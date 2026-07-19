import { Router } from 'express';
import { successResponse } from '../utils/apiResponse';
import { SERVICE_NAME, SERVICE_VERSION } from '../config/constants';
import type { ApiRootResponse } from '../types';
import healthRoutes from './health.routes';
import dbHealthRoutes from './dbHealth.routes';
import authRoutes from './auth.routes';
import auditRoutes from './audit.routes';
import patientRoutes from './patient.routes';
import appointmentRoutes from './appointment.routes';
import queueRoutes from './queue.routes';
import consultationRoutes from './consultation.routes';
import prescriptionRoutes from './prescription.routes';
import labRoutes from './lab.routes';
import documentRoutes from './document.routes';
import billingRoutes from './billing.routes';
import communicationRoutes from './communication.routes';
import staffRoutes from './staff.routes';
import settingsRoutes from './settings.routes';
import privacyRequestRoutes from './privacyRequest.routes';
import consentRoutes from './consent.routes';
import communicationPreferenceRoutes from './communicationPreference.routes';
import retentionRoutes from './retention.routes';
import importRoutes from '../dataExchange/import.routes';
import exportRoutes from '../dataExchange/export.routes';
import backupRoutes from '../dataExchange/backup.routes';
import portabilityRoutes from '../dataExchange/portability.routes';

const router = Router();

// API root
router.get('/', (_req, res) => {
  const response: ApiRootResponse = {
    service: SERVICE_NAME,
    status: 'ok',
    version: SERVICE_VERSION,
    endpoints: ['/health', '/health/db', '/auth/login', '/auth/refresh', '/auth/logout', '/auth/me', '/audit/logs', '/audit/admin', '/audit/denied', '/audit/destructive', '/security/events', '/patients', '/appointments', '/queue', '/consultations', '/prescriptions', '/lab', '/documents', '/billing', '/communications', '/staff', '/settings'],
    message: 'Backend scaffold is running',
  };

  successResponse(res, response);
});

// Health routes
router.use('/', healthRoutes);

// Database health routes
router.use('/', dbHealthRoutes);

// Auth routes
router.use('/auth', authRoutes);

// Audit routes
router.use('/audit', auditRoutes);

// Security routes (under audit for now)
router.use('/security', auditRoutes);

// Patient routes
router.use('/patients', patientRoutes);

// Workflow routes
router.use('/appointments', appointmentRoutes);
router.use('/queue', queueRoutes);
router.use('/consultations', consultationRoutes);
router.use('/prescriptions', prescriptionRoutes);
router.use('/lab', labRoutes);

// Operations routes
router.use('/documents', documentRoutes);
router.use('/billing', billingRoutes);
router.use('/communications', communicationRoutes);
router.use('/staff', staffRoutes);
router.use('/settings', settingsRoutes);

// Privacy/Retention routes
router.use('/privacy/requests', privacyRequestRoutes);
router.use('/privacy/consents', consentRoutes);
router.use('/privacy/communication-preferences', communicationPreferenceRoutes);
router.use('/privacy/portability', portabilityRoutes);
router.use('/retention', retentionRoutes);

// Data Exchange routes
router.use('/import', importRoutes);
router.use('/export', exportRoutes);
router.use('/backups', backupRoutes);

export default router;
