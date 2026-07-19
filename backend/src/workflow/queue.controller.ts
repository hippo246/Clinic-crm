import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createQueueEntry as createQueueEntryService,
  getQueueEntryById as getQueueEntryByIdService,
  listQueueEntries as listQueueEntriesService,
  updateQueueEntry as updateQueueEntryService,
  updateQueueEntryStatus as updateQueueEntryStatusService,
  updateQueueEntryPriority as updateQueueEntryPriorityService,
} from './queue.service';
import {
  createQueueEntrySchema,
  updateQueueEntrySchema,
  queueStatusSchema,
  queuePrioritySchema,
  queueListQuerySchema,
} from './workflow.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create queue entry controller
 */
export async function createQueueEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createQueueEntrySchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create queue entries', 403);
      return;
    }

    const queueEntry = await createQueueEntryService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, queueEntry, 'Queue entry created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create queue entry controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create queue entry', 500);
  }
}

/**
 * Get queue entry by ID controller
 */
export async function getQueueEntryById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view queue entries', 403);
      return;
    }

    const queueEntry = await getQueueEntryByIdService(id);

    if (!queueEntry) {
      errorResponse(res, 'NOT_FOUND', 'Queue entry not found', 404);
      return;
    }

    successResponse(res, queueEntry, 'Queue entry retrieved successfully');
  } catch (error) {
    logger.error('Get queue entry by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get queue entry', 500);
  }
}

/**
 * List queue entries controller
 */
export async function listQueueEntries(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = queueListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view queue entries', 403);
      return;
    }

    const result = await listQueueEntriesService(validatedQuery);

    successResponse(res, result, 'Queue entries retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List queue entries controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list queue entries', 500);
  }
}

/**
 * Update queue entry controller
 */
export async function updateQueueEntry(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateQueueEntrySchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update queue entries', 403);
      return;
    }

    const queueEntry = await updateQueueEntryService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, queueEntry, 'Queue entry updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Queue entry not found') {
      errorResponse(res, 'NOT_FOUND', 'Queue entry not found', 404);
      return;
    }
    logger.error('Update queue entry controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update queue entry', 500);
  }
}

/**
 * Update queue entry status controller
 */
export async function updateQueueEntryStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = queueStatusSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update queue status', 403);
      return;
    }

    const queueEntry = await updateQueueEntryStatusService(
      id,
      validatedData.status,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, queueEntry, 'Queue status updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Queue entry not found') {
      errorResponse(res, 'NOT_FOUND', 'Queue entry not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Update queue status controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update queue status', 500);
  }
}

/**
 * Update queue entry priority controller
 */
export async function updateQueueEntryPriority(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = queuePrioritySchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_queue') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update queue priority', 403);
      return;
    }

    const queueEntry = await updateQueueEntryPriorityService(
      id,
      validatedData.priority,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, queueEntry, 'Queue priority updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Queue entry not found') {
      errorResponse(res, 'NOT_FOUND', 'Queue entry not found', 404);
      return;
    }
    logger.error('Update queue priority controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update queue priority', 500);
  }
}
