import type { Job, JobStatus, CreateJobInput, UpdateJobInput } from '../jobs/job.types';

/**
 * Job service: orchestrates job lifecycle (create, get, update).
 * Will use job store implementation (in-memory or persistence) injected later.
 * Method signatures only for Phase 2.
 */
export interface JobService {
  create(input: CreateJobInput): Promise<Job>;
  getById(jobId: string): Promise<Job | null>;
  update(jobId: string, input: UpdateJobInput): Promise<Job | null>;
}

/**
 * Placeholder implementation – no job store yet; getById returns null so
 * status/result endpoints return 404. create/update will be wired in Phase 3.
 */
export const jobService: JobService = {
  async create(): Promise<Job> {
    throw new Error('JobService.create not implemented');
  },
  async getById(): Promise<Job | null> {
    return null;
  },
  async update(): Promise<Job | null> {
    throw new Error('JobService.update not implemented');
  },
};
