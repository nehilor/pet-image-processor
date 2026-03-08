import { loadConfig } from '../../config/env';

export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed';

/**
 * Update job status on the backend via POST /internal/job-update
 */
export async function updateJobStatus(
  jobId: string,
  status: JobStatus,
  processedImageKey?: string | null
): Promise<void> {
  const config = loadConfig();
  const url = `${config.backendBaseUrl.replace(/\/$/, '')}/internal/job-update`;
  const body: Record<string, string | null> = { jobId, status };
  if (processedImageKey !== undefined && processedImageKey !== null) {
    body.processedImageKey = processedImageKey;
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Job update failed: ${res.status} ${text}`);
  }
}
