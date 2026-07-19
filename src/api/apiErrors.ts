/**
 * API Error Handling
 * Normalizes backend errors into user-safe messages
 */

import { ApiError, NetworkError, TimeoutError, ValidationError } from './apiTypes';

/**
 * Normalize HTTP status codes to user-safe messages
 */
export function getStatusMessage(status: number): string {
  switch (status) {
    case 400:
      return 'Invalid request. Please check your input and try again.';
    case 401:
      return 'Authentication required. Please log in again.';
    case 403:
      return 'You do not have permission to perform this action.';
    case 404:
      return 'The requested resource was not found.';
    case 422:
      return 'Validation failed. Please check your input.';
    case 429:
      return 'Too many requests. Please wait and try again.';
    case 500:
      return 'Server error. Please try again later.';
    case 502:
    case 503:
    case 504:
      return 'Service unavailable. Please try again later.';
    default:
      return 'An unexpected error occurred. Please try again.';
  }
}

/**
 * Create an ApiError from a fetch response
 */
export async function createApiErrorFromResponse(
  response: Response,
  requestId?: string
): Promise<ApiError> {
  const status = response.status;
  const statusText = response.statusText;
  
  try {
    const body = await response.json() as ApiErrorResponse;
    return new ApiError(
      body.message || getStatusMessage(status),
      status,
      body.error || 'UNKNOWN_ERROR',
      body.details,
      requestId || body.requestId,
      body.details?.validationErrors as ValidationError[] | undefined
    );
  } catch {
    // If response is not JSON, use status-based message
    return new ApiError(
      getStatusMessage(status),
      status,
      statusText || 'UNKNOWN_ERROR',
      undefined,
      requestId
    );
  }
}

/**
 * Check if an error is a network error
 */
export function isNetworkError(error: unknown): error is NetworkError {
  return error instanceof NetworkError;
}

/**
 * Check if an error is a timeout error
 */
export function isTimeoutError(error: unknown): error is TimeoutError {
  return error instanceof TimeoutError;
}

/**
 * Check if an error is an auth error (401)
 */
export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 401;
}

/**
 * Check if an error is a permission error (403)
 */
export function isPermissionError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 403;
}

/**
 * Check if an error is a validation error (422)
 */
export function isValidationError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 422;
}

/**
 * Check if an error is a not found error (404)
 */
export function isNotFoundError(error: unknown): boolean {
  return error instanceof ApiError && error.status === 404;
}

/**
 * Get user-safe error message
 */
export function getUserSafeErrorMessage(error: unknown): string {
  if (isNetworkError(error)) {
    return 'Network error. Please check your connection and try again.';
  }
  if (isTimeoutError(error)) {
    return 'Request timed out. Please try again.';
  }
  if (error instanceof ApiError) {
    return error.message;
  }
  if (error instanceof Error) {
    return 'An unexpected error occurred. Please try again.';
  }
  return 'An unknown error occurred.';
}
