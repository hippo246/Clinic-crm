import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createCommunication as createCommunicationService,
  getCommunicationById as getCommunicationByIdService,
  listCommunications as listCommunicationsService,
  updateCommunication as updateCommunicationService,
  deleteCommunication as deleteCommunicationService,
  scheduleCommunication as scheduleCommunicationService,
  listScheduledCommunications as listScheduledCommunicationsService,
  updateScheduledCommunication as updateScheduledCommunicationService,
  cancelScheduledCommunication as cancelScheduledCommunicationService,
  createCommunicationTemplate as createCommunicationTemplateService,
  // getCommunicationTemplateById as getCommunicationTemplateByIdService,
  listCommunicationTemplates as listCommunicationTemplatesService,
  updateCommunicationTemplate as updateCommunicationTemplateService,
  deleteCommunicationTemplate as deleteCommunicationTemplateService,
  createCallLog as createCallLogService,
  // getCallLogById as getCallLogByIdService,
  listCallLogs as listCallLogsService,
  updateCallLog as updateCallLogService,
} from './communication.service';
import {
  createCommunicationSchema,
  updateCommunicationSchema,
  scheduleCommunicationSchema,
  communicationTemplateSchema,
  updateCommunicationTemplateSchema,
  createCallLogSchema,
  updateCallLogSchema,
  communicationListQuerySchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== COMMUNICATION CONTROLLERS ====================

export async function createCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createCommunicationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create communications', 403);
      return;
    }

    const communication = await createCommunicationService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, communication, 'Communication created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create communication', 500);
  }
}

export async function getCommunicationById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view communications', 403);
      return;
    }

    const communication = await getCommunicationByIdService(id);

    if (!communication) {
      errorResponse(res, 'NOT_FOUND', 'Communication not found', 404);
      return;
    }

    successResponse(res, communication, 'Communication retrieved successfully');
  } catch (error) {
    logger.error('Get communication by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get communication', 500);
  }
}

export async function listCommunications(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = communicationListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view communications', 403);
      return;
    }

    const result = await listCommunicationsService(validatedQuery);

    successResponse(res, result, 'Communications retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List communications controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list communications', 500);
  }
}

export async function updateCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateCommunicationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update communications', 403);
      return;
    }

    const communication = await updateCommunicationService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, communication, 'Communication updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Communication not found') {
      errorResponse(res, 'NOT_FOUND', 'Communication not found', 404);
      return;
    }
    logger.error('Update communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update communication', 500);
  }
}

export async function deleteCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete communications', 403);
      return;
    }

    const result = await deleteCommunicationService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Communication deleted successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Communication not found') {
      errorResponse(res, 'NOT_FOUND', 'Communication not found', 404);
      return;
    }
    logger.error('Delete communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete communication', 500);
  }
}

// ==================== SCHEDULED COMMUNICATION CONTROLLERS ====================

export async function listScheduledCommunications(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.query;

    // Check permissions
    if (!req.user?.permissions.includes('view_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view scheduled communications', 403);
      return;
    }

    const scheduled = await listScheduledCommunicationsService(patientId as string | undefined);

    successResponse(res, scheduled, 'Scheduled communications retrieved successfully');
  } catch (error) {
    logger.error('List scheduled communications controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list scheduled communications', 500);
  }
}

export async function scheduleCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = scheduleCommunicationSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to schedule communications', 403);
      return;
    }

    const scheduled = await scheduleCommunicationService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, scheduled, 'Communication scheduled successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Schedule communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to schedule communication', 500);
  }
}

export async function updateScheduledCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = scheduleCommunicationSchema.partial().parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update scheduled communications', 403);
      return;
    }

    const scheduled = await updateScheduledCommunicationService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, scheduled, 'Scheduled communication updated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Scheduled communication not found') {
      errorResponse(res, 'NOT_FOUND', 'Scheduled communication not found', 404);
      return;
    }
    logger.error('Update scheduled communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update scheduled communication', 500);
  }
}

export async function cancelScheduledCommunication(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel scheduled communications', 403);
      return;
    }

    const scheduled = await cancelScheduledCommunicationService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, scheduled, 'Scheduled communication cancelled successfully');
  } catch (error) {
    logger.error('Cancel scheduled communication controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel scheduled communication', 500);
  }
}

// ==================== COMMUNICATION TEMPLATE CONTROLLERS ====================

export async function listCommunicationTemplates(req: AuthenticatedRequest, res: Response) {
  try {
    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view communication templates', 403);
      return;
    }

    const templates = await listCommunicationTemplatesService();

    successResponse(res, templates, 'Communication templates retrieved successfully');
  } catch (error) {
    logger.error('List communication templates controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list communication templates', 500);
  }
}

export async function createCommunicationTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = communicationTemplateSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create communication templates', 403);
      return;
    }

    const template = await createCommunicationTemplateService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, template, 'Communication template created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create communication template controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create communication template', 500);
  }
}

export async function updateCommunicationTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateCommunicationTemplateSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update communication templates', 403);
      return;
    }

    const template = await updateCommunicationTemplateService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, template, 'Communication template updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Communication template not found') {
      errorResponse(res, 'NOT_FOUND', 'Communication template not found', 404);
      return;
    }
    logger.error('Update communication template controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update communication template', 500);
  }
}

export async function deleteCommunicationTemplate(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete communication templates', 403);
      return;
    }

    const result = await deleteCommunicationTemplateService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Communication template deleted successfully');
  } catch (error) {
    logger.error('Delete communication template controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete communication template', 500);
  }
}

// ==================== CALL LOG CONTROLLERS ====================

export async function listCallLogs(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.query;

    // Check permissions
    if (!req.user?.permissions.includes('view_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view call logs', 403);
      return;
    }

    const callLogs = await listCallLogsService(patientId as string | undefined);

    successResponse(res, callLogs, 'Call logs retrieved successfully');
  } catch (error) {
    logger.error('List call logs controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list call logs', 500);
  }
}

export async function createCallLog(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createCallLogSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create call logs', 403);
      return;
    }

    const callLog = await createCallLogService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, callLog, 'Call log created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create call log controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create call log', 500);
  }
}

export async function updateCallLog(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateCallLogSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('send_communications') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update call logs', 403);
      return;
    }

    const callLog = await updateCallLogService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, callLog, 'Call log updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Call log not found') {
      errorResponse(res, 'NOT_FOUND', 'Call log not found', 404);
      return;
    }
    logger.error('Update call log controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update call log', 500);
  }
}
