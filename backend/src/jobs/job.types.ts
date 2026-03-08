/**
 * Job status values as defined in backend_processing_pipeline.spec.md
 */
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Job model: one image processing request and its outcome.
 */
export interface Job {
  jobId: string;
  status: JobStatus;
  originalImageKey: string;
  processedImageKey: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Input for creating a new job (queued).
 */
export interface CreateJobInput {
  jobId: string;
  originalImageKey: string;
}

/**
 * Input for updating job status and/or processed key.
 */
export interface UpdateJobInput {
  status?: JobStatus;
  processedImageKey?: string | null;
}
