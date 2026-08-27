import mongoose from "mongoose"

/**
 * Global FreePBX integration settings (singleton document).
 *
 * The integration speaks ONLY to the FreePBX control plane (Asterisk Manager
 * Interface), so it stays agnostic of the telephony edge (SIP trunk, gateway,
 * analog FXS/ATA phones, softphones ...). Changing topology never requires
 * changing this integration - only these settings change.
 */
const FreepbxSettingsSchema = new mongoose.Schema({
    // master switch - when false the AMI connection is torn down
    enabled: { type: Boolean, default: false },

    // Asterisk Manager Interface endpoint
    host: { type: String, default: "127.0.0.1" },
    port: { type: Number, default: 5038 },
    username: { type: String, default: "" },
    secret: { type: String, default: "" },

    // Internal context used to reach agent extensions and outbound routes.
    // "from-internal" is the FreePBX default and works for every device type.
    dialContext: { type: String, default: "from-internal" },

    // Seconds the PBX rings the agent leg before giving up
    dialTimeout: { type: Number, default: 45 },

    // ---- caller-id number normalization used for Lead/Contact matching ----
    // Comma separated international country codes to strip ("98,49")
    countryCodesToStrip: { type: String, default: "" },
    // National/trunk prefix to strip once country code is handled ("0")
    nationalPrefixToStrip: { type: String, default: "" },
    // Compare only the last N digits of numbers when matching records
    matchDigits: { type: Number, default: 9 },

    // Optional base URL of the PBX web/recordings root, used to build
    // playback links for call recordings (e.g. https://pbx.example.com)
    recordingUrlBase: { type: String, default: "" },
    // Optional filename template (relative to recordingUrlBase unless it is a
    // full http(s) URL). Placeholders: {uniqueId} {number} {ext} {date} {time}
    // e.g. "monitor/{date}-{time}-{uniqueId}.wav". Empty => "{uniqueId}.wav"
    recordingUrlPattern: { type: String, default: "" },

    // ---- Click-to-call delivery ------------------------------------------ //
    // Asterisk's Manager-API Originate collapses ~16ms after INVITE on some
    // builds (verified by wire capture 2026-08-27), so ring legs are delivered
    // as .call files into the spool directory instead (pbx_spool - proven
    // stable on this PBX). Files are copied over SSH/SFTP.
    // Host defaults to `host`; sshPassword may also come from env
    // FREEPBX_SSH_PASSWORD (settings value wins when both are set).
    sshPort: { type: Number, default: 22 },
    sshUser: { type: String, default: "root" },
    sshPassword: { type: String, default: "" },
    // Remote directory monitored by asterisk (FreePBX default)
    spoolDir: { type: String, default: "/var/spool/asterisk/outgoing" },

    deleted: {
        type: Boolean,
        default: false,
    },
    createdOn: { type: Date, default: Date.now },
    modifiedOn: { type: Date, default: Date.now }
})

export default mongoose.model("FreepbxSettings", FreepbxSettingsSchema)
