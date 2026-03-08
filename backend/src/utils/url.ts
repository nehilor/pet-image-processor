import { loadConfig } from '../../config/env';

/**
 * Build public S3 URL for a processed image key.
 * Format: https://{bucket}.s3.{region}.amazonaws.com/{key}
 * The key is used as-is so path segments (e.g. processed-images/jobId.jpg) keep the slash.
 */
export function getProcessedImageUrl(processedKey: string): string {
  const config = loadConfig();
  if (!config.s3BucketName || !config.awsRegion) {
    throw new Error('S3_BUCKET_NAME and AWS_REGION must be configured');
  }
  return `https://${config.s3BucketName}.s3.${config.awsRegion}.amazonaws.com/${processedKey}`;
}
