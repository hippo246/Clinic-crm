/**
 * API Types
 * Common TypeScript types for API client and adapters
 */

/**
 * HTTP methods
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * API request options
 */
export interface ApiRequestOptions {
  method?: HttpMethod;
  headers?: Record<string, string>;
  body?: unknown;
  timeout?: number;
  signal?: AbortSignal;
  isMultipart?: boolean;
  isFileDownload?: boolean;
}

/**
 * API response envelope
 */
export interface ApiResponse<T = unknown> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  requestId?: string;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
  details?: Record<string, unknown>;
  requestId?: string;
}

/**
 * Validation error details
 */
export interface ValidationError {
  field: string;
  message: string;
}

/**
 * API error
 */
export class ApiError extends Error {
  status: number;
  code: string;
  details?: Record<string, unknown>;
  requestId?: string;
  validationErrors?: ValidationError[];

  constructor(
    message: string,
    status: number,
    code: string,
    details?: Record<string, unknown>,
    requestId?: string,
    validationErrors?: ValidationError[]
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    this.validationErrors = validationErrors;
  }
}

/**
 * Network error (offline, timeout, etc.)
 */
export class NetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NetworkError';
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}
