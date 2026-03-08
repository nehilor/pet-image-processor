import type { UploadResponse, StatusResponse, ResultResponse } from '@/types';

const getBaseUrl = (): string => {
  const url = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';
  return url;
};

/**
 * Upload an image file. Uses multipart field "image".
 * Returns jobId and status on 201.
 */
export async function uploadImage(file: File): Promise<UploadResponse> {
  const base = getBaseUrl();
  const url = base ? `${base.replace(/\/$/, '')}/upload` : '/upload';
  const formData = new FormData();
  formData.append('image', file);

  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.message === 'string'
        ? body.message
        : body?.error ?? `Upload failed: ${res.status}`;
    throw new Error(message);
  }

  const data = (await res.json()) as UploadResponse;
  if (!data.jobId || data.status !== 'queued') {
    throw new Error('Invalid upload response');
  }
  return data;
}

/**
 * Get current job status.
 */
export async function getJobStatus(jobId: string): Promise<StatusResponse> {
  const base = getBaseUrl();
  const url = base
    ? `${base.replace(/\/$/, '')}/status/${encodeURIComponent(jobId)}`
    : `/status/${encodeURIComponent(jobId)}`;

  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error('Job not found');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.message === 'string'
        ? body.message
        : body?.error ?? `Status check failed: ${res.status}`;
    throw new Error(message);
  }

  return res.json() as Promise<StatusResponse>;
}

/**
 * Get processed image URL when job is completed.
 * If not completed, returns status only (no processedImageUrl).
 */
export async function getJobResult(
  jobId: string
): Promise<ResultResponse | { jobId: string; status: string }> {
  const base = getBaseUrl();
  const url = base
    ? `${base.replace(/\/$/, '')}/result/${encodeURIComponent(jobId)}`
    : `/result/${encodeURIComponent(jobId)}`;

  const res = await fetch(url);

  if (res.status === 404) {
    throw new Error('Job not found');
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const message =
      typeof body?.message === 'string'
        ? body.message
        : body?.error ?? `Result fetch failed: ${res.status}`;
    throw new Error(message);
  }

  const data = (await res.json()) as ResultResponse | { jobId: string; status: string };
  return data;
}
