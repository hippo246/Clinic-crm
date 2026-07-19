import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { sanitizeAuditMetadata } from '../utils/logSanitizer';
export type ConfirmationType = 'type_resource_id' | 'type_delete' | 'type_confirm';

export interface DestructiveActionMetadata {
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  role: string;
  confirmationType: ConfirmationType;
  confirmationMatched: boolean;
  reason?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
}

export interface DestructiveActionQuery {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Validates a typed confirmation against expected format.
 * Does not store the raw confirmation text.
 * 
 * @param confirmationType - The type of confirmation required
 * @param userConfirmation - The user's confirmation input
 * @param _resourceType - The resource type being acted upon (unused in current validation logic)
 * @param resourceId - The resource ID being acted upon
 * @returns True if confirmation matches expected format
 */
export function validateTypedConfirmation(
  confirmationType: ConfirmationType,
  userConfirmation: string,
  _resourceType: string,
  resourceId: string
): boolean {
  try {
    switch (confirmationType) {
      case 'type_resource_id':
        // User must type the exact resource ID
        return userConfirmation === resourceId;
      
      case 'type_delete':
        // User must type "DELETE" or "delete"
        return userConfirmation.toLowerCase() === 'delete';
      
      case 'type_confirm':
        // User must type "CONFIRM" or "confirm"
        return userConfirmation.toLowerCase() === 'confirm';
      
      default:
        return false;
    }
  } catch (error) {
    logger.error('Error validating typed confirmation:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    return false;
  }
}

/**
 * Logs a destructive action to the database.
 * Destructive actions include delete, archive, bulk operations, etc.
 * Does not store raw confirmation text - only type and match status.
 * Sanitizes metadata before writing to ensure no PHI/PII is stored.
 * Fails silently to avoid disrupting user actions.
 * 
 * @param metadata - The destructive action metadata to log
 */
export async function logDestructiveAction(metadata: DestructiveActionMetadata): Promise<void> {
  try {
    // Sanitize metadata before writing
    const sanitizedMetadata = metadata.metadata 
      ? sanitizeAuditMetadata(metadata.metadata) 
      : undefined;

    // Build safe metadata for storage - no raw confirmation text
    const safeMetadata: Record<string, unknown> = {};
    if (sanitizedMetadata) {
      // Only preserve safe fields
      if (sanitizedMetadata.resourceType !== undefined) safeMetadata.resourceType = sanitizedMetadata.resourceType;
      if (sanitizedMetadata.action !== undefined) safeMetadata.action = sanitizedMetadata.action;
      if (sanitizedMetadata.requestId !== undefined) safeMetadata.requestId = sanitizedMetadata.requestId;
      if (sanitizedMetadata.count !== undefined) safeMetadata.count = sanitizedMetadata.count;
    }

    // Write to database
    await prisma.destructiveActionLog.create({
      data: {
        action: metadata.action,
        resourceType: metadata.resourceType,
        resourceId: metadata.resourceId,
        actor: metadata.actorId,
        role: metadata.role,
        reason: metadata.reason,
        metadata: Object.keys(safeMetadata).length > 0 ? (safeMetadata as any) : undefined,
      },
    });
  } catch (error) {
    // Fail silently - destructive action logging must never crash user actions
    logger.warn('Failed to log destructive action to database, using console fallback', {
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      actorId: metadata.actorId,
      role: metadata.role,
      confirmationMatched: metadata.confirmationMatched,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Safe console fallback with minimal information
    console.info('[DESTRUCTIVE]', {
      action: metadata.action,
      resourceType: metadata.resourceType,
      resourceId: metadata.resourceId,
      actorId: metadata.actorId,
      role: metadata.role,
      confirmationMatched: metadata.confirmationMatched,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Retrieves destructive action logs with pagination and filtering.
 * 
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated destructive action logs
 */
export async function getDestructiveActionLogs(query: DestructiveActionQuery = {}) {
  try {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.resourceType) {
      where.resourceType = query.resourceType;
    }

    if (query.actorId) {
      where.actor = query.actorId;
    }

    if (query.dateFrom || query.dateTo) {
      where.createdAt = {};
      if (query.dateFrom) {
        where.createdAt = { ...where.createdAt as object, gte: new Date(query.dateFrom) };
      }
      if (query.dateTo) {
        where.createdAt = { ...where.createdAt as object, lte: new Date(query.dateTo) };
      }
    }

    const [actions, total] = await Promise.all([
      prisma.destructiveActionLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.destructiveActionLog.count({ where }),
    ]);

    return {
      actions,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve destructive action logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve destructive action logs');
  }
}

// Append-only behavior: No update/delete functions for destructive action logs
// Destructive action logs are immutable once written
// Future: Database-level constraints and hash-chain verification
// Future: Database-level constraints and hash-chain verification
