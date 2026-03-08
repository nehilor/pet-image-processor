'use client';

export interface ErrorNoticeProps {
  errorMessage: string | null;
  onRetry: () => void;
  onReset: () => void;
}

export function ErrorNotice({
  errorMessage,
  onRetry,
  onReset,
}: ErrorNoticeProps) {
  if (!errorMessage) return null;

  return (
    <section
      className="rounded-lg border border-red-200 bg-red-50 p-6 shadow-sm"
      role="alert"
    >
      <h2 className="mb-2 text-lg font-medium text-red-800">Error</h2>
      <p className="mb-4 text-sm text-red-700">{errorMessage}</p>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={onRetry}
          className="rounded-md bg-red-800 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={onReset}
          className="rounded-md border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
        >
          Reset
        </button>
      </div>
    </section>
  );
}
