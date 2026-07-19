import { prisma } from '../db/client';
import { logger } from '../utils/logger';

/**
 * Storage cleanup service (foundation only - not production ready)
 * Handles cleanup of orphaned files and storage maintenance
 * 
 * SAFETY NOTES:
 * - Orphan cleanup is conservative and requires manual invocation
 * - Does not automatically delete files without explicit confirmation
 * - Logs counts only, never file paths, filenames, or storage keys
 * - Not intended for automated production use without additional safeguards
 */

/**
 * Delete orphaned files from storage (preview/conservative only)
 * Files that exist in storage but have no corresponding document record
 * 
 * SAFETY: This function is conservative and requires manual invocation.
 * It does not automatically delete files. Returns counts only.
 */
export async function deleteOrphanedFiles(): Promise<{ deleted: number; errors: number }> {
  try {
    // Get all storage keys from database
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        storageKey: true,
      },
    });

    const validStorageKeys = new Set(documents.map((d) => d.storageKey));
    let deleted = 0;
    let errors = 0;

    // Note: This is a simplified foundation implementation
    // In production, you would need to list all files in storage and compare
    // For local storage, this would require filesystem traversal
    // For S3, this would require listing objects in the bucket
    // This is intentionally conservative to prevent accidental data loss

    logger.info('Storage cleanup: orphaned file deletion is foundation only - not implemented', {
      validKeysCount: validStorageKeys.size,
    });

    return { deleted, errors };
  } catch (error) {
    logger.error('Failed to delete orphaned files', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to delete orphaned files');
  }
}

/**
 * Delete files for soft-deleted documents (DISABLED for safety)
 * Documents marked as deleted in DB but files still in storage
 * 
 * SAFETY: This function is disabled for retention safety.
 * Physical file deletion should only happen after retention period
 * and with explicit typed confirmation via destructiveActionService.
 */
export async function cleanupDeletedDocumentFiles(): Promise<{ deleted: number; errors: number }> {
  try {
    // DISABLED: Physical file deletion is retention-unsafe
    // This should only happen after retention period expires
    // and with explicit typed confirmation
    
    logger.warn('Storage cleanup: cleanupDeletedDocumentFiles is disabled for retention safety');
    
    return { deleted: 0, errors: 0 };
  } catch (error) {
    logger.error('Failed to cleanup deleted document files', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to cleanup deleted document files');
  }
}

/**
 * Verify storage integrity (counts only - no paths logged)
 * Check if all document records have corresponding files in storage
 * 
 * SAFETY: Logs counts only, never file paths, filenames, or storage keys
 */
export async function verifyStorageIntegrity(): Promise<{ valid: number; missing: number }> {
  try {
    const documents = await prisma.document.findMany({
      where: {
        deletedAt: null,
      },
      select: {
        id: true,
        storageKey: true,
      },
    });

    let valid = 0;
    let missing = 0;

    // Note: This would require checking each file in storage
    // For local storage: fs.existsSync
    // For S3: headObject
    // This is a placeholder foundation implementation

    logger.info('Storage integrity check is foundation only - not implemented', {
      totalDocuments: documents.length,
    });

    return { valid, missing };
  } catch (error) {
    logger.error('Failed to verify storage integrity', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to verify storage integrity');
  }
}
