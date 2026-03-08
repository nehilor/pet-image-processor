import { Router } from 'express';
import { getStatus, getResult } from '../controllers/status.controller';

const router = Router();

/**
 * GET /status/:jobId – return current job status
 */
router.get('/status/:jobId', getStatus);

/**
 * GET /result/:jobId – return processed image URL when completed
 */
router.get('/result/:jobId', getResult);

export default router;
