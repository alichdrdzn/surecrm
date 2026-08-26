import mongoose from "mongoose"

const Calls = new mongoose.Schema({
    subject: { type: String, required: true },
    status: { type: String, required: true },
    startDateTime: { type: String, required: true },
    duration: { type: String, required: true },
    relatedTo: { type: String, required: true },
    note: { type: String, required: true },
    lead_id: {
        type: mongoose.Schema.ObjectId,
        ref: "Lead"
    },
    contact_id: {
        type: mongoose.Schema.ObjectId,
        ref: "Contact"
    },
    createdBy: {
        type: mongoose.Schema.ObjectId,
        ref: "User",
    },

    // ---- FreePBX integration metadata (optional, auto-logged calls) ----
    source: { type: String, default: "" },       // "" manual | "freepbx"
    direction: { type: String, default: "" },    // "Inbound" | "Outbound" ("" for legacy/manual rows)
    phoneNumber: { type: String, default: "" },  // external party of the call
    pbxUniqueId: { type: String, default: "" },  // Asterisk Uniqueid
    pbxLinkedId: { type: String, default: "" },  // Asterisk Linkedid (groups all channels of one call)
    pbxChannel: { type: String, default: "" },   // Asterisk channel name
    recordingUrl: { type: String, default: "" }, // playback URL of the call recording

    deleted: {
        type: Boolean,
        default: false,
    },
    createdOn: { type: Date, default: Date.now },
    modifiedOn: { type: Date, default: Date.now }
})

export default mongoose.model('Calls', Calls)