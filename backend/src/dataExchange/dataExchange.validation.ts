/**
 * Data Exchange Validation Schemas
 * Zod schemas for import/export/backup operations
 */

import { z } from 'zod';

// Import validation schemas
export const importPreviewSchema = z.object({
  dataType: z.enum(['patients', 'staff', 'settings', 'communication_preferences', 'consents']),
  format: z.enum(['JSON', 'CSV']),
  file: z.any().optional(), // For multipart upload
  fileUrl: z.string().url().optional(), // For already uploaded files
});

export const importExecuteSchema = z.object({
  importJobId: z.string().uuid(),
  confirmation: z.string().refine((val) => val === 'EXECUTE VALIDATED IMPORT'),
  dryRun: z.boolean().default(false),
});

export const importJobListQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  dataType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const importJobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const importFileMetadataSchema = z.object({
  fileName: z.string().max(255),
  fileSize: z.number().int().positive().max(10 * 1024 * 1024), // 10MB
  mimeType: z.enum(['application/json', 'text/csv', 'application/vnd.ms-excel']),
});

export const importMappingSchema = z.object({
  sourceField: z.string(),
  targetField: z.string(),
  required: z.boolean().default(false),
});

// Export validation schemas
export const exportCreateSchema = z.object({
  dataType: z.enum(['patients', 'appointments', 'consultations', 'prescriptions', 'lab_results', 'billing', 'documents', 'communications', 'audit', 'privacy', 'all']),
  format: z.enum(['JSON', 'CSV']),
  filters: z.record(z.any()).optional(),
  dateRange: z.object({
    from: z.string().datetime(),
    to: z.string().datetime(),
  }).optional(),
  isFullPhi: z.boolean().default(false),
  confirmation: z.string().optional(),
});

export const exportJobListQuerySchema = z.object({
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']).optional(),
  dataType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const exportJobIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const exportDownloadQuerySchema = z.object({
  id: z.string().uuid(),
});

export const exportFormatSchema = z.enum(['JSON', 'CSV']);

export const exportDataTypeSchema = z.enum(['patients', 'appointments', 'consultations', 'prescriptions', 'lab_results', 'billing', 'documents', 'communications', 'audit', 'privacy', 'all']);

// Backup validation schemas
export const backupCreateSchema = z.object({
  archiveType: z.enum(['FULL', 'PATIENTS', 'BILLING', 'AUDIT']),
  confirmation: z.string().refine((val) => val === 'CREATE BACKUP ARCHIVE'),
  description: z.string().max(500).optional(),
});

export const backupArchiveListQuerySchema = z.object({
  archiveType: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const backupArchiveIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const backupRestorePreviewSchema = z.object({
  backupArchiveId: z.string().uuid(),
});

export const backupRestoreExecuteSchema = z.object({
  backupArchiveId: z.string().uuid(),
  confirmation: z.string().refine((val) => val === 'RESTORE BACKUP ARCHIVE'),
  dryRun: z.boolean().default(false),
});

// Portability validation schemas
export const portabilityPackageCreateSchema = z.object({
  privacyRequestId: z.string().uuid(),
});

export const portabilityPackageRequestSchema = z.object({
  patientId: z.string().uuid(),
  requestType: z.enum(['ACCESS', 'PORTABILITY']),
});
