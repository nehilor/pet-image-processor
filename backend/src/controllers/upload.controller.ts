import type { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { uploadOriginalImage } from '../services/storage.service';
import { jobService } from '../services/job.service';
import { publishImageProcessingJob } from '../services/queue.service';

/**
 * POST /upload – validate file, then: upload to S3, create job, publish to queue.
 * Returns 201 { jobId, status: "queued" }. Errors: 400 (missing/invalid), 413 (too large), 500 (S3/SQS).
 */
export async function handleUpload(req: Request, res: Response): Promise<void> {
  try {
    if (!req.file || !req.file.buffer) {
      logger.warn('Upload rejected: no file provided');
      res.status(400).json({
        error: 'Bad request',
        message: 'No image file provided. Use multipart field "image".',
      });
      return;
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(req.file.mimetype)) {
      logger.warn('Upload rejected: invalid mime type', { mimetype: req.file.mimetype });
      res.status(400).json({
        error: 'Bad request',
        message: `Invalid file type. Allowed: ${allowedMime.join(', ')}`,
      });
      return;
    }

    const jobId = uuidv4();
    logger.info('Upload request received', { jobId });

    let imageKey: string;
    try {
      imageKey = await uploadOriginalImage(jobId, req.file.buffer);
      logger.info('S3 upload success', { jobId, imageKey });
    } catch (err) {
      logger.error('S3 upload failure', { jobId, error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to store image. Please try again.',
      });
      return;
    }

    try {
      await jobService.create({ jobId, originalImageKey: imageKey });
      logger.info('Job created', { jobId, status: 'queued' });
    } catch (err) {
      logger.error('Job creation failure', { jobId, error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to create job. Please try again.',
      });
      return;
    }

    try {
      await publishImageProcessingJob(jobId, imageKey);
      logger.info('Queue publish success', { jobId, imageKey });
    } catch (err) {
      logger.error('SQS publish failure', { jobId, error: err instanceof Error ? err.message : String(err) });
      res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to queue processing job. Please try again.',
      });
      return;
    }

    res.status(201).json({ jobId, status: 'queued' as const });
  } catch (err) {
    logger.error('Upload handler error', { error: err instanceof Error ? err.message : String(err) });
    res.status(500).json({
      error: 'Internal server error',
      message: 'Upload failed. Please try again.',
    });
  }
}
