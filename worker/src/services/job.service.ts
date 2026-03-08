import { loadConfig } from '../../config/env';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Update job status on the backend via PATCH /api/jobs/:jobId
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  processedImageKey?: string | null
): Promise<void> {
  const config = loadConfig();
  const url = `${config.backendBaseUrl.replace(/\/$/, '')}/api/jobs/${encodeURIComponent(jobId)}`;
  const body: Record<string, string | null> = { status };
  if (processedImageKey !== undefined) body.processedImageKey = processedImageKey;
  const res = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Job update failed: ${res.status} ${text}`);
  }
}
