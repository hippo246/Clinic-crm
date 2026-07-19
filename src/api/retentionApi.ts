/**
 * Retention API Adapter
 * Typed API functions for retention policy and cleanup endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Retention policy types
 */
export interface RetentionPolicy {
  id: string;
  policyName: string;
  entityType: string;
  retentionPeriodDays: number;
  retentionType: 'FIXED' | 'EVENT_BASED' | 'REGULATORY';
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  description?: string;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
  deactivatedAt?: string;
}

export interface CreateRetentionPolicyInput {
  policyName: string;
  entityType: string;
  retentionPeriodDays: number;
  retentionType: RetentionPolicy['retentionType'];
  description?: string;
}

export interface UpdateRetentionPolicyInput {
  policyName?: string;
  retentionPeriodDays?: number;
  description?: string;
}

export interface RetentionCleanupPreview {
  canCleanup: boolean;
  recordCounts: Record<string, number>;
  estimatedSizeBytes: number;
  warnings: string[];
}

export interface RetentionRun {
  id: string;
  policyId: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  startedAt: string;
  completedAt?: string;
  recordsDeleted: number;
  recordsArchived: number;
  error?: string;
}

/**
 * List retention policies
 */
export async function listRetentionPolicies(query: {
  status?: string;
  entityType?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedResponse<RetentionPolicy>> {
  const { status, entityType, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (status) params.append('status', status);
  if (entityType) params.append('entityType', entityType);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: RetentionPolicy[]; total: number; page: number; limit: number }>(
    `/retention/policies?${params.toString()}`
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
 * Get retention policy by ID
 */
export async function getRetentionPolicy(policyId: string): Promise<RetentionPolicy> {
  const response = await apiClient.get<RetentionPolicy>(`/retention/policies/${policyId}`);
  return response.data;
}

/**
 * Create retention policy
 */
export async function createRetentionPolicy(input: CreateRetentionPolicyInput): Promise<RetentionPolicy> {
  const response = await apiClient.post<RetentionPolicy>('/retention/policies', input);
  return response.data;
}

/**
 * Update retention policy
 */
export async function updateRetentionPolicy(policyId: string, input: UpdateRetentionPolicyInput): Promise<RetentionPolicy> {
  const response = await apiClient.put<RetentionPolicy>(`/retention/policies/${policyId}`, input);
  return response.data;
}

/**
 * Activate retention policy
 */
export async function activateRetentionPolicy(policyId: string): Promise<RetentionPolicy> {
  const response = await apiClient.post<RetentionPolicy>(`/retention/policies/${policyId}/activate`, {});
  return response.data;
}

/**
 * Deactivate retention policy
 */
export async function deactivateRetentionPolicy(policyId: string): Promise<RetentionPolicy> {
  const response = await apiClient.post<RetentionPolicy>(`/retention/policies/${policyId}/deactivate`, {});
  return response.data;
}

/**
 * Preview retention cleanup
 */
export async function previewRetentionCleanup(policyId: string): Promise<RetentionCleanupPreview> {
  const response = await apiClient.get<RetentionCleanupPreview>(`/retention/policies/${policyId}/preview`);
  return response.data;
}

/**
 * Run retention cleanup (requires confirmation)
 * Confirmation string is accepted as parameter only and not logged
 */
export async function runRetentionCleanup(
  policyId: string,
  confirmation: string
): Promise<RetentionRun> {
  const response = await apiClient.post<RetentionRun>(`/retention/policies/${policyId}/run`, {
    confirmation,
  });
  return response.data;
}

/**
 * List retention runs
 */
export async function listRetentionRuns(query: {
  policyId?: string;
  status?: string;
  page?: number;
  limit?: number;
} = {}): Promise<PaginatedResponse<RetentionRun>> {
  const { policyId, status, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (policyId) params.append('policyId', policyId);
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: RetentionRun[]; total: number; page: number; limit: number }>(
    `/retention/runs?${params.toString()}`
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
 * Get retention run by ID
 */
export async function getRetentionRun(runId: string): Promise<RetentionRun> {
  const response = await apiClient.get<RetentionRun>(`/retention/runs/${runId}`);
  return response.data;
}
