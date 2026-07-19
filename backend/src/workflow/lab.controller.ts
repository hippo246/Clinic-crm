import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createLabOrder as createLabOrderService,
  getLabOrderById as getLabOrderByIdService,
  listLabOrders as listLabOrdersService,
  updateLabOrder as updateLabOrderService,
  updateLabOrderStatus as updateLabOrderStatusService,
  cancelLabOrder as cancelLabOrderService,
  createLabResult as createLabResultService,
  getLabResultById as getLabResultByIdService,
  listLabResults as listLabResultsService,
  updateLabResult as updateLabResultService,
  approveLabResult as approveLabResultService,
  rejectLabResult as rejectLabResultService,
  markLabResultCritical as markLabResultCriticalService,
} from './lab.service';
import {
  createLabOrderSchema,
  updateLabOrderSchema,
  labOrderStatusSchema,
  labOrderListQuerySchema,
  createLabResultSchema,
  updateLabResultSchema,
  approveLabResultSchema,
  rejectLabResultSchema,
  labResultListQuerySchema,
} from './workflow.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

/**
 * Create lab order controller
 */
export async function createLabOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createLabOrderSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create lab orders', 403);
      return;
    }

    const labOrder = await createLabOrderService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labOrder, 'Lab order created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create lab order controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create lab order', 500);
  }
}

/**
 * Get lab order by ID controller
 */
export async function getLabOrderById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view lab orders', 403);
      return;
    }

    const labOrder = await getLabOrderByIdService(id);

    if (!labOrder) {
      errorResponse(res, 'NOT_FOUND', 'Lab order not found', 404);
      return;
    }

    successResponse(res, labOrder, 'Lab order retrieved successfully');
  } catch (error) {
    logger.error('Get lab order by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get lab order', 500);
  }
}

/**
 * List lab orders controller
 */
export async function listLabOrders(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = labOrderListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view lab orders', 403);
      return;
    }

    const result = await listLabOrdersService(validatedQuery);

    successResponse(res, result, 'Lab orders retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List lab orders controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list lab orders', 500);
  }
}

/**
 * Update lab order controller
 */
export async function updateLabOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateLabOrderSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update lab orders', 403);
      return;
    }

    const labOrder = await updateLabOrderService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labOrder, 'Lab order updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Lab order not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab order not found', 404);
      return;
    }
    logger.error('Update lab order controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update lab order', 500);
  }
}

/**
 * Update lab order status controller
 */
export async function updateLabOrderStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = labOrderStatusSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update lab order status', 403);
      return;
    }

    const labOrder = await updateLabOrderStatusService(
      id,
      validatedData.status,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labOrder, 'Lab order status updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Lab order not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab order not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Invalid status transition')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Update lab order status controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update lab order status', 500);
  }
}

/**
 * Cancel lab order controller
 */
export async function cancelLabOrder(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_orders') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to cancel lab orders', 403);
      return;
    }

    const labOrder = await cancelLabOrderService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, labOrder, 'Lab order cancelled successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Lab order not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab order not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot cancel')) {
      errorResponse(res, 'INVALID_TRANSITION', error.message, 400);
      return;
    }
    logger.error('Cancel lab order controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to cancel lab order', 500);
  }
}

/**
 * Create lab result controller
 */
export async function createLabResult(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createLabResultSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create lab results', 403);
      return;
    }

    const labResult = await createLabResultService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labResult, 'Lab result created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create lab result controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create lab result', 500);
  }
}

/**
 * Get lab result by ID controller
 */
export async function getLabResultById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view lab results', 403);
      return;
    }

    const labResult = await getLabResultByIdService(id);

    if (!labResult) {
      errorResponse(res, 'NOT_FOUND', 'Lab result not found', 404);
      return;
    }

    successResponse(res, labResult, 'Lab result retrieved successfully');
  } catch (error) {
    logger.error('Get lab result by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get lab result', 500);
  }
}

/**
 * List lab results controller
 */
export async function listLabResults(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = labResultListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view lab results', 403);
      return;
    }

    const result = await listLabResultsService(validatedQuery);

    successResponse(res, result, 'Lab results retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List lab results controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list lab results', 500);
  }
}

/**
 * Update lab result controller
 */
export async function updateLabResult(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateLabResultSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update lab results', 403);
      return;
    }

    const labResult = await updateLabResultService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labResult, 'Lab result updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Lab result not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab result not found', 404);
      return;
    }
    logger.error('Update lab result controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update lab result', 500);
  }
}

/**
 * Approve lab result controller
 */
export async function approveLabResult(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = approveLabResultSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('approve_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to approve lab results', 403);
      return;
    }

    const labResult = await approveLabResultService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labResult, 'Lab result approved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Lab result not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab result not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot approve')) {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Approve lab result controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to approve lab result', 500);
  }
}

/**
 * Reject lab result controller
 */
export async function rejectLabResult(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = rejectLabResultSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('approve_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to reject lab results', 403);
      return;
    }

    const labResult = await rejectLabResultService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    successResponse(res, labResult, 'Lab result rejected successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Lab result not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab result not found', 404);
      return;
    }
    if (error instanceof Error && error.message.includes('Cannot reject')) {
      errorResponse(res, 'INVALID_STATE', error.message, 400);
      return;
    }
    logger.error('Reject lab result controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to reject lab result', 500);
  }
}

/**
 * Mark lab result as critical controller
 */
export async function markLabResultCritical(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('approve_lab_results') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to mark lab results as critical', 403);
      return;
    }

    const labResult = await markLabResultCriticalService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, labResult, 'Lab result marked as critical successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Lab result not found') {
      errorResponse(res, 'NOT_FOUND', 'Lab result not found', 404);
      return;
    }
    logger.error('Mark lab result critical controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to mark lab result as critical', 500);
  }
}
