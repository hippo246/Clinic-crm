/**
 * Health Check API
 * API health and status endpoints
 */

import { apiClient } from './apiClient';

/**
 * Health check response
 */
export interface HealthResponse {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version?: string;
  environment?: string;
}

/**
 * Database health response
 */
export interface DbHealthResponse {
  status: 'healthy' | 'unhealthy';
  connection: 'connected' | 'disconnected';
  latency?: number;
}

/**
 * Check API health
 */
export async function getApiHealth(): Promise<HealthResponse> {
  const response = await apiClient.get<HealthResponse>('/health');
  return response.data;
}

/**
 * Check database health
 */
export async function getDbHealth(): Promise<DbHealthResponse> {
  const response = await apiClient.get<DbHealthResponse>('/health/db');
  return response.data;
}
