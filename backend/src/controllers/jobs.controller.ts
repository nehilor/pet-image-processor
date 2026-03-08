import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';

/**
 * PATCH /jobs/:jobId – update job status and/or processedImageKey (used by worker).
 * Body: { status?, processedImageKey? }
 */
export async function updateJob(req: Request, res: Response): Promise<void> {
  try {
    const { jobId } = req.params;
    if (!jobId) {
      res.status(400).json({ error: 'Missing jobId' });
      return;
    }
    const body = req.body as { status?: string; processedImageKey?: string | null };
    const status = body.status as 'queued' | 'processing' | 'completed' | 'failed' | undefined;
    if (status && !['queued', 'processing', 'completed', 'failed'].includes(status)) {
      res.status(400).json({ error: 'Invalid status' });
      return;
    }
    const job = await jobService.update(jobId, {
      status,
      processedImageKey: body.processedImageKey,
    });
    if (!job) {
      res.status(404).json({ error: 'Job not found', jobId });
      return;
    }
    res.status(200).json({ jobId: job.jobId, status: job.status });
  } catch (err) {
    logger.error('Update job handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
