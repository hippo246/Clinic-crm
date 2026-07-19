/**
 * Privacy API Adapter
 * Typed API functions for privacy-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Privacy request types
 */
export interface PrivacyRequest {
  id: string;
  patientId: string;
  requestType: 'ACCESS' | 'DELETION' | 'CORRECTION' | 'RESTRICTION';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'REJECTED';
  requestedAt: string;
  completedAt?: string;
  notes?: string;
}

export interface CreatePrivacyRequestInput {
  patientId: string;
  requestType: PrivacyRequest['requestType'];
  notes?: string;
}

export interface UpdatePrivacyRequestInput {
  status?: PrivacyRequest['status'];
  notes?: string;
}

export interface CommunicationPreference {
  id: string;
  patientId: string;
  channel: 'EMAIL' | 'SMS' | 'PHONE' | 'IN_PERSON' | 'MAIL';
  preferred: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UpdateCommunicationPreferenceInput {
  channel: CommunicationPreference['channel'];
  preferred: boolean;
}

/**
 * Create privacy request
 */
export async function createPrivacyRequest(input: CreatePrivacyRequestInput): Promise<PrivacyRequest> {
  const response = await apiClient.post<PrivacyRequest>('/privacy/requests', input);
  return response.data;
}

/**
 * Update privacy request
 */
export async function updatePrivacyRequest(requestId: string, input: UpdatePrivacyRequestInput): Promise<PrivacyRequest> {
  const response = await apiClient.put<PrivacyRequest>(`/privacy/requests/${requestId}`, input);
  return response.data;
}

/**
 * Approve privacy request
 */
export async function approvePrivacyRequest(requestId: string): Promise<PrivacyRequest> {
  const response = await apiClient.post<PrivacyRequest>(`/privacy/requests/${requestId}/approve`, {});
  return response.data;
}

/**
 * Reject privacy request
 */
export async function rejectPrivacyRequest(requestId: string, reason?: string): Promise<PrivacyRequest> {
  const response = await apiClient.post<PrivacyRequest>(`/privacy/requests/${requestId}/reject`, { reason });
  return response.data;
}

/**
 * Complete privacy request
 */
export async function completePrivacyRequest(requestId: string): Promise<PrivacyRequest> {
  const response = await apiClient.post<PrivacyRequest>(`/privacy/requests/${requestId}/complete`, {});
  return response.data;
}

/**
 * Cancel privacy request
 */
export async function cancelPrivacyRequest(requestId: string): Promise<PrivacyRequest> {
  const response = await apiClient.post<PrivacyRequest>(`/privacy/requests/${requestId}/cancel`, {});
  return response.data;
}

/**
 * List privacy requests
 */
export async function listPrivacyRequests(query: {
  patientId?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedResponse<PrivacyRequest>> {
  const { patientId, status, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (patientId) params.append('patientId', patientId);
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: PrivacyRequest[]; total: number; page: number; limit: number }>(
    `/privacy/requests?${params.toString()}`
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
 * Get privacy request by ID
 */
export async function getPrivacyRequest(requestId: string): Promise<PrivacyRequest> {
  const response = await apiClient.get<PrivacyRequest>(`/privacy/requests/${requestId}`);
  return response.data;
}

/**
 * Get communication preferences for patient
 */
export async function getCommunicationPreferences(patientId: string): Promise<CommunicationPreference[]> {
  const response = await apiClient.get<CommunicationPreference[]>(`/privacy/preferences/${patientId}`);
  return response.data;
}

/**
 * Update communication preference
 */
export async function updateCommunicationPreference(
  patientId: string,
  input: UpdateCommunicationPreferenceInput
): Promise<CommunicationPreference> {
  const response = await apiClient.put<CommunicationPreference>(`/privacy/preferences/${patientId}`, input);
  return response.data;
}

/**
 * Opt-in to communication channel
 */
export async function optInCommunication(patientId: string, channel: CommunicationPreference['channel']): Promise<CommunicationPreference> {
  const response = await apiClient.post<CommunicationPreference>(`/privacy/preferences/${patientId}/opt-in`, { channel });
  return response.data;
}

/**
 * Opt-out of communication channel
 */
export async function optOutCommunication(patientId: string, channel: CommunicationPreference['channel']): Promise<CommunicationPreference> {
  const response = await apiClient.post<CommunicationPreference>(`/privacy/preferences/${patientId}/opt-out`, { channel });
  return response.data;
}
