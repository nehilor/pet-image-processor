import { Router } from 'express';
import { handleUpload } from '../controllers/upload.controller';
import { uploadMiddleware } from '../middleware/upload.middleware';

const router = Router();

/**
 * POST /upload – field "image", max size MAX_FILE_SIZE_MB, mime: jpeg/png/webp.
 */
router.post('/', uploadMiddleware.single('image'), handleUpload);

export default router;
