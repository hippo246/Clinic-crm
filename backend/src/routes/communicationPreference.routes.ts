import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  getCommunicationPreferences,
  updateCommunicationPreference,
  optOutCommunication,
  optInCommunication,
} from '../privacy/communicationPreference.controller';

const router = Router();

// All communication preference routes require authentication
router.use(authenticate);

// Communication preference routes
router.get('/patients/:patientId/communication-preferences', getCommunicationPreferences);
router.put('/patients/:patientId/communication-preferences', updateCommunicationPreference);
router.patch('/patients/:patientId/communication-preferences', updateCommunicationPreference);
router.post('/patients/:patientId/communication-preferences/opt-out', optOutCommunication);
router.post('/patients/:patientId/communication-preferences/opt-in', optInCommunication);

export default router;
