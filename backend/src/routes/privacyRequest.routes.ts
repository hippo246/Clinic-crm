import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createPrivacyRequest,
  getPrivacyRequestById,
  listPrivacyRequests,
  updatePrivacyRequest,
  approvePrivacyRequest,
  rejectPrivacyRequest,
  completePrivacyRequest,
  cancelPrivacyRequest,
} from '../privacy/privacyRequest.controller';

const router = Router();

// All privacy request routes require authentication
router.use(authenticate);

// Privacy request routes
router.get('/', listPrivacyRequests);
router.get('/:id', getPrivacyRequestById);
router.post('/', createPrivacyRequest);
router.put('/:id', updatePrivacyRequest);
router.patch('/:id', updatePrivacyRequest);
router.post('/:id/approve', approvePrivacyRequest);
router.post('/:id/reject', rejectPrivacyRequest);
router.post('/:id/complete', completePrivacyRequest);
router.post('/:id/cancel', cancelPrivacyRequest);

export default router;
