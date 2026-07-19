/**
 * Storage service
 * Centralized localStorage helpers with error handling
 */

/**
 * Check if localStorage is available
 */
export function storageAvailable(): boolean {
  try {
    const test = "__storage_test__";
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Read JSON from localStorage
 */
export function readJSON<T>(key: string, fallback: T): T {
  if (!storageAvailable()) return fallback;

  try {
    const raw = localStorage.getItem(key);
    if (raw == null) return fallback;
    const parsed = JSON.parse(raw);
    return parsed ?? fallback;
  } catch (error) {
    console.warn(`Failed to parse localStorage key "${key}":`, error);
    return fallback;
  }
}

/**
 * Write JSON to localStorage
 * Returns true if successful, false otherwise
 */
export function writeJSON(key: string, value: unknown): boolean {
  if (!storageAvailable()) return false;

  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn(`Failed to write localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Remove item from localStorage
 * Returns true if successful, false otherwise
 */
export function removeStorageItem(key: string): boolean {
  if (!storageAvailable()) return false;

  try {
    localStorage.removeItem(key);
    return true;
  } catch (error) {
    console.warn(`Failed to remove localStorage key "${key}":`, error);
    return false;
  }
}

/**
 * Clear all localStorage (use with caution)
 * Returns true if successful, false otherwise
 */
export function clearAllStorage(): boolean {
  if (!storageAvailable()) return false;

  try {
    localStorage.clear();
    return true;
  } catch (error) {
    console.warn("Failed to clear localStorage:", error);
    return false;
  }
}

/**
 * Get all keys from localStorage
 */
export function getAllStorageKeys(): string[] {
  if (!storageAvailable()) return [];

  try {
    return Object.keys(localStorage);
  } catch (error) {
    console.warn("Failed to get localStorage keys:", error);
    return [];
  }
}

/**
 * Get storage usage estimate
 */
export function getStorageUsage(): { used: number; available: number; percent: number } {
  if (!storageAvailable()) return { used: 0, available: 0, percent: 0 };

  try {
    let total = 0;
    for (const key of getAllStorageKeys()) {
      const value = localStorage.getItem(key);
      if (value) total += value.length;
    }
    // localStorage typically has ~5MB limit
    const available = 5 * 1024 * 1024; // 5MB in bytes
    return {
      used: total,
      available: available - total,
      percent: (total / available) * 100,
    };
  } catch (error) {
    console.warn("Failed to calculate storage usage:", error);
    return { used: 0, available: 0, percent: 0 };
  }
}

/**
 * Check if storage is nearly full
 */
export function isStorageNearlyFull(threshold: number = 90): boolean {
  const usage = getStorageUsage();
  return usage.percent >= threshold;
}
