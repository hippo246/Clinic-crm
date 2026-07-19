/**
 * Data Exchange Presenter
 * Shapes output data based on role and export type
 */

import type { ExportDataType } from './dataExchange.types';
import { SANITIZED_FIELDS, SENSITIVE_FIELDS } from './dataExchange.constants';

export class DataExchangePresenter {
  /**
   * Shape export data based on data type and whether full PHI is allowed
   */
  shapeExportData(data: any[], dataType: ExportDataType, isFullPhi: boolean, role: string): any[] {
    if (isFullPhi && role === 'admin') {
      // Full PHI export for admin - return all fields
      return data;
    }

    // Sanitized export - filter sensitive fields
    const sensitiveFields = SENSITIVE_FIELDS[dataType] || [];
    const sanitizedFields = SANITIZED_FIELDS[dataType] || [];

    return data.map((item) => {
      const shaped: any = {};

      if (sanitizedFields.length > 0) {
        // Use allowlist approach
        for (const field of sanitizedFields) {
          if (item[field] !== undefined) {
            shaped[field] = item[field];
          }
        }
      } else {
        // Use blocklist approach
        for (const key of Object.keys(item)) {
          if (!sensitiveFields.includes(key)) {
            shaped[key] = item[key];
          }
        }
      }

      return shaped;
    });
  }

  /**
   * Shape import preview result
   */
  shapeImportPreviewResult(result: any): any {
    return {
      totalRows: result.totalRows,
      validRows: result.validRows,
      invalidRows: result.invalidRows,
      warnings: result.warnings,
      duplicateCandidates: result.duplicateCandidates,
      fieldMapping: result.fieldMapping,
      sampleErrors: result.sampleErrors.map((err: any) => ({
        row: err.row,
        field: err.field,
        error: err.error,
      })),
    };
  }

  /**
   * Shape export job metadata
   */
  shapeExportJobMetadata(job: any): any {
    return {
      exportJobId: job.id,
      dataType: job.jobType,
      status: job.status,
      format: job.parameters?.format || 'JSON',
      isFullPhi: job.parameters?.isFullPhi || false,
      recordCounts: job.parameters?.recordCounts || {},
      sizeBytes: job.parameters?.sizeBytes,
      startedBy: job.startedBy,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      error: job.error,
      createdAt: job.createdAt,
    };
  }

  /**
   * Shape backup archive metadata
   */
  shapeBackupArchiveMetadata(archive: any): any {
    return {
      backupArchiveId: archive.id,
      archiveType: archive.archiveType,
      sizeBytes: archive.fileSize,
      dataTypes: archive.parameters?.dataTypes || [],
      recordCounts: archive.parameters?.recordCounts || {},
      createdBy: archive.createdBy,
      createdAt: archive.createdAt,
      expiresAt: archive.expiresAt,
      checksum: archive.parameters?.checksum,
    };
  }

  /**
   * Shape restore preview result
   */
  shapeRestorePreviewResult(result: any): any {
    return {
      canRestore: result.canRestore,
      schemaVersion: result.schemaVersion,
      recordCounts: result.recordCounts,
      conflicts: result.conflicts,
      warnings: result.warnings,
    };
  }
}

export const dataExchangePresenter = new DataExchangePresenter();
