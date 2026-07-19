import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createRetentionPolicy as createRetentionPolicyService,
  getRetentionPolicyById as getRetentionPolicyByIdService,
  listRetentionPolicies as listRetentionPoliciesService,
  updateRetentionPolicy as updateRetentionPolicyService,
  activateRetentionPolicy as activateRetentionPolicyService,
  deactivateRetentionPolicy as deactivateRetentionPolicyService,
  previewRetentionCleanup as previewRetentionCleanupService,
  runRetentionCleanup as runRetentionCleanupService,
  getRetentionRunById as getRetentionRunByIdService,
  listRetentionRuns as listRetentionRunsService,
} from './retention.service';
import {
  createRetentionPolicySchema,
  updateRetentionPolicySchema,
  retentionPolicyListQuerySchema,
  retentionPreviewQuerySchema,
  retentionRunSchema,
  retentionRunIdParamSchema,
} from './privacy.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== RETENTION POLICY CONTROLLERS ====================

export async function createRetentionPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createRetentionPolicySchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create retention policies', 403);
      return;
    }

    const policy = await createRetentionPolicyService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, policy, 'Retention policy created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create retention policy controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create retention policy', 500);
  }
}

export async function getRetentionPolicyById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view retention policies', 403);
      return;
    }

    const policy = await getRetentionPolicyByIdService(id);

    if (!policy) {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }

    successResponse(res, policy, 'Retention policy retrieved successfully');
  } catch (error) {
    logger.error('Get retention policy by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get retention policy', 500);
  }
}

export async function listRetentionPolicies(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = retentionPolicyListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view retention policies', 403);
      return;
    }

    const result = await listRetentionPoliciesService(validatedQuery);

    successResponse(res, result, 'Retention policies retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List retention policies controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list retention policies', 500);
  }
}

export async function updateRetentionPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateRetentionPolicySchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update retention policies', 403);
      return;
    }

    const policy = await updateRetentionPolicyService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, policy, 'Retention policy updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Retention policy not found') {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }
    logger.error('Update retention policy controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update retention policy', 500);
  }
}

export async function activateRetentionPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to activate retention policies', 403);
      return;
    }

    const policy = await activateRetentionPolicyService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, policy, 'Retention policy activated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Retention policy not found') {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }
    logger.error('Activate retention policy controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to activate retention policy', 500);
  }
}

export async function deactivateRetentionPolicy(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to deactivate retention policies', 403);
      return;
    }

    const policy = await deactivateRetentionPolicyService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, policy, 'Retention policy deactivated successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Retention policy not found') {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }
    logger.error('Deactivate retention policy controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to deactivate retention policy', 500);
  }
}

// ==================== RETENTION RUN CONTROLLERS ====================

export async function previewRetentionCleanup(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = retentionPreviewQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to preview retention cleanup', 403);
      return;
    }

    const preview = await previewRetentionCleanupService(validatedQuery);

    successResponse(res, preview, 'Retention cleanup preview generated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Retention policy not found') {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }
    logger.error('Preview retention cleanup controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to preview retention cleanup', 500);
  }
}

export async function runRetentionCleanup(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = retentionRunSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to run retention cleanup', 403);
      return;
    }

    const run = await runRetentionCleanupService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, run, 'Retention cleanup started successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Retention policy not found') {
      errorResponse(res, 'NOT_FOUND', 'Retention policy not found', 404);
      return;
    }
    logger.error('Run retention cleanup controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to run retention cleanup', 500);
  }
}

export async function getRetentionRunById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    retentionRunIdParamSchema.parse({ id });

    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view retention runs', 403);
      return;
    }

    const run = await getRetentionRunByIdService(id);

    if (!run) {
      errorResponse(res, 'NOT_FOUND', 'Retention run not found', 404);
      return;
    }

    successResponse(res, run, 'Retention run retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid retention run ID', 400);
      return;
    }
    logger.error('Get retention run by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get retention run', 500);
  }
}

export async function listRetentionRuns(req: AuthenticatedRequest, res: Response) {
  try {
    // Check permissions
    if (!req.user?.permissions.includes('view_privacy') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view retention runs', 403);
      return;
    }

    const runs = await listRetentionRunsService();

    successResponse(res, runs, 'Retention runs retrieved successfully');
  } catch (error) {
    logger.error('List retention runs controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list retention runs', 500);
  }
}
