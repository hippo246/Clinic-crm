/**
 * Date utility functions
 * Extracted from src/ui/utils.ts for shared use
 */

/**
 * Format date to readable string
 */
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "Invalid";
  return date.toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

/**
 * Format date to short string (DD/MM/YYYY)
 */
export function fmtDateShort(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "Invalid";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

/**
 * Calculate age from date of birth
 */
export function calcAge(dob: Date | string): number {
  const birth = typeof dob === "string" ? new Date(dob) : dob;
  if (isNaN(birth.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Format relative time (e.g., "5m ago", "2h ago")
 */
export function fmtRelative(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/**
 * Format date with time
 */
export function fmtDateTime(d: Date | string | null | undefined): string {
  if (!d) return "N/A";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "Invalid";
  return date.toLocaleString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Check if date is in the past
 */
export function isPast(d: Date | string): boolean {
  const date = typeof d === "string" ? new Date(d) : d;
  return date < new Date();
}

/**
 * Check if date is in the future
 */
export function isFuture(d: Date | string): boolean {
  const date = typeof d === "string" ? new Date(d) : d;
  return date > new Date();
}

/**
 * Get days between two dates
 */
export function daysBetween(start: Date | string, end: Date | string): number {
  const startDate = typeof start === "string" ? new Date(start) : start;
  const endDate = typeof end === "string" ? new Date(end) : end;
  const diffTime = endDate.getTime() - startDate.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}
