import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';

/**
 * GET /status/:jobId – return current job status.
 * Delegates to job service; returns 404 for unknown jobId.
 */
export async function getStatus(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }
    const job = await jobService.getById(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found', jobId });
      return;
    }
    res.status(200).json({ jobId: job.jobId, status: job.status });
  } catch (err) {
    logger.error('Get status handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * GET /result/:jobId – return processed image URL when job is completed.
 * Will use job service + storage service for pre-signed URL (Phase 6).
 */
export async function getResult(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }
    const job = await jobService.getById(jobId);
    if (!job) {
      res.status(404).json({ error: 'Job not found', jobId });
      return;
    }
    if (job.status !== 'completed') {
      res.status(200).json({ jobId: job.jobId, status: job.status });
      return;
    }
    // Phase 6: generate pre-signed URL from storage service
    res.status(501).json({
      error: 'Not implemented',
      message: 'Result URL generation will be implemented in Phase 6',
    });
  } catch (err) {
    logger.error('Get result handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
