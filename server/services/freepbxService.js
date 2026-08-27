import FreepbxSettings from "../model/FreepbxSettings.js";
import Calls from "../model/Calls.js";
import Lead from "../model/Lead.js";
import Contact from "../model/Contact.js";
import User from "../model/User.js";
import AmiClient, { AMI_STATE } from "../utils/amiClient.js";
import { pbx } from "../utils/logger.js";
import fs from "fs";
import os from "os";
import path from "path";
import { execFile } from "child_process";

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
    pendingOrigins: new Map(), // agentExt -> {number, docId, at} (ring legs of calls placed from the CRM)
    finalizedLinks: new Map(), // linkedId -> timestamp (calls already persisted; channels end one-by-one)
    callsByLink: new Map(),    // linkedId -> live call lifecycle {docId, number, direction, agentExts, answeredAt, ...}

    timers: {
        agentsRefresh: null,
        sseHeartbeat: null,
    },
};

const SSE_HEARTBEAT_MS = 25000;
const AGENTS_REFRESH_MS = 30000;
/** How long a pending click-to-call ring leg stays recognizable as outgoing. */
const ORIGIN_TTL_MS = 120000;

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
            pbx.error("event handler error:", err.message);
        }
    });
    client.on("state", (st) => pbx.info(`AMI state -> ${st}`));
    client.on("disconnected", () => pbx.warn("AMI connection lost; will retry"));
    client.on("log", (level, msg) => pbx[level === "warn" ? "warn" : "info"](msg));

    state.client = client;
    state.channels.clear();
    client.connect().catch((err) => {
        pbx.error(`initial AMI connect failed: ${err.message}`);
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

        // Boot cleanup: click-to-call placeholders left "Ringing" because a
        // restart interrupted the call before any AMI Hangup was observed.
        // Anything older than 15 min can no longer be a live ring.
        try {
            const res = await Calls.updateMany(
                {
                    source: "freepbx",
                    status: "Ringing",
                    deleted: false,
                    createdOn: { $lt: new Date(Date.now() - 15 * 60000) },
                },
                {
                    $set: {
                        status: "Failed",
                        note: "Auto-closed on startup: the call never completed (CRM restarted mid-call)",
                        modifiedOn: new Date(),
                    },
                }
            );
            if (res.modifiedCount > 0) pbx.info(`closed ${res.modifiedCount} stale ringing placeholder(s)`);
        } catch (e) {
            /* non-fatal */
        }

        pbx.info("service initialized");
    } catch (err) {
        pbx.error("init error:", err.message);
    } finally {
        state.initializing = false;
    }
}

function _startTimers() {
    if (!state.timers.agentsRefresh) {
        state.timers.agentsRefresh = setInterval(() => {
            refreshAgentExtensions().catch(() => {});
            _sweepCallStates();
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
    // An extension counts only if the channel itself resolves to it. Note
    // ch.exten may hold DIALED DIGITS (dial-begin enrichment), so always fall
    // back to the name-derived extension when exten is not an agent ext.
    const consider = (c) => {
        const e = String(
            c.exten && state.agentExtensions.has(String(c.exten))
                ? c.exten
                : _extenFromChannelName(c.channelName)
        );
        if (e && state.agentExtensions.has(e)) exts.add(e);
    };
    consider(ch);
    const lid = ch.linkedId;
    if (lid) {
        for (const [, other] of state.channels) {
            if (other === ch || !other.linkedId || other.linkedId !== lid) continue;
            consider(other);
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

/** True when the channel belongs to one of our agents' extensions. */
function _isAgentChannel(ch) {
    if (!ch) return false;
    if (ch.exten && state.agentExtensions.has(String(ch.exten))) return true;
    const nameExt = _extenFromChannelName(ch.channelName);
    return Boolean(nameExt && state.agentExtensions.has(nameExt));
}

/** Still-tracked sibling channels of the same call (shared Linkedid). */
function _linkedPeers(ch) {
    if (!ch.linkedId) return [];
    const peers = [];
    for (const [, other] of state.channels) {
        if (other !== ch && other.linkedId && other.linkedId === ch.linkedId) peers.push(other);
    }
    return peers;
}

/**
 * Live lifecycle record of an in-flight call, keyed by Asterisk Linkedid.
 * Gives the app real awareness of what happens to a call:
 *   ringing -> answered ("call_answered" SSE) -> ended ("call_ended" SSE)
 */
function _ensureCallState(linkedId) {
    if (!linkedId) return null;
    const key = String(linkedId);
    let cs = state.callsByLink.get(key);
    if (!cs) {
        cs = {
            linkedId: key,
            docId: "",          // Calls document pre-created by click-to-call (if any)
            number: "",         // external party
            direction: "",      // Inbound | Outbound
            agentExts: new Set(),
            startedAt: Date.now(),
            answeredAt: null,
            answeredPushed: false,
        };
        state.callsByLink.set(key, cs);
    }
    return cs;
}

/** Every agent extension currently involved in the linked call. */
function _agentsOnLink(linkedId) {
    const exts = new Set();
    if (!linkedId) return exts;
    const cs = state.callsByLink.get(String(linkedId));
    if (cs) for (const e of cs.agentExts) exts.add(e);
    for (const [, ch] of state.channels) {
        if (!ch.linkedId || String(ch.linkedId) !== String(linkedId)) continue;
        const e = String(ch.exten || _extenFromChannelName(ch.channelName));
        if (e && state.agentExtensions.has(e)) exts.add(e);
    }
    return exts;
}

/**
 * First-answer transition of a call. Pushes "call_answered" ONCE to every
 * involved agent so their UI switches from "Calling..." to Connected.
 */
function _markCallAnswered(linkedId, extra = {}) {
    const cs = _ensureCallState(linkedId);
    if (!cs || cs.answeredPushed) return;
    cs.answeredPushed = true;
    cs.answeredAt = Date.now();
    if (!cs.number && extra.number) cs.number = extra.number;
    if (!cs.direction && extra.direction) cs.direction = extra.direction;

    pushToExtensions(Array.from(_agentsOnLink(linkedId)), "call_answered", {
        id: cs.docId,
        number: cs.number,
        direction: cs.direction,
        answeredAt: new Date(cs.answeredAt).toISOString(),
    });
}

/** Drop lifecycle entries of long-gone calls (safety net against leaks). */
function _sweepCallStates() {
    const cutoff = Date.now() - 6 * 3600000;
    for (const [k, cs] of state.callsByLink) {
        if (cs.startedAt < cutoff) state.callsByLink.delete(k);
    }
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
                // The "call_answered" transition fires only when an EXTERNAL
                // party's channel goes Up. Agent-owned legs are excluded:
                // their "Up" means the agent picked up, not that the remote
                // party did (their answerAt is still recorded factually).
                if (_isAgentChannel(ch)) break;
                const num = _externalNumber(ch);
                if (num && ch.linkedId) {
                    const cs = _ensureCallState(ch.linkedId);
                    if (!cs.number) cs.number = num;
                    if (!cs.direction) cs.direction = ch.direction || _detectDirection(ch);
                    _markCallAnswered(ch.linkedId, { number: num });
                }
            }
            break;
        }

        case "dialbegin":
        case "dial": {
            const destId = evt.DestUniqueID || evt.DestUniqueid;
            const destCh = destId ? _updateChannel({ ...evt, Uniqueid: undefined, UniqueID: undefined }) : null;
            if (destCh && destId) destCh.uniqueId = destId;

            // Enrich the DIALING channel as well: for calls placed straight on
            // the phone (outside the CRM) the dialed number only becomes known
            // through these events. Without this the agent leg ends up with no
            // external number and the call is never logged.
            const srcId = evt.Uniqueid || evt.UniqueID;
            const srcCh = srcId ? state.channels.get(srcId) : null;
            if (srcCh) {
                // Adopt the destination number only for our own agents' legs,
                // never for trunk channels receiving inbound calls.
                const nameExt = _extenFromChannelName(srcCh.channelName);
                const srcIsAgent =
                    (nameExt && state.agentExtensions.has(nameExt)) ||
                    state.agentExtensions.has(String(srcCh.callerIdNum));
                let srcExten;
                if (evt.Exten) srcExten = evt.Exten;
                else if (srcIsAgent && evt.DestExten) srcExten = evt.DestExten;
                if (srcExten && !srcCh.exten) srcCh.exten = srcExten;
                const lid = evt.Linkedid || evt.LinkedID;
                if (lid && !srcCh.linkedId) srcCh.linkedId = lid;

                // Seed the live call lifecycle with what we now know
                if (lid) {
                    const cs = _ensureCallState(lid);
                    const agentExt = _extenFromChannelName(srcCh.channelName);
                    if (agentExt && state.agentExtensions.has(agentExt)) cs.agentExts.add(agentExt);
                    const candNum = String(srcCh.exten || "");
                    if (!cs.number && candNum && !state.agentExtensions.has(candNum)) cs.number = candNum;
                    if (!cs.direction) cs.direction = _detectDirection(srcCh);
                }
            }

            const callerNum = evt.CallerIDNum || evt.DestCallerIDNum || "";
            const destExten =
                evt.DestExten ||
                (destCh && destCh.exten) ||
                _extenFromChannelName(evt.DestChannel || "");

            _maybeNotifyIncomingCall({
                callerNum,
                callerName: evt.CallerIDName || "",
                destExten,
                linkedId: evt.Linkedid || evt.LinkedID || "",
            });
            break;
        }

        case "bridgeenter": {
            // Voice is flowing between two channels - strongest "answered"
            // signal. Only treated as THE answer when an external party is on
            // the bridge (agent-pickup bridges must not fire it prematurely).
            const lid = evt.Linkedid || evt.LinkedID || "";
            if (!lid) break;
            let extNum = "";
            for (const uid of [evt.Uniqueid1 || evt.UniqueID1, evt.Uniqueid2 || evt.UniqueID2]) {
                const c = uid ? state.channels.get(uid) : null;
                if (!c) continue;
                const n = _externalNumber({ ...c, direction: c.direction || _detectDirection(c) });
                if (n) {
                    extNum = n;
                    if (!c.answerAt) c.answerAt = Date.now();
                }
            }
            if (extNum) {
                const cs = _ensureCallState(lid);
                if (!cs.number) cs.number = extNum;
                _markCallAnswered(lid, { number: extNum });
            }
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
                    pbx.error("finalize call failed:", err.message)
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
 * Click-to-call bookkeeping. An AMI Originate first rings the AGENT'S OWN
 * extension; without this ledger the DialBegin of that very leg would be
 * misread as an inbound call and the agent would get an "Incoming Call"
 * screen-pop for the number they just dialed out to.
 */
function _rememberOriginate(agentExtension, number, docId) {
    const now = Date.now();
    for (const [k, v] of state.pendingOrigins) {
        if (now - v.at > ORIGIN_TTL_MS) state.pendingOrigins.delete(k);
    }
    state.pendingOrigins.set(String(agentExtension), {
        number: String(number || ""),
        docId: docId ? String(docId) : "",
        at: now,
    });
}

function _forgetOriginate(agentExtension) {
    state.pendingOrigins.delete(String(agentExtension));
}

function _consumePendingOriginate(agentExtension) {
    const key = String(agentExtension);
    const entry = state.pendingOrigins.get(key);
    if (!entry) return null;
    state.pendingOrigins.delete(key);
    if (Date.now() - entry.at > ORIGIN_TTL_MS) return null; // stale - ignore
    return entry;
}

/**
 * Called on DialBegin. If the dialed party is one of our agents'
 * extensions and the calling party carries an (external) number, push an
 * "incoming_call" event to that agent's SSE streams.
 * If instead the ring is the agent-side leg of a call placed from the CRM,
 * push an "outgoing_call" event so the UI reports it as outgoing.
 */
async function _maybeNotifyIncomingCall({ callerNum, callerName, destExten, linkedId }) {
    try {
        if (!callerNum || !destExten) return;
        if (!state.agentExtensions.has(String(destExten))) return;

        // This ring is the agent being called back by their own outbound dial
        const origin = _consumePendingOriginate(destExten);
        if (origin) {
            const outNumber = origin.number || callerNum;
            // Bind the CRM row to the live call lifecycle for later transitions
            const cs = _ensureCallState(linkedId);
            if (cs) {
                cs.docId = origin.docId || "";
                if (!cs.number) cs.number = outNumber;
                if (!cs.direction) cs.direction = "Outbound";
                cs.agentExts.add(String(destExten));
            }
            pushToExtensions([String(destExten)], "outgoing_call", {
                to: outNumber,
                extension: String(destExten),
                match: await findCrmMatch(outNumber),
                callId: origin.docId,
                at: new Date().toISOString(),
            });
            return;
        }

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
        pbx.error("incoming-call notify failed:", err.message);
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
    const dir = ch.direction || _detectDirection(ch);
    // A value that is itself one of our extensions is never the external party
    const isInternal = (n) => n && state.agentExtensions.has(String(n));
    if (dir === "Inbound") {
        if (ch.callerIdNum && !isInternal(ch.callerIdNum)) {
            return ch.callerIdNum;
        }
        return "";
    }
    const num = String(ch.exten || "");
    return num && !isInternal(num) ? num : "";
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
 * Persist one finished PBX call as a record in the existing Calls model.
 *
 * A single call spans several AMI channels (agent leg, trunk leg, local legs)
 * that share a Linkedid. Exactly ONE Calls row is persisted per call:
 *   - the agent's own channel is preferred as the source of truth, so calls
 *     dialed directly on the desk phone (outside SureCRM) are logged too;
 *   - rows are attributed to the user owning the involved extension;
 *   - the pre-created click-to-call row ("Ringing") is completed instead of
 *     being duplicated.
 *
 * @param {object} ch tracked channel that just hung up
 * @param {string[]} [relatedExts] agent extensions involved in this call
 */
async function _finalizeChannel(ch, relatedExts) {
    try {
        // Channels of the same call hang up one-by-one; keep a single row
        if (ch.linkedId && state.finalizedLinks.has(ch.linkedId)) return null;

        const group = [..._linkedPeers(ch), ch];

        // Prefer the agent's own channel: it reliably carries the external
        // number for outbound dials made from the CRM *or* the phone itself.
        let primary = group.find((c) => _isAgentChannel(c)) || ch;
        primary.direction = _detectDirection(primary);
        let number = _externalNumber(primary);
        if (!number) {
            // e.g. inbound ring leg - the external caller is on another channel
            for (const cand of group) {
                if (cand === primary) continue;
                cand.direction = cand.direction || _detectDirection(cand);
                const n = _externalNumber(cand);
                if (n) {
                    primary = cand;
                    number = n;
                    break;
                }
            }
        }

        // The live-lifecycle record (populated by DialBegin for CRM-placed
        // calls) is authoritative: it knows the exact pre-created document.
        const liveCs = primary.linkedId ? state.callsByLink.get(String(primary.linkedId)) : null;
        if (!number && liveCs && liveCs.number) number = liveCs.number;

        // Asterisk's dead Manager-Originate path spawned channels whose exten
        // was literally "s"; without this guard such garbage leaked into new
        // Calls rows. Everything that cannot be tied to real digits AND to an
        // existing click-to-call document is dropped.
        const saneNumber = /^[\d*#+]{3,}$/.test(String(number || ""));
        if (!saneNumber && !(liveCs && liveCs.docId)) return; // not attributable

        // ---- IMMUTABLE SNAPSHOT (taken synchronously, before ANY await) ----
        // Sibling channels of the same call hang up moments later and mutate
        // the shared tracked objects. Everything the disposition/duration is
        // computed from MUST be captured now, not after the DB awaits below.
        const snap = {
            linkedId: primary.linkedId || "",
            uniqueId: primary.uniqueId || "",
            channelName: primary.channelName,
            direction: primary.direction,
            cause: ch.hangupCause || "",       // the channel THAT hung up
            causeTxt: ch.hangupCauseTxt || "",
            answerAt: group.reduce((acc, c) => Math.max(acc, c.answerAt ? Number(c.answerAt) : 0), 0),
            exten: primary.exten || "",
        };
        const disposition = _disposition({ answerAt: snap.answerAt || null, hangupCause: snap.cause, direction: snap.direction });

        if (primary.linkedId) {
            state.finalizedLinks.set(primary.linkedId, Date.now());
            if (state.finalizedLinks.size > 500) {
                const cutoff = Date.now() - 3600000;
                for (const [k, t] of state.finalizedLinks) {
                    if (t < cutoff) state.finalizedLinks.delete(k);
                }
            }
        }

        const settings = await getSettings();
        const match = await findCrmMatch(number);
        const endedAt = Date.now();
        const talkMs = snap.answerAt ? Math.max(0, endedAt - snap.answerAt) : 0;

        // Attribute the call to the user behind the involved extension
        const ownerExt = relatedExts && relatedExts.length ? String(relatedExts[0]) : "";
        const agentUser = ownerExt ? state.agentExtensions.get(ownerExt) : null;

        // A row for this very call may already exist (multi-channel hangups)
        let saved = primary.linkedId
            ? await Calls.findOne({ source: "freepbx", pbxLinkedId: primary.linkedId, deleted: false })
            : null;

        // 1) Bind to the exact click-to-call document tracked on the live
        //    lifecycle (works even when no agent extension was resolved).
        if (!saved && liveCs && liveCs.docId) {
            saved = await Calls.findById(liveCs.docId).catch(() => null);
            if (saved && saved.deleted) saved = null;
        }

        // 2) Legacy heuristic for calls dialed straight on the phone: newest
        //    "Ringing" placeholder of the same agent and number. Guarded so it
        //    can never match on junk like "s".
        if (!saved && agentUser && primary.direction === "Outbound" && saneNumber) {
            saved = await Calls.findOne({
                source: "freepbx",
                direction: "Outbound",
                status: "Ringing",
                deleted: false,
                createdBy: agentUser._id,
                phoneNumber: new RegExp(`${number}$`),
            }).sort({ createdOn: -1 });
        }

        // Never fabricate rows when nothing attributable was found
        if (!saved && !saneNumber && !(liveCs && liveCs.docId)) return;

        const patch = {
            status: disposition,
            duration: _formatDuration(talkMs),
            note: `Auto-logged from FreePBX. Channel: ${snap.channelName}. Cause: ${snap.causeTxt || snap.cause || "-"}`,
            pbxUniqueId: snap.uniqueId,
            pbxLinkedId: snap.linkedId,
            pbxChannel: snap.channelName,
            recordingUrl: _buildRecordingUrl(settings, { ...primary, exten: snap.exten }, number),
            modifiedOn: new Date(),
        };

        if (saved) {
            Object.assign(saved, patch);
            await saved.save();
        } else {
            const doc = new Calls({
                subject:
                    match && match.label
                        ? `${primary.direction} call - ${match.label}`
                        : `${primary.direction} call from/to ${number}`,
                startDateTime: new Date(primary.startAt).toISOString(),
                relatedTo: match ? match.type : "None",
                lead_id: match && match.type === "Lead" ? match.id : undefined,
                contact_id: match && match.type === "Contact" ? match.id : undefined,
                source: "freepbx",
                direction: primary.direction,
                phoneNumber: number,
                createdBy: agentUser ? agentUser._id : null,
                ...patch,
            });
            saved = await doc.save();
        }

        pushCallEnded(
            {
                id: String(saved._id),
                subject: saved.subject,
                status: saved.status,
                direction: primary.direction,
                number,
                duration: saved.duration,
                match,
            },
            relatedExts && relatedExts.length ? relatedExts : []
        );
        // Lifecycle of this call is over - drop it (finalizedLinks keeps dedup)
        if (primary.linkedId) state.callsByLink.delete(String(primary.linkedId));
        return saved;
    } catch (err) {
        pbx.error("persisting call failed:", err.message);
        return null;
    }
}

// ---------------------------------------------------------------------- //
// Click-to-call (call-file delivery)                                      //
// ---------------------------------------------------------------------- //

/**
 * Ring the agent's extension; when they pick up, place the call to `number`.
 *
 * WHY .call FILES AND NOT AMI ORIGINATE:
 * Verified by wire capture on this PBX (2026-08-27): every Manager-API
 * Originate (Channel/Context/Exten or Channel/Application, Local or direct
 * PJSIP tech) sends INVITE and then cancels its own call ~16ms after the
 * 100 Trying arrives - the phone flashes "Ringing" for an instant. The
 * channel is even born at [context,'s',1], which produced bogus rows with
 * phoneNumber 's'. pbx_spool (.call files dropped into
 * /var/spool/asterisk/outgoing) performs the identical agent-first flow
 * through a different execution path and rings reliably on this build.
 *
 * Delivery: scp to /tmp on the PBX, then atomically rename into the spool
 * directory so asterisk never reads a partially written file.
 *
 * @returns the pre-created Calls document
 */
async function originate({ agentUserId, agentExtension, number, lead_id, contact_id, subject }) {
    const settings = await getSettings();
    const digits = _digitsOnly(number);
    if (!digits) throw Object.assign(new Error("A valid phone number is required"), { status: 400 });
    if (!agentExtension) {
        throw Object.assign(new Error("Your user has no PBX extension configured"), { status: 400 });
    }

    // Pre-create the call so the UI gets an id immediately; events finalize it
    const doc = new Calls({
        subject: subject || `Outbound call to ${number}`,
        status: "Ringing",
        startDateTime: new Date().toISOString(),
        duration: "00:00:00",
        relatedTo: lead_id ? "Lead" : contact_id ? "Contact" : "None",
        lead_id: lead_id || undefined,
        contact_id: contact_id || undefined,
        note: "Click-to-call via FreePBX",
        source: "freepbx",
        direction: "Outbound",
        phoneNumber: number,
        createdBy: agentUserId || null,
    });
    await doc.save();

    // Tag the agent-ring leg so it gets reported as OUTGOING (never incoming)
    _rememberOriginate(agentExtension, digits, doc._id);

    try {
        await _deployCallFile(settings, {
            baseName: `surecrm-${String(doc._id)}-${Date.now()}.call`,
            content: _buildCallFileContent(settings, { agentExtension, digits, docId: String(doc._id) }),
        });
    } catch (err) {
        _forgetOriginate(agentExtension); // PBX never received a ring leg
        await Calls.findByIdAndUpdate(doc._id, { status: "Failed", note: `Call-file delivery failed: ${err.message}` });
        throw Object.assign(new Error(`PBX rejected the call: ${err.message}`), { status: 502 });
    }
    return doc;
}

/** Compose the pbx_spool call file. See Asterisk docs "callfiles". */
function _buildCallFileContent(settings, { agentExtension, digits, docId }) {
    const waitTime = Math.min(90, Math.max(10, Number(settings.dialTimeout) || 45));
    return [
        `Channel: Local/${agentExtension}@${settings.dialContext}/n`,
        `CallerID: SureCRM <${digits}>`,
        `WaitTime: ${waitTime}`,
        `MaxRetries: 0`,
        `RetryTime: 60`,
        `Archive: yes`,
        `Context: ${settings.dialContext}`,
        `Extension: ${digits}`,
        `Priority: 1`,
        // Lets the event finalizer bind hangups back to this exact row.
        `Set: __SURECRMCALLID=${docId}`,
        "", // trailing newline
    ].join("\n");
}

/**
 * Copy a call file onto the PBX host (sshpass+scp; no extra npm deps).
 * Step 1: scp content to /tmp/<name> on the PBX.
 * Step 2: ssh mv it into the spool dir - atomic on the same filesystem,
 *         so pbx_spool only ever picks up complete files.
 * Throws with the underlying stderr message on any failure.
 */
async function _deployCallFile(settings, { baseName, content }) {
    const host = String((settings && settings.host) || "").trim();
    if (!host) throw new Error("FreePBX host is not configured");
    const password = String(process.env.FREEPBX_SSH_PASSWORD || (settings && settings.sshPassword) || "");
    if (!password) throw new Error("No SSH password configured (sshPassword or FREEPBX_SSH_PASSWORD)");
    const port = Number(settings.sshPort) || 22;
    const user = settings.sshUser || "root";
    const spoolDir = settings.spoolDir || "/var/spool/asterisk/outgoing";
    if (!/^[A-Za-z0-9._-]+$/.test(baseName)) throw new Error("Unsafe spool filename");
    if (!/^[A-Za-z0-9/._-]+$/.test(spoolDir)) throw new Error("Unsafe spool directory");

    const tmpLocal = path.join(os.tmpdir(), baseName);
    const tmpRemote = `/tmp/${baseName}`;
    const dstRemote = `${spoolDir}/${baseName}`;
    const dest = `${user}@${host}`;

    fs.writeFileSync(tmpLocal, content, { mode: 0o600 });
    try {
        await _runCmd(
            "sshpass",
            ["-e", "scp", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8", `-P${port}`, tmpLocal, `${dest}:${tmpRemote}`],
            password
        );
        await _runCmd(
            "sshpass",
            ["-e", "ssh", "-o", "StrictHostKeyChecking=no", "-o", "ConnectTimeout=8", `-p${port}`, dest,
             // asterisk (non-root) must own the file to be able to utime/remove
             // it once consumed; tolerate chown failures on non-standard setups.
             `(chown asterisk:asterisk ${tmpRemote} || true) && chmod 644 ${tmpRemote} && mv ${tmpRemote} ${dstRemote}`],
            password
        );
    } finally {
        try { fs.unlinkSync(tmpLocal); } catch (e) { /* noop */ }
    }
}

/** execFile wrapper: hard timeout, SSHPASS injected via env (secret-safe). */
function _runCmd(cmd, args, sshPassword) {
    return new Promise((resolve, reject) => {
        execFile(
            cmd,
            args,
            { timeout: 15000, env: { ...process.env, SSHPASS: sshPassword } },
            (err, stdout, stderr) => {
                if (err) {
                    const detail = String(stderr || err.message).trim().split("\n").pop();
                    return reject(new Error(detail || err.message));
                }
                resolve({ stdout });
            }
        );
    });
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

/** Test-only access to internals (not used by production callers). */
export const __testHooks = { state, handleAmiEvent: _handleAmiEvent };




