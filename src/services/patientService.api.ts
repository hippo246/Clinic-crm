/**
 * Patient Service (API Mode)
 * Patient service implementation using backend API
 */

import * as patientApi from '../api/patientApi';
import type { Patient, CreatePatientInput, UpdatePatientInput, ArchivePatientInput, PatientListQuery, PatientAuditLog } from '../api/patientApi';

/**
 * List patients
 */
export async function listPatients(query: PatientListQuery = {}) {
  return await patientApi.listPatients(query);
}

/**
 * Get patient by ID
 */
export async function getPatient(id: string): Promise<Patient> {
  return await patientApi.getPatient(id);
}

/**
 * Create patient
 */
export async function createPatient(input: CreatePatientInput): Promise<Patient> {
  return await patientApi.createPatient(input);
}

/**
 * Update patient
 */
export async function updatePatient(id: string, input: UpdatePatientInput): Promise<Patient> {
  return await patientApi.updatePatient(id, input);
}

/**
 * Archive patient
 */
export async function archivePatient(id: string, input: ArchivePatientInput = {}): Promise<Patient> {
  return await patientApi.archivePatient(id, input);
}

/**
 * Restore patient
 */
export async function restorePatient(id: string): Promise<Patient> {
  return await patientApi.restorePatient(id);
}

/**
 * Get patient audit logs
 */
export async function getPatientAudit(id: string): Promise<PatientAuditLog[]> {
  return await patientApi.getPatientAudit(id);
}
