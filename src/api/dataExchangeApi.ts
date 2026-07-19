/**
 * Data Exchange API Adapter
 * Typed API functions for import/export/backup/portability endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Import types
 */
export interface ImportPreviewResult {
  canImport: boolean;
  validRows: number;
  invalidRows: number;
  duplicateCandidates: number;
  warnings: string[];
  errors: string[];
}

export interface ImportExecuteResult {
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  warnings: string[];
}

export interface ImportJob {
  importJobId: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  parameters: Record<string, unknown>;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
  createdAt: string;
}

/**
 * Export types
 */
export interface ExportJob {
  exportJobId: string;
  jobType: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  parameters: Record<string, unknown>;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  fileUrl?: string;
  error?: string;
  createdAt: string;
}

/**
 * Backup types
 */
export interface BackupArchive {
  id: string;
  archiveType: string;
  fileUrl: string;
  fileSize: number;
  createdBy: string;
  createdAt: string;
  expiresAt?: string;
}

export interface RestorePreviewResult {
  canRestore: boolean;
  schemaVersion: string;
  recordCounts: Record<string, number>;
  conflicts: Array<{ type: string; description: string }>;
  warnings: string[];
}

/**
 * Import preview
 */
export async function importPreview(
  file: File,
  dataType: string,
  format: 'JSON.csv'
): Promise<ImportPreviewResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('dataType', dataType);
  formData.append('format', format);
  
  const response = await apiClient.upload<ImportPreviewResult>('/import/preview', formData);
  return response.data;
}

/**
 * Execute import (requires confirmation)
 */
export async function importExecute(
  importJobId: string,
  confirmation: string,
  dryRun: boolean = false
): Promise<ImportExecuteResult> {
  const response = await apiClient.post<ImportExecuteResult>(`/import/${importJobId}/execute`, {
    confirmation,
    dryRun,
  });
  return response.data;
}

/**
 * Create export job
 */
export async function createExportJob(
  dataType: string,
  format: 'JSON.csv',
  parameters: Record<string, unknown> = {},
  confirmation?: string
): Promise<ExportJob> {
  const response = await apiClient.post<ExportJob>('/export', {
    dataType,
    format,
    parameters,
    confirmation,
  });
  return response.data;
}

/**
 * List export jobs
 */
export async function listExportJobs(query: {
  status?: string;
  dataType?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedResponse<ExportJob>> {
  const { status, dataType, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (status) params.append('status', status);
  if (dataType) params.append('dataType', dataType);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: ExportJob[]; total: number; page: number; limit: number }>(
    `/export?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

/**
 * Get export job by ID
 */
export async function getExportJob(exportJobId: string): Promise<ExportJob> {
  const response = await apiClient.get<ExportJob>(`/export/${exportJobId}`);
  return response.data;
}

/**
 * Download export file
 */
export async function downloadExportFile(exportJobId: string): Promise<Blob> {
  const response = await apiClient.download(`/export/${exportJobId}/download`);
  return response.data;
}

/**
 * Cancel export job
 */
export async function cancelExportJob(exportJobId: string): Promise<ExportJob> {
  const response = await apiClient.post<ExportJob>(`/export/${exportJobId}/cancel`, {});
  return response.data;
}

/**
 * Create backup archive (requires confirmation)
 */
export async function createBackupArchive(
  archiveType: string,
  confirmation: string
): Promise<BackupArchive> {
  const response = await apiClient.post<BackupArchive>('/backup', {
    archiveType,
    confirmation,
  });
  return response.data;
}

/**
 * List backup archives
 */
export async function listBackupArchives(): Promise<BackupArchive[]> {
  const response = await apiClient.get<BackupArchive[]>('/backup');
  return response.data;
}

/**
 * Get backup archive by ID
 */
export async function getBackupArchive(backupArchiveId: string): Promise<BackupArchive> {
  const response = await apiClient.get<BackupArchive>(`/backup/${backupArchiveId}`);
  return response.data;
}

/**
 * Download backup archive
 */
export async function downloadBackupArchive(backupArchiveId: string): Promise<Blob> {
  const response = await apiClient.download(`/backup/${backupArchiveId}/download`);
  return response.data;
}

/**
 * Restore preview
 */
export async function restorePreview(backupArchiveId: string): Promise<RestorePreviewResult> {
  const response = await apiClient.get<RestorePreviewResult>(`/backup/${backupArchiveId}/restore-preview`);
  return response.data;
}

/**
 * Restore backup (requires confirmation)
 */
export async function restoreBackup(
  backupArchiveId: string,
  confirmation: string,
  dryRun: boolean = false
): Promise<RestorePreviewResult> {
  const response = await apiClient.post<RestorePreviewResult>(`/backup/${backupArchiveId}/restore`, {
    confirmation,
    dryRun,
  });
  return response.data;
}

/**
 * Create portability package
 */
export async function createPortabilityPackage(privacyRequestId: string): Promise<ExportJob> {
  const response = await apiClient.post<ExportJob>(`/portability/${privacyRequestId}`, {});
  return response.data;
}
