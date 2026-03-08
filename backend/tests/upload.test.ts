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

describe('POST /upload', () => {
  it('returns 201 with jobId and status queued when file is valid', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', fixturePath)
      .expect(201);

    expect(res.body).toHaveProperty('jobId');
    expect(typeof res.body.jobId).toBe('string');
    expect(res.body.jobId.length).toBeGreaterThan(0);
    expect(res.body).toMatchObject({ status: 'queued' });

    expect(mockUpload).toHaveBeenCalledTimes(1);
    expect(mockUpload).toHaveBeenCalledWith(res.body.jobId, expect.any(Buffer));
    expect(mockPublish).toHaveBeenCalledTimes(1);
    expect(mockPublish).toHaveBeenCalledWith(
      res.body.jobId,
      `original-images/${res.body.jobId}.jpg`
    );
  });

  it('returns 400 when no file is provided', async () => {
    const res = await request(app)
      .post('/upload')
      .expect(400);

    expect(res.body).toMatchObject({
      error: 'Bad request',
      message: expect.stringContaining('No image file'),
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  it('returns 400 when file has invalid type', async () => {
    const res = await request(app)
      .post('/upload')
      .attach('image', Buffer.from('not an image'), { filename: 'file.txt', contentType: 'text/plain' })
      .expect(400);

    expect(res.body).toMatchObject({
      error: 'Bad request',
      message: expect.stringMatching(/Invalid file type|Allowed/),
    });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
