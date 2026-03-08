import type { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { jobService } from '../services/job.service';

const ALLOWED_STATUSES = ['processing', 'completed', 'failed'] as const;

/**
 * POST /internal/job-update – update job status (used by worker).
 * Body: { jobId: string, status: "processing" | "completed" | "failed", processedImageKey?: string }
 */
export async function updateJobInternal(req: Request, res: Response): Promise<void> {
  try {
    const body = req.body as { jobId?: string; status?: string; processedImageKey?: string };
    const { jobId, status, processedImageKey } = body;

    if (!jobId || typeof jobId !== 'string') {
      res.status(400).json({ error: 'Bad request', message: 'jobId is required' });
      return;
    }
    if (!status || !ALLOWED_STATUSES.includes(status as (typeof ALLOWED_STATUSES)[number])) {
      res.status(400).json({
        error: 'Bad request',
        message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}`,
      });
      return;
    }

    const job = await jobService.getById(jobId);
    if (!job) {
      logger.warn('Job not found for internal update', { jobId });
      res.status(404).json({ error: 'Job not found', jobId });
      return;
    }

    await jobService.update(jobId, {
      status: status as 'processing' | 'completed' | 'failed',
      ...(processedImageKey !== undefined && { processedImageKey }),
    });

    logger.info('Job status updated', { jobId, status, processedImageKey: processedImageKey ?? undefined });

    const updated = await jobService.getById(jobId);
    res.status(200).json({
      jobId: updated!.jobId,
      status: updated!.status,
    });
  } catch (err) {
    logger.error('Internal job update error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({ error: 'Internal server error' });
  }
}
