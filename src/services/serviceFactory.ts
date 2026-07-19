/**
 * Service Factory
 * Creates service instances based on data mode
 */

import { getDataModeContext } from './dataMode';

/**
 * Service factory options
 */
export interface ServiceFactoryOptions<TLocal, TApi> {
  localService: TLocal;
  apiService: TApi;
}

/**
 * Create a service that switches between local and API implementations
 */
export function createService<TLocal, TApi>(
  options: ServiceFactoryOptions<TLocal, TApi>
): TLocal | TApi {
  const { isApiMode } = getDataModeContext();
  
  if (isApiMode) {
    return options.apiService;
  }
  
  return options.localService;
}

/**
 * Create a service with explicit mode override
 */
export function createServiceWithMode<TLocal, TApi>(
  options: ServiceFactoryOptions<TLocal, TApi>,
  mode: 'local' | 'api'
): TLocal | TApi {
  if (mode === 'api') {
    return options.apiService;
  }
  
  return options.localService;
}
