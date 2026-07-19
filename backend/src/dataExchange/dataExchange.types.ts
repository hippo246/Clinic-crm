/**
 * Data Exchange Types
 * Types for import/export/backup operations
 */

export type ImportDataType = 'patients' | 'staff' | 'settings' | 'communication_preferences' | 'consents';
export type ExportDataType = 'patients' | 'appointments' | 'consultations' | 'prescriptions' | 'lab_results' | 'billing' | 'documents' | 'communications' | 'audit' | 'privacy' | 'all';
export type ExportFormat = 'JSON' | 'CSV';
export type ImportFormat = 'JSON' | 'CSV';

export type ImportJobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
export type ExportJobStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface ImportPreviewResult {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  warnings: number;
  duplicateCandidates: number;
  fieldMapping: Record<string, string>;
  sampleErrors: Array<{ row: number; field: string; error: string }>;
}

export interface ImportExecuteResult {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  warnings: number;
}

export interface ExportJobMetadata {
  exportJobId: string;
  dataType: ExportDataType;
  format: ExportFormat;
  isFullPhi: boolean;
  recordCounts: Record<string, number>;
  sizeBytes?: number;
}

export interface BackupArchiveMetadata {
  backupArchiveId: string;
  archiveType: string;
  sizeBytes: number;
  dataTypes: string[];
  recordCounts: Record<string, number>;
  createdBy: string;
  createdAt: Date;
  checksum?: string;
}

export interface RestorePreviewResult {
  canRestore: boolean;
  schemaVersion: string;
  recordCounts: Record<string, number>;
  conflicts: string[];
  warnings: string[];
}
