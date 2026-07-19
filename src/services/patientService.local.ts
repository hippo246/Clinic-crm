/**
 * Patient Service (Local Mode)
 * Patient service implementation using localStorage
 * This preserves existing localStorage behavior
 */

import { readJSON, writeJSON } from '../shared/services/storageService';

/**
 * Patient types (matching API types for consistency)
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
  status?: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  deletedAt?: string;
  deletedBy?: string;
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

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const STORAGE_KEY = 'patients';

/**
 * Get all patients from localStorage
 */
function getAllPatients(): Patient[] {
  return readJSON<Patient[]>(STORAGE_KEY, []);
}

/**
 * Save all patients to localStorage
 */
function saveAllPatients(patients: Patient[]): void {
  writeJSON(STORAGE_KEY, patients);
}

/**
 * List patients with pagination and filtering
 */
export async function listPatients(query: PatientListQuery = {}): Promise<PaginatedResponse<Patient>> {
  const { status, search, page = 1, limit = 20 } = query;
  let patients = getAllPatients();
  
  // Filter by status
  if (status) {
    patients = patients.filter(p => p.status === status);
  }
  
  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase();
    patients = patients.filter(p => 
      p.firstName.toLowerCase().includes(searchLower) ||
      p.lastName.toLowerCase().includes(searchLower) ||
      (p.externalId && p.externalId.toLowerCase().includes(searchLower))
    );
  }
  
  const total = patients.length;
  const totalPages = Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;
  const data = patients.slice(startIndex, endIndex);
  
  return {
    data,
    total,
    page,
    limit,
    totalPages,
  };
}

/**
 * Get patient by ID
 */
export async function getPatient(id: string): Promise<Patient> {
  const patients = getAllPatients();
  const patient = patients.find(p => p.id === id);
  
  if (!patient) {
    throw new Error('Patient not found');
  }
  
  return patient;
}

/**
 * Create patient
 */
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  const patients = getAllPatients();
  
  const newPatient: Patient = {
    id: crypto.randomUUID(),
    ...input,
    status: 'ACTIVE',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  patients.push(newPatient);
  saveAllPatients(patients);
  
  return newPatient;
}

/**
 * Update patient
 */
export async function updatePatient(id: string, input: UpdatePatientInput): Promise<Patient> {
  const patients = getAllPatients();
  const index = patients.findIndex(p => p.id === id);
  
  if (index === -1) {
    throw new Error('Patient not found');
  }
  
  const updatedPatient: Patient = {
    ...patients[index],
    ...input,
    updatedAt: new Date().toISOString(),
  };
  
  patients[index] = updatedPatient;
  saveAllPatients(patients);
  
  return updatedPatient;
}

/**
 * Archive patient
 */
export async function archivePatient(id: string, input: ArchivePatientInput = {}): Promise<Patient> {
  return await updatePatient(id, {
    status: 'ARCHIVED',
    deletedAt: new Date().toISOString(),
    deletedBy: 'current-user', // In real implementation, use actual user ID
  });
}

/**
 * Restore patient
 */
export async function restorePatient(id: string): Promise<Patient> {
  return await updatePatient(id, {
    status: 'ACTIVE',
    deletedAt: undefined,
    deletedBy: undefined,
  });
}

/**
 * Get patient audit logs (placeholder for local mode)
 */
export async function getPatientAudit(id: string): Promise<PatientAuditLog[]> {
  // In local mode, audit logs are not fully implemented
  // Return empty array for now
  return [];
}
