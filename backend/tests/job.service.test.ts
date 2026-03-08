import {
  createJob,
  getJob,
  updateJobStatus,
  setProcessedImage,
  jobService,
} from '../src/services/job.service';

describe('job.service', () => {
  const testJobId = 'test-job-' + Date.now();
  const originalKey = 'original-images/test.jpg';

  describe('createJob', () => {
    it('creates a job with status queued', () => {
      const job = createJob(testJobId, originalKey);
      expect(job).toMatchObject({
        jobId: testJobId,
        status: 'queued',
        originalImageKey: originalKey,
        processedImageKey: null,
      });
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    it('stores the job so getJob can find it', () => {
      const created = createJob('job-get-test', originalKey);
      const found = getJob('job-get-test');
      expect(found).not.toBeNull();
      expect(found?.jobId).toBe(created.jobId);
      expect(found?.status).toBe('queued');
    });
  });

  describe('getJob', () => {
    it('returns null for unknown jobId', () => {
      const found = getJob('non-existent-job-id-xyz');
      expect(found).toBeNull();
    });

    it('returns the job when it exists', () => {
      createJob('job-found', originalKey);
      const found = getJob('job-found');
      expect(found).not.toBeNull();
      expect(found?.jobId).toBe('job-found');
      expect(found?.originalImageKey).toBe(originalKey);
    });
  });

  describe('updateJobStatus', () => {
    it('updates status and returns the job', () => {
      createJob('job-update-status', originalKey);
      const updated = updateJobStatus('job-update-status', 'processing');
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('processing');
      expect(getJob('job-update-status')?.status).toBe('processing');
    });

    it('returns null for unknown jobId', () => {
      const result = updateJobStatus('unknown-id-status', 'processing');
      expect(result).toBeNull();
    });

    it('supports full lifecycle: queued -> processing -> completed', () => {
      const id = 'job-lifecycle';
      createJob(id, originalKey);
      expect(getJob(id)?.status).toBe('queued');
      updateJobStatus(id, 'processing');
      expect(getJob(id)?.status).toBe('processing');
      updateJobStatus(id, 'completed');
      expect(getJob(id)?.status).toBe('completed');
    });

    it('supports failed status', () => {
      createJob('job-failed', originalKey);
      updateJobStatus('job-failed', 'failed');
      expect(getJob('job-failed')?.status).toBe('failed');
    });
  });

  describe('setProcessedImage', () => {
    it('sets processedImageKey and status to completed', () => {
      createJob('job-processed', originalKey);
      const processedKey = 'processed-images/job-processed.jpg';
      const updated = setProcessedImage('job-processed', processedKey);
      expect(updated).not.toBeNull();
      expect(updated?.status).toBe('completed');
      expect(updated?.processedImageKey).toBe(processedKey);
      expect(getJob('job-processed')?.processedImageKey).toBe(processedKey);
    });

    it('returns null for unknown jobId', () => {
      const result = setProcessedImage('unknown-id-key', 'processed/key.jpg');
      expect(result).toBeNull();
    });
  });

  describe('jobService (async API)', () => {
    it('create returns job', async () => {
      const id = 'job-async-create';
      const job = await jobService.create({ jobId: id, originalImageKey: originalKey });
      expect(job.jobId).toBe(id);
      expect(job.status).toBe('queued');
    });

    it('getById returns null for unknown job', async () => {
      const found = await jobService.getById('async-unknown-id');
      expect(found).toBeNull();
    });

    it('update updates status and processedImageKey', async () => {
      const id = 'job-async-update';
      await jobService.create({ jobId: id, originalImageKey: originalKey });
      const updated = await jobService.update(id, {
        status: 'processing',
        processedImageKey: 'processed/images.jpg',
      });
      expect(updated?.status).toBe('processing');
      expect(updated?.processedImageKey).toBe('processed/images.jpg');
    });

    it('update returns null for unknown jobId', async () => {
      const result = await jobService.update('async-update-unknown', { status: 'completed' });
      expect(result).toBeNull();
    });
  });
});
