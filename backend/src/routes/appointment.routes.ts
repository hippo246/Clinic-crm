import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment,
  updateAppointmentStatus,
  cancelAppointment,
  markAppointmentNoShow,
} from '../workflow/appointment.controller';

const router = Router();

// All appointment routes require authentication
router.use(authenticate);

// Appointment CRUD routes
router.get('/', listAppointments);
router.get('/:id', getAppointmentById);
router.post('/', createAppointment);
router.put('/:id', updateAppointment);
router.patch('/:id', updateAppointment);
router.post('/:id/status', updateAppointmentStatus);
router.post('/:id/cancel', cancelAppointment);
router.post('/:id/no-show', markAppointmentNoShow);

export default router;
