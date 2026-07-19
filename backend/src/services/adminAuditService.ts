import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { sanitizeAuditMetadata } from '../utils/logSanitizer';

export interface AdminOperationMetadata {
  action: string;
  module: string;
  resourceType?: string;
  resourceId?: string;
  actor: string;
  role: string;
  metadata?: Record<string, unknown>;
}

export interface AdminAuditQuery {
  page?: number;
  limit?: number;
  action?: string;
  module?: string;
  actor?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Logs an admin operation to the database.
 * Admin operations include settings changes, exports, imports, backups, etc.
 * Sanitizes all metadata to ensure no PHI/PII is stored.
 * Fails silently to avoid disrupting admin actions.
 * 
 * @param operation - The admin operation to log
 */
export async function logAdminOperation(operation: AdminOperationMetadata): Promise<void> {
  try {
    // Sanitize metadata before writing
    const sanitizedMetadata = operation.metadata 
      ? sanitizeAuditMetadata(operation.metadata) 
      : undefined;

    // Build safe metadata - only count/type/status/source
    const safeMetadata: Record<string, unknown> = {};
    if (sanitizedMetadata) {
      // Only preserve safe fields
      if (sanitizedMetadata.count !== undefined) safeMetadata.count = sanitizedMetadata.count;
      if (sanitizedMetadata.type !== undefined) safeMetadata.type = sanitizedMetadata.type;
      if (sanitizedMetadata.status !== undefined) safeMetadata.status = sanitizedMetadata.status;
      if (sanitizedMetadata.source !== undefined) safeMetadata.source = sanitizedMetadata.source;
      if (sanitizedMetadata.resourceType !== undefined) safeMetadata.resourceType = sanitizedMetadata.resourceType;
    }

    // Write to database
    await prisma.adminAuditLog.create({
      data: {
        action: operation.action,
        module: operation.module,
        resourceType: operation.resourceType,
        resourceId: operation.resourceId,
        actor: operation.actor,
        role: operation.role,
        metadata: Object.keys(safeMetadata).length > 0 ? (safeMetadata as any) : undefined,
      },
    });
  } catch (error) {
    // Fail silently - admin audit logging must never crash admin actions
    logger.warn('Failed to log admin operation to database, using console fallback', {
      action: operation.action,
      module: operation.module,
      actor: operation.actor,
      role: operation.role,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Safe console fallback with minimal information
    console.info('[ADMIN_AUDIT]', {
      action: operation.action,
      module: operation.module,
      actor: operation.actor,
      role: operation.role,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Retrieves admin audit logs with pagination and filtering.
 * 
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated admin audit logs
 */
export async function getAdminAuditLogs(query: AdminAuditQuery = {}) {
  try {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(200, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.action) {
      where.action = query.action;
    }

    if (query.module) {
      where.module = query.module;
    }

    if (query.actor) {
      where.actor = query.actor;
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

    const [logs, total] = await Promise.all([
      prisma.adminAuditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.adminAuditLog.count({ where }),
    ]);

    return {
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve admin audit logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve admin audit logs');
  }
}

/**
 * Exports admin audit logs for a given query.
 * Returns sanitized rows for external processing.
 * 
 * @param query - Query parameters for filtering
 * @returns Sanitized admin audit log rows
 */
export async function exportAdminAuditLogs(query: AdminAuditQuery = {}) {
  try {
    // Use a higher limit for exports
    const exportQuery = { ...query, limit: 1000 };
    const result = await getAdminAuditLogs(exportQuery);
    
    // Return only the logs (not pagination info)
    return result.logs;
  } catch (error) {
    logger.error('Failed to export admin audit logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to export admin audit logs');
  }
}

// Append-only behavior: No update/delete functions for admin audit logs
// Admin audit logs are immutable once written
// Future: Database-level constraints and hash-chain verification
