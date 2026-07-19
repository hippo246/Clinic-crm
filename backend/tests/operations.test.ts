/**
 * Operations/Admin Backend APIs Tests
 * 
 * Tests for document metadata, billing, communication, staff, and settings APIs.
 * Uses mocked Prisma client to avoid requiring live database.
 */

import { prisma } from '../src/db/client';

// Mock audit services
jest.mock('../src/services/auditService', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../src/services/adminAuditService', () => ({
  logAdminOperation: jest.fn().mockResolvedValue(undefined),
}));

import { logAuditEvent } from '../src/services/auditService';
import { logAdminOperation } from '../src/services/adminAuditService';

// Mock patient workflow guard
jest.mock('../src/workflow/patientWorkflowGuard', () => ({
  validatePatientForWorkflow: jest.fn().mockResolvedValue({ valid: true }),
}));

import { validatePatientForWorkflow } from '../src/workflow/patientWorkflowGuard';

// Import services after mocks are set up
import { createDocumentMetadata } from '../src/operations/document.service';
import { createInvoice } from '../src/operations/billing.service';
import { createCommunication } from '../src/operations/communication.service';
import { createStaffMember } from '../src/operations/staff.service';
import { updateSystemSetting } from '../src/operations/settings.service';

describe('Operations Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Document Metadata', () => {
    it('should create document metadata with audit logging', async () => {
      const mockDocument = {
        id: 'doc-1',
        patientId: 'patient-1',
        storageKey: 'storage-key-1',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 1024,
        category: 'medical',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
      };

      (prisma.document.create as any).mockResolvedValue(mockDocument);

      const result = await createDocumentMetadata(
        {
          patientId: 'patient-1',
          storageKey: 'storage-key-1',
          fileName: 'test.pdf',
          fileType: 'application/pdf',
          fileSize: 1024,
          category: 'medical',
        },
        'user-1',
        'admin'
      );

      expect(result).toEqual(mockDocument);
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'document_created',
        resourceType: 'document',
        resourceId: 'doc-1',
        actorId: 'user-1',
        actorRole: 'admin',
        metadata: {
          documentId: 'doc-1',
          patientId: 'patient-1',
        },
      });
    });

    it('should validate patient before creating document', async () => {
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({
        valid: false,
        error: 'Patient is archived',
      });

      await expect(
        createDocumentMetadata(
          {
            patientId: 'patient-1',
            storageKey: 'storage-key-1',
            fileName: 'test.pdf',
            fileType: 'application/pdf',
            fileSize: 1024,
          },
          'user-1',
          'admin'
        )
      ).rejects.toThrow('Failed to create document metadata');
    });
  });

  describe('Billing', () => {
    it('should create invoice with audit logging', async () => {
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const mockInvoice = {
        id: 'invoice-1',
        patientId: 'patient-1',
        invoiceNumber: 'INV-001',
        totalAmount: 100,
        status: 'DRAFT',
        issuedAt: null,
        dueDate: null,
        paidAt: null,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.invoice.create as any).mockResolvedValue(mockInvoice);

      const result = await createInvoice(
        {
          patientId: 'patient-1',
          invoiceNumber: 'INV-001',
          totalAmount: 100,
        },
        'user-1',
        'billing'
      );

      expect(result).toEqual(mockInvoice);
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'invoice_created',
        resourceType: 'invoice',
        resourceId: 'invoice-1',
        actorId: 'user-1',
        actorRole: 'billing',
        metadata: {
          invoiceId: 'invoice-1',
          patientId: 'patient-1',
        },
      });
    });
  });

  describe('Communication', () => {
    it('should create communication with audit logging', async () => {
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const mockCommunication = {
        id: 'comm-1',
        patientId: 'patient-1',
        channel: 'EMAIL',
        subject: 'Test Subject',
        message: 'Test Message',
        scheduledAt: null,
        sentAt: null,
        deliveredAt: null,
        failedReason: null,
        createdBy: 'user-1',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      (prisma.communication.create as any).mockResolvedValue(mockCommunication);

      const result = await createCommunication(
        {
          patientId: 'patient-1',
          channel: 'EMAIL',
          subject: 'Test Subject',
          message: 'Test Message',
        },
        'user-1',
        'doctor'
      );

      expect(result).toEqual(mockCommunication);
      expect(logAuditEvent).toHaveBeenCalledWith({
        action: 'communication_created',
        resourceType: 'communication',
        resourceId: 'comm-1',
        actorId: 'user-1',
        actorRole: 'doctor',
        metadata: {
          communicationId: 'comm-1',
          patientId: 'patient-1',
          channel: 'EMAIL',
        },
      });
    });
  });

  describe('Staff', () => {
    it('should create staff member with audit logging', async () => {
      const mockStaff = {
        id: 'staff-1',
        userId: 'user-1',
        employeeId: 'EMP-001',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        department: 'DOCTOR',
        specialization: 'Cardiology',
        status: 'ACTIVE',
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      (prisma.staffMember.create as any).mockResolvedValue(mockStaff);

      const result = await createStaffMember(
        {
          userId: 'user-1',
          employeeId: 'EMP-001',
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
          department: 'DOCTOR',
          specialization: 'Cardiology',
        },
        'admin-user',
        'admin'
      );

      expect(result).toEqual(mockStaff);
      expect(logAdminOperation).toHaveBeenCalledWith({
        action: 'staff_created',
        module: 'staff',
        resourceType: 'staff',
        resourceId: 'staff-1',
        actor: 'admin-user',
        role: 'admin',
        metadata: {
          staffId: 'staff-1',
        },
      });
    });

    it('should not log staff PII in audit metadata', async () => {
      const mockStaff = {
        id: 'staff-1',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '+1234567890',
      };

      (prisma.staffMember.create as any).mockResolvedValue(mockStaff);

      await createStaffMember(
        {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        'admin-user',
        'admin'
      );

      const auditCall = (logAdminOperation as jest.Mock).mock.calls[0];
      const metadata = auditCall[0].metadata;

      expect(metadata.firstName).toBeUndefined();
      expect(metadata.lastName).toBeUndefined();
      expect(metadata.email).toBeUndefined();
      expect(metadata.phone).toBeUndefined();
    });
  });

  describe('Settings', () => {
    it('should reject secret-like keys', async () => {
      await expect(
        updateSystemSetting(
          'apiKey',
          {
            settingValue: 'secret-value',
            description: 'API Key',
          },
          'user-1',
          'admin'
        )
      ).rejects.toThrow('Failed to update system setting');
    });

    it('should update system setting with audit logging', async () => {
      const mockSetting = {
        id: 'setting-1',
        settingKey: 'clinicName',
        settingValue: 'Test Clinic',
        description: 'Clinic name',
        updatedAt: new Date(),
      };

      (prisma.systemSetting.findUnique as any).mockResolvedValue(null);
      (prisma.systemSetting.create as any).mockResolvedValue(mockSetting);

      const result = await updateSystemSetting(
        'clinicName',
        {
          settingValue: 'Test Clinic',
          description: 'Clinic name',
        },
        'user-1',
        'admin'
      );

      expect(result).toEqual(mockSetting);
      expect(logAdminOperation).toHaveBeenCalledWith({
        action: 'system_setting_updated',
        module: 'settings',
        resourceType: 'system_setting',
        resourceId: 'setting-1',
        actor: 'user-1',
        role: 'admin',
        metadata: {
          settingKey: 'clinicName',
        },
      });
    });
  });

  describe('RBAC', () => {
    it('should allow admin to manage staff', async () => {
      const mockStaff = {
        id: 'staff-1',
        firstName: 'John',
      };

      (prisma.staffMember.create as any).mockResolvedValue(mockStaff);

      const result = await createStaffMember(
        { firstName: 'John' },
        'admin-user',
        'admin'
      );

      expect(result).toEqual(mockStaff);
    });

    it('should allow billing role to manage invoices', async () => {
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const mockInvoice = {
        id: 'invoice-1',
        patientId: 'patient-1',
        totalAmount: 100,
      };

      (prisma.invoice.create as any).mockResolvedValue(mockInvoice);

      const result = await createInvoice(
        {
          patientId: 'patient-1',
          totalAmount: 100,
        },
        'billing-user',
        'billing'
      );

      expect(result).toEqual(mockInvoice);
    });

    it('should allow doctor to create communications', async () => {
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const mockCommunication = {
        id: 'comm-1',
        patientId: 'patient-1',
        channel: 'EMAIL',
        message: 'Test',
      };

      (prisma.communication.create as any).mockResolvedValue(mockCommunication);

      const result = await createCommunication(
        {
          patientId: 'patient-1',
          channel: 'EMAIL',
          message: 'Test',
        },
        'doctor-user',
        'doctor'
      );

      expect(result).toEqual(mockCommunication);
    });
  });
});
