import { SQSClient, SendMessageCommand } from '@aws-sdk/client-sqs';
import { loadConfig } from '../../config/env';

export interface QueueMessageBody {
  jobId: string;
  imageKey: string;
}

let sqsClient: SQSClient | null = null;

function getClient(): SQSClient {
  if (!sqsClient) {
    const config = loadConfig();
    sqsClient = new SQSClient({
      region: config.awsRegion,
      ...(config.awsAccessKeyId && config.awsSecretAccessKey
        ? {
            credentials: {
              accessKeyId: config.awsAccessKeyId,
              secretAccessKey: config.awsSecretAccessKey,
            },
          }
        : {}),
    });
  }
  return sqsClient;
}

/**
 * Publish message to SQS. Body: { jobId, imageKey }. Queue: SQS_QUEUE_URL.
 */
export async function publishImageProcessingJob(jobId: string, imageKey: string): Promise<void> {
  const config = loadConfig();
  const url = config.sqsQueueUrl?.trim();
  if (!url) {
    throw new Error('SQS_QUEUE_URL is not configured');
  }
  if (!url.startsWith('https://sqs.') || !url.includes('.amazonaws.com')) {
    throw new Error(
      'SQS_QUEUE_URL must be a valid SQS queue URL (e.g. https://sqs.us-east-1.amazonaws.com/123456789012/queue-name)'
    );
  }
  const client = getClient();
  await client.send(
    new SendMessageCommand({
      QueueUrl: url,
      MessageBody: JSON.stringify({ jobId, imageKey }),
    })
  );
}

export interface QueueService {
  sendMessage(body: QueueMessageBody): Promise<void>;
}

export const queueService: QueueService = {
  async sendMessage(body: QueueMessageBody): Promise<void> {
    await publishImageProcessingJob(body.jobId, body.imageKey);
  },
};
