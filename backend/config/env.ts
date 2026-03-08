import dotenv from 'dotenv';

dotenv.config();

function getEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === '') {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvOptional(key: string, defaultValue: string): string {
  return process.env[key] ?? defaultValue;
}

function getEnvNumber(key: string, defaultValue: number): number {
  const value = process.env[key];
  if (value === undefined || value === '') return defaultValue;
  const num = parseInt(value, 10);
  if (Number.isNaN(num)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return num;
}

export interface EnvConfig {
  port: number;
  nodeEnv: string;
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  s3BucketName: string;
  s3OriginalPrefix: string;
  s3ProcessedPrefix: string;
  sqsQueueUrl: string;
  maxFileSizeMb: number;
  workerPollIntervalMs: number;
  jobStatusTtlMinutes: number;
}

/**
 * Load and validate environment configuration.
 * Required vars must be set in production; for Phase 2 dev, we validate only PORT and NODE_ENV.
 */
export function loadConfig(): EnvConfig {
  const port = getEnvNumber('PORT', 4000);
  const nodeEnv = getEnvOptional('NODE_ENV', 'development');

  return {
    port,
    nodeEnv,
    awsRegion: getEnvOptional('AWS_REGION', 'us-east-1'),
    awsAccessKeyId: getEnvOptional('AWS_ACCESS_KEY_ID', ''),
    awsSecretAccessKey: getEnvOptional('AWS_SECRET_ACCESS_KEY', ''),
    s3BucketName: getEnvOptional('S3_BUCKET_NAME', ''),
    s3OriginalPrefix: getEnvOptional('S3_ORIGINAL_PREFIX', 'original-images'),
    s3ProcessedPrefix: getEnvOptional('S3_PROCESSED_PREFIX', 'processed-images'),
    sqsQueueUrl: getEnvOptional('SQS_QUEUE_URL', ''),
    maxFileSizeMb: getEnvNumber('MAX_FILE_SIZE_MB', 5),
    workerPollIntervalMs: getEnvNumber('WORKER_POLL_INTERVAL_MS', 2000),
    jobStatusTtlMinutes: getEnvNumber('JOB_STATUS_TTL_MINUTES', 60),
  };
}
