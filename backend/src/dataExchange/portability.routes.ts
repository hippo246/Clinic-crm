/**
 * Portability Routes
 * Routes for portability export package operations
 */

import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { createPortabilityPackageController } from './portability.controller';

const router = Router();

// All portability routes require authentication
router.use(authenticate);

// Portability package creation
router.post('/packages', createPortabilityPackageController);

export default router;
