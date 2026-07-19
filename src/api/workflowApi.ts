/**
 * Workflow API Adapter
 * Typed API functions for workflow-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Appointment types
 */
export interface Appointment {
  id: string;
  patientId: string;
  staffId?: string;
  date: string;
  time: string;
  duration?: number;
  status: 'SCHEDULED' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAppointmentInput {
  patientId: string;
  staffId?: string;
  date: string;
  time: string;
  duration?: number;
  notes?: string;
}

export interface UpdateAppointmentInput {
  staffId?: string;
  date?: string;
  time?: string;
  duration?: number;
  status?: Appointment['status'];
  notes?: string;
}

export interface AppointmentListQuery {
  patientId?: string;
  staffId?: string;
  status?: Appointment['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Consultation types
 */
export interface Consultation {
  id: string;
  patientId: string;
  staffId: string;
  startedAt: string;
  completedAt?: string;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  notes?: string;
  diagnosis?: string;
  treatment?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateConsultationInput {
  patientId: string;
  staffId: string;
  startedAt: string;
  notes?: string;
  diagnosis?: string;
  treatment?: string;
}

export interface UpdateConsultationInput {
  staffId?: string;
  startedAt?: string;
  completedAt?: string;
  status?: Consultation['status'];
  notes?: string;
  diagnosis?: string;
  treatment?: string;
}

export interface ConsultationListQuery {
  patientId?: string;
  staffId?: string;
  status?: Consultation['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Prescription types
 */
export interface Prescription {
  id: string;
  patientId: string;
  staffId: string;
  prescribedAt: string;
  status: 'DRAFT' | 'ISSUED' | 'DISPENSED' | 'CANCELLED' | 'EXPIRED';
  medication: string;
  dosage: string;
  frequency: string;
  duration?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePrescriptionInput {
  patientId: string;
  staffId: string;
  prescribedAt: string;
  medication: string;
  dosage: string;
  frequency: string;
  duration?: string;
  notes?: string;
}

export interface UpdatePrescriptionInput {
  staffId?: string;
  prescribedAt?: string;
  status?: Prescription['status'];
  medication?: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
}

export interface PrescriptionListQuery {
  patientId?: string;
  staffId?: string;
  status?: Prescription['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Lab Order types
 */
export interface LabOrder {
  id: string;
  patientId: string;
  staffId: string;
  orderedAt: string;
  status: 'ORDERED' | 'SAMPLE_COLLECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  testType: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabOrderInput {
  patientId: string;
  staffId: string;
  orderedAt: string;
  testType: string;
  notes?: string;
}

export interface UpdateLabOrderInput {
  staffId?: string;
  orderedAt?: string;
  status?: LabOrder['status'];
  testType?: string;
  notes?: string;
}

export interface LabOrderListQuery {
  patientId?: string;
  staffId?: string;
  status?: LabOrder['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Lab Result types
 */
export interface LabResult {
  id: string;
  orderId: string;
  patientId: string;
  reportedAt: string;
  status: 'PENDING' | 'REVIEWED' | 'APPROVED' | 'REJECTED';
  result: string;
  referenceRange?: string;
  isCritical?: boolean;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLabResultInput {
  orderId: string;
  patientId: string;
  reportedAt: string;
  result: string;
  referenceRange?: string;
  isCritical?: boolean;
  notes?: string;
}

export interface UpdateLabResultInput {
  reportedAt?: string;
  status?: LabResult['status'];
  result?: string;
  referenceRange?: string;
  isCritical?: boolean;
  notes?: string;
}

export interface LabResultListQuery {
  orderId?: string;
  patientId?: string;
  status?: LabResult['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Queue types
 */
export interface QueueItem {
  id: string;
  patientId: string;
  status: 'WAITING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  priority?: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  room?: string;
  estimatedWaitMinutes?: number;
  arrivedAt: string;
  startedAt?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateQueueItemInput {
  patientId: string;
  priority?: QueueItem['priority'];
  room?: string;
}

export interface UpdateQueueItemInput {
  status?: QueueItem['status'];
  priority?: QueueItem['priority'];
  room?: string;
  estimatedWaitMinutes?: number;
}

export interface QueueListQuery {
  status?: QueueItem['status'];
  priority?: QueueItem['priority'];
  room?: string;
  page?: number;
  limit?: number;
}

/**
 * Appointment functions
 */
export async function listAppointments(query: AppointmentListQuery = {}): Promise<PaginatedResponse<Appointment>> {
  const { patientId, staffId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (staffId) params.append('staffId', staffId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Appointment[]; total: number; page: number; limit: number }>(
    `/workflow/appointments?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getAppointment(appointmentId: string): Promise<Appointment> {
  const response = await apiClient.get<Appointment>(`/workflow/appointments/${appointmentId}`);
  return response.data;
}

export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const response = await apiClient.post<Appointment>('/workflow/appointments', input);
  return response.data;
}

export async function updateAppointment(appointmentId: string, input: UpdateAppointmentInput): Promise<Appointment> {
  const response = await apiClient.put<Appointment>(`/workflow/appointments/${appointmentId}`, input);
  return response.data;
}

export async function cancelAppointment(appointmentId: string, reason?: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/workflow/appointments/${appointmentId}/cancel`, { reason });
  return response.data;
}

/**
 * Consultation functions
 */
export async function listConsultations(query: ConsultationListQuery = {}): Promise<PaginatedResponse<Consultation>> {
  const { patientId, staffId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (staffId) params.append('staffId', staffId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Consultation[]; total: number; page: number; limit: number }>(
    `/workflow/consultations?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getConsultation(consultationId: string): Promise<Consultation> {
  const response = await apiClient.get<Consultation>(`/workflow/consultations/${consultationId}`);
  return response.data;
}

export async function createConsultation(input: CreateConsultationInput): Promise<Consultation> {
  const response = await apiClient.post<Consultation>('/workflow/consultations', input);
  return response.data;
}

export async function updateConsultation(consultationId: string, input: UpdateConsultationInput): Promise<Consultation> {
  const response = await apiClient.put<Consultation>(`/workflow/consultations/${consultationId}`, input);
  return response.data;
}

export async function completeConsultation(consultationId: string): Promise<Consultation> {
  const response = await apiClient.post<Consultation>(`/workflow/consultations/${consultationId}/complete`, {});
  return response.data;
}

export async function cancelConsultation(consultationId: string, reason?: string): Promise<Consultation> {
  const response = await apiClient.post<Consultation>(`/workflow/consultations/${consultationId}/cancel`, { reason });
  return response.data;
}

/**
 * Prescription functions
 */
export async function listPrescriptions(query: PrescriptionListQuery = {}): Promise<PaginatedResponse<Prescription>> {
  const { patientId, staffId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (staffId) params.append('staffId', staffId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Prescription[]; total: number; page: number; limit: number }>(
    `/workflow/prescriptions?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getPrescription(prescriptionId: string): Promise<Prescription> {
  const response = await apiClient.get<Prescription>(`/workflow/prescriptions/${prescriptionId}`);
  return response.data;
}

export async function createPrescription(input: CreatePrescriptionInput): Promise<Prescription> {
  const response = await apiClient.post<Prescription>('/workflow/prescriptions', input);
  return response.data;
}

export async function updatePrescription(prescriptionId: string, input: UpdatePrescriptionInput): Promise<Prescription> {
  const response = await apiClient.put<Prescription>(`/workflow/prescriptions/${prescriptionId}`, input);
  return response.data;
}

export async function refillPrescription(prescriptionId: string): Promise<Prescription> {
  const response = await apiClient.post<Prescription>(`/workflow/prescriptions/${prescriptionId}/refill`, {});
  return response.data;
}

export async function discontinuePrescription(prescriptionId: string, reason?: string): Promise<Prescription> {
  const response = await apiClient.post<Prescription>(`/workflow/prescriptions/${prescriptionId}/discontinue`, { reason });
  return response.data;
}

/**
 * Lab Order functions
 */
export async function listLabOrders(query: LabOrderListQuery = {}): Promise<PaginatedResponse<LabOrder>> {
  const { patientId, staffId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (staffId) params.append('staffId', staffId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: LabOrder[]; total: number; page: number; limit: number }>(
    `/workflow/lab-orders?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getLabOrder(orderId: string): Promise<LabOrder> {
  const response = await apiClient.get<LabOrder>(`/workflow/lab-orders/${orderId}`);
  return response.data;
}

export async function createLabOrder(input: CreateLabOrderInput): Promise<LabOrder> {
  const response = await apiClient.post<LabOrder>('/workflow/lab-orders', input);
  return response.data;
}

export async function updateLabOrder(orderId: string, input: UpdateLabOrderInput): Promise<LabOrder> {
  const response = await apiClient.put<LabOrder>(`/workflow/lab-orders/${orderId}`, input);
  return response.data;
}

export async function cancelLabOrder(orderId: string, reason?: string): Promise<LabOrder> {
  const response = await apiClient.post<LabOrder>(`/workflow/lab-orders/${orderId}/cancel`, { reason });
  return response.data;
}

/**
 * Lab Result functions
 */
export async function listLabResults(query: LabResultListQuery = {}): Promise<PaginatedResponse<LabResult>> {
  const { orderId, patientId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  orderId ? params.append('orderId', orderId) : null;
  if (patientId) params.append('patientId', patientId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: LabResult[]; total: number; page: number; limit: number }>(
    `/workflow/lab-results?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getLabResult(resultId: string): Promise<LabResult> {
  const response = await apiClient.get<LabResult>(`/workflow/lab-results/${resultId}`);
  return response.data;
}

export async function createLabResult(input: CreateLabResultInput): Promise<LabResult> {
  const response = await apiClient.post<LabResult>('/workflow/lab-results', input);
  return response.data;
}

export async function updateLabResult(resultId: string, input: UpdateLabResultInput): Promise<LabResult> {
  const response = await apiClient.put<LabResult>(`/workflow/lab-results/${resultId}`, input);
  return response.data;
}

export async function approveLabResult(resultId: string): Promise<LabResult> {
  const response = await apiClient.post<LabResult>(`/workflow/lab-results/${resultId}/approve`, {});
  return response.data;
}

export async function rejectLabResult(resultId: string, reason?: string): Promise<LabResult> {
  const response = await apiClient.post<LabResult>(`/workflow/lab-results/${resultId}/reject`, { reason });
  return response.data;
}

export async function markLabResultCritical(resultId: string): Promise<LabResult> {
  const response = await apiClient.post<LabResult>(`/workflow/lab-results/${resultId}/critical`, {});
  return response.data;
}

/**
 * Queue functions
 */
export async function listQueue(query: QueueListQuery = {}): Promise<PaginatedResponse<QueueItem>> {
  const { status, priority, room, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (status) params.append('status', status);
  if (priority) params.append('priority', priority);
  if (room) params.append('room', room);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: QueueItem[]; total: number; page: number; limit: number }>(
    `/workflow/queue?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getQueueItem(itemId: string): Promise<QueueItem> {
  const response = await apiClient.get<QueueItem>(`/workflow/queue/${itemId}`);
  return response.data;
}

export async function createQueueItem(input: CreateQueueItemInput): Promise<QueueItem> {
  const response = await apiClient.post<QueueItem>('/workflow/queue', input);
  return response.data;
}

export async function updateQueueItem(itemId: string, input: UpdateQueueItemInput): Promise<QueueItem> {
  const response = await apiClient.put<QueueItem>(`/workflow/queue/${itemId}`, input);
  return response.data;
}

export async function updateQueuePriority(itemId: string, priority: QueueItem['priority']): Promise<QueueItem> {
  const response = await apiClient.put<QueueItem>(`/workflow/queue/${itemId}/priority`, { priority });
  return response.data;
}

export async function updateQueueRoom(itemId: string, room: string): Promise<QueueItem> {
  const response = await apiClient.put<QueueItem>(`/workflow/queue/${itemId}/room`, { room });
  return response.data;
}

/**
 * List appointments
 */
export async function listAppointments(query: AppointmentListQuery = {}): Promise<PaginatedResponse<Appointment>> {
  const { patientId, staffId, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (staffId) params.append('staffId', staffId);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Appointment[]; total: number; page: number; limit: number }>(
    `/appointments?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

/**
 * Get appointment by ID
 */
export async function getAppointment(id: string): Promise<Appointment> {
  const response = await apiClient.get<Appointment>(`/appointments/${id}`);
  return response.data;
}

/**
 * Create appointment
 */
export async function createAppointment(input: CreateAppointmentInput): Promise<Appointment> {
  const response = await apiClient.post<Appointment>('/appointments', input);
  return response.data;
}

/**
 * Update appointment
 */
export async function updateAppointment(id: string, input: UpdateAppointmentInput): Promise<Appointment> {
  const response = await apiClient.put<Appointment>(`/appointments/${id}`, input);
  return response.data;
}

/**
 * Cancel appointment
 */
export async function cancelAppointment(id: string): Promise<Appointment> {
  const response = await apiClient.post<Appointment>(`/appointments/${id}/cancel`, {});
  return response.data;
}

/**
 * List queue
 */
export async function listQueue(): Promise<QueueItem[]> {
  const response = await apiClient.get<QueueItem[]>('/queue');
  return response.data;
}

/**
 * Add to queue
 */
export async function addToQueue(input: AddToQueueInput): Promise<QueueItem> {
  const response = await apiClient.post<QueueItem>('/queue', input);
  return response.data;
}

/**
 * Update queue item status
 */
export async function updateQueueItemStatus(id: string, status: QueueItem['status']): Promise<QueueItem> {
  const response = await apiClient.put<QueueItem>(`/queue/${id}`, { status });
  return response.data;
}
