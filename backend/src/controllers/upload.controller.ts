import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';

/**
 * POST /upload – upload image and create processing job.
 * Business logic is in the upload service (not implemented yet).
 * Controller only delegates and formats response.
 */
export async function handleUpload(req: Request, res: Response): Promise<void> {
  try {
    // Phase 4: will call uploadService.upload(req.file), then res.status(201).json(...)
    // For Phase 2 we return 501 to indicate not implemented.
    logger.info('Upload endpoint called (not implemented)');
    res.status(501).json({
      error: 'Not implemented',
      message: 'Upload will be implemented in Phase 4',
    });
  } catch (err) {
    logger.error('Upload handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
