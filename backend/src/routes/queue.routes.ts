import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createQueueEntry,
  getQueueEntryById,
  listQueueEntries,
  updateQueueEntry,
  updateQueueEntryStatus,
  updateQueueEntryPriority,
} from '../workflow/queue.controller';

const router = Router();

// All queue routes require authentication
router.use(authenticate);

// Queue CRUD routes
router.get('/', listQueueEntries);
router.get('/:id', getQueueEntryById);
router.post('/', createQueueEntry);
router.patch('/:id', updateQueueEntry);
router.post('/:id/status', updateQueueEntryStatus);
router.post('/:id/priority', updateQueueEntryPriority);

export default router;
