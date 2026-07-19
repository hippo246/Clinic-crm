/**
 * Billing API Adapter
 * Typed API functions for billing-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Invoice types
 */
export interface Invoice {
  id: string;
  invoiceNumber: string;
  patientId: string;
  totalAmount: number;
  status: 'DRAFT' | 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE' | 'CANCELLED' | 'WRITTEN_OFF';
  issuedAt?: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateInvoiceInput {
  patientId: string;
  invoiceNumber: string;
  totalAmount: number;
  issuedAt?: string;
  dueDate?: string;
  notes?: string;
}

export interface UpdateInvoiceInput {
  invoiceNumber?: string;
  totalAmount?: number;
  issuedAt?: string;
  dueDate?: string;
  notes?: string;
  status?: Invoice['status'];
}

export interface InvoiceListQuery {
  patientId?: string;
  status?: Invoice['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Payment types
 */
export interface Payment {
  id: string;
  invoiceId: string;
  amount: number;
  paymentMethod: 'CASH' | 'CARD' | 'UPI' | 'BANK_TRANSFER' | 'INSURANCE';
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paidAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePaymentInput {
  invoiceId: string;
  amount: number;
  paymentMethod: Payment['paymentMethod'];
  notes?: string;
}

export interface UpdatePaymentInput {
  amount?: number;
  paymentMethod?: Payment['paymentMethod'];
  status?: Payment['status'];
  notes?: string;
}

export interface PaymentListQuery {
  invoiceId?: string;
  status?: Payment['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Invoice functions
 */
export async function listInvoices(query: InvoiceListQuery = {}): Promise<PaginatedResponse<Invoice>> {
  const { patientId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Invoice[]; total: number; page: number; limit: number }>(
    `/billing/invoices?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getInvoice(invoiceId: string): Promise<Invoice> {
  const response = await apiClient.get<Invoice>(`/billing/invoices/${invoiceId}`);
  return response.data;
}

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const response = await apiClient.post<Invoice>('/billing/invoices', input);
  return response.data;
}

export async function updateInvoice(invoiceId: string, input: UpdateInvoiceInput): Promise<Invoice> {
  const response = await apiClient.put<Invoice>(`/billing/invoices/${invoiceId}`, input);
  return response.data;
}

export async function voidInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
  const response = await apiClient.post<Invoice>(`/billing/invoices/${invoiceId}/void`, { reason });
  return response.data;
}

export async function writeOffInvoice(invoiceId: string, reason?: string): Promise<Invoice> {
  const response = await apiClient.post<Invoice>(`/billing/invoices/${invoiceId}/write-off`, { reason });
  return response.data;
}

/**
 * Payment functions
 */
export async function listPayments(query: PaymentListQuery = {}): Promise<PaginatedResponse<Payment>> {
  const { invoiceId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (invoiceId) params.append('invoiceId', invoiceId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Payment[]; total: number; page: number; limit: number }>(
    `/billing/payments?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getPayment(paymentId: string): Promise<Payment> {
  const response = await apiClient.get<Payment>(`/billing/payments/${paymentId}`);
  return response.data;
}

export async function createPayment(input: CreatePaymentInput): Promise<Payment> {
  const response = await apiClient.post<Payment>('/billing/payments', input);
  return response.data;
}

export async function updatePayment(paymentId: string, input: UpdatePaymentInput): Promise<Payment> {
  const response = await apiClient.put<Payment>(`/billing/payments/${paymentId}`, input);
  return response.data;
}

export async function refundPayment(paymentId: string, reason?: string): Promise<Payment> {
  const response = await apiClient.post<Payment>(`/billing/payments/${paymentId}/refund`, { reason });
  return response.data;
}
