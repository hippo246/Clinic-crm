import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAdminOperation } from '../services/adminAuditService';
import {
  CreateStaffInput,
  UpdateStaffInput,
  StaffListQuery,
  CreateStaffScheduleInput,
  UpdateStaffScheduleInput,
} from './operations.validation';

/**
 * Create staff member
 */
export async function createStaffMember(
  data: CreateStaffInput,
  actorId: string,
  actorRole: string
) {
  try {
    const staff = await prisma.staffMember.create({
      data: {
        userId: data.userId,
        employeeId: data.employeeId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone,
        department: data.department,
        specialization: data.specialization,
        status: data.status || 'ACTIVE',
      },
    });

    // Log admin audit event with staffId only
    await logAdminOperation({
      action: 'staff_created',
      module: 'staff',
      resourceType: 'staff',
      resourceId: staff.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        staffId: staff.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff creation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return staff;
  } catch (error) {
    logger.error('Failed to create staff member', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create staff member');
  }
}

/**
 * Get staff member by ID
 */
export async function getStaffMemberById(id: string) {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id },
      include: {
        schedules: true,
        activities: true,
      },
    });

    return staff;
  } catch (error) {
    logger.error('Failed to get staff member by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get staff member');
  }
}

/**
 * List staff members with pagination and filters
 */
export async function listStaffMembers(query: StaffListQuery) {
  try {
    const { page, limit, department, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (department) where.department = department;
    if (status) where.status = status;

    const [staff, total] = await Promise.all([
      prisma.staffMember.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.staffMember.count({ where }),
    ]);

    return {
      staff,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list staff members', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list staff members');
  }
}

/**
 * Update staff member
 */
export async function updateStaffMember(
  id: string,
  data: UpdateStaffInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingStaff = await prisma.staffMember.findUnique({
      where: { id },
    });

    if (!existingStaff) {
      throw new Error('Staff member not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.userId !== undefined && data.userId !== existingStaff.userId) {
      updateData.userId = data.userId;
      changedFields.push('userId');
    }
    if (data.employeeId !== undefined && data.employeeId !== existingStaff.employeeId) {
      updateData.employeeId = data.employeeId;
      changedFields.push('employeeId');
    }
    if (data.firstName !== undefined && data.firstName !== existingStaff.firstName) {
      updateData.firstName = data.firstName;
      changedFields.push('firstName');
    }
    if (data.lastName !== undefined && data.lastName !== existingStaff.lastName) {
      updateData.lastName = data.lastName;
      changedFields.push('lastName');
    }
    if (data.email !== undefined && data.email !== existingStaff.email) {
      updateData.email = data.email;
      changedFields.push('email');
    }
    if (data.phone !== undefined && data.phone !== existingStaff.phone) {
      updateData.phone = data.phone;
      changedFields.push('phone');
    }
    if (data.department !== undefined && data.department !== existingStaff.department) {
      updateData.department = data.department;
      changedFields.push('department');
    }
    if (data.specialization !== undefined && data.specialization !== existingStaff.specialization) {
      updateData.specialization = data.specialization;
      changedFields.push('specialization');
    }
    if (data.status !== undefined && data.status !== existingStaff.status) {
      updateData.status = data.status;
      changedFields.push('status');
    }

    if (Object.keys(updateData).length === 0) {
      return existingStaff;
    }

    const staff = await prisma.staffMember.update({
      where: { id },
      data: updateData,
    });

    // Log admin audit event with changed field names only
    await logAdminOperation({
      action: 'staff_updated',
      module: 'staff',
      resourceType: 'staff',
      resourceId: staff.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        staffId: staff.id,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return staff;
  } catch (error) {
    logger.error('Failed to update staff member', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update staff member');
  }
}

/**
 * Deactivate staff member
 */
export async function deactivateStaffMember(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    // Check if this is the last active admin
    if (staff.status === 'ACTIVE') {
      const activeAdmins = await prisma.staffMember.count({
        where: {
          status: 'ACTIVE',
          department: 'ADMIN',
          deletedAt: null,
        },
      });

      if (activeAdmins <= 1 && staff.department === 'ADMIN') {
        throw new Error('Cannot deactivate the last active admin');
      }
    }

    const updatedStaff = await prisma.staffMember.update({
      where: { id },
      data: { status: 'INACTIVE' },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_deactivated',
      module: 'staff',
      resourceType: 'staff',
      resourceId: staff.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        staffId: staff.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff deactivation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedStaff;
  } catch (error) {
    logger.error('Failed to deactivate staff member', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to deactivate staff member');
  }
}

/**
 * Reactivate staff member
 */
export async function reactivateStaffMember(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    const updatedStaff = await prisma.staffMember.update({
      where: { id },
      data: { status: 'ACTIVE' },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_reactivated',
      module: 'staff',
      resourceType: 'staff',
      resourceId: staff.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        staffId: staff.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff reactivation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedStaff;
  } catch (error) {
    logger.error('Failed to reactivate staff member', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to reactivate staff member');
  }
}

/**
 * Delete staff member (soft delete)
 */
export async function deleteStaffMember(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const staff = await prisma.staffMember.findUnique({
      where: { id },
    });

    if (!staff) {
      throw new Error('Staff member not found');
    }

    // Check if this is the last active admin
    if (staff.status === 'ACTIVE') {
      const activeAdmins = await prisma.staffMember.count({
        where: {
          status: 'ACTIVE',
          department: 'ADMIN',
          deletedAt: null,
        },
      });

      if (activeAdmins <= 1 && staff.department === 'ADMIN') {
        throw new Error('Cannot delete the last active admin');
      }
    }

    const updatedStaff = await prisma.staffMember.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_deleted',
      module: 'staff',
      resourceType: 'staff',
      resourceId: staff.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        staffId: staff.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff deletion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedStaff;
  } catch (error) {
    logger.error('Failed to delete staff member', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete staff member');
  }
}

/**
 * Create staff schedule
 */
export async function createStaffSchedule(
  staffId: string,
  data: CreateStaffScheduleInput,
  actorId: string,
  actorRole: string
) {
  try {
    const schedule = await prisma.staffSchedule.create({
      data: {
        staffId,
        date: new Date(data.date),
        startTime: data.startTime,
        endTime: data.endTime,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_schedule_created',
      module: 'staff',
      resourceType: 'staff_schedule',
      resourceId: schedule.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        scheduleId: schedule.id,
        staffId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff schedule creation admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return schedule;
  } catch (error) {
    logger.error('Failed to create staff schedule', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create staff schedule');
  }
}

/**
 * Get staff schedules
 */
export async function getStaffSchedules(staffId: string) {
  try {
    const schedules = await prisma.staffSchedule.findMany({
      where: { staffId },
      orderBy: { date: 'asc' },
    });

    return schedules;
  } catch (error) {
    logger.error('Failed to get staff schedules', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get staff schedules');
  }
}

/**
 * Update staff schedule
 */
export async function updateStaffSchedule(
  staffId: string,
  scheduleId: string,
  data: UpdateStaffScheduleInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existing = await prisma.staffSchedule.findUnique({
      where: { id: scheduleId },
    });

    if (!existing) {
      throw new Error('Staff schedule not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.date !== undefined) {
      updateData.date = new Date(data.date);
      changedFields.push('date');
    }
    if (data.startTime !== undefined && data.startTime !== existing.startTime) {
      updateData.startTime = data.startTime;
      changedFields.push('startTime');
    }
    if (data.endTime !== undefined && data.endTime !== existing.endTime) {
      updateData.endTime = data.endTime;
      changedFields.push('endTime');
    }

    if (Object.keys(updateData).length === 0) {
      return existing;
    }

    const schedule = await prisma.staffSchedule.update({
      where: { id: scheduleId },
      data: updateData,
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_schedule_updated',
      module: 'staff',
      resourceType: 'staff_schedule',
      resourceId: scheduleId,
      actor: actorId,
      role: actorRole,
      metadata: {
        scheduleId,
        staffId,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff schedule update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return schedule;
  } catch (error) {
    logger.error('Failed to update staff schedule', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update staff schedule');
  }
}

/**
 * Delete staff schedule
 */
export async function deleteStaffSchedule(
  staffId: string,
  scheduleId: string,
  actorId: string,
  actorRole: string
) {
  try {
    await prisma.staffSchedule.delete({
      where: { id: scheduleId },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'staff_schedule_deleted',
      module: 'staff',
      resourceType: 'staff_schedule',
      resourceId: scheduleId,
      actor: actorId,
      role: actorRole,
      metadata: {
        scheduleId,
        staffId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log staff schedule deletion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete staff schedule', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete staff schedule');
  }
}
