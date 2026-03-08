import path from 'path';
import request from 'supertest';
import { app } from '../src/app';
import { uploadOriginalImage } from '../src/services/storage.service';
import { publishImageProcessingJob } from '../src/services/queue.service';

jest.mock('../src/services/storage.service', () => ({
  uploadOriginalImage: jest.fn(),
}));
jest.mock('../src/services/queue.service', () => ({
  publishImageProcessingJob: jest.fn(),
}));

const mockUpload = uploadOriginalImage as jest.MockedFunction<typeof uploadOriginalImage>;
const mockPublish = publishImageProcessingJob as jest.MockedFunction<typeof publishImageProcessingJob>;

const fixturePath = path.join(__dirname, 'fixtures', 'photo.jpg');

beforeEach(() => {
  jest.clearAllMocks();
  mockUpload.mockImplementation((jobId: string) =>
    Promise.resolve(`original-images/${jobId}.jpg`)
  );
  mockPublish.mockResolvedValue(undefined);
});

describe('Upload then status (integration-style)', () => {
  it('POST /upload creates job, GET /status/:jobId returns job and status', async () => {
    const uploadRes = await request(app)
      .post('/upload')
      .attach('image', fixturePath)
      .expect(201);

    const { jobId } = uploadRes.body;
    expect(jobId).toBeDefined();
    expect(uploadRes.body.status).toBe('queued');

    const statusRes = await request(app)
      .get(`/status/${jobId}`)
      .expect(200);

    expect(statusRes.body).toMatchObject({
      jobId,
      status: 'queued',
    });
  });
});
