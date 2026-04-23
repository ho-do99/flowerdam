import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../middleware/auth';
import { uploadImage } from '../controllers/upload.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const router = Router();

router.post('/', authenticate, upload.single('file'), uploadImage);

export default router;
