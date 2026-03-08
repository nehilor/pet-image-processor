import dotenv from 'dotenv';

dotenv.config();

function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) throw new Error(`Environment variable ${key} must be a number`);
  return num;
}

export interface WorkerConfig {
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  s3BucketName: string;
  s3OriginalPrefix: string;
  s3ProcessedPrefix: string;
  sqsQueueUrl: string;
  workerPollIntervalMs: number;
  backendBaseUrl: string;
}

export function loadConfig(): WorkerConfig {
  return {
    awsRegion: getEnvOptional('AWS_REGION', 'us-east-1'),
    awsAccessKeyId: getEnvOptional('AWS_ACCESS_KEY_ID', ''),
    awsSecretAccessKey: getEnvOptional('AWS_SECRET_ACCESS_KEY', ''),
    s3BucketName: getEnvOptional('S3_BUCKET_NAME', ''),
    s3OriginalPrefix: getEnvOptional('S3_ORIGINAL_PREFIX', 'original-images'),
    s3ProcessedPrefix: getEnvOptional('S3_PROCESSED_PREFIX', 'processed-images'),
    sqsQueueUrl: getEnvOptional('SQS_QUEUE_URL', ''),
    workerPollIntervalMs: getEnvNumber('WORKER_POLL_INTERVAL_MS', 2000),
    backendBaseUrl: getEnvOptional('BACKEND_BASE_URL', 'http://localhost:4000'),
  };
}
