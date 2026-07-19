/**
 * API Configuration
 * Environment-based configuration for data mode and API settings
 */

export type DataMode = 'local' | 'api';

/**
 * Get the current data mode from environment variables
 * Defaults to 'local' for safety - API mode must be opt-in
 */
export function getDataMode(): DataMode {
  const mode = import.meta.env.VITE_DATA_MODE as DataMode;
  return mode === 'api' ? 'api' : 'local';
}

/**
 * Get the API base URL from environment variables
 * Used only when VITE_DATA_MODE=api
 */
export function getApiBaseUrl(): string {
  return import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';
}

/**
 * Get the API timeout from environment variables
 * Defaults to 30 seconds
 */
export function getApiTimeout(): number {
  const timeout = parseInt(import.meta.env.VITE_API_TIMEOUT_MS || '30000', 10);
  return isNaN(timeout) ? 30000 : timeout;
}

/**
 * Check if API debug logging is enabled
 * WARNING: Do not enable in production
 */
export function isApiDebugEnabled(): boolean {
  return import.meta.env.VITE_ENABLE_API_DEBUG === 'true';
}

/**
 * Check if the app is running in API mode
 */
export function isApiMode(): boolean {
  return getDataMode() === 'api';
}

/**
 * Check if the app is running in local mode
 */
export function isLocalMode(): boolean {
  return getDataMode() === 'local';
}

/**
 * Configuration object for easy access
 */
export const apiConfig = {
  dataMode: getDataMode(),
  apiBaseUrl: getApiBaseUrl(),
  apiTimeout: getApiTimeout(),
  debugEnabled: isApiDebugEnabled(),
  isApiMode: isApiMode(),
  isLocalMode: isLocalMode(),
} as const;
