/**
 * Export utility functions
 * CSV export and file download helpers
 */

/**
 * Escape CSV cell value
 */
export function escapeCSVCell(value: any): string {
  if (value == null) return "";
  const str = String(value);
  // If contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Convert data to CSV string
 */
export function toCSV<T extends Record<string, any>>(
  data: T[],
  columns?: { key: keyof T; label: string }[]
): string {
  if (!data || data.length === 0) return "";

  const headers = columns || (Object.keys(data[0]) as (keyof T)[]).map((key) => ({ key, label: String(key) }));
  const csvHeaders = headers.map((h) => escapeCSVCell(h.label)).join(",");

  const csvRows = data.map((row) =>
    headers.map((h) => escapeCSVCell(row[h.key])).join(",")
  );

  return [csvHeaders, ...csvRows].join("\n");
}

/**
 * Download text file
 */
export function downloadTextFile(content: string, filename: string, mimeType: string = "text/plain;charset=utf-8;"): void {
  const blob = new Blob([content], { type: mimeType });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  filename: string,
  columns?: { key: keyof T; label: string }[]
): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const csvContent = toCSV(data, columns);
  // Add UTF-8 BOM for Excel compatibility
  const bom = "\uFEFF";
  downloadTextFile(bom + csvContent, `${filename}.csv`, "text/csv;charset=utf-8;");
}

/**
 * Export to JSON
 */
export function exportToJSON<T>(data: T[], filename: string): void {
  if (!data || data.length === 0) {
    console.warn("No data to export");
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadTextFile(jsonContent, `${filename}.json`, "application/json;charset=utf-8;");
}

/**
 * Generate timestamped filename
 */
export function generateTimestampedFilename(prefix: string, extension: string = "csv"): string {
  const timestamp = new Date().toISOString().split("T")[0];
  return `${prefix}_${timestamp}.${extension}`;
}

/**
 * Copy to clipboard
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch (err) {
    console.error("Failed to copy to clipboard:", err);
    return false;
  }
}
