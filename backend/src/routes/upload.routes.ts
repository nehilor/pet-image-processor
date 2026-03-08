import { Router } from 'express';
import { handleUpload } from '../controllers/upload.controller';

const router = Router();

/**
 * POST /upload – upload image and create processing job.
 * Multer middleware will be added in Phase 4.
 */
router.post('/', handleUpload);

export default router;
