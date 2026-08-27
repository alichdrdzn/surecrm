import FreepbxSettings from "../model/FreepbxSettings.js";
import User from "../model/User.js";
import freepbxService from "../services/freepbxService.js";
import jwt from "jsonwebtoken";

// ---------------------------------------------------------------------- //
// Guards                                                                  //
// ---------------------------------------------------------------------- //

/** Allow only CRM admins (token carries userId -> lookup role). */
async function requireAdmin(req, res, next) {
    try {
        const user = await User.findById(req.user.userId).select("role deleted");
        if (!user || user.deleted || user.role !== "admin") {
            return res.status(403).json({ message: "Admin access required" });
        }
        req.currentUser = user;
        next();
    } catch (err) {
        return res.status(500).json({ message: "An error occurred" });
    }
}

// ---------------------------------------------------------------------- //
// Admin settings                                                          //
// ---------------------------------------------------------------------- //

/** Never leak the AMI secret to the browser. */
function _sanitize(doc) {
    if (!doc) return null;
    const o = doc.toObject();
    o.hasSecret = Boolean(o.secret);
    delete o.secret;
    o.hasSshPassword = Boolean(o.sshPassword || process.env.FREEPBX_SSH_PASSWORD);
    delete o.sshPassword;
    return o;
}

const getSettings = async (req, res) => {
    try {
        let doc = await FreepbxSettings.findOne({ deleted: false });
        if (!doc) doc = await FreepbxSettings.create({});
        res.status(200).json({ data: _sanitize(doc), status: freepbxService.getStatus() });
    } catch (err) {
        res.status(500).json({ message: "Failed to load settings" });
    }
};

/**
 * Create/update the singleton settings. If `secret` is sent empty, the
 * previously stored secret is preserved (so the UI can leave it blank).
 * Saving reconciles the live AMI connection immediately.
 */
const saveSettings = async (req, res) => {
    try {
        const b = req.body || {};
        if (b.enabled && (!b.host || !b.username)) {
            return res.status(400).json({ message: "Host and username are required when enabling the integration" });
        }

        let doc = await FreepbxSettings.findOne({ deleted: false });
        if (!doc) doc = new FreepbxSettings();

        const fields = [
            "enabled", "host", "username", "dialContext", "countryCodesToStrip",
            "nationalPrefixToStrip", "recordingUrlBase", "recordingUrlPattern",
            "sshUser", "spoolDir",
        ];
        for (const f of fields) {
            if (b[f] !== undefined) doc[f] = b[f];
        }
        if (b.port !== undefined) doc.port = Number(b.port) || 5038;
        if (b.sshPort !== undefined) doc.sshPort = Number(b.sshPort) || 22;
        if (b.dialTimeout !== undefined) doc.dialTimeout = Number(b.dialTimeout) || 45;
        if (b.matchDigits !== undefined) doc.matchDigits = Number(b.matchDigits) || 9;
        // Empty secret => keep existing one
        if (typeof b.secret === "string" && b.secret.length > 0) doc.secret = b.secret;
        // Same "empty means keep" semantics for the SSH password
        if (typeof b.sshPassword === "string" && b.sshPassword.length > 0) doc.sshPassword = b.sshPassword;

        doc.modifiedOn = new Date();
        await doc.save();

        const result = await freepbxService.reloadSettings();
        await freepbxService.refreshAgentExtensions().catch(() => {});

        res.status(200).json({
            data: _sanitize(doc),
            engine: result,
            message: result.enabled
                ? result.connected
                    ? "Settings saved - FreePBX connected"
                    : "Settings saved - connecting to FreePBX..."
                : "Settings saved - integration disabled",
        });
    } catch (err) {
        res.status(500).json({ message: err.message || "Failed to save settings" });
    }
};

/** Live AMI login probe. Accepts unsaved form values or tests saved ones. */
const testConnection = async (req, res) => {
    try {
        const result = await freepbxService.testConnection(req.body || {});
        res.status(result.ok ? 200 : 400).json(result);
    } catch (err) {
        res.status(500).json({ ok: false, message: err.message });
    }
};

// ---------------------------------------------------------------------- //
// Authenticated endpoints                                                 //
// ---------------------------------------------------------------------- //

const status = async (req, res) => {
    res.status(200).json({ data: freepbxService.getStatus() });
};

const livecalls = async (req, res) => {
    try {
        const data = await freepbxService.getLiveCalls();
        res.status(200).json({ data: data.calls });
    } catch (err) {
        res.status(500).json({ message: "Failed to list live calls" });
    }
};

/** Current user's telephony profile (extension etc.). */
const me = async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select("firstName lastName extension");
        res.status(200).json({
            data: user ? { extension: user.extension || "" } : { extension: "" },
            pbx: freepbxService.getStatus(),
        });
    } catch (err) {
        res.status(500).json({ message: "An error occurred" });
    }
};

/** Update just the caller's own extension (used by the profile UX). */
const setMyExtension = async (req, res) => {
    try {
        const ext = String((req.body || {}).extension || "").trim();
        if (ext && !/^[0-9*#+]{1,12}$/.test(ext)) {
            return res.status(400).json({ message: "Invalid extension format" });
        }
        const user = await User.findByIdAndUpdate(
            req.user.userId,
            { extension: ext || null },
            { new: true }
        ).select("firstName lastName extension");
        await freepbxService.refreshAgentExtensions().catch(() => {});
        res.status(200).json({ data: { extension: (user && user.extension) || "" }, message: "Extension updated" });
    } catch (err) {
        res.status(500).json({ message: "Failed to update extension" });
    }
};

/** Click-to-call: rings MY extension, then dials `number`. */
const originate = async (req, res) => {
    try {
        const me_ = await User.findById(req.user.userId).select("extension role");
        let ext = me_ && me_.extension;
        // Admins may place a call on behalf of a specific extension
        if ((!ext || !String(ext).trim()) && req.body.extension) {
            if (!me_ || me_.role !== "admin") {
                return res.status(400).json({ message: "No extension assigned to your account" });
            }
            ext = req.body.extension;
        }
        if (!ext || !String(ext).trim()) {
            return res.status(400).json({ message: "No extension assigned to your account" });
        }

        const doc = await freepbxService.originate({
            agentUserId: req.user.userId,
            agentExtension: String(ext).trim(),
            number: req.body.number,
            lead_id: req.body.lead_id,
            contact_id: req.body.contact_id,
            subject: req.body.subject,
        });
        res.status(200).json({ data: doc, message: "Call placed - answer your phone to connect" });
    } catch (err) {
        res.status(err.status || 500).json({ message: err.message || "Failed to place call" });
    }
};

// ---------------------------------------------------------------------- //
// Server-Sent Events stream                                               //
// ---------------------------------------------------------------------- //

/**
 * Real-time event stream. Browsers cannot set Authorization headers on
 * EventSource, so the JWT is accepted via ?token= instead.
 */
const events = async (req, res) => {
    let payload = null;
    try {
        payload = jwt.verify(String(req.query.token || ""), "secret_key");
    } catch (err) {
        return res.status(401).end();
    }
    try {
        const user = await User.findById(payload.userId).select("extension role");
        const unregister = freepbxService.addSseClient({
            userId: String(payload.userId),
            extension: user ? user.extension : "",
            role: user ? user.role : "",
            res,
        });
        req.on("close", unregister);
    } catch (err) {
        res.status(500).end();
    }
};

export default {
    requireAdmin,
    getSettings,
    saveSettings,
    testConnection,
    status,
    livecalls,
    me,
    setMyExtension,
    originate,
    events,
};

