/**
 * Communication API Adapter
 * Typed API functions for communication-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Communication types
 */
export interface Communication {
  id: string;
  patientId?: string;
  type: 'EMAIL' | 'SMS' | 'CALL' | 'WHATSAPP' | 'LETTER';
  status: 'PENDING' | 'SENT' | 'DELIVERED' | 'FAILED' | 'CANCELLED';
  subject?: string;
  content?: string;
  recipient?: string;
  sentAt?: string;
  scheduledFor?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCommunicationInput {
  patientId?: string;
  type: Communication['type'];
  subject?: string;
  content?: string;
  recipient?: string;
  scheduledFor?: string;
}

export interface UpdateCommunicationInput {
  type?: Communication['type'];
  subject?: string;
  content?: string;
  recipient?: string;
  status?: Communication['status'];
  scheduledFor?: string;
}

export interface CommunicationListQuery {
  patientId?: string;
  type?: Communication['type'];
  status?: Communication['status'];
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
}

/**
 * Scheduled Communication types
 */
export interface ScheduledCommunication {
  id: string;
  patientId: string;
  type: Communication['type'];
  subject?: string;
  content?: string;
  recipient?: string;
  scheduledFor: string;
  status: 'PENDING' | 'SENT' | 'CANCELLED' | 'FAILED';
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleCommunicationInput {
  patientId: string;
  type: Communication['type'];
  subject?: string;
  content?: string;
  recipient?: string;
  scheduledFor: string;
}

/**
 * Communication Template types
 */
export interface CommunicationTemplate {
  id: string;
  name: string;
  type: Communication['type'];
  subject?: string;
  content: string;
  variables?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateInput {
  name: string;
  type: Communication['type'];
  subject?: string;
  content: string;
  variables?: string[];
}

export interface UpdateTemplateInput {
  name?: string;
  type?: Communication['type'];
  subject?: string;
  content?: string;
  variables?: string[];
  isActive?: boolean;
}

/**
 * Call Log types
 */
export interface CallLog {
  id: string;
  patientId: string;
  phoneNumber: string;
  direction: 'INBOUND' | 'OUTBOUND';
  duration?: number;
  status: 'COMPLETED' | 'MISSED' | 'FAILED';
  notes?: string;
  calledAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCallLogInput {
  patientId: string;
  phoneNumber: string;
  direction: CallLog['direction'];
  duration?: number;
  status: CallLog['status'];
  notes?: string;
  calledAt: string;
}

export interface UpdateCallLogInput {
  phoneNumber?: string;
  direction?: CallLog['direction'];
  duration?: number;
  status?: CallLog['status'];
  notes?: string;
  calledAt?: string;
}

/**
 * Communication functions
 */
export async function listCommunications(query: CommunicationListQuery = {}): Promise<PaginatedResponse<Communication>> {
  const { patientId, type, status, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (type) params.append('type', type);
  if (status) params.append('status', status);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Communication[]; total: number; page: number; limit: number }>(
    `/communications?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getCommunication(communicationId: string): Promise<Communication> {
  const response = await apiClient.get<Communication>(`/communications/${communicationId}`);
  return response.data;
}

export async function createCommunication(input: CreateCommunicationInput): Promise<Communication> {
  const response = await apiClient.post<Communication>('/communications', input);
  return response.data;
}

export async function updateCommunication(communicationId: string, input: UpdateCommunicationInput): Promise<Communication> {
  const response = await apiClient.put<Communication>(`/communications/${communicationId}`, input);
  return response.data;
}

export async function deleteCommunication(communicationId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>(`/communications/${communicationId}`);
  return response.data;
}

/**
 * Scheduled Communication functions
 */
export async function listScheduledCommunications(query: { patientId?: string; page?: number; limit?: number } = {}): Promise<PaginatedResponse<ScheduledCommunication>> {
  const { patientId, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: ScheduledCommunication[]; total: number; page: number; limit: number }>(
    `/communications/scheduled?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function scheduleCommunication(input: ScheduleCommunicationInput): Promise<ScheduledCommunication> {
  const response = await apiClient.post<ScheduledCommunication>('/communications/schedule', input);
  return response.data;
}

export async function cancelScheduledCommunication(communicationId: string): Promise<ScheduledCommunication> {
  const response = await apiClient.post<ScheduledCommunication>(`/communications/scheduled/${communicationId}/cancel`, {});
  return response.data;
}

/**
 * Communication Template functions
 */
export async function listCommunicationTemplates(query: { type?: Communication['type']; page?: number; limit?: number } = {}): Promise<PaginatedResponse<CommunicationTemplate>> {
  const { type, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (type) params.append('type', type);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: CommunicationTemplate[]; total: number; page: number; limit: number }>(
    `/communications/templates?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function createCommunicationTemplate(input: CreateTemplateInput): Promise<CommunicationTemplate> {
  const response = await apiClient.post<CommunicationTemplate>('/communications/templates', input);
  return response.data;
}

export async function updateCommunicationTemplate(templateId: string, input: UpdateTemplateInput): Promise<CommunicationTemplate> {
  const response = await apiClient.put<CommunicationTemplate>(`/communications/templates/${templateId}`, input);
  return response.data;
}

export async function deleteCommunicationTemplate(templateId: string): Promise<{ success: boolean }> {
  const response = await apiClient.delete<{ success: boolean }>(`/communications/templates/${templateId}`);
  return response.data;
}

/**
 * Call Log functions
 */
export async function listCallLogs(query: { patientId?: string; dateFrom?: string; dateTo?: string; page?: number; limit?: number } = {}): Promise<PaginatedResponse<CallLog>> {
  const { patientId, dateFrom, dateTo, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (dateFrom) params.append('dateFrom', dateFrom);
  if (dateTo) params.append('dateTo', dateTo);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: CallLog[]; total: number; page: number; limit: number }>(
    `/communications/calls?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function createCallLog(input: CreateCallLogInput): Promise<CallLog> {
  const response = await apiClient.post<CallLog>('/communications/calls', input);
  return response.data;
}

export async function updateCallLog(callLogId: string, input: UpdateCallLogInput): Promise<CallLog> {
  const response = await apiClient.put<CallLog>(`/communications/calls/${callLogId}`, input);
  return response.data;
}
