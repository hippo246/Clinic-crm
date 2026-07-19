/**
 * Backup Routes
 * Routes for backup operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createBackupArchiveController,
  listBackupArchivesController,
  getBackupArchiveByIdController,
  downloadBackupArchiveController,
  restorePreviewController,
  restoreBackupController,
} from './backup.controller';

const router = Router();

// All backup routes require authentication
router.use(authenticate);

// Backup archive creation
router.post('/', createBackupArchiveController);

// Backup archive management
router.get('/', listBackupArchivesController);
router.get('/:id', getBackupArchiveByIdController);
router.get('/:id/download', downloadBackupArchiveController);

// Restore operations
router.post('/:id/restore-preview', restorePreviewController);
router.post('/:id/restore', restoreBackupController);

export default router;
