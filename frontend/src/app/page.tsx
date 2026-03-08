'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import type { JobStatus } from '@/types';
import { uploadImage, getJobStatus, getJobResult } from '@/services/api';
import { ImageUploadPanel } from '@/components/ImageUploadPanel';
import { StatusPanel } from '@/components/StatusPanel';
import { ProcessedImagePanel } from '@/components/ProcessedImagePanel';
import { ErrorNotice } from '@/components/ErrorNotice';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
const POLL_INTERVAL_MS = 2000;
const MAX_POLL_ATTEMPTS = 150; // 5 min at 2s
const MAX_CONSECUTIVE_FAILURES = 3;

export default function Page() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [processedImageUrl, setProcessedImageUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollAttemptsRef = useRef(0);
  const consecutiveFailuresRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const reset = useCallback(() => {
    stopPolling();
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setUploading(false);
    setJobId(null);
    setJobStatus(null);
    setProcessedImageUrl(null);
    setErrorMessage(null);
    pollAttemptsRef.current = 0;
    consecutiveFailuresRef.current = 0;
  }, [previewUrl, stopPolling]);

  const clearError = useCallback(() => setErrorMessage(null), []);

  // Preview URL when file is selected
  useEffect(() => {
    if (!selectedFile) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Cleanup polling on unmount
  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleFileSelect = useCallback((file: File | null) => {
    setSelectedFile(file);
    setErrorMessage(null);
  }, []);

  const fetchResult = useCallback(async (id: string) => {
    const data = await getJobResult(id);
    if (data.status === 'completed' && 'processedImageUrl' in data) {
      setProcessedImageUrl(data.processedImageUrl);
    }
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedFile) {
      setErrorMessage('Please select an image.');
      return;
    }
    if (!ALLOWED_TYPES.includes(selectedFile.type)) {
      setErrorMessage('Please select a valid image (JPEG, PNG or WebP).');
      return;
    }
    if (selectedFile.size > MAX_SIZE_BYTES) {
      setErrorMessage(`File is too large. Maximum size is ${MAX_SIZE_BYTES / 1024 / 1024} MB.`);
      return;
    }

    setErrorMessage(null);
    setUploading(true);
    try {
      const { jobId: id } = await uploadImage(selectedFile);
      setJobId(id);
      setJobStatus('queued');
      setProcessedImageUrl(null);
      pollAttemptsRef.current = 0;
      consecutiveFailuresRef.current = 0;

      pollingRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setErrorMessage('Processing is taking longer than expected. Try resetting and uploading again.');
          return;
        }
        try {
          const statusData = await getJobStatus(id);
          setJobStatus(statusData.status);
          consecutiveFailuresRef.current = 0;

          if (statusData.status === 'completed') {
            stopPolling();
            await fetchResult(id);
            return;
          }
          if (statusData.status === 'failed') {
            stopPolling();
            setErrorMessage('Processing failed.');
            return;
          }
        } catch (err) {
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            stopPolling();
            setErrorMessage(
              err instanceof Error ? err.message : 'Could not check status. Try again or reset.'
            );
          }
        }
      }, POLL_INTERVAL_MS);
    } catch (err) {
      setErrorMessage(
        err instanceof Error ? err.message : 'Upload failed. Check your connection and try again.'
      );
    } finally {
      setUploading(false);
    }
  }, [selectedFile, stopPolling, fetchResult]);

  const retry = useCallback(() => {
    setErrorMessage(null);
    if (jobId && jobStatus !== 'completed' && jobStatus !== 'failed') {
      consecutiveFailuresRef.current = 0;
      stopPolling();
      pollingRef.current = setInterval(async () => {
        pollAttemptsRef.current += 1;
        if (pollAttemptsRef.current > MAX_POLL_ATTEMPTS) {
          stopPolling();
          setErrorMessage('Processing is taking longer than expected. Try resetting and uploading again.');
          return;
        }
        try {
          const statusData = await getJobStatus(jobId);
          setJobStatus(statusData.status);
          consecutiveFailuresRef.current = 0;
          if (statusData.status === 'completed') {
            stopPolling();
            await fetchResult(jobId);
            return;
          }
          if (statusData.status === 'failed') {
            stopPolling();
            setErrorMessage('Processing failed.');
            return;
          }
        } catch (err) {
          consecutiveFailuresRef.current += 1;
          if (consecutiveFailuresRef.current >= MAX_CONSECUTIVE_FAILURES) {
            stopPolling();
            setErrorMessage(
              err instanceof Error ? err.message : 'Could not check status. Try again or reset.'
            );
          }
        }
      }, POLL_INTERVAL_MS);
    } else {
      handleUpload();
    }
  }, [jobId, jobStatus, stopPolling, fetchResult, handleUpload]);

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-2 text-2xl font-semibold text-gray-900">
        Pet Image Processor
      </h1>
      <p className="mb-8 text-gray-600">
        Upload a pet photo to process it asynchronously.
      </p>

      <div className="flex flex-col gap-6">
        <ImageUploadPanel
          selectedFile={selectedFile}
          onFileSelect={handleFileSelect}
          onUpload={handleUpload}
          uploading={uploading}
          clearError={clearError}
        />

        {previewUrl && (
          <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-medium text-gray-800">
              Preview
            </h2>
            <div className="overflow-hidden rounded-md border border-gray-200">
              <img
                src={previewUrl}
                alt="Preview of selected pet image"
                className="max-h-64 w-full object-contain"
              />
            </div>
          </section>
        )}

        <StatusPanel jobId={jobId} jobStatus={jobStatus} />

        <ProcessedImagePanel
          processedImageUrl={processedImageUrl}
          status={jobStatus}
        />

        <ErrorNotice
          errorMessage={errorMessage}
          onRetry={retry}
          onReset={reset}
        />
      </div>
    </main>
  );
}
