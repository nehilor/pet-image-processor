/**
 * Queue message body as defined in backend_processing_pipeline.spec.md
 */
export interface QueueMessageBody {
  jobId: string;
  imageKey: string;
}

/**
 * Queue service: SQS send message.
 * Will be implemented in Phase 3 with AWS SDK.
 * Method signatures only for Phase 2.
 */
export interface QueueService {
  sendMessage(body: QueueMessageBody): Promise<void>;
}

/**
 * Placeholder – not used until SQS integration is added.
 */
export const queueService: QueueService = {
  async sendMessage(): Promise<void> {
    throw new Error('QueueService.sendMessage not implemented');
  },
};
