/**
 * Import Routes
 * Routes for import operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { uploadSingle } from '../middleware/upload';
import {
  createImportPreviewController,
  executeImportController,
  cancelImportJobController,
  listImportJobsController,
  getImportJobByIdController,
} from './import.controller';

const router = Router();

// All import routes require authentication
router.use(authenticate);

// Import preview (multipart upload)
router.post('/preview', uploadSingle, createImportPreviewController);

// Import execution
router.post('/jobs/:id/execute', executeImportController);

// Import job management
router.get('/jobs', listImportJobsController);
router.get('/jobs/:id', getImportJobByIdController);
router.post('/jobs/:id/cancel', cancelImportJobController);

export default router;
