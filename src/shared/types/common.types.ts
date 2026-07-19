/**
 * Common types
 * Generic types used across the application
 */

/**
 * ID type
 */
export type ID = string;

/**
 * ISO date string
 */
export type ISODateString = string;

/**
 * Status option
 */
export interface StatusOption {
  value: string;
  label: string;
  color?: string;
}

/**
 * Select option
 */
export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * Audit action
 */
export type AuditAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "export"
  | "login"
  | "logout"
  | "permission_change"
  | "settings_change";

/**
 * Feedback type
 */
export type FeedbackType = "success" | "error" | "info" | "warning";

/**
 * Pagination params
 */
export interface PaginationParams {
  page: number;
  pageSize: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

/**
 * API response wrapper
 */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
  error?: string;
}

/**
 * Sort option
 */
export interface SortOption {
  key: string;
  label: string;
  direction?: "asc" | "desc";
}

/**
 * Filter option
 */
export interface FilterOption {
  key: string;
  label: string;
  value?: any;
  operator?: "eq" | "neq" | "contains" | "startsWith" | "endsWith" | "gt" | "lt" | "gte" | "lte" | "in";
}

/**
 * Date range
 */
export interface DateRange {
  from: string | Date;
  to: string | Date;
}

/**
 * Address
 */
export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

/**
 * Contact info
 */
export interface ContactInfo {
  phone?: string;
  email?: string;
  secondaryPhone?: string;
  secondaryEmail?: string;
}

/**
 * Named entity
 */
export interface NamedEntity {
  id: ID;
  name: string;
}

/**
 * Timestamped entity
 */
export interface TimestampedEntity {
  createdAt: ISODateString;
  updatedAt: ISODateString;
  createdBy?: ID;
  updatedBy?: ID;
}

/**
 * Soft deletable entity
 */
export interface SoftDeletableEntity {
  deletedAt?: ISODateString;
  deletedBy?: ID;
  isDeleted?: boolean;
}

/**
 * Base entity
 */
export interface BaseEntity extends TimestampedEntity, SoftDeletableEntity {
  id: ID;
}
