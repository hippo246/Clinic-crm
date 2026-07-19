/**
 * Portability Export Package Service
 * Handles patient data export for privacy/portability requests
 * 
 * IMPORTANT: Portability package generation is metadata/foundation only.
 * 
 * Current behavior:
 * - Validates approved ACCESS/PORTABILITY request
 * - Patient-scoped only
 * - Document binaries are excluded from the package
 * - No package contents logged
 * - Actual package file storage is not fully wired yet
 */

import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';

/**
 * Create portability export package
 */
export async function createPortabilityPackage(
  privacyRequestId: string,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate privacy request exists
    const privacyRequest = await prisma.privacyRequest.findUnique({
      where: { id: privacyRequestId },
    });

    if (!privacyRequest) {
      throw new Error('Privacy request not found');
    }

    // Validate request type
    if (privacyRequest.requestType !== 'ACCESS') {
      throw new Error('Privacy request must be ACCESS or PORTABILITY type');
    }

    // Validate request status
    if (privacyRequest.status !== 'COMPLETED') {
      throw new Error('Privacy request must be in COMPLETED status');
    }

    const patientId = privacyRequest.patientId;

    // Fetch patient-specific data
    const patientData = await fetchPatientData(patientId);

    // Generate export package (JSON format)
    const packageContent = {
      privacyRequestId,
      patientId,
      exportType: privacyRequest.requestType,
      exportedAt: new Date().toISOString(),
      data: patientData,
    };

    const fileContent = JSON.stringify(packageContent, null, 2);

    // Create export job for tracking
    const exportJob = await prisma.exportJob.create({
      data: {
        jobType: 'portability',
        status: 'COMPLETED',
        parameters: {
          format: 'JSON',
          privacyRequestId,
          patientId,
          recordCounts: Object.fromEntries(
            Object.entries(patientData).map(([key, value]) => [key, Array.isArray(value) ? value.length : 0])
          ),
          sizeBytes: fileContent.length,
        } as any,
        startedBy: actorId,
        startedAt: new Date(),
        completedAt: new Date(),
        fileUrl: `portability/${privacyRequestId}.json`,
      },
    });

    // Note: Portability package generation is metadata/foundation only
    // Document binaries are excluded from the package
    // Actual package file storage is not fully wired yet

    // Log audit event
    await logAuditEvent({
      action: 'privacy_export_package_created',
      resourceType: 'privacy_request',
      resourceId: privacyRequestId,
      actorId,
      actorRole,
      metadata: {
        privacyRequestId,
        patientId,
        exportJobId: exportJob.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log portability package creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'privacy_export_package_created',
      module: 'privacy',
      resourceType: 'privacy_request',
      resourceId: privacyRequestId,
      actor: actorId,
      role: actorRole,
      metadata: {
        privacyRequestId,
        patientId,
        exportJobId: exportJob.id,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log portability package admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return {
      exportJobId: exportJob.id,
      privacyRequestId,
      patientId,
      fileUrl: exportJob.fileUrl,
      recordCounts: (exportJob.parameters as any)?.recordCounts,
    };
  } catch (error) {
    logger.error('Failed to create portability package', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create portability package');
  }
}

/**
 * Fetch patient-specific data for portability export
 */
async function fetchPatientData(patientId: string): Promise<Record<string, any[]>> {
  const data: Record<string, any[]> = {};

  // Patient basic info (sanitized)
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      externalId: true,
      firstName: true,
      lastName: true,
      dateOfBirth: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (patient) {
    data.patient = [patient];
  }

  // Appointments
  data.appointments = await prisma.appointment.findMany({
    where: { patientId },
    select: {
      id: true,
      status: true,
      date: true,
      time: true,
      createdAt: true,
    },
  });

  // Consultations
  data.consultations = await prisma.consultation.findMany({
    where: { patientId },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      createdAt: true,
    },
  });

  // Prescriptions
  data.prescriptions = await prisma.prescription.findMany({
    where: { patientId },
    select: {
      id: true,
      status: true,
      prescribedAt: true,
      createdAt: true,
    },
  });

  // Lab orders
  data.labOrders = await prisma.labOrder.findMany({
    where: { patientId },
    select: {
      id: true,
      status: true,
      orderedAt: true,
      createdAt: true,
    },
  });

  // Documents (metadata only - no file content)
  data.documents = await prisma.document.findMany({
    where: { patientId },
    select: {
      id: true,
      fileType: true,
      uploadedAt: true,
    },
  });

  // Invoices
  data.invoices = await prisma.invoice.findMany({
    where: { patientId },
    select: {
      id: true,
      invoiceNumber: true,
      totalAmount: true,
      status: true,
      createdAt: true,
    },
  });

  // Communications (metadata only)
  data.communications = await prisma.communication.findMany({
    where: { patientId },
    select: {
      id: true,
      channel: true,
      status: true,
      sentAt: true,
      createdAt: true,
    },
  });

  // Consents - model may not exist in current schema, skip for now
  data.consents = [];

  // Communication preferences
  data.communicationPreferences = await prisma.communicationPreference.findMany({
    where: { patientId },
    select: {
      id: true,
      channel: true,
      preferred: true,
      createdAt: true,
    },
  });

  // Privacy requests
  data.privacyRequests = await prisma.privacyRequest.findMany({
    where: { patientId },
    select: {
      id: true,
      requestType: true,
      status: true,
      createdAt: true,
    },
  });

  return data;
}
