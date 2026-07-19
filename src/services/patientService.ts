/**
 * Patient Service Facade
 * Unified patient service that switches between local and API modes
 */

import { createService } from './serviceFactory';
import * as patientServiceLocal from './patientService.local';
import * as patientServiceApi from './patientService.api';

/**
 * Create patient service based on data mode
 */
const patientService = createService({
  localService: patientServiceLocal,
  apiService: patientServiceApi,
});

/**
 * Export all patient service functions
 */
export const listPatients = (query?: any) => patientService.listPatients(query);
export const getPatient = (id: string) => patientService.getPatient(id);
export const createPatient = (input: any) => patientService.createPatient(input);
export const updatePatient = (id: string, input: any) => patientService.updatePatient(id, input);
export const archivePatient = (id: string, input?: any) => patientService.archivePatient(id, input);
export const restorePatient = (id: string) => patientService.restorePatient(id);
export const getPatientAudit = (id: string) => patientService.getPatientAudit(id);

/**
 * Re-export types
 */
export type {
  Patient,
  CreatePatientInput,
  UpdatePatientInput,
  ArchivePatientInput,
  PatientListQuery,
  PatientAuditLog,
  PaginatedResponse,
} from './patientService.local';
