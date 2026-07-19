import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { logAdminOperation } from '../services/adminAuditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  CreateInvoiceItemInput,
  UpdateInvoiceItemInput,
  CreatePaymentInput,
  UpdatePaymentInput,
  CreateInsuranceRecordInput,
  UpdateInsuranceRecordInput,
  InvoiceListQuery,
  PaymentListQuery,
  VoidInvoiceInput,
} from './operations.validation';

/**
 * Create invoice
 */
export async function createInvoice(
  data: CreateInvoiceInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for invoice');
    }

    const invoice = await prisma.invoice.create({
      data: {
        patientId: data.patientId,
        invoiceNumber: data.invoiceNumber,
        totalAmount: data.totalAmount,
        issuedAt: data.issuedAt ? new Date(data.issuedAt) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        notes: data.notes,
      },
    });

    // Log audit event with invoiceId/patientId only
    await logAuditEvent({
      action: 'invoice_created',
      resourceType: 'invoice',
      resourceId: invoice.id,
      actorId,
      actorRole,
      metadata: {
        invoiceId: invoice.id,
        patientId: data.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return invoice;
  } catch (error) {
    logger.error('Failed to create invoice', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create invoice');
  }
}

/**
 * Get invoice by ID
 */
export async function getInvoiceById(id: string) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        payments: true,
      },
    });

    return invoice;
  } catch (error) {
    logger.error('Failed to get invoice by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get invoice');
  }
}

/**
 * List invoices with pagination and filters
 */
export async function listInvoices(query: InvoiceListQuery) {
  try {
    const { page, limit, patientId, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.invoice.count({ where }),
    ]);

    return {
      invoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list invoices', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list invoices');
  }
}

/**
 * Update invoice
 */
export async function updateInvoice(
  id: string,
  data: UpdateInvoiceInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!existingInvoice) {
      throw new Error('Invoice not found');
    }

    // If changing patient, validate new patient
    if (data.patientId && data.patientId !== existingInvoice.patientId) {
      const patientCheck = await validatePatientForWorkflow(data.patientId);
      if (!patientCheck.valid) {
        throw new Error(patientCheck.error || 'Patient not suitable for invoice');
      }
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.patientId !== undefined && data.patientId !== existingInvoice.patientId) {
      updateData.patientId = data.patientId;
      changedFields.push('patientId');
    }
    if (data.invoiceNumber !== undefined && data.invoiceNumber !== existingInvoice.invoiceNumber) {
      updateData.invoiceNumber = data.invoiceNumber;
      changedFields.push('invoiceNumber');
    }
    if (data.totalAmount !== undefined && data.totalAmount.toString() !== existingInvoice.totalAmount.toString()) {
      updateData.totalAmount = data.totalAmount;
      changedFields.push('totalAmount');
    }
    if (data.issuedAt !== undefined) {
      updateData.issuedAt = data.issuedAt ? new Date(data.issuedAt) : null;
      changedFields.push('issuedAt');
    }
    if (data.dueDate !== undefined) {
      updateData.dueDate = data.dueDate ? new Date(data.dueDate) : null;
      changedFields.push('dueDate');
    }
    if (data.notes !== undefined && data.notes !== existingInvoice.notes) {
      updateData.notes = data.notes;
      changedFields.push('notes');
    }

    if (Object.keys(updateData).length === 0) {
      return existingInvoice;
    }

    const invoice = await prisma.invoice.update({
      where: { id },
      data: updateData,
    });

    // Log audit event with changed field names only
    await logAuditEvent({
      action: 'invoice_updated',
      resourceType: 'invoice',
      resourceId: invoice.id,
      actorId,
      actorRole,
      metadata: {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return invoice;
  } catch (error) {
    logger.error('Failed to update invoice', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update invoice');
  }
}

/**
 * Void invoice
 */
export async function voidInvoice(
  id: string,
  _data: VoidInvoiceInput,
  actorId: string,
  actorRole: string
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'invoice_voided',
      module: 'billing',
      resourceType: 'invoice',
      resourceId: invoice.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice void admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedInvoice;
  } catch (error) {
    logger.error('Failed to void invoice', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to void invoice');
  }
}

/**
 * Archive invoice
 */
export async function archiveInvoice(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { id },
      data: { status: 'WRITTEN_OFF' },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'invoice_archived',
      module: 'billing',
      resourceType: 'invoice',
      resourceId: invoice.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice archive admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedInvoice;
  } catch (error) {
    logger.error('Failed to archive invoice', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to archive invoice');
  }
}

/**
 * Delete invoice
 */
export async function deleteInvoice(
  id: string,
  actorId: string,
  actorRole: string
) {
  try {
    const invoice = await prisma.invoice.findUnique({
      where: { id },
    });

    if (!invoice) {
      throw new Error('Invoice not found');
    }

    await prisma.invoice.delete({
      where: { id },
    });

    // Log admin audit event
    await logAdminOperation({
      action: 'invoice_deleted',
      module: 'billing',
      resourceType: 'invoice',
      resourceId: invoice.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        invoiceId: invoice.id,
        patientId: invoice.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice deletion admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete invoice', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete invoice');
  }
}

/**
 * Create invoice item
 */
export async function createInvoiceItem(
  invoiceId: string,
  data: CreateInvoiceItemInput,
  actorId: string,
  actorRole: string
) {
  try {
    const item = await prisma.invoiceItem.create({
      data: {
        invoiceId,
        description: data.description,
        quantity: data.quantity,
        unitPrice: data.unitPrice,
        totalPrice: data.totalPrice,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'invoice_item_created',
      resourceType: 'invoice_item',
      resourceId: item.id,
      actorId,
      actorRole,
      metadata: {
        invoiceItemId: item.id,
        invoiceId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice item creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return item;
  } catch (error) {
    logger.error('Failed to create invoice item', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create invoice item');
  }
}

/**
 * Update invoice item
 */
export async function updateInvoiceItem(
  invoiceId: string,
  itemId: string,
  data: UpdateInvoiceItemInput,
  actorId: string,
  actorRole: string
) {
  try {
    const item = await prisma.invoiceItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new Error('Invoice item not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.description !== undefined && data.description !== item.description) {
      updateData.description = data.description;
      changedFields.push('description');
    }
    if (data.quantity !== undefined && data.quantity !== item.quantity) {
      updateData.quantity = data.quantity;
      changedFields.push('quantity');
    }
    if (data.unitPrice !== undefined && data.unitPrice.toString() !== item.unitPrice.toString()) {
      updateData.unitPrice = data.unitPrice;
      changedFields.push('unitPrice');
    }
    if (data.totalPrice !== undefined && data.totalPrice.toString() !== item.totalPrice.toString()) {
      updateData.totalPrice = data.totalPrice;
      changedFields.push('totalPrice');
    }

    if (Object.keys(updateData).length === 0) {
      return item;
    }

    const updatedItem = await prisma.invoiceItem.update({
      where: { id: itemId },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'invoice_item_updated',
      resourceType: 'invoice_item',
      resourceId: itemId,
      actorId,
      actorRole,
      metadata: {
        invoiceItemId: itemId,
        invoiceId,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice item update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return updatedItem;
  } catch (error) {
    logger.error('Failed to update invoice item', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update invoice item');
  }
}

/**
 * Delete invoice item
 */
export async function deleteInvoiceItem(
  invoiceId: string,
  itemId: string,
  actorId: string,
  actorRole: string
) {
  try {
    await prisma.invoiceItem.delete({
      where: { id: itemId },
    });

    // Log audit event
    await logAuditEvent({
      action: 'invoice_item_deleted',
      resourceType: 'invoice_item',
      resourceId: itemId,
      actorId,
      actorRole,
      metadata: {
        invoiceItemId: itemId,
        invoiceId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log invoice item deletion audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete invoice item', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete invoice item');
  }
}

/**
 * Create payment
 */
export async function createPayment(
  data: CreatePaymentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const payment = await prisma.payment.create({
      data: {
        invoiceId: data.invoiceId,
        amount: data.amount,
        paymentMethod: data.paymentMethod,
        reference: data.reference,
      },
    });

    // Log audit event with paymentId/invoiceId only
    await logAuditEvent({
      action: 'payment_created',
      resourceType: 'payment',
      resourceId: payment.id,
      actorId,
      actorRole,
      metadata: {
        paymentId: payment.id,
        invoiceId: data.invoiceId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log payment creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return payment;
  } catch (error) {
    logger.error('Failed to create payment', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create payment');
  }
}

/**
 * Get payment by ID
 */
export async function getPaymentById(id: string) {
  try {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        invoice: true,
      },
    });

    return payment;
  } catch (error) {
    logger.error('Failed to get payment by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get payment');
  }
}

/**
 * List payments with pagination and filters
 */
export async function listPayments(query: PaymentListQuery) {
  try {
    const { page, limit, invoiceId, status, sortBy, sortOrder } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (invoiceId) where.invoiceId = invoiceId;
    if (status) where.status = status;

    const [payments, total] = await Promise.all([
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
      }),
      prisma.payment.count({ where }),
    ]);

    return {
      payments,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('Failed to list payments', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list payments');
  }
}

/**
 * Update payment
 */
export async function updatePayment(
  id: string,
  data: UpdatePaymentInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingPayment = await prisma.payment.findUnique({
      where: { id },
    });

    if (!existingPayment) {
      throw new Error('Payment not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.amount !== undefined && data.amount.toString() !== existingPayment.amount.toString()) {
      updateData.amount = data.amount;
      changedFields.push('amount');
    }
    if (data.paymentMethod !== undefined && data.paymentMethod !== existingPayment.paymentMethod) {
      updateData.paymentMethod = data.paymentMethod;
      changedFields.push('paymentMethod');
    }
    if (data.status !== undefined && data.status !== existingPayment.status) {
      updateData.status = data.status;
      changedFields.push('status');
      if (data.status === 'COMPLETED') {
        updateData.paidAt = new Date();
      }
    }
    if (data.reference !== undefined && data.reference !== existingPayment.reference) {
      updateData.reference = data.reference;
      changedFields.push('reference');
    }

    if (Object.keys(updateData).length === 0) {
      return existingPayment;
    }

    const payment = await prisma.payment.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'payment_updated',
      resourceType: 'payment',
      resourceId: payment.id,
      actorId,
      actorRole,
      metadata: {
        paymentId: payment.id,
        invoiceId: payment.invoiceId,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log payment update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return payment;
  } catch (error) {
    logger.error('Failed to update payment', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update payment');
  }
}

/**
 * Create insurance record
 */
export async function createInsuranceRecord(
  data: CreateInsuranceRecordInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient
    const patientCheck = await validatePatientForWorkflow(data.patientId);
    if (!patientCheck.valid) {
      throw new Error(patientCheck.error || 'Patient not suitable for insurance record');
    }

    const insurance = await prisma.insuranceRecord.create({
      data: {
        patientId: data.patientId,
        provider: data.provider,
        policyNumber: data.policyNumber,
        groupNumber: data.groupNumber,
        validFrom: new Date(data.validFrom),
        validTo: data.validTo ? new Date(data.validTo) : null,
        isActive: data.isActive,
      },
    });

    // Log audit event with insuranceId/patientId only
    await logAuditEvent({
      action: 'insurance_created',
      resourceType: 'insurance',
      resourceId: insurance.id,
      actorId,
      actorRole,
      metadata: {
        insuranceId: insurance.id,
        patientId: data.patientId,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log insurance creation audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return insurance;
  } catch (error) {
    logger.error('Failed to create insurance record', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to create insurance record');
  }
}

/**
 * Get insurance record by ID
 */
export async function getInsuranceRecordById(id: string) {
  try {
    const insurance = await prisma.insuranceRecord.findUnique({
      where: { id },
    });

    return insurance;
  } catch (error) {
    logger.error('Failed to get insurance record by ID', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get insurance record');
  }
}

/**
 * List insurance records
 */
export async function listInsuranceRecords(patientId?: string) {
  try {
    const where: Record<string, unknown> = {};

    if (patientId) where.patientId = patientId;

    const records = await prisma.insuranceRecord.findMany({
      where,
      orderBy: { validFrom: 'desc' },
    });

    return records;
  } catch (error) {
    logger.error('Failed to list insurance records', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to list insurance records');
  }
}

/**
 * Update insurance record
 */
export async function updateInsuranceRecord(
  id: string,
  data: UpdateInsuranceRecordInput,
  actorId: string,
  actorRole: string
) {
  try {
    const existingInsurance = await prisma.insuranceRecord.findUnique({
      where: { id },
    });

    if (!existingInsurance) {
      throw new Error('Insurance record not found');
    }

    const updateData: Record<string, unknown> = {};
    const changedFields: string[] = [];

    if (data.provider !== undefined && data.provider !== existingInsurance.provider) {
      updateData.provider = data.provider;
      changedFields.push('provider');
    }
    if (data.policyNumber !== undefined && data.policyNumber !== existingInsurance.policyNumber) {
      updateData.policyNumber = data.policyNumber;
      changedFields.push('policyNumber');
    }
    if (data.groupNumber !== undefined && data.groupNumber !== existingInsurance.groupNumber) {
      updateData.groupNumber = data.groupNumber;
      changedFields.push('groupNumber');
    }
    if (data.validFrom !== undefined) {
      updateData.validFrom = new Date(data.validFrom);
      changedFields.push('validFrom');
    }
    if (data.validTo !== undefined) {
      updateData.validTo = data.validTo ? new Date(data.validTo) : null;
      changedFields.push('validTo');
    }
    if (data.isActive !== undefined && data.isActive !== existingInsurance.isActive) {
      updateData.isActive = data.isActive;
      changedFields.push('isActive');
    }

    if (Object.keys(updateData).length === 0) {
      return existingInsurance;
    }

    const insurance = await prisma.insuranceRecord.update({
      where: { id },
      data: updateData,
    });

    // Log audit event
    await logAuditEvent({
      action: 'insurance_updated',
      resourceType: 'insurance',
      resourceId: insurance.id,
      actorId,
      actorRole,
      metadata: {
        insuranceId: insurance.id,
        patientId: insurance.patientId,
        changedFields,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log insurance update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return insurance;
  } catch (error) {
    logger.error('Failed to update insurance record', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update insurance record');
  }
}
