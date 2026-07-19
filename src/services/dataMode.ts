/**
 * Data Mode Service
 * Factory for choosing between localStorage and API services
 */

import { apiConfig } from '../config/apiConfig';

/**
 * Data mode type
 */
export type DataMode = 'local' | 'api';

/**
 * Get current data mode
 */
export function getDataMode(): DataMode {
  return apiConfig.dataMode;
}

/**
 * Check if running in API mode
 */
export function isApiMode(): boolean {
  return getDataMode() === 'api';
}

/**
 * Check if running in local mode
 */
export function isLocalMode(): boolean {
  return getDataMode() === 'local';
}

/**
 * Data mode context for services
 */
export interface DataModeContext {
  mode: DataMode;
  isApiMode: boolean;
  isLocalMode: boolean;
}

/**
 * Get data mode context
 */
export function getDataModeContext(): DataModeContext {
  return {
    mode: getDataMode(),
    isApiMode: isApiMode(),
    isLocalMode: isLocalMode(),
  };
}
