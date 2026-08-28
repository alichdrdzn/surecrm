import { Router } from 'express';
import Document from '../controllers/document.js';
import auth from '../middlewares/auth.js';
import { upload } from '../utils/upload.js'

const router = Router();

// Upload a single file
router.post('/upload', auth, upload.single('file'), Document.fileUpload);

// Get documents linked to a specific contact or lead
router.get('/by-entity/:type/:id', auth, Document.getDocumentsByEntity);

// Existing routes
router.get('/list', auth, Document.index);
router.get('/file/:fileId', Document.downloadFile);
router.delete('/delete/:id', auth, Document.deleteData);
router.post('/deletemany', auth, Document.deleteMany);

export default router;
