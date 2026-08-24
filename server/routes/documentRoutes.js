import { Router } from 'express';
import Document from '../controllers/document.js';
import auth from '../middlewares/auth.js';
import { upload } from '../utils/upload.js'

const router = Router();

router.get('/list', auth, Document.index);
router.post('/upload', auth, upload.single('file'), Document.fileUpload);
router.get('/file/:fileId', Document.downloadFile);
router.delete('/delete/:id', auth, Document.deleteData);
router.post('/deletemany', auth, Document.deleteMany)



export default router