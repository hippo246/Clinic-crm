/**
 * Safe reusable validators
 * All validators are safe and never throw
 */

/**
 * Check if value is non-empty (string, array, or object with keys)
 */
export function isNonEmpty(value: unknown): boolean {
  if (value == null) return false;
  if (typeof value === "string") return value.trim().length > 0;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === "object") return Object.keys(value as Record<string, unknown>).length > 0;
  return false;
}

/**
 * Validate email format
 */
export function validateEmail(email: unknown): boolean {
  if (email == null || typeof email !== "string") return false;
  const trimmed = email.trim();
  if (trimmed.length === 0) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(trimmed);
}

/**
 * Validate phone number (basic check for digits)
 */
export function validatePhone(phone: unknown): boolean {
  if (phone == null || typeof phone !== "string") return false;
  const cleaned = phone.replace(/\D/g, "");
  return cleaned.length >= 10 && cleaned.length <= 15;
}

/**
 * Validate date string (YYYY-MM-DD or ISO format)
 */
export function validateDate(value: unknown): boolean {
  if (value == null || typeof value !== "string") return false;
  const trimmed = value.trim();
  if (trimmed.length === 0) return false;
  const date = new Date(trimmed);
  return !isNaN(date.getTime());
}

/**
 * Validate that date is in the future
 */
export function validateFutureDate(value: unknown): boolean {
  if (!validateDate(value)) return false;
  const date = new Date(value as string);
  return date > new Date();
}

/**
 * Validate that date is in the past or today
 */
export function validatePastOrTodayDate(value: unknown): boolean {
  if (!validateDate(value)) return false;
  const date = new Date(value as string);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date <= today;
}

/**
 * Validate age from DOB
 */
export function validateAgeFromDob(dob: unknown): { valid: boolean; age: number | null; warning?: string } {
  if (!validateDate(dob)) {
    return { valid: false, age: null };
  }
  
  const birthDate = new Date(dob as string);
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  if (age < 0) {
    return { valid: false, age: null, warning: "Date of birth cannot be in the future" };
  }
  
  if (age > 150) {
    return { valid: false, age: null, warning: "Invalid date of birth" };
  }
  
  return { valid: true, age };
}

/**
 * Validate blood group
 */
export function validateBloodGroup(bloodGroup: unknown): boolean {
  if (bloodGroup == null || typeof bloodGroup !== "string") return false;
  const validGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];
  return validGroups.includes(bloodGroup.toUpperCase());
}

/**
 * Validate required field
 */
export function validateRequired(value: unknown, label: string): string | null {
  if (!isNonEmpty(value)) {
    return `${label} is required`;
  }
  return null;
}

/**
 * Validate max length
 */
export function validateMaxLength(value: unknown, max: number, label: string): string | null {
  if (value == null) return null;
  if (typeof value !== "string") return null;
  if (value.length > max) {
    return `${label} must be at most ${max} characters`;
  }
  return null;
}

/**
 * Validate number range
 */
export function validateNumberRange(value: unknown, min: number, max: number, label: string): string | null {
  if (value == null) return null;
  const num = Number(value);
  if (isNaN(num)) return `${label} must be a number`;
  if (num < min || num > max) {
    return `${label} must be between ${min} and ${max}`;
  }
  return null;
}

/**
 * Safely convert value to string
 */
export function safeString(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return String(value);
  return "";
}
