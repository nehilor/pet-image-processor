import type { Job, JobStatus, CreateJobInput, UpdateJobInput } from '../jobs/job.types';

const jobStore = new Map<string, Job>();

function now(): Date {
  return new Date();
}

export interface JobService {
  create(input: CreateJobInput): Promise<Job>;
  getById(jobId: string): Promise<Job | null>;
  update(jobId: string, input: UpdateJobInput): Promise<Job | null>;
}

export function createJob(jobId: string, originalImageKey: string): Job {
  const job: Job = {
    jobId,
    status: 'queued',
    originalImageKey,
    processedImageKey: null,
    createdAt: now(),
    updatedAt: now(),
  };
  jobStore.set(jobId, job);
  return job;
}

export function getJob(jobId: string): Job | null {
  return jobStore.get(jobId) ?? null;
}

export function updateJobStatus(jobId: string, status: JobStatus): Job | null {
  const job = jobStore.get(jobId);
  if (!job) return null;
  job.status = status;
  job.updatedAt = now();
  jobStore.set(jobId, job);
  return job;
}

export function setProcessedImage(jobId: string, processedImageKey: string): Job | null {
  const job = jobStore.get(jobId);
  if (!job) return null;
  job.processedImageKey = processedImageKey;
  job.status = 'completed';
  job.updatedAt = now();
  jobStore.set(jobId, job);
  return job;
}

export const jobService: JobService = {
  async create(input: CreateJobInput): Promise<Job> {
    return createJob(input.jobId, input.originalImageKey);
  },

  async getById(jobId: string): Promise<Job | null> {
    return getJob(jobId) ?? null;
  },

  async update(jobId: string, input: UpdateJobInput): Promise<Job | null> {
    const job = jobStore.get(jobId);
    if (!job) return null;
    if (input.status !== undefined) job.status = input.status;
    if (input.processedImageKey !== undefined) job.processedImageKey = input.processedImageKey;
    job.updatedAt = now();
    jobStore.set(jobId, job);
    return job;
  },
};
