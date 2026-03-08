import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface MulterError extends Error {
  code?: string;
}

export function errorHandler(
  err: MulterError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({
      error: 'Payload too large',
      message: 'File size exceeds the allowed limit.',
    });
    return;
  }

  if (err.message && err.message.includes('Invalid file type')) {
    res.status(400).json({
      error: 'Bad request',
      message: err.message,
    });
    return;
  }

  logger.error('Unhandled error', { error: err.message });
  res.status(500).json({
    error: 'Internal server error',
    message: 'An unexpected error occurred.',
  });
}
