import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createRetentionPolicy,
  getRetentionPolicyById,
  listRetentionPolicies,
  updateRetentionPolicy,
  activateRetentionPolicy,
  deactivateRetentionPolicy,
  previewRetentionCleanup,
  runRetentionCleanup,
  getRetentionRunById,
  listRetentionRuns,
} from '../privacy/retention.controller';

const router = Router();

// All retention routes require authentication
router.use(authenticate);

// Retention policy routes
router.get('/policies', listRetentionPolicies);
router.get('/policies/:id', getRetentionPolicyById);
router.post('/policies', createRetentionPolicy);
router.put('/policies/:id', updateRetentionPolicy);
router.patch('/policies/:id', updateRetentionPolicy);
router.post('/policies/:id/activate', activateRetentionPolicy);
router.post('/policies/:id/deactivate', deactivateRetentionPolicy);

// Retention run routes
router.post('/preview', previewRetentionCleanup);
router.post('/run', runRetentionCleanup);
router.get('/runs', listRetentionRuns);
router.get('/runs/:id', getRetentionRunById);

export default router;
