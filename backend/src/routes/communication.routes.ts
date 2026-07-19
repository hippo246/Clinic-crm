import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createCommunication,
  getCommunicationById,
  listCommunications,
  updateCommunication,
  deleteCommunication,
  listScheduledCommunications,
  scheduleCommunication,
  updateScheduledCommunication,
  cancelScheduledCommunication,
  listCommunicationTemplates,
  createCommunicationTemplate,
  updateCommunicationTemplate,
  deleteCommunicationTemplate,
  listCallLogs,
  createCallLog,
  updateCallLog,
} from '../operations/communication.controller';

const router = Router();

// All communication routes require authentication
router.use(authenticate);

// Communication routes
router.get('/', listCommunications);
router.get('/:id', getCommunicationById);
router.post('/', createCommunication);
router.put('/:id', updateCommunication);
router.patch('/:id', updateCommunication);
router.delete('/:id', deleteCommunication);

// Scheduled communication routes
router.get('/scheduled', listScheduledCommunications);
router.post('/scheduled', scheduleCommunication);
router.patch('/scheduled/:id', updateScheduledCommunication);
router.post('/scheduled/:id/cancel', cancelScheduledCommunication);

// Communication template routes
router.get('/templates', listCommunicationTemplates);
router.post('/templates', createCommunicationTemplate);
router.patch('/templates/:id', updateCommunicationTemplate);
router.delete('/templates/:id', deleteCommunicationTemplate);

// Call log routes
router.get('/calls', listCallLogs);
router.post('/calls', createCallLog);
router.patch('/calls/:id', updateCallLog);

export default router;
