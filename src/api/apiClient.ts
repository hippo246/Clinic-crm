/**
 * API Client
 * Typed HTTP client for backend API communication
 */

import { apiConfig } from '../config/apiConfig';
import { getAuthToken } from './authToken';
import {
  HttpMethod,
  ApiRequestOptions,
  ApiResponse,
  ApiError,
  NetworkError,
  TimeoutError,
} from './apiTypes';
import {
  createApiErrorFromResponse,
  isNetworkError,
  isTimeoutError,
  isAuthError,
} from './apiErrors';

/**
 * Create an AbortController with timeout
 */
function createTimeoutController(timeoutMs: number): AbortController {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller;
}

/**
 * Build request headers
 */
function buildHeaders(
  customHeaders?: Record<string, string>,
  isMultipart?: boolean
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': isMultipart ? 'multipart/form-data' : 'application/json',
    ...customHeaders,
  };

  // Remove Content-Type for multipart (browser sets it with boundary)
  if (isMultipart) {
    delete headers['Content-Type'];
  }

  // Add auth token if available
  const token = getAuthToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

/**
 * Sanitize request body for logging (remove PHI)
 */
function sanitizeRequestBody(body: unknown): string {
  if (!body) return '';
  try {
    const str = JSON.stringify(body);
    // Remove potential PHI fields from logs
    return str.replace(/"(firstName|lastName|phone|email|address|diagnosis|notes|content)":\s*"[^"]*"/g, '"$1":"[REDACTED]"');
  } catch {
    return '[Unable to serialize body]';
  }
}

/**
 * Sanitize response body for logging (remove PHI)
 */
function sanitizeResponseBody(body: unknown): string {
  if (!body) return '';
  try {
    const str = JSON.stringify(body);
    // Remove potential PHI fields from logs
    return str.replace(/"(firstName|lastName|phone|email|address|diagnosis|notes|content)":\s*"[^"]*"/g, '"$1":"[REDACTED]"');
  } catch {
    return '[Unable to serialize body]';
  }
}

/**
 * Make an HTTP request
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const {
    method = 'GET',
    headers: customHeaders,
    body,
    timeout = apiConfig.apiTimeout,
    signal: customSignal,
    isMultipart = false,
    isFileDownload = false,
  } = options;

  const url = `${apiConfig.apiBaseUrl}${endpoint}`;

  // Create timeout controller
  const timeoutController = createTimeoutController(timeout);
  const signal = customSignal || timeoutController.signal;

  // Build headers
  const headers = buildHeaders(customHeaders, isMultipart);

  // Build request body
  const requestBody = isMultipart ? body as FormData : JSON.stringify(body);

  // Debug logging
  if (apiConfig.debugEnabled) {
    console.log(`[API Request] ${method} ${url}`);
    console.log(`[API Request] Headers:`, JSON.stringify({ ...headers, Authorization: headers.Authorization ? '[REDACTED]' : undefined }));
    if (body && !isFileDownload) {
      console.log(`[API Request] Body:`, sanitizeRequestBody(body));
    }
  }

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: requestBody,
      signal,
    });

    // Extract request ID from headers if present
    const requestId = response.headers.get('x-request-id') || undefined;

    // Handle file download
    if (isFileDownload) {
      if (!response.ok) {
        throw await createApiErrorFromResponse(response, requestId);
      }

      const blob = await response.blob();
      return {
        data: blob as T,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
        requestId,
      };
    }

    // Handle JSON response
    const responseData = await response.json();

    // Debug logging
    if (apiConfig.debugEnabled) {
      console.log(`[API Response] ${response.status} ${response.statusText}`);
      console.log(`[API Response] Body:`, sanitizeResponseBody(responseData));
    }

    if (!response.ok) {
      throw await createApiErrorFromResponse(response, requestId);
    }

    return {
      data: responseData as T,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      requestId,
    };
  } catch (error) {
    // Handle timeout
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(`Request timed out after ${timeout}ms`);
    }

    // Handle network errors
    if (error instanceof TypeError) {
      throw new NetworkError('Network error: Failed to connect to server');
    }

    // Re-throw API errors
    if (error instanceof ApiError) {
      throw error;
    }

    // Handle auth errors
    if (isAuthError(error)) {
      // Clear invalid token
      // Note: This is a simple approach - in production, you might want to trigger a re-auth flow
      console.warn('Auth error detected, token may be invalid');
    }

    // Unknown error
    throw error;
  } finally {
    // Cleanup timeout controller
    timeoutController.abort();
  }
}

/**
 * Convenience methods for common HTTP operations
 */
export const apiClient = {
  get: <T = unknown>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'GET' }),

  post: <T = unknown>(endpoint: string, body: unknown, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T = unknown>(endpoint: string, body: unknown, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T = unknown>(endpoint: string, body: unknown, options?: Omit<ApiRequestOptions, 'method'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T = unknown>(endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'DELETE' }),

  upload: <T = unknown>(endpoint: string, formData: FormData, options?: Omit<ApiRequestOptions, 'method' | 'isMultipart'>) =>
    apiRequest<T>(endpoint, { ...options, method: 'POST', body: formData, isMultipart: true }),

  download: (endpoint: string, options?: Omit<ApiRequestOptions, 'method' | 'body' | 'isFileDownload'>) =>
    apiRequest<Blob>(endpoint, { ...options, method: 'GET', isFileDownload: true }),
};
