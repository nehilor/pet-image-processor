import { PutObjectCommand, GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
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
 * Upload original image to S3.
 * Key: ${S3_ORIGINAL_PREFIX}/${jobId}.jpg
 * Returns the S3 key.
 */
export async function uploadOriginalImage(jobId: string, fileBuffer: Buffer): Promise<string> {
  const config = loadConfig();
  if (!config.s3BucketName) {
    throw new Error('S3_BUCKET_NAME is not configured');
  }
  const key = `${config.s3OriginalPrefix}/${jobId}.jpg`;
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3BucketName,
      Key: key,
      Body: fileBuffer,
      ContentType: 'image/jpeg',
    })
  );
  return key;
}

/**
 * Generate a pre-signed GET URL for an S3 key.
 */
export async function getPreSignedUrl(key: string): Promise<string> {
  const config = loadConfig();
  if (!config.s3BucketName) {
    throw new Error('S3_BUCKET_NAME is not configured');
  }
  const client = getClient();
  const command = new GetObjectCommand({ Bucket: config.s3BucketName, Key: key });
  const url = await getSignedUrl(client, command, { expiresIn: 300 });
  return url;
}

export interface StorageService {
  upload(buffer: Buffer, key: string): Promise<string>;
  getPreSignedUrl(key: string): Promise<string>;
}

async function upload(buffer: Buffer, key: string): Promise<string> {
  const config = loadConfig();
  if (!config.s3BucketName) throw new Error('S3_BUCKET_NAME is not configured');
  const client = getClient();
  await client.send(
    new PutObjectCommand({
      Bucket: config.s3BucketName,
      Key: key,
      Body: buffer,
    })
  );
  return key;
}

export const storageService: StorageService = {
  upload,
  getPreSignedUrl,
};
