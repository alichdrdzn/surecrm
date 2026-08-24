import { Router } from 'express';
import policyDocument from '../controllers/policyDocument.js';
import auth from '../middlewares/auth.js';
import { uploadPolicy } from '../utils/upload.js'

const router = Router();

router.get('/list', auth, policyDocument.index);
router.post('/upload', auth, uploadPolicy.single('file'), policyDocument.fileUpload);
router.get('/file/:fileId', policyDocument.downloadFile);
router.delete('/delete/:id', auth, policyDocument.deleteData);



export default router