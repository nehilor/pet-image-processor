/** Job status as returned by the backend */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/** POST /upload success response */
export interface UploadResponse {
  jobId: string;
  status: 'queued';
}

/** GET /status/:jobId response */
export interface StatusResponse {
  jobId: string;
  status: JobStatus;
}

/** GET /result/:jobId response when completed */
export interface ResultResponse {
  jobId: string;
  status: 'completed';
  processedImageUrl: string;
}

/** GET /result/:jobId when not completed yet */
export interface ResultStatusOnlyResponse {
  jobId: string;
  status: Exclude<JobStatus, 'completed'>;
}
