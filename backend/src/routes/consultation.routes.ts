import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createConsultation,
  getConsultationById,
  listConsultations,
  updateConsultation,
  updateConsultationStatus,
  completeConsultation,
  cancelConsultation,
} from '../workflow/consultation.controller';

const router = Router();

// All consultation routes require authentication
router.use(authenticate);

// Consultation CRUD routes
router.get('/', listConsultations);
router.get('/:id', getConsultationById);
router.post('/', createConsultation);
router.put('/:id', updateConsultation);
router.patch('/:id', updateConsultation);
router.post('/:id/status', updateConsultationStatus);
router.post('/:id/complete', completeConsultation);
router.post('/:id/cancel', cancelConsultation);

export default router;
