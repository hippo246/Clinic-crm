import { v4 as uuidv4 } from 'uuid';
import { getStorageAdapter } from './storageFactory';
import { logger } from '../utils/logger';

/**
 * Generate a safe storage key that doesn't include original filename
 * Uses UUID to ensure uniqueness and prevent path traversal
 */
export function generateStorageKey(): string {
  const uuid = uuidv4();
  // Use a simple path structure: documents/year/month/uuid
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  return `documents/${year}/${month}/${uuid}`;
}

/**
 * Store a file using the storage abstraction
 */
export async function storeFile(
  buffer: Buffer,
  contentType: string
): Promise<{ key: string; size: number }> {
  try {
    const key = generateStorageKey();
    const adapter = getStorageAdapter();
    
    const result = await adapter.putObject(key, buffer, contentType);
    
    return {
      key: result.key,
      size: result.size,
    };
  } catch (error) {
    logger.error('Failed to store file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to store file');
  }
}

/**
 * Retrieve a file using the storage abstraction
 */
export async function retrieveFile(key: string) {
  try {
    const adapter = getStorageAdapter();
    return await adapter.getObject(key);
  } catch (error) {
    logger.error('Failed to retrieve file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to retrieve file');
  }
}

/**
 * Delete a file using the storage abstraction
 */
export async function deleteFile(key: string): Promise<void> {
  try {
    const adapter = getStorageAdapter();
    await adapter.deleteObject(key);
  } catch (error) {
    logger.error('Failed to delete file', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete file');
  }
}

/**
 * Check if a file exists using the storage abstraction
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const adapter = getStorageAdapter();
    return await adapter.objectExists(key);
  } catch (error) {
    logger.error('Failed to check file existence', { error: error instanceof Error ? error.message : 'Unknown error' });
    return false;
  }
}

/**
 * Generate a signed URL for file access
 */
export async function generateSignedUrl(key: string, expiresIn: number = 300): Promise<{ url: string; expiresAt: Date }> {
  try {
    const adapter = getStorageAdapter();
    return await adapter.getSignedReadUrl(key, expiresIn);
  } catch (error) {
    logger.error('Failed to generate signed URL', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to generate signed URL');
  }
}
