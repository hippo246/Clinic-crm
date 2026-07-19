/**
 * Patient Data Hook
 * Centralizes patient data operations with local/API mode branching
 * Provides loading/error states without logging PHI
 */

import { useState, useCallback, useEffect } from 'react';
import { isApiMode } from '../utils/apiModeHelper';
import {
  listPatients as listPatientsService,
  getPatient as getPatientService,
  createPatient as createPatientService,
  updatePatient as updatePatientService,
  archivePatient as archivePatientService,
  restorePatient as restorePatientService,
} from '../services/patientService';
import type { Patient, CreatePatientInput, UpdatePatientInput, ArchivePatientInput } from '../services/patientService';
import { loadPatients } from '../ui/utils';

interface UsePatientsDataResult {
  patients: Patient[];
  loading: boolean;
  error: string | null;
  reloadPatients: () => Promise<void>;
  createPatient: (input: CreatePatientInput) => Promise<Patient>;
  updatePatient: (id: string, input: UpdatePatientInput) => Promise<Patient>;
  archivePatient: (id: string, input?: ArchivePatientInput) => Promise<Patient>;
  restorePatient: (id: string) => Promise<Patient>;
  getPatient: (id: string) => Promise<Patient>;
}

export function usePatientsData(): UsePatientsDataResult {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reloadPatients = useCallback(async () => {
    setLoading(true);
    setError(null);
    
    try {
      if (isApiMode()) {
        // API mode: use backend API
        const response = await listPatientsService();
        setPatients(response.data);
      } else {
        // Local mode: use localStorage
        const localPatients = await loadPatients();
        setPatients(localPatients);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load patients';
      setError(message);
      console.error('[usePatientsData] Load error:', message);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCreatePatient = useCallback(async (input: CreatePatientInput): Promise<Patient> => {
    if (isApiMode()) {
      // API mode: use backend API, no localStorage fallback for writes
      const result = await createPatientService(input);
      // Refresh list after create
      await reloadPatients();
      return result;
    } else {
      // Local mode: use localStorage
      const newPatient = await createPatientService(input);
      const updatedPatients = await loadPatients();
      setPatients(updatedPatients);
      return newPatient;
    }
  }, [reloadPatients]);

  const handleUpdatePatient = useCallback(async (id: string, input: UpdatePatientInput): Promise<Patient> => {
    if (isApiMode()) {
      // API mode: use backend API, no localStorage fallback for writes
      const result = await updatePatientService(id, input);
      // Refresh list after update
      await reloadPatients();
      return result;
    } else {
      // Local mode: use localStorage
      const updatedPatient = await updatePatientService(id, input);
      const updatedPatients = await loadPatients();
      setPatients(updatedPatients);
      return updatedPatient;
    }
  }, [reloadPatients]);

  const handleArchivePatient = useCallback(async (id: string, input?: ArchivePatientInput): Promise<Patient> => {
    if (isApiMode()) {
      // API mode: use backend API, no localStorage fallback for writes
      const result = await archivePatientService(id, input);
      // Refresh list after archive
      await reloadPatients();
      return result;
    } else {
      // Local mode: use localStorage
      const archivedPatient = await archivePatientService(id, input);
      const updatedPatients = await loadPatients();
      setPatients(updatedPatients);
      return archivedPatient;
    }
  }, [reloadPatients]);

  const handleRestorePatient = useCallback(async (id: string): Promise<Patient> => {
    if (isApiMode()) {
      // API mode: use backend API, no localStorage fallback for writes
      const result = await restorePatientService(id);
      // Refresh list after restore
      await reloadPatients();
      return result;
    } else {
      // Local mode: use localStorage
      const restoredPatient = await restorePatientService(id);
      const updatedPatients = await loadPatients();
      setPatients(updatedPatients);
      return restoredPatient;
    }
  }, [reloadPatients]);

  const handleGetPatient = useCallback(async (id: string): Promise<Patient> => {
    if (isApiMode()) {
      // API mode: use backend API
      return await getPatientService(id);
    } else {
      // Local mode: use localStorage
      const localPatients = await loadPatients();
      const patient = localPatients.find(p => p.id === id);
      if (!patient) {
        throw new Error('Patient not found');
      }
      return patient;
    }
  }, []);

  // Load patients on mount
  useEffect(() => {
    reloadPatients();
  }, [reloadPatients]);

  return {
    patients,
    loading,
    error,
    reloadPatients,
    createPatient: handleCreatePatient,
    updatePatient: handleUpdatePatient,
    archivePatient: handleArchivePatient,
    restorePatient: handleRestorePatient,
    getPatient: handleGetPatient,
  };
}
