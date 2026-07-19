import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createConsentRecord,
  getConsentRecordById,
  listConsentRecords,
  updateConsentRecord,
  revokeConsentRecord,
} from '../privacy/consent.controller';

const router = Router();

// All consent routes require authentication
router.use(authenticate);

// Consent routes
router.get('/', listConsentRecords);
router.get('/:id', getConsentRecordById);
router.post('/', createConsentRecord);
router.put('/:id', updateConsentRecord);
router.patch('/:id', updateConsentRecord);
router.post('/:id/revoke', revokeConsentRecord);

export default router;
