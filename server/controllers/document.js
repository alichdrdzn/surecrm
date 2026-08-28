import Document from "../model/document.js";
import { crm } from "../utils/logger.js";

const index = async (req, res) => {
    const query = req.query
    query.deleted = false;
    let allData = await Document.find(query).populate({
        path: 'createdBy',
        match: { deleted: false }
    }).exec()

    const result = allData.filter(item => item.createdBy !== null);

    let totalRecords = result.length
    res.send({ result, total_recodes: totalRecords })
}

const getDocumentsByEntity = async (req, res) => {
    try {
        const { type, id } = req.params; // type: 'contact' or 'lead', id: entity id
        const query = {
            deleted: false,
            category: type,
            [`${type}_id`]: id
        };
        const documents = await Document.find(query).sort({ createdOn: -1 });
        res.status(200).json({ result: documents, message: 'Documents fetched successfully' });
    } catch (error) {
        crm.error(error.message);
        res.status(500).json({ error: error.message });
    }
}

const fileUpload = async (req, res) => {
    const fileName = req.body.fileName
    const category = req.body.category || 'general';
    const contactId = req.body.contact_id || null;
    const leadId = req.body.lead_id || null;

    try {
        const fileData = {
            path: req.file.path,
            file: req.file.originalname,
            fileName: fileName,
            category: category,
            createdBy: req.body.createdBy
        };
        if (contactId) fileData.contact_id = contactId;
        if (leadId) fileData.lead_id = leadId;

        const file = await Document.create(fileData);
        res.status(200).json({ file, message: "File uploaded successfully" });
    } catch (error) {
        crm.error(error.message);
        res.status(500).json({ error: error.message });
    }
}


const downloadFile = async (req, res) => {
    try {
        const file = await Document.findById(req.params.fileId);
        file.downloadCount++;

        await file.save();

        res.download(file.path, file.name);

    } catch (error) {
        crm.error(error.message);
        res.status(500).json({ msg: error.message });
    }
}

const deleteData = async (req, res) => {
    try {
        let document = await Document.findByIdAndUpdate({ _id: req.params.id }, { deleted: true })
        res.status(200).json({ message: "File deleted successfully", document })
    } catch (err) {
        res.status(404).json({ message: "error", err })
    }
}

const deleteMany = async (req, res) => {
    try {
        const documentIdsToDelete = req.body;

        const deleteManyDocumnets = await Document.updateMany({ _id: { $in: documentIdsToDelete } }, { deleted: true });

        if (deleteManyDocumnets.deletedCount === 0) {
            return res.status(404).json({ message: "Documents not found." });
        }

        res.status(200).json({ message: "Documents  deleted successfully.", deleteManyDocumnets });
    } catch (err) {
        res.status(500).json({ message: "Error deleting Documents.", error: err.message });
    }
};

export default { index, fileUpload, downloadFile, deleteData, deleteMany, getDocumentsByEntity }