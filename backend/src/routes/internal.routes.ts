import { Router } from 'express';
import { updateJobInternal } from '../controllers/internal.controller';

const router = Router();

/**
 * POST /internal/job-update – worker updates job status and optional processedImageKey
 */
router.post('/job-update', updateJobInternal);

export default router;
