import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createLabOrder,
  getLabOrderById,
  listLabOrders,
  updateLabOrder,
  updateLabOrderStatus,
  cancelLabOrder,
  createLabResult,
  getLabResultById,
  listLabResults,
  updateLabResult,
  approveLabResult,
  rejectLabResult,
  markLabResultCritical,
} from '../workflow/lab.controller';

const router = Router();

// All lab routes require authentication
router.use(authenticate);

// Lab order routes
router.get('/orders', listLabOrders);
router.get('/orders/:id', getLabOrderById);
router.post('/orders', createLabOrder);
router.put('/orders/:id', updateLabOrder);
router.patch('/orders/:id', updateLabOrder);
router.post('/orders/:id/status', updateLabOrderStatus);
router.post('/orders/:id/cancel', cancelLabOrder);

// Lab result routes
router.get('/results', listLabResults);
router.get('/results/:id', getLabResultById);
router.post('/results', createLabResult);
router.put('/results/:id', updateLabResult);
router.patch('/results/:id', updateLabResult);
router.post('/results/:id/approve', approveLabResult);
router.post('/results/:id/reject', rejectLabResult);
router.post('/results/:id/critical', markLabResultCritical);

export default router;
