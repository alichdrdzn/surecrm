import { Router } from 'express';
import Email from '../controllers/email.js'
import auth from '../middlewares/auth.js'
const router = Router();

router.get('/list', Email.index)
router.post('/add', Email.add)
router.get('/view/:id', Email.view)
router.delete('/delete/:id', Email.deleteData)
router.post('/deletemany', Email.deleteMany)


export default router