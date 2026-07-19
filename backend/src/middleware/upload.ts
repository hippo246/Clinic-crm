import multer from 'multer';
import { Request } from 'express';
import { env } from '../config/env';

// Configure multer for memory storage (files are processed before being stored)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(env.DOCUMENT_MAX_FILE_SIZE_MB, 10) * 1024 * 1024, // Convert MB to bytes
  },
  fileFilter: (_req: Request, file, cb) => {
    const allowedMimeTypes = env.DOCUMENT_ALLOWED_MIME_TYPES.split(',');
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`));
    }
  },
});

export const uploadSingle = upload.single('file');
export const uploadMultiple = upload.array('files', 10); // Max 10 files at once
