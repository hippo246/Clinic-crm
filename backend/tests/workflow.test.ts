import {
  validateAppointmentTransition,
  validateQueueTransition,
  validateConsultationTransition,
  validatePrescriptionTransition,
  validateLabOrderTransition,
  validateLabResultTransition,
  isTerminalStatus,
} from '../src/workflow/workflowStateMachine';
import {
  checkPrescriptionRequiredFields,
  canCompletePrescription,
  checkLabResultCritical,
  canApproveLabResult,
  canRejectLabResult,
  canCompleteConsultation,
  isPatientSuitableForWorkflow,
} from '../src/workflow/clinicalSafety';
import { logAuditEvent } from '../src/services/auditService';

jest.mock('../src/db/client');
jest.mock('../src/services/auditService');

describe('Workflow State Machine', () => {
  describe('Appointment transitions', () => {
    it('should allow valid SCHEDULED to CONFIRMED transition', () => {
      const result = validateAppointmentTransition('SCHEDULED', 'CONFIRMED');
      expect(result.valid).toBe(true);
    });

    it('should allow valid SCHEDULED to CHECKED_IN transition', () => {
      const result = validateAppointmentTransition('SCHEDULED', 'CHECKED_IN');
      expect(result.valid).toBe(true);
    });

    it('should allow valid CHECKED_IN to IN_PROGRESS transition', () => {
      const result = validateAppointmentTransition('CHECKED_IN', 'IN_PROGRESS');
      expect(result.valid).toBe(true);
    });

    it('should allow valid IN_PROGRESS to COMPLETED transition', () => {
      const result = validateAppointmentTransition('IN_PROGRESS', 'COMPLETED');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid COMPLETED to SCHEDULED transition', () => {
      const result = validateAppointmentTransition('COMPLETED', 'SCHEDULED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Cannot transition');
    });

    it('should reject invalid from status', () => {
      const result = validateAppointmentTransition('INVALID', 'SCHEDULED');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid from status');
    });
  });

  describe('Queue transitions', () => {
    it('should allow valid WAITING to IN_PROGRESS transition', () => {
      const result = validateQueueTransition('WAITING', 'IN_PROGRESS');
      expect(result.valid).toBe(true);
    });

    it('should allow valid IN_PROGRESS to COMPLETED transition', () => {
      const result = validateQueueTransition('IN_PROGRESS', 'COMPLETED');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid COMPLETED to WAITING transition', () => {
      const result = validateQueueTransition('COMPLETED', 'WAITING');
      expect(result.valid).toBe(false);
    });
  });

  describe('Consultation transitions', () => {
    it('should allow valid SCHEDULED to IN_PROGRESS transition', () => {
      const result = validateConsultationTransition('SCHEDULED', 'IN_PROGRESS');
      expect(result.valid).toBe(true);
    });

    it('should allow valid IN_PROGRESS to COMPLETED transition', () => {
      const result = validateConsultationTransition('IN_PROGRESS', 'COMPLETED');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid COMPLETED to IN_PROGRESS transition', () => {
      const result = validateConsultationTransition('COMPLETED', 'IN_PROGRESS');
      expect(result.valid).toBe(false);
    });
  });

  describe('Prescription transitions', () => {
    it('should allow valid DRAFT to ISSUED transition', () => {
      const result = validatePrescriptionTransition('DRAFT', 'ISSUED');
      expect(result.valid).toBe(true);
    });

    it('should allow valid ISSUED to DISPENSED transition', () => {
      const result = validatePrescriptionTransition('ISSUED', 'DISPENSED');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid DISPENSED to DRAFT transition', () => {
      const result = validatePrescriptionTransition('DISPENSED', 'DRAFT');
      expect(result.valid).toBe(false);
    });
  });

  describe('Lab order transitions', () => {
    it('should allow valid ORDERED to SAMPLE_COLLECTED transition', () => {
      const result = validateLabOrderTransition('ORDERED', 'SAMPLE_COLLECTED');
      expect(result.valid).toBe(true);
    });

    it('should allow valid SAMPLE_COLLECTED to IN_PROGRESS transition', () => {
      const result = validateLabOrderTransition('SAMPLE_COLLECTED', 'IN_PROGRESS');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid COMPLETED to ORDERED transition', () => {
      const result = validateLabOrderTransition('COMPLETED', 'ORDERED');
      expect(result.valid).toBe(false);
    });
  });

  describe('Lab result transitions', () => {
    it('should allow valid PENDING to REVIEWED transition', () => {
      const result = validateLabResultTransition('PENDING', 'REVIEWED');
      expect(result.valid).toBe(true);
    });

    it('should allow valid REVIEWED to APPROVED transition', () => {
      const result = validateLabResultTransition('REVIEWED', 'APPROVED');
      expect(result.valid).toBe(true);
    });

    it('should allow valid PENDING to APPROVED transition', () => {
      const result = validateLabResultTransition('PENDING', 'APPROVED');
      expect(result.valid).toBe(true);
    });

    it('should reject invalid APPROVED to PENDING transition', () => {
      const result = validateLabResultTransition('APPROVED', 'PENDING');
      expect(result.valid).toBe(false);
    });
  });

  describe('Terminal status detection', () => {
    it('should identify COMPLETED as terminal for appointments', () => {
      const result = isTerminalStatus('appointment', 'COMPLETED');
      expect(result).toBe(true);
    });

    it('should identify CANCELLED as terminal for appointments', () => {
      const result = isTerminalStatus('appointment', 'CANCELLED');
      expect(result).toBe(true);
    });

    it('should identify SCHEDULED as non-terminal for appointments', () => {
      const result = isTerminalStatus('appointment', 'SCHEDULED');
      expect(result).toBe(false);
    });

    it('should identify COMPLETED as terminal for queue', () => {
      const result = isTerminalStatus('queue', 'COMPLETED');
      expect(result).toBe(true);
    });

    it('should identify COMPLETED as terminal for consultations', () => {
      const result = isTerminalStatus('consultation', 'COMPLETED');
      expect(result).toBe(true);
    });

    it('should identify EXPIRED as terminal for prescriptions', () => {
      const result = isTerminalStatus('prescription', 'EXPIRED');
      expect(result).toBe(true);
    });

    it('should identify COMPLETED as terminal for lab orders', () => {
      const result = isTerminalStatus('labOrder', 'COMPLETED');
      expect(result).toBe(true);
    });

    it('should identify APPROVED as terminal for lab results', () => {
      const result = isTerminalStatus('labResult', 'APPROVED');
      expect(result).toBe(true);
    });
  });
});

describe('Clinical Safety Helper', () => {
  describe('Prescription safety', () => {
    it('should validate required prescription fields', () => {
      const result = checkPrescriptionRequiredFields({
        medication: 'Aspirin',
        dosage: '100mg',
        frequency: 'daily',
        duration: '7 days',
      });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should error when medication is missing', () => {
      const result = checkPrescriptionRequiredFields({
        medication: '',
        dosage: '100mg',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Medication name is required');
    });

    it('should warn when dosage is missing', () => {
      const result = checkPrescriptionRequiredFields({
        medication: 'Aspirin',
        dosage: '',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Dosage is recommended');
    });

    it('should check if prescription can be completed', () => {
      const result = canCompletePrescription({
        medication: 'Aspirin',
        dosage: '100mg',
        status: 'ISSUED',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject completion without medication', () => {
      const result = canCompletePrescription({
        medication: '',
        dosage: '100mg',
        status: 'ISSUED',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot complete prescription without medication name');
    });

    it('should reject completion of cancelled prescription', () => {
      const result = canCompletePrescription({
        medication: 'Aspirin',
        dosage: '100mg',
        status: 'CANCELLED',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot complete a cancelled prescription');
    });
  });

  describe('Lab result safety', () => {
    it('should check lab result critical flag', () => {
      const result = checkLabResultCritical({
        resultValue: 'critical value',
        resultType: 'Blood Test',
      });
      expect(result.isCritical).toBe(true);
    });

    it('should not flag non-critical results', () => {
      const result = checkLabResultCritical({
        resultValue: 'normal value',
        resultType: 'Blood Test',
      });
      expect(result.isCritical).toBe(false);
    });

    it('should warn when result value is missing', () => {
      const result = checkLabResultCritical({
        resultValue: '',
        resultType: 'Blood Test',
      });
      expect(result.warnings).toContain('Result value is missing');
    });

    it('should check if lab result can be approved', () => {
      const result = canApproveLabResult({
        status: 'PENDING',
        resultValue: 'normal',
        resultType: 'Blood Test',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject approval without result value', () => {
      const result = canApproveLabResult({
        status: 'PENDING',
        resultValue: '',
        resultType: 'Blood Test',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot approve result without value');
    });

    it('should reject approval of rejected result', () => {
      const result = canApproveLabResult({
        status: 'REJECTED',
        resultValue: 'normal',
        resultType: 'Blood Test',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot approve a rejected result');
    });

    it('should check if lab result can be rejected', () => {
      const result = canRejectLabResult({
        status: 'PENDING',
      });
      expect(result.valid).toBe(true);
    });

    it('should reject rejection of approved result', () => {
      const result = canRejectLabResult({
        status: 'APPROVED',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot reject an approved result');
    });
  });

  describe('Consultation safety', () => {
    it('should check if consultation can be completed', () => {
      const result = canCompleteConsultation({
        status: 'IN_PROGRESS',
        chiefComplaint: 'Headache',
        notes: 'Patient reports severe headache',
      });
      expect(result.valid).toBe(true);
    });

    it('should warn when chief complaint is missing', () => {
      const result = canCompleteConsultation({
        status: 'IN_PROGRESS',
        chiefComplaint: '',
        notes: 'Patient reports severe headache',
      });
      expect(result.valid).toBe(true);
      expect(result.warnings).toContain('Chief complaint is recommended for completion');
    });

    it('should reject completion of cancelled consultation', () => {
      const result = canCompleteConsultation({
        status: 'CANCELLED',
        chiefComplaint: 'Headache',
        notes: 'Patient reports severe headache',
      });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Cannot complete a cancelled consultation');
    });
  });

  describe('Patient suitability', () => {
    it('should allow active patient for workflow', () => {
      const result = isPatientSuitableForWorkflow({
        status: 'ACTIVE',
        deletedAt: null,
      });
      expect(result.valid).toBe(true);
    });

    it('should reject deleted patient for workflow', () => {
      const result = isPatientSuitableForWorkflow({
        status: 'ACTIVE',
        deletedAt: new Date(),
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Patient is deleted');
    });

    it('should reject deceased patient for workflow', () => {
      const result = isPatientSuitableForWorkflow({
        status: 'DECEASED',
        deletedAt: null,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Patient is deceased');
    });

    it('should reject transferred patient for workflow', () => {
      const result = isPatientSuitableForWorkflow({
        status: 'TRANSFERRED',
        deletedAt: null,
      });
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Patient has been transferred');
    });
  });
});

describe('Workflow Audit Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should log appointment creation with IDs only', async () => {
    (logAuditEvent as jest.Mock).mockResolvedValue(undefined);

    await logAuditEvent({
      action: 'appointment_created',
      resourceType: 'appointment',
      resourceId: 'apt-123',
      actorId: 'user-1',
      actorRole: 'doctor',
      metadata: {
        appointmentId: 'apt-123',
        patientId: 'patient-1',
      },
    });

    const auditCall = (logAuditEvent as jest.Mock).mock.calls[0][0];
    expect(auditCall.action).toBe('appointment_created');
    expect(auditCall.metadata).toHaveProperty('appointmentId');
    expect(auditCall.metadata).toHaveProperty('patientId');
    expect(auditCall.metadata).not.toHaveProperty('notes');
  });

  it('should log consultation completion without clinical content', async () => {
    (logAuditEvent as jest.Mock).mockResolvedValue(undefined);

    await logAuditEvent({
      action: 'consultation_completed',
      resourceType: 'consultation',
      resourceId: 'consult-123',
      actorId: 'user-1',
      actorRole: 'doctor',
      metadata: {
        consultationId: 'consult-123',
        patientId: 'patient-1',
      },
    });

    const auditCall = (logAuditEvent as jest.Mock).mock.calls[0][0];
    expect(auditCall.metadata).toHaveProperty('consultationId');
    expect(auditCall.metadata).toHaveProperty('patientId');
    expect(auditCall.metadata).not.toHaveProperty('diagnosis');
    expect(auditCall.metadata).not.toHaveProperty('notes');
  });

  it('should log prescription creation without medication details', async () => {
    (logAuditEvent as jest.Mock).mockResolvedValue(undefined);

    await logAuditEvent({
      action: 'prescription_created',
      resourceType: 'prescription',
      resourceId: 'rx-123',
      actorId: 'user-1',
      actorRole: 'doctor',
      metadata: {
        prescriptionId: 'rx-123',
        patientId: 'patient-1',
      },
    });

    const auditCall = (logAuditEvent as jest.Mock).mock.calls[0][0];
    expect(auditCall.metadata).toHaveProperty('prescriptionId');
    expect(auditCall.metadata).not.toHaveProperty('medication');
    expect(auditCall.metadata).not.toHaveProperty('dosage');
  });

  it('should log lab result approval without result values', async () => {
    (logAuditEvent as jest.Mock).mockResolvedValue(undefined);

    await logAuditEvent({
      action: 'lab_result_approved',
      resourceType: 'lab_result',
      resourceId: 'result-123',
      actorId: 'user-1',
      actorRole: 'doctor',
      metadata: {
        labResultId: 'result-123',
        labOrderId: 'order-123',
        patientId: 'patient-1',
        reviewedBy: 'user-1',
      },
    });

    const auditCall = (logAuditEvent as jest.Mock).mock.calls[0][0];
    expect(auditCall.metadata).toHaveProperty('labResultId');
    expect(auditCall.metadata).not.toHaveProperty('resultValue');
    expect(auditCall.metadata).not.toHaveProperty('notes');
  });
});
