import request from 'supertest';
import { app } from '../src/app';
import { jobService } from '../src/services/job.service';

describe('GET /status/:jobId', () => {
  const testJobId = 'status-test-job-' + Date.now();
  const originalKey = 'original-images/status-test.jpg';

  beforeAll(async () => {
    await jobService.create({ jobId: testJobId, originalImageKey: originalKey });
  });

  it('returns 200 with jobId and status queued', async () => {
    const res = await request(app)
      .get(`/status/${testJobId}`)
      .expect(200);

    expect(res.body).toMatchObject({
      jobId: testJobId,
      status: 'queued',
    });
  });

  it('returns 200 with status processing after update', async () => {
    const id = 'status-processing-' + Date.now();
    await jobService.create({ jobId: id, originalImageKey: originalKey });
    await jobService.update(id, { status: 'processing' });

    const res = await request(app).get(`/status/${id}`).expect(200);
    expect(res.body).toMatchObject({ jobId: id, status: 'processing' });
  });

  it('returns 200 with status completed after update', async () => {
    const id = 'status-completed-' + Date.now();
    await jobService.create({ jobId: id, originalImageKey: originalKey });
    await jobService.update(id, {
      status: 'completed',
      processedImageKey: 'processed-images/out.jpg',
    });

    const res = await request(app).get(`/status/${id}`).expect(200);
    expect(res.body).toMatchObject({ jobId: id, status: 'completed' });
  });

  it('returns 404 for unknown jobId', async () => {
    const res = await request(app)
      .get('/status/non-existent-job-id-xyz-404')
      .expect(404);

    expect(res.body).toMatchObject({
      error: 'Job not found',
      jobId: 'non-existent-job-id-xyz-404',
    });
  });
});
