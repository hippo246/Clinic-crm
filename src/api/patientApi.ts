/**
 * Patient API Adapter
 * Typed API functions for patient-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Patient types (matching backend schema)
 */
export interface Patient {
  id: string;
  externalId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  deletedBy?: string;
}

export interface CreatePatientInput {
  externalId?: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
}

export interface UpdatePatientInput {
  externalId?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  phone?: string;
  email?: string;
  address?: string;
}

export interface ArchivePatientInput {
  reasonCode?: string;
}

export interface PatientListQuery {
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  search?: string;
  page?: number;
  limit?: number;
}

export interface PatientAuditLog {
  id: string;
  action: string;
  resourceType: string;
  resourceId: string;
  actorId: string;
  actorRole: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

/**
 * List patients with pagination
 */
export async function listPatients(query: PatientListQuery = {}): Promise<PaginatedResponse<Patient>> {
  const { status, search, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (status) params.append('status', status);
  if (search) params.append('search', search);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Patient[]; total: number; page: number; limit: number }>(
    `/patients?${params.toString()}`
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
 * Get patient by ID
 */
export async function getPatient(id: string): Promise<Patient> {
  const response = await apiClient.get<Patient>(`/patients/${id}`);
  return response.data;
}

/**
 * Create patient
 */
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const response = await apiClient.post<Patient>('/patients', input);
  return response.data;
}

/**
 * Update patient
 */
export async function updatePatient(id: string, input: UpdatePatientInput): Promise<Patient> {
  const response = await apiClient.put<Patient>(`/patients/${id}`, input);
  return response.data;
}

/**
 * Archive patient
 */
export async function archivePatient(id: string, input: ArchivePatientInput = {}): Promise<Patient> {
  const response = await apiClient.post<Patient>(`/patients/${id}/archive`, input);
  return response.data;
}

/**
 * Restore patient
 */
export async function restorePatient(id: string): Promise<Patient> {
  const response = await apiClient.post<Patient>(`/patients/${id}/restore`, {});
  return response.data;
}

/**
 * Get patient audit logs
 */
export async function getPatientAudit(id: string): Promise<PatientAuditLog[]> {
  const response = await apiClient.get<PatientAuditLog[]>(`/patients/${id}/audit`);
  return response.data;
}
