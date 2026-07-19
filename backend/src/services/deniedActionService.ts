import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { sanitizeAuditMetadata } from '../utils/logSanitizer';
export interface DeniedActionMetadata {
  actorId: string;
  actorRoles: string[];
  action: string;
  resourceType?: string;
  resourceId?: string;
  reason?: string;
  method?: string;
  path?: string;
  requestId?: string;
  metadata?: Record<string, unknown>;
}

export interface DeniedActionQuery {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Logs a denied action to the database.
 * Denied actions occur when RBAC middleware blocks access due to missing permissions/roles.
 * Sanitizes metadata before writing to ensure no PHI/PII is stored.
 * Fails silently to avoid disrupting user actions.
 * 
 * @param metadata - The denied action metadata to log
 */
export async function logDeniedAction(metadata: DeniedActionMetadata): Promise<void> {
  try {
    // Sanitize metadata before writing
    const sanitizedMetadata = metadata.metadata 
      ? sanitizeAuditMetadata(metadata.metadata) 
      : undefined;

    // Build safe metadata for storage
    const safeMetadata: Record<string, unknown> = {};
    if (sanitizedMetadata) {
      // Only preserve safe fields
      if (sanitizedMetadata.resourceType !== undefined) safeMetadata.resourceType = sanitizedMetadata.resourceType;
      if (sanitizedMetadata.action !== undefined) safeMetadata.action = sanitizedMetadata.action;
      if (sanitizedMetadata.method !== undefined) safeMetadata.method = sanitizedMetadata.method;
      if (sanitizedMetadata.path !== undefined) safeMetadata.path = sanitizedMetadata.path;
      if (sanitizedMetadata.requestId !== undefined) safeMetadata.requestId = sanitizedMetadata.requestId;
    }

    // Write to database
    await prisma.deniedAction.create({
      data: {
        action: metadata.action,
        resourceType: metadata.resourceType,
        resourceId: metadata.resourceId,
        actor: metadata.actorId,
        role: metadata.actorRoles.join(','),
        reason: metadata.reason,
        metadata: Object.keys(safeMetadata).length > 0 ? (safeMetadata as any) : undefined,
      },
    });
  } catch (error) {
    // Fail silently - denied action logging must never crash user actions
    logger.warn('Failed to log denied action to database, using console fallback', {
      action: metadata.action,
      resourceType: metadata.resourceType,
      actorId: metadata.actorId,
      actorRoles: metadata.actorRoles,
      reason: metadata.reason,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Safe console fallback with minimal information
    console.info('[DENIED]', {
      action: metadata.action,
      resourceType: metadata.resourceType,
      actorId: metadata.actorId,
      actorRoles: metadata.actorRoles.join(','),
      reason: metadata.reason,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Retrieves denied actions with pagination and filtering.
 * 
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated denied actions
 */
export async function getDeniedActions(query: DeniedActionQuery = {}) {
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
      prisma.deniedAction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.deniedAction.count({ where }),
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
    logger.error('Failed to retrieve denied actions:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve denied actions');
  }
}

/**
 * Exports denied actions for a given query.
 * Returns sanitized rows for external processing.
 * 
 * @param query - Query parameters for filtering
 * @returns Sanitized denied action rows
 */
export async function exportDeniedActions(query: DeniedActionQuery = {}) {
  try {
    // Use a higher limit for exports
    const exportQuery = { ...query, limit: 1000 };
    const result = await getDeniedActions(exportQuery);
    
    // Return only the actions (not pagination info)
    return result.actions;
  } catch (error) {
    logger.error('Failed to export denied actions:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to export denied actions');
  }
}

// Append-only behavior: No update/delete functions for denied actions
// Denied actions are immutable once written
// Future: Database-level constraints and hash-chain verification
// Future: Database-level constraints and hash-chain verification
