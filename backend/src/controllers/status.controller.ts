import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';
import { getProcessedImageUrl } from '../utils/url';

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
    logger.info('Status request', { jobId });
    const job = await jobService.getById(jobId);
    if (!job) {
      logger.warn('Job not found for status', { jobId });
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
 * If not completed, return status only. 404 if job not found.
 */
export async function getResult(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }
    logger.info('Result request', { jobId });
    const job = await jobService.getById(jobId);
    if (!job) {
      logger.warn('Job not found for result', { jobId });
      res.status(404).json({ error: 'Job not found', jobId });
      return;
    }
    if (job.status !== 'completed') {
      res.status(200).json({ jobId: job.jobId, status: job.status });
      return;
    }
    if (!job.processedImageKey) {
      logger.warn('Job completed but missing processedImageKey', { jobId });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Job completed but processed image is not available.',
      });
      return;
    }
    const processedImageUrl = getProcessedImageUrl(job.processedImageKey);
    res.status(200).json({
      jobId: job.jobId,
      status: 'completed' as const,
      processedImageUrl,
    });
  } catch (err) {
    logger.error('Get result handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
