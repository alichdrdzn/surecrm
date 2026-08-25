import mongoose from "mongoose";

const User = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    emailAddress: { type: String, require: true },
    password: { type: String, require: true },
    // FreePBX extension this user is reachable on. Any endpoint technology
    // behind the extension (PJSIP desk phone, softphone, analog ATA port ...)
    // works transparently - the CRM only ever references the number.
    extension: { type: String },
    role: {
        type: String, enum: ['user', 'admin'], default: 'user'
    },
    deleted: {
        type: Boolean,
        default: false,
    },
    createdOn: { type: Date, default: Date.now },
    modifiedOn: { type: Date ,default: Date.now}
})

export default mongoose.model('User', User);
