import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import {
  CreateDocumentMetadataInput,
  UpdateDocumentMetadataInput,
  RenewDocumentInput,
  SignDocumentInput,
  DocumentListQuery,
} from './operations.validation';

/**
 * Create document metadata
 */
export async function createDocumentMetadata(
  data: CreateDocumentMetadataInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient if provided
    if (data.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for document');
      }
    }

    const document = await prisma.document.create({
      data: {
        patientId: data.patientId,
        storageKey: data.storageKey,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        category: data.category,
        uploadedBy: actorId,
      },
    });

    // Log audit event with documentId/patientId only
    await logAuditEvent({
      action: 'document_created',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: data.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log document creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return document;
  } catch (error) {
    logger.error('Failed to create document metadata', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create document metadata');
  }
}

/**
 * Get document by ID
 */
export async function getDocumentById(id: string) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
      include: {
        events: true,
      },
    });

    return document;
  } catch (error) {
    logger.error('Failed to get document by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get document');
  }
}

/**
 * List documents with pagination and filters
 */
export async function listDocuments(query: DocumentListQuery) {
  try {
    const { page, limit, patientId, category, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      deletedAt: null,
    };

    if (patientId) where.patientId = patientId;
    if (category) where.category = category;

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.document.count({ where }),
    ]);

    return {
      documents,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list documents', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list documents');
  }
}

/**
 * Update document metadata
 */
export async function updateDocumentMetadata(
  id: string,
  data: UpdateDocumentMetadataInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingDocument = await prisma.document.findUnique({
      where: { id },
    });

    if (!existingDocument) {
      throw new Error('Document not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingDocument.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for document');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingDocument.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.storageKey !== undefined && data.storageKey !== existingDocument.storageKey) {
      updateData.storageKey = data.storageKey;
      changedFields.push('storageKey');
    }
    if (data.fileName !== undefined && data.fileName !== existingDocument.fileName) {
      updateData.fileName = data.fileName;
      changedFields.push('fileName');
    }
    if (data.fileType !== undefined && data.fileType !== existingDocument.fileType) {
      updateData.fileType = data.fileType;
      changedFields.push('fileType');
    }
    if (data.fileSize !== undefined && data.fileSize !== existingDocument.fileSize) {
      updateData.fileSize = data.fileSize;
      changedFields.push('fileSize');
    }
    if (data.category !== undefined && data.category !== existingDocument.category) {
      updateData.category = data.category;
      changedFields.push('category');
    }

    if (Object.keys(updateData).length === 0) {
      return existingDocument;
    }

    const document = await prisma.document.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'document_updated',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
        changedFields,
      },
    }).catch((err) => {
      logger.warn('Failed to log document update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return document;
  } catch (error) {
    logger.error('Failed to update document metadata', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update document metadata');
  }
}

/**
 * Renew document
 */
export async function renewDocument(
  id: string,
  data: RenewDocumentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Create document event for renewal
    await prisma.documentEvent.create({
      data: {
        documentId: id,
        eventType: 'RENEWED',
        description: 'Document renewed',
        metadata: {
          renewedBy: actorId,
          renewedAt: new Date().toISOString(),
          notes: data.notes,
        } as any,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'document_renewed',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err) => {
      logger.warn('Failed to log document renewal audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return document;
  } catch (error) {
    logger.error('Failed to renew document', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to renew document');
  }
}

/**
 * Sign document
 */
export async function signDocument(
  id: string,
  data: SignDocumentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    // Create document event for signing
    await prisma.documentEvent.create({
      data: {
        documentId: id,
        eventType: 'SIGNED',
        description: 'Document signed',
        metadata: {
          signedBy: data.signedBy,
          signedAt: data.signedAt,
          notes: data.notes,
        } as any,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'document_signed',
      resourceType: 'document',
      resourceId: document.id,
      actorId,
      actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
        signedBy: data.signedBy,
      },
    }).catch((err) => {
      logger.warn('Failed to log document signing audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return document;
  } catch (error) {
    logger.error('Failed to sign document', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to sign document');
  }
}

/**
 * Archive document
 */
export async function archiveDocument(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        archivedBy: actorId,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'document_archived',
      module: 'documents',
      resourceType: 'document',
      resourceId: document.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log document archival admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedDocument;
  } catch (error) {
    logger.error('Failed to archive document', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to archive document');
  }
}

/**
 * Delete document (soft delete)
 */
export async function deleteDocument(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const document = await prisma.document.findUnique({
      where: { id },
    });

    if (!document) {
      throw new Error('Document not found');
    }

    const updatedDocument = await prisma.document.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        deletedBy: actorId,
      },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'document_deleted',
      module: 'documents',
      resourceType: 'document',
      resourceId: document.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        documentId: document.id,
        patientId: document.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log document deletion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedDocument;
  } catch (error) {
    logger.error('Failed to delete document', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete document');
  }
}
