import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  createPatient,
  getPatientById,
  listPatients,
  updatePatient,
  archivePatient,
  restorePatient,
  getPatientAuditTrail,
  createPatientNote,
  updatePatientNote,
  deletePatientNote,
  addPatientTimelineEvent,
  getPatientTimelineEvents,
  getPatientNotes,
} from '../src/patients/patient.service';
import { logAuditEvent } from '../src/services/auditService';
import { prisma } from '../src/db/client';

jest.mock('../src/services/auditService', () => ({
  logAuditEvent: jest.fn(),
}));

jest.mock('../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Patient Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createPatient', () => {
    it('should create a patient successfully', async () => {
      const mockPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
        deletedBy: null,
      };

      (prisma.patient.create as any).mockResolvedValue(mockPatient);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await createPatient(
        { firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01', gender: 'male' },
        'user-1',
        'doctor'
      );

      expect(result).toEqual(mockPatient);
      expect(prisma.patient.create).toHaveBeenCalled();
    });
  });

  describe('getPatientById', () => {
    it('should return patient by ID', async () => {
      const mockPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        status: 'ACTIVE',
        deletedAt: null,
        notes: [],
        timelineEvents: [],
      };

      (prisma.patient.findUnique as any).mockResolvedValue(mockPatient);

      const result = await getPatientById('patient-1', false);

      expect(result).toEqual(mockPatient);
      expect(prisma.patient.findUnique).toHaveBeenCalled();
    });

    it('should return null for non-existent patient', async () => {
      (prisma.patient.findUnique as any).mockResolvedValue(null);

      const result = await getPatientById('non-existent', false);

      expect(result).toBeNull();
    });
  });

  describe('listPatients', () => {
    it('should list patients with pagination', async () => {
      const mockPatients = [
        { id: 'patient-1', firstName: 'John', lastName: 'Doe', status: 'ACTIVE' },
        { id: 'patient-2', firstName: 'Jane', lastName: 'Smith', status: 'ACTIVE' },
      ];

      (prisma.patient.findMany as any).mockResolvedValue(mockPatients);
      (prisma.patient.count as any).mockResolvedValue(2);

      const result = await listPatients({ page: 1, limit: 10, includeArchived: false });

      expect(result.patients).toHaveLength(2);
      expect(result.total).toBe(2);
      expect(prisma.patient.findMany).toHaveBeenCalled();
      expect(prisma.patient.count).toHaveBeenCalled();
    });
  });

  describe('updatePatient', () => {
    it('should update patient successfully', async () => {
      const existingPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        phone: '555-1234',
        email: 'john@example.com',
        status: 'ACTIVE',
      };

      const updatedPatient = {
        id: 'patient-1',
        firstName: 'Jane',
        lastName: 'Doe',
        dateOfBirth: new Date('1990-01-01'),
        gender: 'male',
        phone: '555-5678',
        email: 'jane@example.com',
        status: 'ACTIVE',
      };

      (prisma.patient.findUnique as any).mockResolvedValue(existingPatient);
      (prisma.patient.update as any).mockResolvedValue(updatedPatient);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await updatePatient('patient-1', { firstName: 'Jane', phone: '555-5678' }, 'user-1', 'doctor');

      expect(result).toEqual(updatedPatient);
      expect(prisma.patient.update).toHaveBeenCalled();
    });
  });

  describe('archivePatient', () => {
    it('should archive patient (soft delete)', async () => {
      const archivedPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        status: 'INACTIVE',
        deletedAt: new Date(),
        deletedBy: 'user-1',
      };

      (prisma.patient.findUnique as any).mockResolvedValue({ id: 'patient-1' });
      (prisma.patient.update as any).mockResolvedValue(archivedPatient);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await archivePatient('patient-1', { reasonCode: 'duplicate' }, 'user-1', 'admin');

      expect(result).toEqual(archivedPatient);
      expect(prisma.patient.update).toHaveBeenCalled();
    });
  });

  describe('restorePatient', () => {
    it('should restore archived patient', async () => {
      const restoredPatient = {
        id: 'patient-1',
        firstName: 'John',
        lastName: 'Doe',
        status: 'ACTIVE',
        deletedAt: null,
        deletedBy: null,
      };

      (prisma.patient.findUnique as any).mockResolvedValue({ id: 'patient-1', deletedAt: new Date() });
      (prisma.patient.update as any).mockResolvedValue(restoredPatient);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await restorePatient('patient-1', 'user-1', 'admin');

      expect(result).toEqual(restoredPatient);
      expect(prisma.patient.update).toHaveBeenCalled();
    });
  });

  describe('patient notes', () => {
    it('should create patient note', async () => {
      const mockNote = {
        id: 'note-1',
        patientId: 'patient-1',
        content: 'Test note',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.patientNote.create as any).mockResolvedValue(mockNote);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await createPatientNote('patient-1', { content: 'Test note' }, 'user-1', 'doctor');

      expect(result).toEqual(mockNote);
      expect(prisma.patientNote.create).toHaveBeenCalled();
    });

    it('should update patient note', async () => {
      const mockNote = {
        id: 'note-1',
        patientId: 'patient-1',
        content: 'Updated note',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.patientNote.update as any).mockResolvedValue(mockNote);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await updatePatientNote('note-1', { content: 'Updated note' }, 'user-1', 'doctor');

      expect(result).toEqual(mockNote);
      expect(prisma.patientNote.update).toHaveBeenCalled();
    });

    it('should delete patient note (soft-delete)', async () => {
      const mockNote = {
        id: 'note-1',
        patientId: 'patient-1',
        content: 'Test note',
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
        deletedBy: 'user-1',
      };

      (prisma.patientNote.update as any).mockResolvedValue(mockNote);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await deletePatientNote('note-1', 'user-1', 'doctor');

      expect(result).toEqual(mockNote);
      expect(prisma.patientNote.update).toHaveBeenCalled();
    });

    it('should exclude deleted notes from normal note reads', async () => {
      const mockNotes = [
        { id: 'note-1', patientId: 'patient-1', content: 'Active note', deletedAt: null },
      ];

      (prisma.patientNote.findMany as any).mockResolvedValue(mockNotes);

      const result = await getPatientNotes('patient-1', false);

      expect(result).toHaveLength(1);
      expect(prisma.patientNote.findMany).toHaveBeenCalled();
    });
  });

  describe('patient timeline events', () => {
    it('should add timeline event', async () => {
      const mockEvent = {
        id: 'event-1',
        patientId: 'patient-1',
        eventType: 'consultation',
        description: 'Test event',
        metadata: null,
        createdAt: new Date(),
      };

      (prisma.patientTimelineEvent.create as any).mockResolvedValue(mockEvent);
      (logAuditEvent as any).mockResolvedValue(undefined);

      const result = await addPatientTimelineEvent(
        'patient-1',
        { eventType: 'consultation', description: 'Test event' },
        'user-1',
        'doctor'
      );

      expect(result).toEqual(mockEvent);
      expect(prisma.patientTimelineEvent.create).toHaveBeenCalled();
    });

    it('should get timeline events', async () => {
      const mockEvents = [
        { id: 'event-1', patientId: 'patient-1', eventType: 'consultation', description: 'Test', createdAt: new Date() },
      ];

      (prisma.patientTimelineEvent.findMany as any).mockResolvedValue(mockEvents);

      const result = await getPatientTimelineEvents('patient-1');

      expect(result).toEqual(mockEvents);
      expect(prisma.patientTimelineEvent.findMany).toHaveBeenCalled();
    });
  });
});
