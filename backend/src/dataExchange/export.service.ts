/**
 * Export Service
 * Handles export job creation and execution with PHI safeguards
 * 
 * IMPORTANT: Export file generation is foundation-only. Generated export files
 * are placeholder/foundation only and not fully wired to storage abstraction yet.
 * 
 * Current behavior:
 * - Sanitized export excludes PHI by default
 * - Full PHI export requires admin + exact confirmation
 * - CSV formula injection protection is implemented
 * - Actual JSON/CSV output generation exists and is tested
 * 
 * Storage integration foundation: Not fully wired for generated export files yet
 */

import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';
import { logDestructiveAction } from '../services/destructiveActionService';
import { fileFormatService } from './fileFormat.service';
import { dataExchangePresenter } from './dataExchange.presenter';
import { FULL_PHI_EXPORT_CONFIRMATION, ALLOWED_EXPORT_DATA_TYPES, MAX_EXPORT_ROWS } from './dataExchange.constants';
import type { ExportDataType, ExportFormat } from './dataExchange.types';

/**
 * Create export job
 */
export async function createExportJob(
  dataType: ExportDataType,
  format: ExportFormat,
  filters: Record<string, any> | undefined,
  dateRange: { from: string; to: string } | undefined,
  isFullPhi: boolean,
  confirmation: string | undefined,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate data type
    if (!ALLOWED_EXPORT_DATA_TYPES.includes(dataType as any)) {
      throw new Error(`Invalid data type: ${dataType}`);
    }

    // Validate format
    if (!fileFormatService.validateExportFormat(format)) {
      throw new Error(`Invalid format: ${format}`);
    }

    // Validate full PHI export requirements
    if (isFullPhi) {
      if (actorRole !== 'admin') {
        throw new Error('Full PHI export requires admin role');
      }
      if (confirmation !== FULL_PHI_EXPORT_CONFIRMATION) {
        throw new Error('Invalid confirmation for full PHI export');
      }
    }

    // Create export job
    const exportJob = await prisma.exportJob.create({
      data: {
        jobType: dataType,
        status: 'PENDING',
        parameters: {
          format,
          filters,
          dateRange,
          isFullPhi,
        } as any,
        startedBy: actorId,
      },
    });

    // Log destructive action for full PHI export
    if (isFullPhi) {
      await logDestructiveAction({
        actorId,
        action: 'full_phi_export_created',
        resourceType: 'export_job',
        resourceId: exportJob.id,
        role: actorRole,
        confirmationType: 'type_confirm',
        confirmationMatched: confirmation === FULL_PHI_EXPORT_CONFIRMATION,
        metadata: {
          exportJobId: exportJob.id,
          dataType,
          format,
        },
      }).catch((err: unknown) => {
        logger.warn('Failed to log destructive action for full PHI export', { error: err instanceof Error ? err.message : 'Unknown error' });
      });
    }

    // Log audit event
    await logAuditEvent({
      action: isFullPhi ? 'full_phi_export_created' : 'export_job_created',
      resourceType: 'export_job',
      resourceId: exportJob.id,
      actorId,
      actorRole,
      metadata: {
        exportJobId: exportJob.id,
        dataType,
        format,
        isFullPhi,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log export job creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Execute export synchronously for now (foundation)
    await executeExportJob(exportJob.id, actorId, actorRole);

    return {
      exportJobId: exportJob.id,
      status: 'COMPLETED',
    };
  } catch (error) {
    logger.error('Failed to create export job', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create export job');
  }
}

/**
 * Execute export job
 */
async function executeExportJob(exportJobId: string, actorId: string, actorRole: string) {
  try {
    const exportJob = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
    });

    if (!exportJob) {
      throw new Error('Export job not found');
    }

    // Update status to in progress
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    const parameters = exportJob.parameters as any;
    const dataType = exportJob.jobType as string;
    const format = parameters.format as ExportFormat;
    const isFullPhi = parameters.isFullPhi as boolean;

    // Fetch data based on data type
    const data = await fetchExportData(dataType, parameters.filters, parameters.dateRange);

    // Shape data based on PHI settings
    const shapedData = dataExchangePresenter.shapeExportData(data, dataType as any, isFullPhi, actorRole);

    // Limit row count
    const limitedData = shapedData.slice(0, MAX_EXPORT_ROWS);

    // Generate export file
    let fileContent: string;
    if (format === 'JSON') {
      fileContent = fileFormatService.generateJSON(limitedData);
    } else if (format === 'CSV') {
      fileContent = fileFormatService.generateCSV(limitedData);
    } else {
      throw new Error('Unsupported format');
    }

    // Store file (storage integration foundation - not fully wired for generated export files yet)
    const fileUrl = `exports/${exportJobId}.${format.toLowerCase()}`;

    // Update job with results
    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        fileUrl,
        parameters: {
          ...parameters,
          recordCounts: { [dataType]: limitedData.length },
          sizeBytes: fileContent.length,
        } as any,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'export_job_completed',
      module: 'data_exchange',
      resourceType: 'export_job',
      resourceId: exportJobId,
      actor: actorId,
      role: actorRole,
      metadata: {
        exportJobId,
        dataType,
        format,
        isFullPhi,
        recordCount: limitedData.length,
        sizeBytes: fileContent.length,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log export job completion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });
  } catch (error) {
    logger.error('Failed to execute export job', { error: error instanceof Error ? error.message : 'Unknown error' });

    // Update job status to failed
    try {
      await prisma.exportJob.update({
        where: { id: exportJobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (updateError) {
      logger.error('Failed to update export job status', { error: updateError instanceof Error ? updateError.message : 'Unknown error' });
    }

    throw new Error('Failed to execute export job');
  }
}

/**
 * List export jobs
 */
export async function listExportJobs(filters: { status?: string; dataType?: string; page?: number; limit?: number }) {
  try {
    const { status, dataType, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (dataType) where.jobType = dataType;

    const [jobs, total] = await Promise.all([
      prisma.exportJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.exportJob.count({ where }),
    ]);

    return {
      jobs: jobs.map((job) => dataExchangePresenter.shapeExportJobMetadata(job)),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list export jobs', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list export jobs');
  }
}

/**
 * Get export job by ID
 */
export async function getExportJobById(exportJobId: string) {
  try {
    const job = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
    });

    if (!job) {
      throw new Error('Export job not found');
    }

    return dataExchangePresenter.shapeExportJobMetadata(job);
  } catch (error) {
    logger.error('Failed to get export job', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get export job');
  }
}

/**
 * Download export file
 */
export async function downloadExportFile(exportJobId: string, actorId: string, actorRole: string) {
  try {
    const job = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
    });

    if (!job) {
      throw new Error('Export job not found');
    }

    if (job.status !== 'COMPLETED') {
      throw new Error('Export job is not completed');
    }

    if (!job.fileUrl) {
      throw new Error('Export file not available');
    }

    // Log audit event
    await logAuditEvent({
      action: 'export_job_downloaded',
      resourceType: 'export_job',
      resourceId: exportJobId,
      actorId,
      actorRole,
      metadata: {
        exportJobId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log export download audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Foundation: return file URL (in production, would stream from storage)
    return {
      fileUrl: job.fileUrl,
      fileName: `export_${exportJobId}.${(job.parameters as any).format.toLowerCase()}`,
    };
  } catch (error) {
    logger.error('Failed to download export file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to download export file');
  }
}

/**
 * Cancel export job
 */
export async function cancelExportJob(exportJobId: string, actorId: string, actorRole: string) {
  try {
    const exportJob = await prisma.exportJob.findUnique({
      where: { id: exportJobId },
    });

    if (!exportJob) {
      throw new Error('Export job not found');
    }

    if (exportJob.status === 'COMPLETED' || exportJob.status === 'FAILED') {
      throw new Error('Cannot cancel completed or failed job');
    }

    await prisma.exportJob.update({
      where: { id: exportJobId },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'export_job_cancelled',
      resourceType: 'export_job',
      resourceId: exportJobId,
      actorId,
      actorRole,
      metadata: {
        exportJobId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log export cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to cancel export job', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel export job');
  }
}

/**
 * Fetch export data based on data type
 */
async function fetchExportData(dataType: string, _filters: Record<string, any> | undefined, dateRange: { from: string; to: string } | undefined): Promise<any[]> {
  const where: any = {};

  if (dateRange) {
    where.createdAt = {
      gte: new Date(dateRange.from),
      lte: new Date(dateRange.to),
    };
  }

  // Foundation implementation - fetch data based on data type
  switch (dataType) {
    case 'patients':
      return await prisma.patient.findMany({
        where,
        select: {
          id: true,
          externalId: true,
          firstName: true,
          lastName: true,
          status: true,
          createdAt: true,
          updatedAt: true,
          // Full PHI fields would be included if isFullPhi
          phone: true,
          email: true,
          dateOfBirth: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'appointments':
      return await prisma.appointment.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          status: true,
          date: true,
          time: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'consultations':
      return await prisma.consultation.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          status: true,
          startedAt: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'prescriptions':
      return await prisma.prescription.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          status: true,
          prescribedAt: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'billing':
      return await prisma.invoice.findMany({
        where,
        select: {
          id: true,
          invoiceNumber: true,
          patientId: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'documents':
      return await prisma.document.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          fileType: true,
          uploadedAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'communications':
      return await prisma.communication.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          channel: true,
          status: true,
          sentAt: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'audit':
      return await prisma.auditLog.findMany({
        where,
        select: {
          id: true,
          action: true,
          resourceType: true,
          resourceId: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'privacy':
      return await prisma.privacyRequest.findMany({
        where,
        select: {
          id: true,
          patientId: true,
          requestType: true,
          status: true,
          createdAt: true,
        },
        take: MAX_EXPORT_ROWS,
      });

    case 'all':
      // Foundation: return empty for 'all' - would aggregate in production
      return [];

    default:
      return [];
  }
}
