'use client';

import type { JobStatus } from '@/types';

export interface StatusPanelProps {
  jobId: string | null;
  jobStatus: JobStatus | null;
}

const STATUS_LABELS: Record<JobStatus, string> = {
  queued: 'Queued',
  processing: 'Processing…',
  completed: 'Complete',
  failed: 'Failed',
};

export function StatusPanel({ jobId, jobStatus }: StatusPanelProps) {
  if (jobId == null && jobStatus == null) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-gray-800">
          Processing status
        </h2>
        <p className="text-sm text-gray-500">
          Select a pet image to get started.
        </p>
      </section>
    );
  }

  const label = jobStatus ? STATUS_LABELS[jobStatus] : '—';
  const statusClass =
    jobStatus === 'completed'
      ? 'text-green-700 font-medium'
      : jobStatus === 'failed'
        ? 'text-red-700 font-medium'
        : 'text-gray-700';

  return (
    <section
      className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm"
      aria-live="polite"
      aria-label={`Status: ${label}`}
    >
      <h2 className="mb-2 text-lg font-medium text-gray-800">
        Processing status
      </h2>
      <p className={`text-sm ${statusClass}`}>{label}</p>
      {jobId && (
        <p className="mt-1 text-xs text-gray-500" aria-hidden="true">
          Job ID: {jobId}
        </p>
      )}
    </section>
  );
}
