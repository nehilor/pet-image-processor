import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { loadConfig } from '../../config/env';

let s3Client: S3Client | null = null;

function getClient(): S3Client {
  if (!s3Client) {
    const config = loadConfig();
    s3Client = new S3Client({
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
  return s3Client;
}

/**
 * Download original image from S3. Key: ${S3_ORIGINAL_PREFIX}/{jobId}.jpg
 */
export async function downloadOriginalImage(jobId: string): Promise<Buffer> {
  const config = loadConfig();
  if (!config.s3BucketName) throw new Error('S3_BUCKET_NAME is not configured');
  const key = `${config.s3OriginalPrefix}/${jobId}.jpg`;
  const client = getClient();
  const response = await client.send(
    new GetObjectCommand({ Bucket: config.s3BucketName, Key: key })
  );
  const body = response.Body;
  if (!body) throw new Error(`Empty response for key ${key}`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

/**
 * Upload processed image to S3. Key: ${S3_PROCESSED_PREFIX}/{jobId}.jpg
 * Returns the S3 key.
 */
export async function uploadProcessedImage(jobId: string, buffer: Buffer): Promise<string> {
  const config = loadConfig();
  if (!config.s3BucketName) throw new Error('S3_BUCKET_NAME is not configured');
  const key = `${config.s3ProcessedPrefix}/${jobId}.jpg`;
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3BucketName,
      Key: key,
      Body: buffer,
      ContentType: 'image/jpeg',
    })
  );
  return key;
}
