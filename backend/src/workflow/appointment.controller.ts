import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createAppointment as createAppointmentService,
  getAppointmentById as getAppointmentByIdService,
  listAppointments as listAppointmentsService,
  updateAppointment as updateAppointmentService,
  updateAppointmentStatus as updateAppointmentStatusService,
  cancelAppointment as cancelAppointmentService,
  markAppointmentNoShow as markAppointmentNoShowService,
} from './appointment.service';
import {
  createAppointmentSchema,
  updateAppointmentSchema,
  appointmentStatusSchema,
  appointmentListQuerySchema,
} from './workflow.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create appointment controller
 */
export async function createAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createAppointmentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create appointments', 403);
      return;
    }

    const appointment = await createAppointmentService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, appointment, 'Appointment created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create appointment controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create appointment', 500);
  }
}

/**
 * Get appointment by ID controller
 */
export async function getAppointmentById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view appointments', 403);
      return;
    }

    const appointment = await getAppointmentByIdService(id);

    if (!appointment) {
      errorResponse(res, 'NOT_FOUND', 'Appointment not found', 404);
      return;
    }

    successResponse(res, appointment, 'Appointment retrieved successfully');
  } catch (error) {
    logger.error('Get appointment by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get appointment', 500);
  }
}

/**
 * List appointments controller
 */
export async function listAppointments(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = appointmentListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view appointments', 403);
      return;
    }

    const result = await listAppointmentsService(validatedQuery);

    successResponse(res, result, 'Appointments retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List appointments controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list appointments', 500);
  }
}

/**
 * Update appointment controller
 */
export async function updateAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateAppointmentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update appointments', 403);
      return;
    }

    const appointment = await updateAppointmentService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, appointment, 'Appointment updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Appointment not found') {
      errorResponse(res, 'NOT_FOUND', 'Appointment not found', 404);
      return;
    }
    logger.error('Update appointment controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update appointment', 500);
  }
}

/**
 * Update appointment status controller
 */
export async function updateAppointmentStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = appointmentStatusSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update appointment status', 403);
      return;
    }

    const appointment = await updateAppointmentStatusService(
      id,
      validatedData.status,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, appointment, 'Appointment status updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Appointment not found') {
      errorResponse(res, 'NOT_FOUND', 'Appointment not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Update appointment status controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update appointment status', 500);
  }
}

/**
 * Cancel appointment controller
 */
export async function cancelAppointment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel appointments', 403);
      return;
    }

    const appointment = await cancelAppointmentService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, appointment, 'Appointment cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Appointment not found') {
      errorResponse(res, 'NOT_FOUND', 'Appointment not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot cancel')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Cancel appointment controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel appointment', 500);
  }
}

/**
 * Mark appointment as no-show controller
 */
export async function markAppointmentNoShow(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_appointments') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to mark appointments as no-show', 403);
      return;
    }

    const appointment = await markAppointmentNoShowService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, appointment, 'Appointment marked as no-show successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Appointment not found') {
      errorResponse(res, 'NOT_FOUND', 'Appointment not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot mark')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Mark appointment no-show controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to mark appointment as no-show', 500);
  }
}
