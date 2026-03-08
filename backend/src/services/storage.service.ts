/**
 * Storage service: S3 upload and pre-signed URL generation.
 * Will be implemented in Phase 3 with AWS SDK.
 * Method signatures only for Phase 2.
 */
export interface StorageService {
  upload(buffer: Buffer, key: string): Promise<string>;
  getPreSignedUrl(key: string): Promise<string>;
}

/**
 * Placeholder – not used until S3 integration is added.
 */
export const storageService: StorageService = {
  async upload(): Promise<string> {
    throw new Error('StorageService.upload not implemented');
  },
  async getPreSignedUrl(): Promise<string> {
    throw new Error('StorageService.getPreSignedUrl not implemented');
  },
};
