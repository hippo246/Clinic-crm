import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validateLabOrderTransition, validateLabResultTransition } from './workflowStateMachine';
import { validatePatientForWorkflow } from './patientWorkflowGuard';
import { checkLabResultCritical, canApproveLabResult, canRejectLabResult } from './clinicalSafety';
import {
  CreateLabOrderInput,
  UpdateLabOrderInput,
  CreateLabResultInput,
  UpdateLabResultInput,
  ApproveLabResultInput,
  RejectLabResultInput,
  LabOrderListQuery,
  LabResultListQuery,
} from './workflow.validation';

/**
 * Create lab order
 */
export async function createLabOrder(
  data: CreateLabOrderInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for lab order');
    }

    const labOrder = await prisma.labOrder.create({
      data: {
        patientId: data.patientId,
        staffId: data.staffId,
        testType: data.testType,
        notes: data.notes,
      },
    });

    // Log audit event with labOrderId/patientId only
    await logAuditEvent({
      action: 'lab_order_created',
      resourceType: 'lab_order',
      resourceId: labOrder.id,
      actorId,
      actorRole,
      metadata: {
        labOrderId: labOrder.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab order creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return labOrder;
  } catch (error) {
    logger.error('Failed to create lab order', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create lab order');
  }
}

/**
 * Get lab order by ID
 */
export async function getLabOrderById(id: string) {
  try {
    const labOrder = await prisma.labOrder.findUnique({
      where: { id },
      include: {
        results: true,
      },
    });

    return labOrder;
  } catch (error) {
    logger.error('Failed to get lab order by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get lab order');
  }
}

/**
 * List lab orders with pagination and filters
 */
export async function listLabOrders(query: LabOrderListQuery) {
  try {
    const { page, limit, patientId, staffId, status, testType, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (staffId) where.staffId = staffId;
    if (status) where.status = status;
    if (testType) where.testType = { contains: testType, mode: 'insensitive' };

    const [labOrders, total] = await Promise.all([
      prisma.labOrder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.labOrder.count({ where }),
    ]);

    return {
      labOrders,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list lab orders', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list lab orders');
  }
}

/**
 * Update lab order
 */
export async function updateLabOrder(
  id: string,
  data: UpdateLabOrderInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingLabOrder = await prisma.labOrder.findUnique({
      where: { id },
    });

    if (!existingLabOrder) {
      throw new Error('Lab order not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingLabOrder.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for lab order');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingLabOrder.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.staffId !== undefined && data.staffId !== existingLabOrder.staffId) {
      updateData.staffId = data.staffId;
      changedFields.push('staffId');
    }
    if (data.testType !== undefined && data.testType !== existingLabOrder.testType) {
      updateData.testType = data.testType;
      changedFields.push('testType');
    }
    if (data.notes !== undefined && data.notes !== existingLabOrder.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }

    if (Object.keys(updateData).length === 0) {
      return existingLabOrder;
    }

    const labOrder = await prisma.labOrder.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'lab_order_updated',
      resourceType: 'lab_order',
      resourceId: labOrder.id,
      actorId,
      actorRole,
      metadata: {
        labOrderId: labOrder.id,
        patientId: labOrder.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab order update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return labOrder;
  } catch (error) {
    logger.error('Failed to update lab order', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update lab order');
  }
}

/**
 * Update lab order status
 */
export async function updateLabOrderStatus(
  id: string,
  status: string,
  actorId: string,
  actorRole: string
) {
  try {
    const labOrder = await prisma.labOrder.findUnique({
      where: { id },
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    // Validate state transition
    const transition = validateLabOrderTransition(labOrder.status, status);
    if (!transition.valid) {
      throw new Error(transition.error || 'Invalid status transition');
    }

    const updateData: Record<string, unknown> = { status };

    // Set timestamps based on status
    if (status === 'SAMPLE_COLLECTED') {
      updateData.sampleCollectedAt = new Date();
    }
    if (status === 'COMPLETED') {
      updateData.completedAt = new Date();
    }

    const updatedLabOrder = await prisma.labOrder.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with status change only
    await logAuditEvent({
      action: 'lab_order_status_changed',
      resourceType: 'lab_order',
      resourceId: labOrder.id,
      actorId,
      actorRole,
      metadata: {
        labOrderId: labOrder.id,
        patientId: labOrder.patientId,
        fromStatus: labOrder.status,
        toStatus: status,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab order status change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedLabOrder;
  } catch (error) {
    logger.error('Failed to update lab order status', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update lab order status');
  }
}

/**
 * Cancel lab order
 */
export async function cancelLabOrder(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const labOrder = await prisma.labOrder.findUnique({
      where: { id },
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    // Validate state transition
    const transition = validateLabOrderTransition(labOrder.status, 'CANCELLED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot cancel lab order');
    }

    const updatedLabOrder = await prisma.labOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'lab_order_cancelled',
      resourceType: 'lab_order',
      resourceId: labOrder.id,
      actorId,
      actorRole,
      metadata: {
        labOrderId: labOrder.id,
        patientId: labOrder.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab order cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedLabOrder;
  } catch (error) {
    logger.error('Failed to cancel lab order', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel lab order');
  }
}

/**
 * Create lab result
 */
export async function createLabResult(
  data: CreateLabResultInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate lab order
    const labOrder = await prisma.labOrder.findUnique({
      where: { id: data.labOrderId },
    });

    if (!labOrder) {
      throw new Error('Lab order not found');
    }

    const labResult = await prisma.labResult.create({
      data: {
        labOrderId: data.labOrderId,
        resultType: data.resultType,
        resultValue: data.resultValue,
        notes: data.notes,
      },
    });

    // Log audit event with labResultId/labOrderId/patientId only
    await logAuditEvent({
      action: 'lab_result_created',
      resourceType: 'lab_result',
      resourceId: labResult.id,
      actorId,
      actorRole,
      metadata: {
        labResultId: labResult.id,
        labOrderId: data.labOrderId,
        patientId: labOrder.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab result creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return labResult;
  } catch (error) {
    logger.error('Failed to create lab result', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create lab result');
  }
}

/**
 * Get lab result by ID
 */
export async function getLabResultById(id: string) {
  try {
    const labResult = await prisma.labResult.findUnique({
      where: { id },
      include: {
        labOrder: {
          select: {
            id: true,
            patientId: true,
          },
        },
      },
    });

    return labResult;
  } catch (error) {
    logger.error('Failed to get lab result by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get lab result');
  }
}

/**
 * List lab results with pagination and filters
 */
export async function listLabResults(query: LabResultListQuery) {
  try {
    const { page, limit, labOrderId, status, resultType, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (labOrderId) where.labOrderId = labOrderId;
    if (status) where.status = status;
    if (resultType) where.resultType = { contains: resultType, mode: 'insensitive' };

    const [labResults, total] = await Promise.all([
      prisma.labResult.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.labResult.count({ where }),
    ]);

    return {
      labResults,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list lab results', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list lab results');
  }
}

/**
 * Update lab result
 */
export async function updateLabResult(
  id: string,
  data: UpdateLabResultInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingLabResult = await prisma.labResult.findUnique({
      where: { id },
    });

    if (!existingLabResult) {
      throw new Error('Lab result not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.resultType !== undefined && data.resultType !== existingLabResult.resultType) {
      updateData.resultType = data.resultType;
      changedFields.push('resultType');
    }
    if (data.resultValue !== undefined && data.resultValue !== existingLabResult.resultValue) {
      updateData.resultValue = data.resultValue;
      changedFields.push('resultValue');
    }
    if (data.notes !== undefined && data.notes !== existingLabResult.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }

    if (Object.keys(updateData).length === 0) {
      return existingLabResult;
    }

    const labResult = await prisma.labResult.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'lab_result_updated',
      resourceType: 'lab_result',
      resourceId: labResult.id,
      actorId,
      actorRole,
      metadata: {
        labResultId: labResult.id,
        labOrderId: labResult.labOrderId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab result update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return labResult;
  } catch (error) {
    logger.error('Failed to update lab result', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update lab result');
  }
}

/**
 * Approve lab result
 */
export async function approveLabResult(
  id: string,
  data: ApproveLabResultInput,
  actorId: string,
  actorRole: string
) {
  try {
    const labResult = await prisma.labResult.findUnique({
      where: { id },
      include: {
        labOrder: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!labResult) {
      throw new Error('Lab result not found');
    }

    // Validate safety check
    const safetyCheck = canApproveLabResult({
      status: labResult.status,
      resultValue: labResult.resultValue,
      resultType: labResult.resultType,
    });

    if (!safetyCheck.valid) {
      throw new Error(safetyCheck.errors.join(', '));
    }

    // Validate state transition
    const transition = validateLabResultTransition(labResult.status, 'APPROVED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot approve lab result');
    }

    const updatedLabResult = await prisma.labResult.update({
      where: { id },
      data: {
        status: 'APPROVED',
        reviewedAt: new Date(),
        reviewedBy: data.reviewedBy,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'lab_result_approved',
      resourceType: 'lab_result',
      resourceId: labResult.id,
      actorId,
      actorRole,
      metadata: {
        labResultId: labResult.id,
        labOrderId: labResult.labOrderId,
        patientId: labResult.labOrder.patientId,
        reviewedBy: data.reviewedBy,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab result approval audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedLabResult;
  } catch (error) {
    logger.error('Failed to approve lab result', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to approve lab result');
  }
}

/**
 * Reject lab result
 */
export async function rejectLabResult(
  id: string,
  data: RejectLabResultInput,
  actorId: string,
  actorRole: string
) {
  try {
    const labResult = await prisma.labResult.findUnique({
      where: { id },
      include: {
        labOrder: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!labResult) {
      throw new Error('Lab result not found');
    }

    // Validate safety check
    const safetyCheck = canRejectLabResult({
      status: labResult.status,
    });

    if (!safetyCheck.valid) {
      throw new Error(safetyCheck.errors.join(', '));
    }

    // Validate state transition
    const transition = validateLabResultTransition(labResult.status, 'REJECTED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot reject lab result');
    }

    const updatedLabResult = await prisma.labResult.update({
      where: { id },
      data: {
        status: 'REJECTED',
        reviewedAt: new Date(),
        reviewedBy: data.reviewedBy,
        notes: data.notes,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'lab_result_rejected',
      resourceType: 'lab_result',
      resourceId: labResult.id,
      actorId,
      actorRole,
      metadata: {
        labResultId: labResult.id,
        labOrderId: labResult.labOrderId,
        patientId: labResult.labOrder.patientId,
        reviewedBy: data.reviewedBy,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab result rejection audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedLabResult;
  } catch (error) {
    logger.error('Failed to reject lab result', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to reject lab result');
  }
}

/**
 * Mark lab result as critical
 */
export async function markLabResultCritical(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const labResult = await prisma.labResult.findUnique({
      where: { id },
      include: {
        labOrder: {
          select: {
            patientId: true,
          },
        },
      },
    });

    if (!labResult) {
      throw new Error('Lab result not found');
    }

    // Check if result is critical
    const safetyCheck = checkLabResultCritical({
      resultValue: labResult.resultValue,
      resultType: labResult.resultType,
    });

    const updatedLabResult = await prisma.labResult.update({
      where: { id },
      data: {
        status: 'REVIEWED',
        reviewedAt: new Date(),
      },
    });

    // Log audit event with safe metadata only
    await logAuditEvent({
      action: 'lab_result_marked_critical',
      resourceType: 'lab_result',
      resourceId: labResult.id,
      actorId,
      actorRole,
      metadata: {
        labResultId: labResult.id,
        labOrderId: labResult.labOrderId,
        patientId: labResult.labOrder.patientId,
        isCritical: safetyCheck.isCritical,
      },
    }).catch((err) => {
      logger.warn('Failed to log lab result critical marking audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedLabResult;
  } catch (error) {
    logger.error('Failed to mark lab result as critical', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to mark lab result as critical');
  }
}
