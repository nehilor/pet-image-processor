'use client';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

export interface ImageUploadPanelProps {
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  onUpload: () => void;
  uploading: boolean;
  clearError: () => void;
}

export function ImageUploadPanel({
  selectedFile,
  onFileSelect,
  onUpload,
  uploading,
  clearError,
}: ImageUploadPanelProps) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    clearError();
    const file = e.target.files?.[0] ?? null;
    if (!file) {
      onFileSelect(null);
      return;
    }
    onFileSelect(file);
  };

  const valid =
    selectedFile &&
    ALLOWED_TYPES.includes(selectedFile.type) &&
    selectedFile.size <= MAX_SIZE_BYTES;
  const canUpload = valid && !uploading;

  return (
    <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-medium text-gray-800">
        Upload panel
      </h2>
      <div className="flex flex-col gap-4">
        <div>
          <label
            htmlFor="image-picker"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Choose pet image
          </label>
          <input
            id="image-picker"
            type="file"
            accept={ALLOWED_TYPES.join(',')}
            onChange={handleChange}
            disabled={uploading}
            className="block w-full text-sm text-gray-600 file:mr-4 file:rounded file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-gray-700 hover:file:bg-gray-200"
            aria-label="Choose pet image (JPEG, PNG or WebP, max 5MB)"
          />
          {selectedFile && (
            <p className="mt-2 text-sm text-gray-500">
              Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onUpload}
          disabled={!canUpload}
          aria-busy={uploading}
          className="w-fit rounded-md bg-gray-800 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50 hover:bg-gray-700 disabled:hover:bg-gray-800"
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </section>
  );
}
