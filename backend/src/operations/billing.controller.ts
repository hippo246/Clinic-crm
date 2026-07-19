import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  createInvoice as createInvoiceService,
  getInvoiceById as getInvoiceByIdService,
  listInvoices as listInvoicesService,
  updateInvoice as updateInvoiceService,
  voidInvoice as voidInvoiceService,
  archiveInvoice as archiveInvoiceService,
  deleteInvoice as deleteInvoiceService,
  createInvoiceItem as createInvoiceItemService,
  updateInvoiceItem as updateInvoiceItemService,
  deleteInvoiceItem as deleteInvoiceItemService,
  createPayment as createPaymentService,
  getPaymentById as getPaymentByIdService,
  listPayments as listPaymentsService,
  updatePayment as updatePaymentService,
  createInsuranceRecord as createInsuranceRecordService,
  getInsuranceRecordById as getInsuranceRecordByIdService,
  listInsuranceRecords as listInsuranceRecordsService,
  updateInsuranceRecord as updateInsuranceRecordService,
} from './billing.service';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  createInvoiceItemSchema,
  updateInvoiceItemSchema,
  createPaymentSchema,
  updatePaymentSchema,
  createInsuranceRecordSchema,
  updateInsuranceRecordSchema,
  invoiceListQuerySchema,
  paymentListQuerySchema,
  voidInvoiceSchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== INVOICE CONTROLLERS ====================

export async function createInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createInvoiceSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create invoices', 403);
      return;
    }

    const invoice = await createInvoiceService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, invoice, 'Invoice created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create invoice controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create invoice', 500);
  }
}

export async function getInvoiceById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view invoices', 403);
      return;
    }

    const invoice = await getInvoiceByIdService(id);

    if (!invoice) {
      errorResponse(res, 'NOT_FOUND', 'Invoice not found', 404);
      return;
    }

    successResponse(res, invoice, 'Invoice retrieved successfully');
  } catch (error) {
    logger.error('Get invoice by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get invoice', 500);
  }
}

export async function listInvoices(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = invoiceListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view invoices', 403);
      return;
    }

    const result = await listInvoicesService(validatedQuery);

    successResponse(res, result, 'Invoices retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List invoices controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list invoices', 500);
  }
}

export async function updateInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateInvoiceSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update invoices', 403);
      return;
    }

    const invoice = await updateInvoiceService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, invoice, 'Invoice updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invoice not found') {
      errorResponse(res, 'NOT_FOUND', 'Invoice not found', 404);
      return;
    }
    logger.error('Update invoice controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update invoice', 500);
  }
}

export async function voidInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = voidInvoiceSchema.parse(req.body);

    // Check permissions - admin or billing only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('edit_billing')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to void invoices', 403);
      return;
    }

    const invoice = await voidInvoiceService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, invoice, 'Invoice voided successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invoice not found') {
      errorResponse(res, 'NOT_FOUND', 'Invoice not found', 404);
      return;
    }
    logger.error('Void invoice controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to void invoice', 500);
  }
}

export async function archiveInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin or billing only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('edit_billing')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to archive invoices', 403);
      return;
    }

    const invoice = await archiveInvoiceService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, invoice, 'Invoice archived successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invoice not found') {
      errorResponse(res, 'NOT_FOUND', 'Invoice not found', 404);
      return;
    }
    logger.error('Archive invoice controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to archive invoice', 500);
  }
}

export async function deleteInvoice(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions - admin or billing only
    if (!req.user?.roles.includes('admin') && !req.user?.permissions.includes('edit_billing')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete invoices', 403);
      return;
    }

    const result = await deleteInvoiceService(id, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Invoice deleted successfully');
  } catch (error) {
    if (error instanceof Error && error.message === 'Invoice not found') {
      errorResponse(res, 'NOT_FOUND', 'Invoice not found', 404);
      return;
    }
    logger.error('Delete invoice controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete invoice', 500);
  }
}

// ==================== INVOICE ITEM CONTROLLERS ====================

export async function createInvoiceItem(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = createInvoiceItemSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create invoice items', 403);
      return;
    }

    const item = await createInvoiceItemService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, item, 'Invoice item created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create invoice item controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create invoice item', 500);
  }
}

export async function updateInvoiceItem(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, itemId } = req.params;
    const validatedData = updateInvoiceItemSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update invoice items', 403);
      return;
    }

    const item = await updateInvoiceItemService(id, itemId, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, item, 'Invoice item updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Invoice item not found') {
      errorResponse(res, 'NOT_FOUND', 'Invoice item not found', 404);
      return;
    }
    logger.error('Update invoice item controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update invoice item', 500);
  }
}

export async function deleteInvoiceItem(req: AuthenticatedRequest, res: Response) {
  try {
    const { id, itemId } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete invoice items', 403);
      return;
    }

    const result = await deleteInvoiceItemService(id, itemId, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Invoice item deleted successfully');
  } catch (error) {
    logger.error('Delete invoice item controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete invoice item', 500);
  }
}

// ==================== PAYMENT CONTROLLERS ====================

export async function createPayment(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createPaymentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create payments', 403);
      return;
    }

    const payment = await createPaymentService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, payment, 'Payment created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create payment controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create payment', 500);
  }
}

export async function getPaymentById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view payments', 403);
      return;
    }

    const payment = await getPaymentByIdService(id);

    if (!payment) {
      errorResponse(res, 'NOT_FOUND', 'Payment not found', 404);
      return;
    }

    successResponse(res, payment, 'Payment retrieved successfully');
  } catch (error) {
    logger.error('Get payment by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get payment', 500);
  }
}

export async function listPayments(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedQuery = paymentListQuerySchema.parse(req.query);

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view payments', 403);
      return;
    }

    const result = await listPaymentsService(validatedQuery);

    successResponse(res, result, 'Payments retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List payments controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list payments', 500);
  }
}

export async function updatePayment(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updatePaymentSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update payments', 403);
      return;
    }

    const payment = await updatePaymentService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, payment, 'Payment updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Payment not found') {
      errorResponse(res, 'NOT_FOUND', 'Payment not found', 404);
      return;
    }
    logger.error('Update payment controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update payment', 500);
  }
}

// ==================== INSURANCE CONTROLLERS ====================

export async function createInsuranceRecord(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = createInsuranceRecordSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create insurance records', 403);
      return;
    }

    const insurance = await createInsuranceRecordService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, insurance, 'Insurance record created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create insurance record controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create insurance record', 500);
  }
}

export async function getInsuranceRecordById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view insurance records', 403);
      return;
    }

    const insurance = await getInsuranceRecordByIdService(id);

    if (!insurance) {
      errorResponse(res, 'NOT_FOUND', 'Insurance record not found', 404);
      return;
    }

    successResponse(res, insurance, 'Insurance record retrieved successfully');
  } catch (error) {
    logger.error('Get insurance record by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get insurance record', 500);
  }
}

export async function listInsuranceRecords(req: AuthenticatedRequest, res: Response) {
  try {
    const { patientId } = req.query;

    // Check permissions
    if (!req.user?.permissions.includes('view_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view insurance records', 403);
      return;
    }

    const records = await listInsuranceRecordsService(patientId as string | undefined);

    successResponse(res, records, 'Insurance records retrieved successfully');
  } catch (error) {
    logger.error('List insurance records controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list insurance records', 500);
  }
}

export async function updateInsuranceRecord(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const validatedData = updateInsuranceRecordSchema.parse(req.body);

    // Check permissions
    if (!req.user?.permissions.includes('edit_billing') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update insurance records', 403);
      return;
    }

    const insurance = await updateInsuranceRecordService(id, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, insurance, 'Insurance record updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Insurance record not found') {
      errorResponse(res, 'NOT_FOUND', 'Insurance record not found', 404);
      return;
    }
    logger.error('Update insurance record controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update insurance record', 500);
  }
}
