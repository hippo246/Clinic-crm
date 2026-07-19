import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  uploadDocumentFile,
  downloadDocumentFile,
  generateDocumentSignedUrl,
} from './documentFile.service';
import {
  uploadDocumentSchema,
  documentDownloadQuerySchema,
  documentSignedUrlQuerySchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Upload document file controller
 */
export async function uploadDocument(req: AuthenticatedRequest, res: Response) {
  try {
    if (!req.file) {
      errorResponse(res, 'NO_FILE', 'No file uploaded', 400);
      return;
    }

    const validatedData = uploadDocumentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to upload documents', 403);
      return;
    }

    const document = await uploadDocumentFile(
      req.file,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, document, 'Document uploaded successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Upload document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to upload document', 500);
  }
}

/**
 * Download document file controller
 */
export async function downloadDocument(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedQuery = documentDownloadQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to download documents', 403);
      return;
    }

    const result = await downloadDocumentFile(id, req.user.id, req.user.roles.join(','));

    if (!result) {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }

    // Set response headers
    res.setHeader('Content-Type', result.document.fileType);
    res.setHeader('Content-Disposition', `${validatedQuery.disposition}; filename="${result.document.fileName}"`);
    res.setHeader('Content-Length', result.document.fileSize);

    // Stream the file
    result.fileData.stream.pipe(res);
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Download document controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to download document', 500);
  }
}

/**
 * Generate signed URL for document access
 */
export async function generateSignedUrl(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedQuery = documentSignedUrlQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_documents') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to access documents', 403);
      return;
    }

    const signedUrl = await generateDocumentSignedUrl(
      id,
      validatedQuery.expiresIn,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, signedUrl, 'Signed URL generated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Document not found') {
      errorResponse(res, 'NOT_FOUND', 'Document not found', 404);
      return;
    }
    logger.error('Generate signed URL controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to generate signed URL', 500);
  }
}
