import { Router, Response } from 'express';
import { getAuditLogs, exportAuditLogs } from '../services/auditService';
import { getAdminAuditLogs, exportAdminAuditLogs } from '../services/adminAuditService';
import { getSecurityEvents, exportSecurityEvents } from '../services/securityEventService';
import { getDeniedActions } from '../services/deniedActionService';
import { getDestructiveActionLogs } from '../services/destructiveActionService';
import { requireRole } from '../middleware/rbac';
import { authenticate } from '../middleware/authenticate';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { 
  auditQuerySchema, 
  adminAuditQuerySchema, 
  securityEventQuerySchema, 
  deniedActionQuerySchema,
  destructiveActionQuerySchema 
} from '../auth/audit.validation';
import { AuthenticatedRequest } from '../auth/auth.types';

const router = Router();

// Apply authentication to all audit routes
router.use(authenticate);

// GET /api/audit/logs
router.get('/logs', requireRole('admin', 'auditor'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = auditQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const result = await getAuditLogs(validationResult.data);
    successResponse(res, result);
  } catch (error) {
    errorResponse(res, 'AUDIT_LOGS_ERROR', 'Failed to retrieve audit logs', 500);
  }
});

// GET /api/audit/admin
router.get('/admin', requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = adminAuditQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const result = await getAdminAuditLogs(validationResult.data);
    successResponse(res, result);
  } catch (error) {
    errorResponse(res, 'ADMIN_AUDIT_LOGS_ERROR', 'Failed to retrieve admin audit logs', 500);
  }
});

// GET /api/audit/denied
router.get('/denied', requireRole('admin', 'auditor'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = deniedActionQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const result = await getDeniedActions(validationResult.data);
    successResponse(res, result);
  } catch (error) {
    errorResponse(res, 'DENIED_ACTIONS_ERROR', 'Failed to retrieve denied actions', 500);
  }
});

// GET /api/audit/destructive
router.get('/destructive', requireRole('admin', 'auditor'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = destructiveActionQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const result = await getDestructiveActionLogs(validationResult.data);
    successResponse(res, result);
  } catch (error) {
    errorResponse(res, 'DESTRUCTIVE_ACTIONS_ERROR', 'Failed to retrieve destructive action logs', 500);
  }
});

// GET /api/security/events
router.get('/events', requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = securityEventQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const result = await getSecurityEvents(validationResult.data);
    successResponse(res, result);
  } catch (error) {
    errorResponse(res, 'SECURITY_EVENTS_ERROR', 'Failed to retrieve security events', 500);
  }
});

// Export endpoints (admin only)
// GET /api/audit/logs/export
router.get('/logs/export', requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = auditQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const logs = await exportAuditLogs(validationResult.data);
    successResponse(res, { logs, count: logs.length });
  } catch (error) {
    errorResponse(res, 'AUDIT_EXPORT_ERROR', 'Failed to export audit logs', 500);
  }
});

// GET /api/audit/admin/export
router.get('/admin/export', requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = adminAuditQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const logs = await exportAdminAuditLogs(validationResult.data);
    successResponse(res, { logs, count: logs.length });
  } catch (error) {
    errorResponse(res, 'ADMIN_AUDIT_EXPORT_ERROR', 'Failed to export admin audit logs', 500);
  }
});

// GET /api/security/events/export
router.get('/events/export', requireRole('admin'), async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const validationResult = securityEventQuerySchema.safeParse(req.query);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }

    const events = await exportSecurityEvents(validationResult.data);
    successResponse(res, { events, count: events.length });
  } catch (error) {
    errorResponse(res, 'SECURITY_EXPORT_ERROR', 'Failed to export security events', 500);
  }
});

export default router;
