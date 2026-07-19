/**
 * API Mode Helper
 * Internal helper to check current data mode
 */

import { apiConfig } from '../config/apiConfig';

/**
 * Get current data mode
 */
export function getDataMode(): 'local' | 'api' {
  return apiConfig.dataMode;
}

/**
 * Check if running in API mode
 */
export function isApiMode(): boolean {
  return apiConfig.isApiMode;
}

/**
 * Check if running in local mode
 */
export function isLocalMode(): boolean {
  return apiConfig.isLocalMode;
}

/**
 * Get API base URL (only meaningful in API mode)
 */
export function getApiBaseUrl(): string {
  return apiConfig.apiBaseUrl;
}
