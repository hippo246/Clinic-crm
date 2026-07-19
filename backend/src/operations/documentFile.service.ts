import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import { storeFile, retrieveFile, deleteFile, generateSignedUrl } from '../storage/storage.service';
import { validateFile, sanitizeFilename } from '../storage/fileValidation';
import { malwareScanService } from '../storage/malwareScan.service';
import type { UploadDocumentInput } from './operations.validation';

/**
 * Upload document file
 */
export async function uploadDocumentFile(
  file: Express.Multer.File,
  metadata: UploadDocumentInput,
  actorId: string,
  actorRole: string
) {
  let storageKey: string | null = null;
  
  try {
    // Validate patient if provided
    if (metadata.patientId) {
      const patientCheck = await validatePatientForWorkflow(metadata.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for document');
      }
    }

    // Validate file
    const validation = validateFile(
      file.size,
      file.mimetype,
      file.originalname
    );
    
    if (!validation.valid) {
      throw new Error(validation.error || 'File validation failed');
    }

    // Scan file for malware (placeholder)
    const scanResult = await malwareScanService.scanFile(file.buffer, file.originalname);
    if (scanResult.status === 'SUSPICIOUS') {
      throw new Error('File flagged as suspicious by malware scan');
    }

    // Store file
    const storageResult = await storeFile(file.buffer, file.mimetype);
    storageKey = storageResult.key;

    // Sanitize filename for display only (not used for storage)
    const displayFileName = sanitizeFilename(file.originalname);

    // Create document metadata
    const document = await prisma.document.create({
      data: {
        patientId: metadata.patientId,
        storageKey: storageResult.key,
        fileName: displayFileName,
        fileType: file.mimetype,
        fileSize: storageResult.size,
        category: metadata.category,
        uploadedBy: actorId,
      },
    });

    // Log audit event with documentId/patientId only
    await logAuditEvent({
      action: 'document_uploaded',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: metadata.patientId,
        sizeBytes: storageResult.size,
        mimeType: file.mimetype,
        scanStatus: scanResult.status,
      },
    }).catch((err) => {
      logger.warn('Failed to log document upload audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return document;
  } catch (error) {
    // Cleanup: delete file from storage if DB write failed
    if (storageKey) {
      try {
        await deleteFile(storageKey);
      } catch (cleanupError) {
        logger.error('Failed to cleanup file after upload error', { error: cleanupError instanceof Error ? cleanupError.message : 'Unknown error' });
      }
    }
    
    logger.error('Failed to upload document file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to upload document file');
  }
}

/**
 * Download document file
 */
export async function downloadDocumentFile(
  documentId: string,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.archivedAt || document.deletedAt) {
      throw new Error('Document is archived or deleted');
    }

    // Validate patient if document is linked to patient
    if (document.patientId) {
      const patientCheck = await validatePatientForWorkflow(document.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for document access');
      }
    }

    // Retrieve file from storage
    const fileData = await retrieveFile(document.storageKey);

    // Log audit event
    await logAuditEvent({
      action: 'document_downloaded',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log document download audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return {
      document,
      fileData,
    };
  } catch (error) {
    logger.error('Failed to download document file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to download document file');
  }
}

/**
 * Archive document file (soft delete metadata only - retention-safe)
 * This does NOT physically delete the file from storage
 */
export async function archiveDocumentFile(
  documentId: string,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.archivedAt || document.deletedAt) {
      throw new Error('Document is already archived or deleted');
    }

    // Mark document as archived (soft delete only - no physical file deletion)
    const updatedDocument = await prisma.document.update({
      where: { id: documentId },
      data: {
        archivedAt: new Date(),
        archivedBy: actorId,
      },
    });

    // Create document event
    await prisma.documentEvent.create({
      data: {
        documentId,
        eventType: 'ARCHIVED',
        description: 'Document file archived (soft delete)',
        metadata: {
          archivedBy: actorId,
          archivedAt: new Date().toISOString(),
        } as any,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'document_file_archived',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log document file archival audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedDocument;
  } catch (error) {
    logger.error('Failed to archive document file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to archive document file');
  }
}

/**
 * Generate signed URL for document access
 */
export async function generateDocumentSignedUrl(
  documentId: string,
  expiresIn: number,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    if (document.archivedAt || document.deletedAt) {
      throw new Error('Document is archived or deleted');
    }

    // Validate patient if document is linked to patient
    if (document.patientId) {
      const patientCheck = await validatePatientForWorkflow(document.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for document access');
      }
    }

    // Generate signed URL
    const signedUrl = await generateSignedUrl(document.storageKey, expiresIn);

    // Log audit event
    await logAuditEvent({
      action: 'document_signed_url_generated',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log document signed URL audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return signedUrl;
  } catch (error) {
    logger.error('Failed to generate document signed URL', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to generate signed URL');
  }
}
