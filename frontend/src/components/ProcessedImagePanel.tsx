'use client';

export interface ProcessedImagePanelProps {
  processedImageUrl: string | null;
  status: string | null;
}

export function ProcessedImagePanel({
  processedImageUrl,
  status,
}: ProcessedImagePanelProps) {
  if (status !== 'completed' || !processedImageUrl) {
    return (
      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="mb-2 text-lg font-medium text-gray-800">
          Processed image
        </h2>
        <p className="text-sm text-gray-500">
          Processed result will appear here when ready.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-medium text-gray-800">
        Processed image
      </h2>
      <div className="overflow-hidden rounded-md border border-gray-200">
        <img
          src={processedImageUrl}
          alt="Processed result"
          className="max-h-[400px] w-full object-contain"
        />
      </div>
    </section>
  );
}
