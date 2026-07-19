import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validatePrescriptionTransition } from './workflowStateMachine';
import { validatePatientForWorkflow } from './patientWorkflowGuard';
import {
  CreatePrescriptionInput,
  UpdatePrescriptionInput,
  PrescriptionRefillInput,
  PrescriptionListQuery,
} from './workflow.validation';

/**
 * Create prescription
 */
export async function createPrescription(
  data: CreatePrescriptionInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for prescription');
    }

    const prescription = await prisma.prescription.create({
      data: {
        patientId: data.patientId,
        staffId: data.staffId,
        medication: data.medication,
        dosage: data.dosage || '',
        frequency: data.frequency,
      },
    });

    // Log audit event with prescriptionId/patientId only
    await logAuditEvent({
      action: 'prescription_created',
      resourceType: 'prescription',
      resourceId: prescription.id,
      actorId,
      actorRole,
      metadata: {
        prescriptionId: prescription.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log prescription creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return prescription;
  } catch (error) {
    logger.error('Failed to create prescription', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create prescription');
  }
}

/**
 * Get prescription by ID
 */
export async function getPrescriptionById(id: string) {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    return prescription;
  } catch (error) {
    logger.error('Failed to get prescription by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get prescription');
  }
}

/**
 * List prescriptions with pagination and filters
 */
export async function listPrescriptions(query: PrescriptionListQuery) {
  try {
    const { page, limit, patientId, staffId, status, medication, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (staffId) where.staffId = staffId;
    if (status) where.status = status;
    if (medication) where.medication = { contains: medication, mode: 'insensitive' };

    const [prescriptions, total] = await Promise.all([
      prisma.prescription.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.prescription.count({ where }),
    ]);

    return {
      prescriptions,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list prescriptions', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list prescriptions');
  }
}

/**
 * Update prescription
 */
export async function updatePrescription(
  id: string,
  data: UpdatePrescriptionInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingPrescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!existingPrescription) {
      throw new Error('Prescription not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingPrescription.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for prescription');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingPrescription.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.staffId !== undefined && data.staffId !== existingPrescription.staffId) {
      updateData.staffId = data.staffId;
      changedFields.push('staffId');
    }
    if (Object.keys(updateData).length === 0) {
      return existingPrescription;
    }

    const prescription = await prisma.prescription.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'prescription_updated',
      resourceType: 'prescription',
      resourceId: prescription.id,
      actorId,
      actorRole,
      metadata: {
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log prescription update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return prescription;
  } catch (error) {
    logger.error('Failed to update prescription', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update prescription');
  }
}

/**
 * Update prescription status
 */
export async function updatePrescriptionStatus(
  id: string,
  status: string,
  actorId: string,
  actorRole: string
) {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    // Validate state transition
    const transition = validatePrescriptionTransition(prescription.status, status);
    if (!transition.valid) {
      throw new Error(transition.error || 'Invalid status transition');
    }

    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: { status: status as any },
    });

    // Log audit event with status change only
    await logAuditEvent({
      action: 'prescription_status_changed',
      resourceType: 'prescription',
      resourceId: prescription.id,
      actorId,
      actorRole,
      metadata: {
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
        fromStatus: prescription.status,
        toStatus: status,
      },
    }).catch((err) => {
      logger.warn('Failed to log prescription status change audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedPrescription;
  } catch (error) {
    logger.error('Failed to update prescription status', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update prescription status');
  }
}

/**
 * Refill prescription
 */
export async function refillPrescription(
  id: string,
  data: PrescriptionRefillInput,
  actorId: string,
  actorRole: string
) {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    // Validate state transition (ISSUED -> DISPENSED)
    const transition = validatePrescriptionTransition(prescription.status, 'DISPENSED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot refill prescription');
    }

    // Create refill record
    const refill = await prisma.prescriptionRefill.create({
      data: {
        prescriptionId: id,
        refillDate: new Date(),
        dispensedBy: data.dispensedBy,
        notes: data.notes,
      },
    });

    // Update prescription status to DISPENSED
    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: { status: 'DISPENSED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'prescription_refilled',
      resourceType: 'prescription',
      resourceId: prescription.id,
      actorId,
      actorRole,
      metadata: {
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
        refillId: refill.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log prescription refill audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedPrescription;
  } catch (error) {
    logger.error('Failed to refill prescription', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to refill prescription');
  }
}

/**
 * Discontinue prescription
 */
export async function discontinuePrescription(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const prescription = await prisma.prescription.findUnique({
      where: { id },
    });

    if (!prescription) {
      throw new Error('Prescription not found');
    }

    // Validate state transition (any -> CANCELLED)
    const transition = validatePrescriptionTransition(prescription.status, 'CANCELLED');
    if (!transition.valid) {
      throw new Error(transition.error || 'Cannot discontinue prescription');
    }

    const updatedPrescription = await prisma.prescription.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'prescription_discontinued',
      resourceType: 'prescription',
      resourceId: prescription.id,
      actorId,
      actorRole,
      metadata: {
        prescriptionId: prescription.id,
        patientId: prescription.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log prescription discontinuation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedPrescription;
  } catch (error) {
    logger.error('Failed to discontinue prescription', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to discontinue prescription');
  }
}
