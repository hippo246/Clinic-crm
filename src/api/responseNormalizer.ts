/**
 * Response Normalizer
 * Normalizes backend responses into consistent frontend shapes
 */

import { ApiResponse, PaginatedResponse } from './apiTypes';

/**
 * Normalize a paginated response
 */
export function normalizePaginatedResponse<T>(
  response: ApiResponse<{ data: T[]; total: number; page: number; limit: number }>
): PaginatedResponse<T> {
  const { data, total, page, limit } = response.data;
  return {
    data,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Normalize a simple list response (no pagination)
 */
export function normalizeListResponse<T>(response: ApiResponse<T[]>): T[] {
  return response.data;
}

/**
 * Normalize a single item response
 */
export function normalizeItemResponse<T>(response: ApiResponse<T>): T {
  return response.data;
}

/**
 * Extract validation errors from an API error
 */
export function extractValidationErrors(error: unknown): Record<string, string> {
  if (error && typeof error === 'object' && 'validationErrors' in error) {
    const validationErrors = (error as { validationErrors?: Array<{ field: string; message: string }> }).validationErrors;
    if (Array.isArray(validationErrors)) {
      return validationErrors.reduce((acc, err) => {
        acc[err.field] = err.message;
        return acc;
      }, {} as Record<string, string>);
    }
  }
  return {};
}

/**
 * Check if response is empty
 */
export function isEmptyResponse<T>(response: ApiResponse<T>): boolean {
  if (Array.isArray(response.data)) {
    return response.data.length === 0;
  }
  if (response.data === null || response.data === undefined) {
    return true;
  }
  return false;
}

/**
 * Extract request ID from response
 */
export function getRequestId<T>(response: ApiResponse<T>): string | undefined {
  return response.requestId;
}
