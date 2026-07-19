import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { 
  createPatient,
  getPatientById,
  listPatients,
  updatePatient,
  archivePatient,
  restorePatient,
  getPatientAuditTrail,
  getPatientTimelineEvents,
  addPatientTimelineEvent,
  getPatientNotes,
  createPatientNote,
  updatePatientNote,
  deletePatientNote,
} from '../patients/patient.controller';

const router = Router();

// All patient routes require authentication
router.use(authenticate);

// Patient CRUD routes
router.get('/', listPatients);
router.get('/:id', getPatientById);
router.post('/', createPatient);
router.put('/:id', updatePatient);
router.patch('/:id', updatePatient);
router.post('/:id/archive', archivePatient);
router.post('/:id/restore', restorePatient);

// Patient audit trail
router.get('/:id/audit', getPatientAuditTrail);

// Patient timeline
router.get('/:id/timeline', getPatientTimelineEvents);
router.post('/:id/timeline', addPatientTimelineEvent);

// Patient notes
router.get('/:id/notes', getPatientNotes);
router.post('/:id/notes', createPatientNote);
router.patch('/:id/notes/:noteId', updatePatientNote);
router.delete('/:id/notes/:noteId', deletePatientNote);

export default router;
