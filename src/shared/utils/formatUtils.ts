/**
 * Formatting utility functions
 * Dependency-free formatting helpers
 */

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return "??";
  return name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

/**
 * Get avatar color based on name
 */
export function getAvatarColor(name: string): string {
  if (!name) return "#64748b";
  const colors = [
    "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#22c55e",
    "#10b981", "#14b8a6", "#06b6d4", "#0ea5e9", "#3b82f6",
    "#6366f1", "#8b5cf6", "#a855f7", "#d946ef", "#ec4899",
    "#f43f5e",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/**
 * Format phone number
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "N/A";
  // Remove all non-digit characters
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone;
}

/**
 * Format currency
 */
export function formatCurrency(amount: number | null | undefined, currency: string = "INR"): string {
  if (amount == null) return "N/A";
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `₹${amount.toLocaleString("en-IN")}`;
  }
}

/**
 * Format percentage
 */
export function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value == null) return "N/A";
  return `${value.toFixed(decimals)}%`;
}

/**
 * Safe text - truncate and escape
 */
export function safeText(text: string | null | undefined, maxLength: number = 100): string {
  if (text == null) return "";
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
  if (escaped.length <= maxLength) return escaped;
  return escaped.slice(0, maxLength) + "...";
}

/**
 * Capitalize first letter
 */
export function capitalize(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

/**
 * Title case
 */
export function titleCase(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .toLowerCase()
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Truncate text
 */
export function truncate(text: string | null | undefined, maxLength: number = 50): string {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Format file size
 */
export function formatFileSize(bytes: number | null | undefined): string {
  if (bytes == null) return "N/A";
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Pluralize word
 */
export function pluralize(count: number, singular: string, plural?: string): string {
  if (count === 1) return `${count} ${singular}`;
  return `${count} ${plural || singular + "s"}`;
}

/**
 * Format name (title case)
 */
export function formatName(name: string | null | undefined): string {
  if (!name) return "";
  return titleCase(name);
}

/**
 * Format address from address object
 */
export function formatAddress(address: Record<string, unknown> | null | undefined): string {
  if (!address) return "";
  const parts: string[] = [];
  
  if (address.street) parts.push(String(address.street));
  if (address.city) parts.push(String(address.city));
  if (address.state) parts.push(String(address.state));
  if (address.zip) parts.push(String(address.zip));
  if (address.country) parts.push(String(address.country));
  
  return parts.join(", ");
}

/**
 * Format date for HTML date input (YYYY-MM-DD)
 */
export function formatDateForInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  
  return `${year}-${month}-${day}`;
}

/**
 * Format datetime for HTML datetime-local input (YYYY-MM-DDTHH:mm)
 */
export function formatDateTimeForInput(date: string | Date | null | undefined): string {
  if (!date) return "";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "";
  
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}
