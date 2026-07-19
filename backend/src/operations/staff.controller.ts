import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createStaffMember as createStaffMemberService,
  getStaffMemberById as getStaffMemberByIdService,
  listStaffMembers as listStaffMembersService,
  updateStaffMember as updateStaffMemberService,
  deactivateStaffMember as deactivateStaffMemberService,
  reactivateStaffMember as reactivateStaffMemberService,
  deleteStaffMember as deleteStaffMemberService,
  createStaffSchedule as createStaffScheduleService,
  getStaffSchedules as getStaffSchedulesService,
  updateStaffSchedule as updateStaffScheduleService,
  deleteStaffSchedule as deleteStaffScheduleService,
} from './staff.service';
import {
  createStaffSchema,
  updateStaffSchema,
  staffListQuerySchema,
  createStaffScheduleSchema,
  updateStaffScheduleSchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== STAFF CONTROLLERS ====================

export async function createStaffMember(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createStaffSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create staff members', 403);
      return;
    }

    const staff = await createStaffMemberService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, staff, 'Staff member created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot deactivate the last active admin') {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Create staff member controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create staff member', 500);
  }
}

export async function getStaffMemberById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view staff members', 403);
      return;
    }

    const staff = await getStaffMemberByIdService(id);

    if (!staff) {
      errorResponse(res, 'NOT_FOUND', 'Staff member not found', 404);
      return;
    }

    successResponse(res, staff, 'Staff member retrieved successfully');
  } catch (error) {
    logger.error('Get staff member by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get staff member', 500);
  }
}

export async function listStaffMembers(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = staffListQuerySchema.parse(req.query);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view staff members', 403);
      return;
    }

    const result = await listStaffMembersService(validatedQuery);

    successResponse(res, result, 'School members retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List staff members controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list staff members', 500);
  }
}

export async function updateStaffMember(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateStaffSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update staff members', 403);
      return;
    }

    const staff = await updateStaffMemberService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, staff, 'Staff member updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Staff member not found') {
      errorResponse(res, 'NOT_FOUND', 'Staff member not found', 404);
      return;
    }
    logger.error('Update staff member controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update staff member', 500);
  }
}

export async function deactivateStaffMember(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to deactivate staff members', 403);
      return;
    }

    const staff = await deactivateStaffMemberService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, staff, 'Staff member deactivated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Staff member not found') {
      errorResponse(res, 'NOT_FOUND', 'Staff member not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot deactivate the last active admin') {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Deactivate staff member controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to deactivate staff member', 500);
  }
}

export async function reactivateStaffMember(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to reactivate staff members', 403);
      return;
    }

    const staff = await reactivateStaffMemberService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, staff, 'Staff member reactivated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Staff member not found') {
      errorResponse(res, 'NOT_FOUND', 'Staff member not found', 404);
      return;
    }
    logger.error('Reactivate staff member controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to reactivate staff member', 500);
  }
}

export async function deleteStaffMember(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete staff members', 403);
      return;
    }

    const staff = await deleteStaffMemberService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, staff, 'Staff member deleted successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Staff member not found') {
      errorResponse(res, 'NOT_FOUND', 'Staff member not found', 404);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot delete the last active admin') {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Delete staff member controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete staff member', 500);
  }
}

// ==================== STAFF SCHEDULE CONTROLLERS ====================

export async function getStaffSchedules(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view staff schedules', 403);
      return;
    }

    const schedules = await getStaffSchedulesService(id);

    successResponse(res, schedules, 'Staff schedules retrieved successfully');
  } catch (error) {
    logger.error('Get staff schedules controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get staff schedules', 500);
  }
}

export async function createStaffSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = createStaffScheduleSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create staff schedules', 403);
      return;
    }

    const schedule = await createStaffScheduleService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, schedule, 'Staff schedule created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create staff schedule controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create staff schedule', 500);
  }
}

export async function updateStaffSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, scheduleId } = req.params;
    const validatedData = updateStaffScheduleSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update staff schedules', 403);
      return;
    }

    const schedule = await updateStaffScheduleService(id, scheduleId, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, schedule, 'Staff schedule updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Staff schedule not found') {
      errorResponse(res, 'NOT_FOUND', 'Staff schedule not found', 404);
      return;
    }
    logger.error('Update staff schedule controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update staff schedule', 500);
  }
}

export async function deleteStaffSchedule(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, scheduleId } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete staff schedules', 403);
      return;
    }

    const result = await deleteStaffScheduleService(id, scheduleId, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Staff schedule deleted successfully');
  } catch (error) {
    logger.error('Delete staff schedule controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete staff schedule', 500);
  }
}
