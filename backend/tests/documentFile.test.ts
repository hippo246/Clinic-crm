import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { prisma } from '../src/db/client';
import { uploadDocumentFile, downloadDocumentFile, generateDocumentSignedUrl, archiveDocumentFile } from '../src/operations/documentFile.service';
import { resetStorageAdapter } from '../src/storage/storageFactory';
import { mockStoreFile, mockRetrieveFile, mockGenerateSignedUrl } from './setup';

// Mock dependencies
jest.mock('../src/db/client');
jest.mock('../src/storage/storageFactory');
jest.mock('../src/storage/fileValidation');
jest.mock('../src/storage/malwareScan.service');
jest.mock('../src/utils/logger');
jest.mock('../src/services/auditService');
jest.mock('../src/workflow/patientWorkflowGuard');

describe('Document File Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetStorageAdapter();
    // Reset storage service mocks to default resolved values AFTER clearAllMocks
    mockStoreFile.mockResolvedValue({ key: 'documents/2024/01/uuid', size: 12 });
    mockRetrieveFile.mockResolvedValue({
      stream: { pipe: jest.fn() },
      metadata: { key: 'documents/2024/01/uuid', size: 12, contentType: 'application/pdf' },
    });
    mockGenerateSignedUrl.mockResolvedValue({
      url: '/api/documents/file/documents/2024/01/uuid',
      expiresAt: new Date(),
    });
  });

  describe('uploadDocumentFile', () => {
    it('should upload a document file successfully', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 12,
      } as Express.Multer.File;

      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 12,
        patientId: 'patient-1',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
      };

      (prisma.document.create as any).mockResolvedValue(mockDocument);
      (prisma.document.findUnique as any).mockResolvedValue(null);

      const { validateFile } = require('../src/storage/fileValidation');
      (validateFile as jest.Mock).mockReturnValue({ valid: true });

      const { malwareScanService } = require('../src/storage/malwareScan.service');
      (malwareScanService.scanFile as jest.Mock).mockResolvedValue({ status: 'CLEAN', scannedAt: new Date() });

      mockStoreFile.mockResolvedValue({ key: 'documents/2024/01/uuid', size: 12 });

      const { validatePatientForWorkflow } = require('../src/workflow/patientWorkflowGuard');
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const result = await uploadDocumentFile(mockFile, { patientId: 'patient-1' }, 'user-1', 'admin');

      expect(result).toEqual(mockDocument);
      expect(prisma.document.create).toHaveBeenCalled();
    });

    it('should fail file validation', async () => {
      const mockFile = {
        buffer: Buffer.from('test content'),
        originalname: 'test.pdf',
        mimetype: 'application/pdf',
        size: 12,
      } as Express.Multer.File;

      const { validateFile } = require('../src/storage/fileValidation');
      (validateFile as jest.Mock).mockReturnValue({ valid: false, errors: ['Invalid file'] });

      await expect(
        uploadDocumentFile(mockFile, { patientId: 'patient-1' }, 'user-1', 'admin')
      ).rejects.toThrow('Failed to upload document file');
    });
  });

  describe('downloadDocumentFile', () => {
    it('should download a document file successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 12,
        patientId: 'patient-1',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      const { validatePatientForWorkflow } = require('../src/workflow/patientWorkflowGuard');
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const result = await downloadDocumentFile('doc-1', 'user-1', 'admin');

      expect(result.document).toEqual(mockDocument);
      expect(result.fileData).toBeDefined();
    });

    it('should throw error for archived document', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        archivedAt: new Date(),
        deletedAt: null,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      await expect(
        downloadDocumentFile('doc-1', 'user-1', 'admin')
      ).rejects.toThrow('Failed to download document file');
    });
  });

  describe('generateDocumentSignedUrl', () => {
    it('should generate a signed URL successfully', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 12,
        patientId: 'patient-1',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      const { validatePatientForWorkflow } = require('../src/workflow/patientWorkflowGuard');
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const result = await generateDocumentSignedUrl('doc-1', 300, 'user-1', 'admin');

      expect(result.url).toContain('/api/documents/file/');
      expect(result.expiresAt).toBeInstanceOf(Date);
    });

    it('should throw error for deleted document', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        deletedAt: new Date(),
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      await expect(
        generateDocumentSignedUrl('doc-1', 300, 'user-1', 'admin')
      ).rejects.toThrow('Failed to generate signed URL');
    });
  });

  describe('archiveDocumentFile', () => {
    it('should archive document file (soft delete only)', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        fileName: 'test.pdf',
        fileType: 'application/pdf',
        fileSize: 12,
        patientId: 'patient-1',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        archivedAt: null,
        deletedAt: null,
      };

      const mockArchivedDocument = {
        ...mockDocument,
        archivedAt: new Date(),
        archivedBy: 'user-1',
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);
      (prisma.document.update as any).mockResolvedValue(mockArchivedDocument);
      (prisma.documentEvent.create as any).mockResolvedValue({});

      const { validatePatientForWorkflow } = require('../src/workflow/patientWorkflowGuard');
      (validatePatientForWorkflow as jest.Mock).mockResolvedValue({ valid: true });

      const result = await archiveDocumentFile('doc-1', 'user-1', 'admin');

      expect(result.archivedAt).toBeDefined();
      expect(result.archivedBy).toBe('user-1');
      expect(prisma.documentEvent.create).toHaveBeenCalledWith({
        data: {
          documentId: 'doc-1',
          eventType: 'ARCHIVED',
          description: 'Document file archived (soft delete)',
          metadata: expect.any(Object),
        },
      });
    });

    it('should throw error for already archived document', async () => {
      const mockDocument = {
        id: 'doc-1',
        storageKey: 'documents/2024/01/uuid',
        archivedAt: new Date(),
        deletedAt: null,
      };

      (prisma.document.findUnique as any).mockResolvedValue(mockDocument);

      await expect(
        archiveDocumentFile('doc-1', 'user-1', 'admin')
      ).rejects.toThrow('Failed to archive document file');
    });
  });
});
