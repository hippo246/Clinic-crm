/**
 * Auth Token Management
 * Handles authentication token storage and retrieval
 */

const TOKEN_KEY = 'auth_token';

/**
 * Get the current auth token
 * Returns null if no token is stored
 */
export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Set the auth token
 */
export function setAuthToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (error) {
    console.error('Failed to store auth token:', error);
  }
}

/**
 * Clear the auth token
 */
export function clearAuthToken(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (error) {
    console.error('Failed to clear auth token:', error);
  }
}

/**
 * Check if an auth token exists
 */
export function hasAuthToken(): boolean {
  return getAuthToken() !== null;
}
