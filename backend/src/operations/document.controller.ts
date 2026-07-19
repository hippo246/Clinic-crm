import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createDocumentMetadata as createDocumentMetadataService,
  getDocumentById as getDocumentByIdService,
  listDocuments as listDocumentsService,
  updateDocumentMetadata as updateDocumentMetadataService,
  renewDocument as renewDocumentService,
  signDocument as signDocumentService,
  archiveDocument as archiveDocumentService,
  deleteDocument as deleteDocumentService,
} from './document.service';
import {
  createDocumentMetadataSchema,
  updateDocumentMetadataSchema,
  documentListQuerySchema,
  renewDocumentSchema,
  signDocumentSchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create document metadata controller
 */
export async function createDocumentMetadata(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createDocumentMetadataSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create documents', 403);
      return;
    }

    const document = await createDocumentMetadataService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, document, 'Document metadata created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create document metadata controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create document metadata', 500);
  }
}

/**
 * Get document by ID controller
 */
export async function getDocumentById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view documents', 403);
      return;
    }

    const document = await getDocumentByIdService(id);

    if (!document) {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }

    successResponse(res, document, 'Document retrieved successfully');
  } catch (error) {
    logger.error('Get document by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get document', 500);
  }
}

/**
 * List documents controller
 */
export async function listDocuments(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = documentListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view documents', 403);
      return;
    }

    const result = await listDocumentsService(validatedQuery);

    successResponse(res, result, 'Documents retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List documents controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list documents', 500);
  }
}

/**
 * Update document metadata controller
 */
export async function updateDocumentMetadata(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateDocumentMetadataSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update documents', 403);
      return;
    }

    const document = await updateDocumentMetadataService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, document, 'Document metadata updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Update document metadata controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update document metadata', 500);
  }
}

/**
 * Renew document controller
 */
export async function renewDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = renewDocumentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to renew documents', 403);
      return;
    }

    const document = await renewDocumentService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, document, 'Document renewed successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Renew document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to renew document', 500);
  }
}

/**
 * Sign document controller
 */
export async function signDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = signDocumentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to sign documents', 403);
      return;
    }

    const document = await signDocumentService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, document, 'Document signed successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Sign document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to sign document', 500);
  }
}

/**
 * Archive document controller
 */
export async function archiveDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin or explicit delete permission only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('delete_documents')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to archive documents', 403);
      return;
    }

    const document = await archiveDocumentService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, document, 'Document archived successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Archive document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to archive document', 500);
  }
}

/**
 * Delete document controller
 */
export async function deleteDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin or explicit delete permission only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('delete_documents')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete documents', 403);
      return;
    }

    const document = await deleteDocumentService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, document, 'Document deleted successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Delete document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete document', 500);
  }
}
