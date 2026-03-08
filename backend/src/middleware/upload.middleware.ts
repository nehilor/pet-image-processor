import multer from 'multer';
import { loadConfig } from '../../config/env';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function getMulterLimit(): number {
  const config = loadConfig();
  return config.maxFileSizeMb * 1024 * 1024;
}

const storage = multer.memoryStorage();

export function createUploadMiddleware(): multer.Multer {
  return multer({
    storage,
    limits: { fileSize: getMulterLimit() },
    fileFilter(_req, file, cb) {
      if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
        cb(new Error(`Invalid file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`));
        return;
      }
      cb(null, true);
    },
  });
}

export const uploadMiddleware = createUploadMiddleware();
