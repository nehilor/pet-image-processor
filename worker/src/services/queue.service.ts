import {
  SQSClient,
  ReceiveMessageCommand,
  DeleteMessageCommand,
  type Message,
} from '@aws-sdk/client-sqs';
import { loadConfig } from '../../config/env';

export interface QueueMessage {
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
 * Receive one message from the queue (long poll). Returns null if no message.
 */
export async function receiveMessage(): Promise<{ message: Message; body: QueueMessage } | null> {
  const config = loadConfig();
  if (!config.sqsQueueUrl?.trim() || !config.sqsQueueUrl.startsWith('https://sqs.')) {
    return null;
  }
  const client = getClient();
  const response = await client.send(
    new ReceiveMessageCommand({
      QueueUrl: config.sqsQueueUrl,
      MaxNumberOfMessages: 1,
      WaitTimeSeconds: 10,
      VisibilityTimeout: 60,
    })
  );
  const message = response.Messages?.[0];
  if (!message?.Body) return null;
  let body: QueueMessage;
  try {
    body = JSON.parse(message.Body) as QueueMessage;
  } catch {
    return null;
  }
  if (!body.jobId || !body.imageKey) return null;
  return { message, body };
}

/**
 * Delete message from queue after successful processing.
 */
export async function deleteMessage(receiptHandle: string): Promise<void> {
  const config = loadConfig();
  if (!config.sqsQueueUrl) throw new Error('SQS_QUEUE_URL is not configured');
  const client = getClient();
  await client.send(
    new DeleteMessageCommand({
      QueueUrl: config.sqsQueueUrl,
      ReceiptHandle: receiptHandle,
    })
  );
}
