/**
 * Export Routes
 * Routes for export operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createExportJobController,
  listExportJobsController,
  getExportJobByIdController,
  downloadExportFileController,
  cancelExportJobController,
} from './export.controller';

const router = Router();

// All export routes require authentication
router.use(authenticate);

// Export job creation
router.post('/jobs', createExportJobController);

// Export job management
router.get('/jobs', listExportJobsController);
router.get('/jobs/:id', getExportJobByIdController);
router.get('/jobs/:id/download', downloadExportFileController);
router.post('/jobs/:id/cancel', cancelExportJobController);

export default router;
