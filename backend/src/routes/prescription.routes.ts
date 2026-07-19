import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createPrescription,
  getPrescriptionById,
  listPrescriptions,
  updatePrescription,
  updatePrescriptionStatus,
  refillPrescription,
  discontinuePrescription,
} from '../workflow/prescription.controller';

const router = Router();

// All prescription routes require authentication
router.use(authenticate);

// Prescription CRUD routes
router.get('/', listPrescriptions);
router.get('/:id', getPrescriptionById);
router.post('/', createPrescription);
router.put('/:id', updatePrescription);
router.patch('/:id', updatePrescription);
router.post('/:id/status', updatePrescriptionStatus);
router.post('/:id/refill', refillPrescription);
router.post('/:id/discontinue', discontinuePrescription);

export default router;
