import net from "net";
import { EventEmitter } from "events";

/**
 * Minimal dependency-free Asterisk Manager Interface (AMI) client.
 *
 * Speaks the plain-text AMI protocol over TCP:
 *   - packets are terminated by an empty line ("\r\n\r\n")
 *   - actions are sent as "Key: Value" blocks and correlated via ActionID
 *   - events arrive asynchronously and are emitted on the 'event' channel
 *
 * Features: login, keepalive ping, ActionID response correlation with
 * timeout, automatic reconnect with capped backoff, clean destroy.
 */

const CRLF = "\r\n";
const PACKET_END = "\r\n\r\n";

export const AMI_STATE = {
    DISCONNECTED: "disconnected",
    CONNECTING: "connecting",
    CONNECTED: "connected", // TCP up, login in flight
    READY: "ready",         // authenticated, usable
};

class AmiClient extends EventEmitter {
    /**
     * @param {object} opts
     * @param {string} opts.host
     * @param {number} opts.port
     * @param {string} opts.username
     * @param {string} opts.secret
     * @param {boolean} [opts.reconnect=true]  auto reconnect when connection drops
     * @param {string} [opts.eventsFilter]     AMI event mask ("call,system") - omit for all
     */
    constructor(opts) {
        super();
        this.host = opts.host;
        this.port = opts.port || 5038;
        this.username = opts.username;
        this.secret = opts.secret;
        this.reconnect = opts.reconnect !== false;
        this.eventsFilter = opts.eventsFilter;

        this.socket = null;
        this.buffer = "";
        this.actionId = 0;
        this.pending = new Map(); // actionId -> {resolve, reject, timer}
        this.pingTimer = null;
        this.reconnectTimer = null;
        this.backoffMs = 1000;
        this.destroyed = false;

        this.state = AMI_STATE.DISCONNECTED;
    }

    /** Open socket + authenticate. Resolves once ready ("FullyBooted"). */
    connect() {
        if (this.state === AMI_STATE.CONNECTED || this.state === AMI_STATE.READY) {
            return Promise.resolve();
        }
        this.destroyed = false;
        this.state = AMI_STATE.CONNECTING;
        this.emit("state", this.state);

        return new Promise((resolve, reject) => {
            let settled = false;
            const settle = (fn, arg) => {
                if (!settled) {
                    settled = true;
                    fn(arg);
                }
            };

            const socket = net.createConnection({ host: this.host, port: this.port });
            this.socket = socket;

            socket.once("error", (err) => settle(reject, err));
            socket.once("close", () => this._onClose());
            socket.on("data", (chunk) => this._onData(chunk));

            socket.on("connect", () => {
                this.state = AMI_STATE.CONNECTED;
                this.emit("state", this.state);

                // IMPORTANT: attach the FullyBooted listener BEFORE sending
                // Login. Asterisk may push banner + login response +
                // FullyBooted in a single TCP segment; packets are handled
                // synchronously, so a listener registered in a .then() after
                // send() would miss it.
                const onBooted = () => {
                    clearTimeout(guard);
                    this.removeListener("fullybooted", onBooted);
                    this.backoffMs = 1000;
                    this.state = AMI_STATE.READY;
                    this.emit("state", this.state);
                    this._startPing();
                    settle(resolve);
                };
                const guard = setTimeout(() => {
                    this.removeListener("fullybooted", onBooted);
                    settle(reject, new Error("AMI connected but no FullyBooted event received"));
                }, 10000);
                this.once("fullybooted", onBooted);

                const login = { Action: "Login", Username: this.username, Secret: this.secret };
                if (this.eventsFilter) login.Events = this.eventsFilter;

                this.send(login).catch((err) => {
                    clearTimeout(guard);
                    this.removeListener("fullybooted", onBooted);
                    socket.destroy();
                    settle(reject, err instanceof Error ? err : new Error(String(err)));
                });
            });
        });
    }

    /**
     * Send one action, resolve with the full response packet object.
     * Rejects on Response: Error or after `timeoutMs`.
     */
    send(action, timeoutMs = 15000) {
        return new Promise((resolve, reject) => {
            if (!this.socket || this.socket.destroyed) {
                return reject(new Error("AMI socket is not connected"));
            }
            const id = String(++this.actionId);
            const payload = { ...action, ActionID: id };

            const lines = Object.entries(payload)
                .filter(([, v]) => v !== undefined && v !== null)
                .map(([k, v]) => `${k}: ${v}`);
            this.socket.write(lines.join(CRLF) + CRLF + CRLF);

            const timer = setTimeout(() => {
                if (this.pending.has(id)) {
                    this.pending.delete(id);
                    reject(new Error(`AMI action "${action.Action}" timed out`));
                }
            }, timeoutMs);
            this.pending.set(id, { resolve, reject, timer });
        });
    }

    /** Graceful logoff + teardown. No further reconnects. */
    async destroy() {
        this.destroyed = true;
        this._clearTimers();
        if (this.socket && !this.socket.destroyed) {
            try {
                await this.send({ Action: "Logoff" }, 3000);
            } catch (e) {
                /* socket may already be gone */
            }
            this.socket.destroy();
        }
        this.socket = null;
        this.state = AMI_STATE.DISCONNECTED;
        this.emit("state", this.state);
    }

    // ------------------------- internals ------------------------------ //

    _onData(chunk) {
        this.buffer += chunk.toString("utf8");
        let idx;
        while ((idx = this.buffer.indexOf(PACKET_END)) !== -1) {
            const rawPacket = this.buffer.slice(0, idx);
            this.buffer = this.buffer.slice(idx + PACKET_END.length);
            this._handlePacket(rawPacket);
        }
    }

    _handlePacket(rawPacket) {
        const lines = rawPacket.split(/\r?\n/);

        // Banner may arrive alone or merged with the first packets
        if (lines.length && /^Asterisk Call Manager/i.test(lines[0])) {
            this.banner = this.banner || lines[0];
            lines.shift();
        }
        if (!lines.length) return;

        const packet = {};
        for (const line of lines) {
            if (!line.trim()) continue;
            const sep = line.indexOf(":");
            if (sep === -1) continue;
            packet[line.slice(0, sep).trim()] = line.slice(sep + 1).trim();
        }
        if (!Object.keys(packet).length) return;

        if (packet.Event) {
            if (packet.Event.toLowerCase() === "fullybooted") this.emit("fullybooted", packet);
            this.emit("event", packet);
            return;
        }

        if (packet.ActionID && this.pending.has(packet.ActionID)) {
            const { resolve, reject, timer } = this.pending.get(packet.ActionID);
            clearTimeout(timer);
            this.pending.delete(packet.ActionID);
            if ((packet.Response || "").toLowerCase().indexOf("error") === 0) {
                reject(new Error(packet.Message || "AMI action failed"));
            } else {
                resolve(packet);
            }
        }
    }

    _startPing() {
        this._clearPing();
        this.pingTimer = setInterval(() => {
            this.send({ Action: "Ping" }, 8000).catch(() => {});
        }, 25000);
    }

    _onClose() {
        const wasUp = this.state === AMI_STATE.READY || this.state === AMI_STATE.CONNECTED;
        this._clearTimers();
        this.buffer = "";
        this.state = AMI_STATE.DISCONNECTED;
        this.emit("state", this.state);
        if (wasUp) this.emit("disconnected");

        if (this.destroyed || !this.reconnect) return;

        // Exponential backoff capped at 30s
        this.reconnectTimer = setTimeout(() => {
            this.connect().catch((err) => {
                this.emit("log", "warn", `AMI reconnect failed: ${err.message}`);
            });
        }, this.backoffMs);
        this.backoffMs = Math.min(this.backoffMs * 2, 30000);
    }

    _clearPing() {
        if (this.pingTimer) clearInterval(this.pingTimer);
        this.pingTimer = null;
    }

    _clearTimers() {
        this._clearPing();
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = null;
        for (const [, p] of this.pending) {
            clearTimeout(p.timer);
            p.reject(new Error("AMI client destroyed"));
        }
        this.pending.clear();
    }
}

export default AmiClient;
