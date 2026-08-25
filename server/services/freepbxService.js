import FreepbxSettings from "../model/FreepbxSettings.js";
import Calls from "../model/Calls.js";
import Lead from "../model/Lead.js";
import Contact from "../model/Contact.js";
import User from "../model/User.js";
import AmiClient, { AMI_STATE } from "../utils/amiClient.js";

/**
 * FreePBX integration service.
 *
 * Fixed architecture: the ONLY integration surface is the FreePBX control
 * plane (Asterisk Manager Interface). Everything topology-specific
 * (trunks, gateways, analog ports) stays inside FreePBX - this service only
 * ever sees extensions and phone numbers.
 *
 * Responsibilities:
 *   - own the AMI connection lifecycle (start/stop/reload on settings change)
 *   - track live channels/events and turn finished calls into Calls records
 *   - match caller numbers to Leads/Contacts (digit-normalized suffix search)
 *   - click-to-call via AMI Originate (agent extension <-> customer number)
 *   - push incoming-call notifications to agents over SSE
 */

const state = {
    client: null,          // active AmiClient instance
    settings: null,        // cached FreepbxSettings document
    initializing: false,

    channels: new Map(),   // uniqueId -> channel info
    sseClients: new Set(), // {id, userId, extension, res}
    agentExtensions: new Map(), // extension -> {_id, firstName, lastName}

    timers: {
        agentsRefresh: null,
        sseHeartbeat: null,
    },
};

const SSE_HEARTBEAT_MS = 25000;
const AGENTS_REFRESH_MS = 30000;

// ---------------------------------------------------------------------- //
// Settings & lifecycle                                                    //
// ---------------------------------------------------------------------- //

async function getSettings() {
    if (state.settings) return state.settings;
    let doc = await FreepbxSettings.findOne({ deleted: false });
    if (!doc) doc = await FreepbxSettings.create({});
    state.settings = doc;
    return doc;
}

/** Reload settings from DB and reconcile the AMI connection. */
async function reloadSettings() {
    const fresh = await FreepbxSettings.findOne({ deleted: false });
    state.settings = fresh || (await FreepbxSettings.create({}));

    const shouldRun = Boolean(state.settings.enabled);
    const running = Boolean(state.client);
    const targetChanged =
        running &&
        (state.client.host !== state.settings.host ||
            state.client.port !== Number(state.settings.port) ||
            state.client.username !== state.settings.username ||
            state.client.secret !== state.settings.secret);

    if (!shouldRun) {
        if (running) await _stopClient();
        return { enabled: false, connected: false };
    }
    if (!running || targetChanged) {
        await _stopClient();
        _startClient();
    }
    return { enabled: true, connected: isConnected() };
}

function _startClient() {
    const s = state.settings;
    const client = new AmiClient({
        host: s.host,
        port: Number(s.port) || 5038,
        username: s.username,
        secret: s.secret,
        reconnect: true,
    });

    client.on("event", (evt) => {
        try {
            _handleAmiEvent(evt);
        } catch (err) {
            console.error("[freepbx] event handler error:", err.message);
        }
    });
    client.on("state", (st) => console.log(`[freepbx] AMI state -> ${st}`));
    client.on("disconnected", () => console.warn("[freepbx] AMI connection lost; will retry"));
    client.on("log", (level, msg) => console[level === "warn" ? "warn" : "log"](`[freepbx] ${msg}`));

    state.client = client;
    state.channels.clear();
    client.connect().catch((err) => {
        console.error(`[freepbx] initial AMI connect failed: ${err.message}`);
        // client keeps retrying internally while enabled
    });
}

async function _stopClient() {
    const client = state.client;
    state.client = null;
    state.channels.clear();
    if (client) {
        client.removeAllListeners();
        try {
            await client.destroy();
        } catch (e) {
            /* noop */
        }
    }
}

function isConnected() {
    return Boolean(state.client && state.client.state === AMI_STATE.READY);
}

/** Boot hook. Never throws - a PBX problem must not take the CRM down. */
async function init() {
    if (state.initializing) return;
    state.initializing = true;
    try {
        await getSettings();
        _startTimers();
        await refreshAgentExtensions();
        await reloadSettings();
        console.log("[freepbx] service initialized");
    } catch (err) {
        console.error("[freepbx] init error:", err.message);
    } finally {
        state.initializing = false;
    }
}

function _startTimers() {
    if (!state.timers.agentsRefresh) {
        state.timers.agentsRefresh = setInterval(() => {
            refreshAgentExtensions().catch(() => {});
        }, AGENTS_REFRESH_MS);
    }
    if (!state.timers.sseHeartbeat) {
        state.timers.sseHeartbeat = setInterval(() => {
            for (const c of state.sseClients) {
                try {
                    c.res.write(": heartbeat\n\n");
                } catch (e) {
                    /* close handler cleans up */
                }
            }
        }, SSE_HEARTBEAT_MS);
    }
}

// ---------------------------------------------------------------------- //
// Agent directory                                                         //
// ---------------------------------------------------------------------- //

/** Cache of users that have an extension configured (extension -> user). */
async function refreshAgentExtensions() {
    const users = await User.find({ deleted: false, extension: { $nin: [null, ""] } })
        .select("firstName lastName extension");
    const map = new Map();
    for (const u of users) {
        const ext = String(u.extension || "").trim();
        if (ext) map.set(ext, { _id: String(u._id), firstName: u.firstName, lastName: u.lastName });
    }
    state.agentExtensions = map;
    return map;
}

// ---------------------------------------------------------------------- //
// AMI event tracking                                                      //
// ---------------------------------------------------------------------- //

function _channelInfoFromEvent(evt) {
    return {
        uniqueId: evt.Uniqueid || evt.UniqueID || evt.DestUniqueID || "",
        channelName: evt.Channel || evt.DestChannel || "",
        callerIdNum: evt.CallerIDNum || evt.DestCallerIDNum || "",
        callerIdName: evt.CallerIDName || evt.DestCallerIDName || "",
        exten: evt.Exten || evt.DestExten || "",
        context: evt.Context || evt.DestContext || "",
        linkedId: evt.Linkedid || evt.LinkedID || evt.DestLinkedid || "",
        startAt: Date.now(),
        answerAt: null,
    };
}

function _updateChannel(evt) {
    const id = evt.Uniqueid || evt.UniqueID || evt.DestUniqueID;
    if (!id) return null;
    let ch = state.channels.get(id);
    if (!ch) {
        ch = _channelInfoFromEvent(evt);
        ch.uniqueId = id;
        state.channels.set(id, ch);
    }
    // Enrich fields as later events reveal them
    if (evt.Channel) ch.channelName = evt.Channel;
    if (evt.DestChannel && !ch.channelName) ch.channelName = evt.DestChannel;
    if (evt.CallerIDNum) ch.callerIdNum = evt.CallerIDNum;
    else if (evt.DestCallerIDNum && !ch.callerIdNum) ch.callerIdNum = evt.DestCallerIDNum;
    if (evt.Exten) ch.exten = evt.Exten;
    else if (evt.DestExten && !ch.exten) ch.exten = evt.DestExten;
    if (evt.Context) ch.context = evt.Context;
    else if (evt.DestContext && !ch.context) ch.context = evt.DestContext;
    if (evt.Linkedid || evt.LinkedID) ch.linkedId = evt.Linkedid || evt.LinkedID;
    else if ((evt.DestLinkedid || evt.DestLinkedID) && !ch.linkedId) ch.linkedId = evt.DestLinkedid || evt.DestLinkedID;
    return ch;
}

/**
 * Agent extensions involved in the same call as `ch` (same Linkedid), plus
 * the extension of the channel itself. Used to scope call_ended pushes so
 * unrelated agents do not get toasts/popups for other people's calls.
 */
function _relatedExtensions(ch) {
    const exts = new Set();
    const addIfAgent = (name) => {
        const e = String(ch.exten || _extenFromChannelName(name));
        if (e && state.agentExtensions.has(e)) exts.add(e);
    };
    addIfAgent(ch.channelName);
    const lid = ch.linkedId;
    if (lid) {
        for (const [, other] of state.channels) {
            if (other === ch || !other.linkedId || other.linkedId !== lid) continue;
            const e = String(other.exten || _extenFromChannelName(other.channelName));
            if (e && state.agentExtensions.has(e)) exts.add(e);
        }
    }
    return Array.from(exts);
}


/**
 * Extract a dialed extension from a channel name such as:
 *   PJSIP/1000-0000001 | Local/1000@from-internal-0002;2 | SIP/trunk-a-123
 */
function _extenFromChannelName(name) {
    if (!name) return "";
    const m = name.match(/\/([0-9]{2,12})(?:@|-|$|;)/);
    return m ? m[1] : "";
}

function _handleAmiEvent(evt) {
    const event = (evt.Event || "").toLowerCase();

    switch (event) {
        case "newchannel":
            _updateChannel(evt);
            break;

        case "newstate": {
            const ch = _updateChannel(evt);
            if (ch && /up/i.test(evt.ChannelStateDesc || "") && !ch.answerAt) {
                ch.answerAt = Date.now();
            }
            break;
        }

        case "dialbegin":
        case "dial": {
            const destId = evt.DestUniqueID || evt.DestUniqueid;
            const destCh = destId ? _updateChannel({ ...evt, Uniqueid: undefined, UniqueID: undefined }) : null;
            if (destCh && destId) destCh.uniqueId = destId;

            const callerNum = evt.CallerIDNum || evt.DestCallerIDNum || "";
            const destExten =
                evt.DestExten ||
                (destCh && destCh.exten) ||
                _extenFromChannelName(evt.DestChannel || "");

            _maybeNotifyIncomingCall({ callerNum, callerName: evt.CallerIDName || "", destExten });
            break;
        }

        case "hangup": {
            const id = evt.Uniqueid || evt.UniqueID;
            const ch = state.channels.get(id) || _updateChannel(evt);
            if (ch) {
                ch.hangupCause = evt.Cause || "";
                ch.hangupCauseTxt = evt["Cause-txt"] || evt.Cause_txt || "";
                const relatedExts = _relatedExtensions(ch);
                _finalizeChannel(ch, relatedExts).catch((err) =>
                    console.error("[freepbx] finalize call failed:", err.message)
                );
                state.channels.delete(id);
            }
            break;
        }

        default:
            break;
    }
}

// ---------------------------------------------------------------------- //
// Number normalization & CRM matching                                     //
// ---------------------------------------------------------------------- //

/** Keep digits plus dialable symbols used by PBX feature codes. */
function _digitsOnly(value) {
    return String(value || "").replace(/[^\d*#+]/g, "");
}

/**
 * Normalize a phone number for matching:
 *   strip symbols -> strip country code(s) -> strip national prefix ->
 *   keep last `matchDigits` digits.
 */
function normalizeNumber(rawNumber, settings) {
    let num = _digitsOnly(rawNumber);
    if (!num) return "";

    const ccs = String(settings.countryCodesToStrip || "")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean);
    for (const cc of ccs) {
        if (num.length > cc.length && num.startsWith(cc)) {
            const rest = num.slice(cc.length);
            // Only treat as country code when what remains looks like a full
            // national number (national prefix or reasonable length)
            if (settings.nationalPrefixToStrip && rest.startsWith(settings.nationalPrefixToStrip)) {
                num = rest.slice(settings.nationalPrefixToStrip.length);
            } else if (rest.length >= 8) {
                num = rest;
            }
            break;
        }
    }
    if (!ccs.length && settings.nationalPrefixToStrip && num.startsWith(settings.nationalPrefixToStrip)) {
        const stripped = num.slice(settings.nationalPrefixToStrip.length);
        if (stripped.length >= 8) num = stripped;
    }

    const n = Math.max(3, Number(settings.matchDigits) || 9);
    return num.length > n ? num.slice(-n) : num;
}

/**
 * Find the Lead or Contact whose phone fields end with the normalized
 * caller/callee number. Leads win over Contacts (prospects first).
 */
async function findCrmMatch(rawNumber) {
    if (!rawNumber) return null;
    const settings = await getSettings();
    const norm = normalizeNumber(rawNumber, settings);
    if (!norm || norm.length < 4) return null;

    const rx = new RegExp(`${norm}$`);
    let doc = await Lead.findOne({
        deleted: false,
        $or: [{ phoneNumber: rx }, { alternatePhoneNumber: rx }],
    }).select("firstName lastName phoneNumber");
    if (doc) return { type: "Lead", id: String(doc._id), label: `${doc.firstName} ${doc.lastName}` };

    doc = await Contact.findOne({
        deleted: false,
        $or: [{ phoneNumber: rx }, { alternatePhoneNumber: rx }],
    }).select("firstName lastName phoneNumber");
    if (doc) return { type: "Contact", id: String(doc._id), label: `${doc.firstName} ${doc.lastName}` };

    return null;
}

// ---------------------------------------------------------------------- //
// Incoming-call screen pop                                                //
// ---------------------------------------------------------------------- //

/**
 * Called on DialBegin. If the dialed party is one of our agents'
 * extensions and the calling party carries an (external) number, push an
 * "incoming_call" event to that agent's SSE streams.
 */
async function _maybeNotifyIncomingCall({ callerNum, callerName, destExten }) {
    try {
        if (!callerNum || !destExten) return;
        if (!state.agentExtensions.has(String(destExten))) return;
        // Ignore internal-to-internal dials (extension calling extension)
        if (state.agentExtensions.has(String(callerNum))) return;

        const match = await findCrmMatch(callerNum);
        pushToExtensions([String(destExten)], "incoming_call", {
            from: callerNum,
            fromName: callerName || "",
            extension: String(destExten),
            match, // {type, id, label} | null
            at: new Date().toISOString(),
        });
    } catch (err) {
        console.error("[freepbx] incoming-call notify failed:", err.message);
    }
}

// ---------------------------------------------------------------------- //
// Call finalization (persist into the Calls collection)                   //
// ---------------------------------------------------------------------- //

function _formatDuration(ms) {
    const totalSec = Math.max(0, Math.round(ms / 1000));
    const h = String(Math.floor(totalSec / 3600)).padStart(2, "0");
    const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, "0");
    const s = String(totalSec % 60).padStart(2, "0");
    return `${h}:${m}:${s}`;
}

function _disposition(ch) {
    if (ch.answerAt) return "Answered";
    switch (ch.hangupCause) {
        case "17":
            return "Busy";
        case "16":
        case "18":
        case "19":
            return ch.direction === "Inbound" ? "Missed" : "No Answer";
        default:
            return "Failed";
    }
}

// ---------------------------------------------------------------------- //
// Channel -> persisted call                                               //
// ---------------------------------------------------------------------- //

/**
 * Heuristic topology-independent direction detection.
 * Inbound trunk channels in FreePBX arrive in contexts such as
 * "from-trunk", "from-pstn" or "from-sip-external"; agent/outbound legs use
 * "from-internal". We never reference trunks - only these generic contexts.
 */
function _detectDirection(ch) {
    const ctx = String(ch.context || "").toLowerCase();
    if (/^from-(trunk|pstn|external|sip-external)/.test(ctx)) return "Inbound";
    if (ctx.includes("from-internal")) return "Outbound";
    // Local/ channel with an @context suffix reveals the dial context
    const atCtx = String(ch.channelName || "").toLowerCase();
    if (atCtx.includes("@from-internal")) return "Outbound";
    // Fall back: has a dialed exten and a device caller => outbound
    if (ch.exten && ch.callerIdNum) return "Outbound";
    return "Inbound";
}

/** External party of the call (what the CRM cares about). */
function _externalNumber(ch) {
    if (ch.direction === "Inbound") {
        // For inbound, callerIdNum is external unless it's an internal ext
        if (ch.callerIdNum && !state.agentExtensions.has(String(ch.callerIdNum))) {
            return ch.callerIdNum;
        }
        return "";
    }
    return ch.exten || "";
}

/**
 * Build the playback URL for a finished call from the admin settings.
 *   recordingUrlBase    e.g. https://pbx.example.com  (required; feature off
 *                       entirely when empty)
 *   recordingUrlPattern optional filename template relative to the base (or a
 *                       full http(s) URL on its own). Placeholders:
 *                       {uniqueId} {number} {ext} {date} {time}
 */
function _buildRecordingUrl(settings, ch, number) {
    const base = String(settings.recordingUrlBase || "").trim();
    if (!base) return "";

    let pattern = String(settings.recordingUrlPattern || "").trim() || "{uniqueId}.wav";
    const d = new Date(ch.startAt);
    const p2 = (n) => String(n).padStart(2, "0");
    const replacements = {
        uniqueId: ch.uniqueId || "",
        number: number || "",
        ext: ch.exten || _extenFromChannelName(ch.channelName) || "",
        date: `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}`,
        time: `${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`,
    };
    for (const [k, v] of Object.entries(replacements)) {
        pattern = pattern.split(`{${k}}`).join(v);
    }
    if (/^https?:\/\//i.test(pattern)) return pattern;
    return `${base.replace(/\/+$/, "")}/${pattern.replace(/^\/+/, "")}`;
}

/**
 * Persist one finished PBX channel as a record in the existing Calls model.
 * Only meaningful calls are stored (an external party must exist).
 *
 * @param {object} ch tracked channel
 * @param {string[]} [relatedExts] agent extensions involved in this call
 */
async function _finalizeChannel(ch, relatedExts) {
    try {
        ch.direction = _detectDirection(ch);
        const number = _externalNumber(ch);
        if (!number) return; // purely internal / system channel

        const settings = await getSettings();
        const match = await findCrmMatch(number);
        const endedAt = Date.now();
        const talkMs = ch.answerAt ? Math.max(0, endedAt - ch.answerAt) : 0;

        const doc = new Calls({
            subject:
                match && match.label
                    ? `${ch.direction} call - ${match.label}`
                    : `${ch.direction} call from/to ${number}`,
            status: _disposition(ch),
            startDateTime: new Date(ch.startAt).toISOString(),
            duration: _formatDuration(talkMs),
            relatedTo: match ? match.type : "",
            lead_id: match && match.type === "Lead" ? match.id : undefined,
            contact_id: match && match.type === "Contact" ? match.id : undefined,
            note: `Auto-logged from FreePBX. Channel: ${ch.channelName}. Cause: ${ch.hangupCauseTxt || ch.hangupCause || "-"}`,
            source: "freepbx",
            direction: ch.direction,
            phoneNumber: number,
            pbxUniqueId: ch.uniqueId,
            pbxChannel: ch.channelName,
            recordingUrl: _buildRecordingUrl(settings, ch, number),
            createdBy: null,
        });
        const saved = await doc.save();

        pushCallEnded(
            {
                id: String(saved._id),
                subject: saved.subject,
                status: saved.status,
                direction: ch.direction,
                number,
                duration: saved.duration,
                match,
            },
            relatedExts && relatedExts.length ? relatedExts : []
        );
        return saved;
    } catch (err) {
        console.error("[freepbx] persisting call failed:", err.message);
        return null;
    }
}

// ---------------------------------------------------------------------- //
// Click-to-call (AMI Originate)                                           //
// ---------------------------------------------------------------------- //

/**
 * Ring the agent's extension; when they pick up, place the call to `number`.
 * Uses Local/<ext>@<dialContext> so ANY endpoint technology behind the
 * extension works (PJSIP phone, softphone, analog ATA port ...).
 *
 * @returns the pre-created Calls document
 */
async function originate({ agentUserId, agentExtension, number, lead_id, contact_id, subject }) {
    if (!isConnected()) {
        throw Object.assign(new Error("FreePBX integration is not connected"), { status: 503 });
    }
    const settings = state.settings;
    const digits = _digitsOnly(number);
    if (!digits) throw Object.assign(new Error("A valid phone number is required"), { status: 400 });

    // Pre-create the call so the UI gets an id immediately; events finalize it
    const doc = new Calls({
        subject: subject || `Outbound call to ${number}`,
        status: "Ringing",
        startDateTime: new Date().toISOString(),
        duration: "00:00:00",
        relatedTo: lead_id ? "Lead" : contact_id ? "Contact" : "",
        lead_id: lead_id || undefined,
        contact_id: contact_id || undefined,
        note: "Click-to-call via FreePBX",
        source: "freepbx",
        phoneNumber: number,
        createdBy: agentUserId || null,
    });
    await doc.save();

    try {
        await state.client.send({
            Action: "Originate",
            Channel: `Local/${agentExtension}@${settings.dialContext}`,
            Context: settings.dialContext,
            Exten: digits,
            Priority: "1",
            CallerID: `SureCRM <${digits}>`,
            Timeout: String(Math.max(10, Number(settings.dialTimeout) || 45)),
            Async: "true",
            Variable: "__SURECRMCALLID=" + String(doc._id),
        });
    } catch (err) {
        await Calls.findByIdAndUpdate(doc._id, { status: "Failed", note: `AMI Originate failed: ${err.message}` });
        throw Object.assign(new Error(`PBX rejected the call: ${err.message}`), { status: 502 });
    }
    return doc;
}

// ---------------------------------------------------------------------- //
// Server-Sent Events (real-time push to browsers)                         //
// ---------------------------------------------------------------------- //

/**
 * Register one SSE client. Returns an unregister function.
 * `role` ("admin" | "user") is used to scope per-call events to admins as a
 * fallback when no specific agent extension is known for a call.
 */
function addSseClient({ userId, extension, role, res }) {
    const client = {
        id: `${userId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        userId,
        extension: extension ? String(extension) : "",
        role: role ? String(role) : "",
        res,
    };
    state.sseClients.add(client);

    res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
    });
    res.write("retry: 5000\n\n");
    res.write(`event: connected\ndata: ${JSON.stringify({ ok: true, extension: client.extension })}\n\n`);

    return () => state.sseClients.delete(client);
}

function _sseWrite(client, event, payload) {
    try {
        client.res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch (e) {
        state.sseClients.delete(client);
    }
}

/** Send an event only to SSE clients whose user has the given extensions. */
function pushToExtensions(extensions, event, payload) {
    const wanted = new Set(extensions.map(String));
    for (const c of state.sseClients) {
        if (c.extension && wanted.has(c.extension)) _sseWrite(c, event, payload);
    }
}

/** Broadcast an event to every connected browser. */
function pushAll(event, payload) {
    for (const c of state.sseClients) _sseWrite(c, event, payload);
}

/**
 * Call-finished event scoped to the people actually involved:
 *  - every SSE client whose extension took part in the call
 *  - plus all admins as a fallback (so a call is never silently dropped)
 */
function pushCallEnded(payload, extensions = []) {
    const wanted = new Set((extensions || []).map(String));
    let delivered = 0;
    for (const c of state.sseClients) {
        if ((c.extension && wanted.has(c.extension)) || c.role === "admin") {
            _sseWrite(c, "call_ended", payload);
            delivered += 1;
        }
    }
    return delivered;
}

// ---------------------------------------------------------------------- //
// Introspection for APIs                                                  //
// ---------------------------------------------------------------------- //

function getStatus() {
    return {
        enabled: Boolean(state.settings && state.settings.enabled),
        connected: isConnected(),
        amiState: state.client ? state.client.state : AMI_STATE.DISCONNECTED,
        host: state.settings ? state.settings.host : null,
        port: state.settings ? state.settings.port : null,
        banner: (state.client && state.client.banner) || null,
        activeChannels: state.channels.size,
        sseClients: state.sseClients.size,
        agentExtensions: Array.from(state.agentExtensions.keys()),
    };
}

/** Snapshot of channels still on the PBX right now (live-calls panel). */
async function getLiveCalls() {
    const settings = await getSettings();
    const now = Date.now();
    const items = [];
    for (const [, ch] of state.channels) {
        if (!ch.channelName) continue;
        const direction = ch.direction || _detectDirection(ch);
        const number = _externalNumber(ch);
        // Skip pure internal legs without any external party
        if (!number && !state.agentExtensions.has(_extenFromChannelName(ch.channelName))) continue;
        items.push({
            uniqueId: ch.uniqueId,
            channel: ch.channelName,
            direction,
            number,
            matchedName: null,
            exten: ch.exten || _extenFromChannelName(ch.channelName),
            agent: state.agentExtensions.get(String(ch.exten || "")) || null,
            state: ch.answerAt ? "Up" : "Ringing",
            startAt: new Date(ch.startAt).toISOString(),
            durationSec: Math.round((now - (ch.answerAt || ch.startAt)) / 1000),
        });
    }
    // Resolve CRM matches best-effort (do not fail the endpoint on lookup errors)
    await Promise.all(
        items.map(async (it) => {
            if (!it.number) return;
            try {
                const m = await findCrmMatch(it.number);
                it.matchedName = m ? m.label : null;
                it.matchType = m ? m.type : null;
                it.matchId = m ? m.id : null;
            } catch (e) {
                /* ignore */
            }
        })
    );
    return { settings: { matchDigits: settings.matchDigits }, calls: items };
}

/**
 * Live login probe used by POST /freepbx/settings/test.
 * Opens a throwaway connection; never touches the running engine.
 */
async function testConnection(override = {}) {
    const base = override.useSaved ? await getSettings() : {};
    const opts = {
        host: override.host ?? base.host ?? "",
        port: Number(override.port ?? base.port ?? 5038),
        username: override.username ?? base.username ?? "",
        secret: override.secret ?? base.secret ?? "",
        reconnect: false,
    };
    if (!opts.host || !opts.username) {
        return { ok: false, message: "Host and username are required" };
    }

    const client = new AmiClient(opts);
    const started = Date.now();
    try {
        await Promise.race([
            client.connect(),
            new Promise((_, rej) => setTimeout(() => rej(new Error("Connection timed out")), 10000)),
        ]);
        const version = client.banner || "connected";
        await client.destroy();
        return { ok: true, message: "Authentication accepted", version, elapsedMs: Date.now() - started };
    } catch (err) {
        try {
            await client.destroy();
        } catch (e) {
            /* noop */
        }
        return { ok: false, message: err.message, elapsedMs: Date.now() - started };
    }
}

export default {
    init,
    reloadSettings,
    refreshAgentExtensions,
    originate,
    findCrmMatch,
    normalizeNumber,
    getStatus,
    getLiveCalls,
    isConnected,
    addSseClient,
    pushAll,
    pushCallEnded,
    pushToExtensions,
    testConnection,
};




