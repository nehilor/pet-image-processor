import { logger } from './utils/logger';
import { receiveMessage, deleteMessage } from './services/queue.service';
import { downloadOriginalImage } from './services/s3.service';
import { processImage } from './services/image.service';
import { uploadProcessedImage } from './services/s3.service';
import { updateJobStatus } from './services/job.service';
import { loadConfig } from '../config/env';

async function processJob(jobId: string, imageKey: string, receiptHandle: string): Promise<void> {
  try {
    logger.info('Message received', { jobId, imageKey });

    await updateJobStatus(jobId, 'processing');
    logger.info('Job status set to processing', { jobId });

    const imageBuffer = await downloadOriginalImage(jobId);
    logger.info('Image downloaded', { jobId });

    const processedBuffer = await processImage(imageBuffer);
    logger.info('Image processed', { jobId });

    const processedKey = await uploadProcessedImage(jobId, processedBuffer);
    logger.info('Image uploaded', { jobId, processedKey });

    await updateJobStatus(jobId, 'completed', processedKey);
    logger.info('Job completed', { jobId });

    await deleteMessage(receiptHandle);
    logger.info('Message deleted', { jobId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Processing failed', { jobId, error: message });
    try {
      await updateJobStatus(jobId, 'failed');
    } catch (updateErr) {
      logger.error('Failed to update job status to failed', {
        jobId,
        error: updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    }
    // Do not delete message so it can be retried after visibility timeout
  }
}

async function runLoop(): Promise<void> {
  const config = loadConfig();
  const pollIntervalMs = config.workerPollIntervalMs;

  logger.info('Worker started', {
    pollIntervalMs,
    queueUrl: config.sqsQueueUrl ? 'configured' : 'missing',
    backendBaseUrl: config.backendBaseUrl,
  });

  while (true) {
    try {
      const result = await receiveMessage();
      if (result) {
        const { message, body } = result;
        await processJob(body.jobId, body.imageKey, message.ReceiptHandle ?? '');
      }
    } catch (err) {
      logger.error('Worker loop error', { error: err instanceof Error ? err.message : String(err) });
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }
}

runLoop().catch((err) => {
  logger.error('Worker crashed', { error: err instanceof Error ? err.message : String(err) });
  process.exit(1);
});
