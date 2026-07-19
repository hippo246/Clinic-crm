import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  createStaffMember,
  getStaffMemberById,
  listStaffMembers,
  updateStaffMember,
  deactivateStaffMember,
  reactivateStaffMember,
  deleteStaffMember,
  getStaffSchedules,
  createStaffSchedule,
  updateStaffSchedule,
  deleteStaffSchedule,
} from '../operations/staff.controller';

const router = Router();

// All staff routes require authentication
router.use(authenticate);

// Staff member routes
router.get('/', listStaffMembers);
router.get('/:id', getStaffMemberById);
router.post('/', createStaffMember);
router.put('/:id', updateStaffMember);
router.patch('/:id', updateStaffMember);
router.post('/:id/deactivate', deactivateStaffMember);
router.post('/:id/reactivate', reactivateStaffMember);
router.delete('/:id', deleteStaffMember);

// Staff schedule routes
router.get('/:id/schedules', getStaffSchedules);
router.post('/:id/schedules', createStaffSchedule);
router.patch('/:id/schedules/:scheduleId', updateStaffSchedule);
router.delete('/:id/schedules/:scheduleId', deleteStaffSchedule);

export default router;
