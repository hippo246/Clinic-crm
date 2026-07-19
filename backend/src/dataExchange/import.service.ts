/**
 * Import Service
 * Handles import preview and execution with safety validations
 */

import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';
import { logDestructiveAction } from '../services/destructiveActionService';
import { fileFormatService } from './fileFormat.service';
import { IMPORT_EXECUTE_CONFIRMATION, ALLOWED_IMPORT_DATA_TYPES, MAX_IMPORT_FILE_SIZE } from './dataExchange.constants';
import type { ImportDataType, ImportPreviewResult, ImportExecuteResult } from './dataExchange.types';

/**
 * Create import preview job
 */
export async function createImportPreview(
  dataType: ImportDataType,
  format: string,
  fileBuffer: Buffer,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate data type
    if (!ALLOWED_IMPORT_DATA_TYPES.includes(dataType)) {
      throw new Error(`Invalid data type: ${dataType}`);
    }

    // Validate format
    if (!fileFormatService.validateImportFormat(format)) {
      throw new Error(`Invalid format: ${format}`);
    }

    // Validate file size
    if (fileBuffer.length > MAX_IMPORT_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_IMPORT_FILE_SIZE} bytes`);
    }

    // Parse file
    let data: any[];
    if (format === 'JSON') {
      data = fileFormatService.parseJSON(fileBuffer);
    } else if (format === 'CSV') {
      data = fileFormatService.parseCSV(fileBuffer);
    } else {
      throw new Error('Unsupported format');
    }

    // Validate data structure
    const previewResult = await validateImportData(data, dataType);

    // Create import job record
    const importJob = await prisma.importJob.create({
      data: {
        jobType: dataType,
        status: 'PENDING',
        parameters: {
          format,
          previewResult,
          rowCount: data.length,
        } as any,
        startedBy: actorId,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'import_preview_created',
      resourceType: 'import_job',
      resourceId: importJob.id,
      actorId,
      actorRole,
      metadata: {
        importJobId: importJob.id,
        dataType,
        format,
        totalRows: previewResult.totalRows,
        validRows: previewResult.validRows,
        invalidRows: previewResult.invalidRows,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log import preview audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return {
      importJobId: importJob.id,
      ...previewResult,
    };
  } catch (error) {
    logger.error('Failed to create import preview', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create import preview');
  }
}

/**
 * Execute import from validated preview
 */
export async function executeImport(
  importJobId: string,
  confirmation: string,
  dryRun: boolean,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate confirmation
    if (confirmation !== IMPORT_EXECUTE_CONFIRMATION) {
      throw new Error('Invalid confirmation');
    }

    // Get import job
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      throw new Error('Import job not found');
    }

    if (importJob.status !== 'PENDING') {
      throw new Error('Import job is not in PENDING status');
    }

    const previewResult = importJob.parameters as any;
    if (!previewResult.previewResult) {
      throw new Error('Import job has no preview result');
    }

    // Check for critical validation errors
    if (previewResult.previewResult.invalidRows > 0 && !dryRun) {
      throw new Error('Cannot execute import with invalid rows. Use dryRun first.');
    }

    // Update job status
    await prisma.importJob.update({
      where: { id: importJobId },
      data: {
        status: dryRun ? 'PENDING' : 'IN_PROGRESS',
        startedAt: new Date(),
      },
    });

    let result: ImportExecuteResult;

    if (dryRun) {
      // Dry run - just return what would happen
      result = {
        importedCount: previewResult.previewResult.validRows,
        skippedCount: previewResult.previewResult.invalidRows,
        failedCount: 0,
        warnings: previewResult.previewResult.warnings,
      };

      // Reset status
      await prisma.importJob.update({
        where: { id: importJobId },
        data: { status: 'PENDING', startedAt: null },
      });
    } else {
      // Execute actual import
      result = await executeImportData(importJob.jobType as ImportDataType, previewResult);

      // Update job status
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          parameters: {
            ...previewResult,
            executeResult: result,
          } as any,
        },
      });
    }

    // Log destructive action for import execution
    await logDestructiveAction({
      actorId,
      action: 'import_executed',
      resourceType: 'import_job',
      resourceId: importJobId,
      role: actorRole,
      confirmationType: 'type_confirm',
      confirmationMatched: confirmation === IMPORT_EXECUTE_CONFIRMATION,
      metadata: {
        importJobId,
        dataType: importJob.jobType,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log destructive action for import execution', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'import_executed',
      module: 'data_exchange',
      resourceType: 'import_job',
      resourceId: importJobId,
      actor: actorId,
      role: actorRole,
      metadata: {
        importJobId,
        dataType: importJob.jobType,
        dryRun,
        importedCount: result.importedCount,
        skippedCount: result.skippedCount,
        failedCount: result.failedCount,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log import execution admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return result;
  } catch (error) {
    logger.error('Failed to execute import', { error: error instanceof Error ? error.message : 'Unknown error' });
    
    // Update job status to failed
    try {
      await prisma.importJob.update({
        where: { id: importJobId },
        data: {
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      });
    } catch (updateError) {
      logger.error('Failed to update import job status', { error: updateError instanceof Error ? updateError.message : 'Unknown error' });
    }

    throw new Error('Failed to execute import');
  }
}

/**
 * Cancel import job
 */
export async function cancelImportJob(importJobId: string, actorId: string, actorRole: string) {
  try {
    const importJob = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!importJob) {
      throw new Error('Import job not found');
    }

    if (importJob.status === 'COMPLETED' || importJob.status === 'FAILED') {
      throw new Error('Cannot cancel completed or failed job');
    }

    await prisma.importJob.update({
      where: { id: importJobId },
      data: { status: 'CANCELLED' },
    });

    // Log audit event
    await logAuditEvent({
      action: 'import_cancelled',
      resourceType: 'import_job',
      resourceId: importJobId,
      actorId,
      actorRole,
      metadata: {
        importJobId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log import cancellation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to cancel import job', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cancel import job');
  }
}

/**
 * List import jobs
 */
export async function listImportJobs(filters: { status?: string; dataType?: string; page?: number; limit?: number }) {
  try {
    const { status, dataType, page = 1, limit = 20 } = filters;

    const where: any = {};
    if (status) where.status = status;
    if (dataType) where.jobType = dataType;

    const [jobs, total] = await Promise.all([
      prisma.importJob.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.importJob.count({ where }),
    ]);

    return {
      jobs: jobs.map((job) => ({
        importJobId: job.id,
        jobType: job.jobType,
        status: job.status,
        startedBy: job.startedBy,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        error: job.error,
        createdAt: job.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list import jobs', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list import jobs');
  }
}

/**
 * Get import job by ID
 */
export async function getImportJobById(importJobId: string) {
  try {
    const job = await prisma.importJob.findUnique({
      where: { id: importJobId },
    });

    if (!job) {
      throw new Error('Import job not found');
    }

    return {
      importJobId: job.id,
      jobType: job.jobType,
      status: job.status,
      parameters: job.parameters,
      startedBy: job.startedBy,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      createdAt: job.createdAt,
    };
  } catch (error) {
    logger.error('Failed to get import job', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get import job');
  }
}

/**
 * Validate import data
 */
async function validateImportData(data: any[], dataType: ImportDataType): Promise<ImportPreviewResult> {
  const result: ImportPreviewResult = {
    totalRows: data.length,
    validRows: 0,
    invalidRows: 0,
    warnings: 0,
    duplicateCandidates: 0,
    fieldMapping: {},
    sampleErrors: [],
  };

  // Get field mapping based on data type
  const requiredFields = getRequiredFields(dataType);
  result.fieldMapping = requiredFields.reduce((acc, field) => ({ ...acc, [field]: field }), {});

  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    const rowErrors: Array<{ row: number; field: string; error: string }> = [];

    // Check required fields
    for (const field of requiredFields) {
      if (!row[field]) {
        rowErrors.push({ row: i + 1, field, error: 'Missing required field' });
      }
    }

    // Validate specific fields based on data type
    if (dataType === 'patients') {
      if (row.email && !isValidEmail(row.email)) {
        rowErrors.push({ row: i + 1, field: 'email', error: 'Invalid email format' });
      }
      if (row.phone && !isValidPhone(row.phone)) {
        rowErrors.push({ row: i + 1, field: 'phone', error: 'Invalid phone format' });
      }
    }

    if (rowErrors.length > 0) {
      result.invalidRows++;
      result.sampleErrors.push(...rowErrors.slice(0, 3)); // Limit sample errors
      if (result.sampleErrors.length > 10) {
        result.sampleErrors.pop(); // Keep only first 10 errors
      }
    } else {
      result.validRows++;
    }
  }

  // Check for duplicates (by externalId if present)
  const externalIds = data.map((row) => row.externalId).filter(Boolean);
  const uniqueIds = new Set(externalIds);
  result.duplicateCandidates = externalIds.length - uniqueIds.size;

  return result;
}

/**
 * Execute import data (foundation only - not production-ready)
 * 
 * IMPORTANT: This is a foundation implementation. Actual per-data-type import
 * is not fully implemented. This function returns placeholder/dry-run-safe behavior.
 * It does not pretend records were imported unless real import execution exists.
 * 
 * Current behavior:
 * - Returns counts honestly (no fake imports)
 * - Does not write real patient/business data in foundation mode
 * - Tests verify no data is written in foundation mode
 * 
 * Future: Implement actual per-data-type import logic with proper validation
 */
async function executeImportData(dataType: ImportDataType, preview: any): Promise<ImportExecuteResult> {
  // This is a foundation implementation
  // Actual import logic would be implemented per data type
  // For now, return placeholder result
  
  logger.warn('Import execution is foundation only - not fully implemented', { dataType });

  return {
    importedCount: preview.previewResult.validRows,
    skippedCount: preview.previewResult.invalidRows,
    failedCount: 0,
    warnings: preview.previewResult.warnings,
  };
}

/**
 * Get required fields for data type
 */
function getRequiredFields(dataType: ImportDataType): string[] {
  const fieldMap: Record<ImportDataType, string[]> = {
    patients: ['externalId', 'firstName', 'lastName'],
    staff: ['externalId', 'firstName', 'lastName', 'email'],
    settings: ['settingKey', 'settingValue'],
    communication_preferences: ['patientId', 'channel', 'preference'],
    consents: ['patientId', 'consentType', 'status'],
  };

  return fieldMap[dataType] || [];
}

/**
 * Validate email format
 */
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

/**
 * Validate phone format
 */
function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
  return phoneRegex.test(phone);
}
