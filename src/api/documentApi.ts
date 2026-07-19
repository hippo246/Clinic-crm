/**
 * Document API Adapter
 * Typed API functions for document-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Document types
 */
export interface Document {
  id: string;
  patientId?: string;
  storageKey: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  category?: string;
  uploadedBy: string;
  uploadedAt: string;
  archivedAt?: string;
  archivedBy?: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface DocumentMetadata {
  id?: string;
  patientId?: string;
  category?: string;
  tags?: string[];
  notes?: string;
  documentDate?: string;
  expiresAt?: string;
}

export interface UploadDocumentInput {
  patientId?: string;
  file: File;
  category?: string;
  metadata?: DocumentMetadata;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: string;
}

export interface DocumentListQuery {
  patientId?: string;
  category?: string;
  page?: number;
  limit?: number;
}

/**
 * List documents
 */
export async function listDocuments(query: DocumentListQuery = {}): Promise<PaginatedResponse<Document>> {
  const { patientId, category, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (category) params.append('category', category);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Document[]; total: number; page: number; limit: number }>(
    `/documents?${params.toString()}`
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
 * Get document by ID
 */
export async function getDocument(documentId: string): Promise<Document> {
  const response = await apiClient.get<Document>(`/documents/${documentId}`);
  return response.data;
}

/**
 * Upload document
 */
export async function uploadDocument(input: UploadDocumentInput): Promise<Document> {
  const formData = new FormData();
  formData.append('file', input.file);
  if (input.patientId) formData.append('patientId', input.patientId);
  if (input.category) formData.append('category', input.category);
  if (input.metadata) formData.append('metadata', JSON.stringify(input.metadata));
  
  const response = await apiClient.post<Document>('/documents/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response.data;
}

/**
 * Download document
 */
export async function downloadDocument(documentId: string): Promise<Blob> {
  const response = await apiClient.get<Blob>(`/documents/${documentId}/download`, {
    responseType: 'blob',
  });
  return response.data;
}

/**
 * Get signed URL for document
 */
export async function getDocumentSignedUrl(documentId: string): Promise<SignedUrlResult> {
  const response = await apiClient.get<SignedUrlResult>(`/documents/${documentId}/signed-url`);
  return response.data;
}

/**
 * Create document metadata
 */
export async function createDocumentMetadata(documentId: string, metadata: DocumentMetadata): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/metadata`, metadata);
  return response.data;
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(documentId: string, metadata: Partial<DocumentMetadata>): Promise<Document> {
  const response = await apiClient.put<Document>(`/documents/${documentId}/metadata`, metadata);
  return response.data;
}

/**
 * Renew document (update expiry)
 */
export async function renewDocument(documentId: string, expiresAt: string): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/renew`, { expiresAt });
  return response.data;
}

/**
 * Sign document (mark as signed)
 */
export async function signDocument(documentId: string, signedBy: string): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/sign`, { signedBy });
  return response.data;
}

/**
 * Archive document
 */
export async function archiveDocument(documentId: string, reason?: string): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/archive`, { reason });
  return response.data;
}

/**
 * Soft delete document
 */
export async function softDeleteDocument(documentId: string, reason?: string): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/delete`, { reason });
  return response.data;
}

/**
 * Archive document
 */
export async function archiveDocument(documentId: string): Promise<Document> {
  const response = await apiClient.post<Document>(`/documents/${documentId}/archive`, {});
  return response.data;
}

/**
 * Delete document (soft delete)
 */
export async function deleteDocument(documentId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>(`/documents/${documentId}`);
  return response.data;
}
