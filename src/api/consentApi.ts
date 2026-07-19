/**
 * Consent API Adapter
 * Typed API functions for consent management endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Consent types
 */
export interface ConsentRecord {
  id: string;
  patientId: string;
  consentType: string;
  status: 'GRANTED' | 'REVOKED' | 'EXPIRED';
  grantedAt: string;
  revokedAt?: string;
  expiresAt?: string;
  grantedBy: string;
  revokedBy?: string;
  notes?: string;
}

export interface CreateConsentInput {
  patientId: string;
  consentType: string;
  expiresAt?: string;
  notes?: string;
}

export interface RevokeConsentInput {
  reason?: string;
}

/**
 * List consents for patient
 */
export async function listConsents(patientId: string): Promise<ConsentRecord[]> {
  const response = await apiClient.get<ConsentRecord[]>(`/consents/patient/${patientId}`);
  return response.data;
}

/**
 * Get consent by ID
 */
export async function getConsent(consentId: string): Promise<ConsentRecord> {
  const response = await apiClient.get<ConsentRecord>(`/consents/${consentId}`);
  return response.data;
}

/**
 * Create consent
 */
export async function createConsent(input: CreateConsentInput): Promise<ConsentRecord> {
  const response = await apiClient.post<ConsentRecord>('/consents', input);
  return response.data;
}

/**
 * Update consent
 */
export async function updateConsent(consentId: string, input: {
  expiresAt?: string;
  notes?: string;
}): Promise<ConsentRecord> {
  const response = await apiClient.put<ConsentRecord>(`/consents/${consentId}`, input);
  return response.data;
}

/**
 * Revoke consent
 */
export async function revokeConsent(consentId: string, input: RevokeConsentInput = {}): Promise<ConsentRecord> {
  const response = await apiClient.post<ConsentRecord>(`/consents/${consentId}/revoke`, input);
  return response.data;
}

/**
 * Get consent history
 */
export async function getConsentHistory(patientId: string): Promise<ConsentRecord[]> {
  const response = await apiClient.get<ConsentRecord[]>(`/consents/patient/${patientId}/history`);
  return response.data;
}
