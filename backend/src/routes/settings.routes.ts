import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import {
  getClinicSettings,
  updateClinicSetting,
  getSystemSettings,
  updateSystemSetting,
  getAllSettings,
  batchUpdateSettings,
} from '../operations/settings.controller';

const router = Router();

// All settings routes require authentication
router.use(authenticate);

// Clinic settings routes
router.get('/clinic', getClinicSettings);
router.put('/clinic/:key', updateClinicSetting);

// System settings routes
router.get('/system', getSystemSettings);
router.put('/system/:key', updateSystemSetting);

// All settings routes
router.get('/', getAllSettings);
router.patch('/', batchUpdateSettings);

export default router;
