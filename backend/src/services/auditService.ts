import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { sanitizeAuditMetadata } from '../utils/logSanitizer';
export interface AuditEventMetadata {
  actorId?: string;
  actorRole?: string;
  actorRoles?: string[];
  action: string;
  resourceType: string;
  resourceId: string;
  patientId?: string;
  status?: string;
  metadata?: Record<string, unknown>;
  requestId?: string;
  ipHash?: string;
  userAgent?: string;
}

export interface AuditLogQuery {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  actorId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Logs an audit event to the database.
 * Sanitizes metadata before writing to ensure no PHI/PII is stored.
 * Fails silently to avoid disrupting user actions.
 * 
 * @param event - The audit event to log
 */
export async function logAuditEvent(event: AuditEventMetadata): Promise<void> {
  try {
    // Sanitize metadata before writing
    const sanitizedMetadata = event.metadata 
      ? sanitizeAuditMetadata(event.metadata) 
      : undefined;

    // Build safe metadata for storage
    const safeMetadata: Record<string, unknown> = {
      ...sanitizedMetadata,
      // Only include safe fields
      ...(event.patientId && { patientId: event.patientId }),
      ...(event.requestId && { requestId: event.requestId }),
      ...(event.ipHash && { ipHash: event.ipHash }),
    };

    // Write to database
    await prisma.auditLog.create({
      data: {
        action: event.action,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        actorId: event.actorId,
        actorRole: event.actorRole || event.actorRoles?.join(','),
        metadata: Object.keys(safeMetadata).length > 0 ? (safeMetadata as any) : undefined,
      },
    });
  } catch (error) {
    // Fail silently - audit logging must never crash user actions
    logger.warn('Failed to log audit event to database, using console fallback', {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      actorId: event.actorId,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Safe console fallback with minimal information
    console.info('[AUDIT]', {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      actorId: event.actorId,
      actorRole: event.actorRole || event.actorRoles?.join(','),
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Retrieves audit logs with pagination and filtering.
 * 
 * @param query - Query parameters for filtering and pagination
 * @returns Paginated audit logs
 */
export async function getAuditLogs(query: AuditLogQuery = {}) {
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
      where.actorId = query.actorId;
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
      prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count({ where }),
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
    logger.error('Failed to retrieve audit logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve audit logs');
  }
}

/**
 * Retrieves a single audit log by ID.
 * 
 * @param id - The audit log ID
 * @returns The audit log or null if not found
 */
export async function getAuditLogById(id: string) {
  try {
    const log = await prisma.auditLog.findUnique({
      where: { id },
    });

    return log;
  } catch (error) {
    logger.error('Failed to retrieve audit log:', { 
      id,
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve audit log');
  }
}

/**
 * Builds audit metadata from request context.
 * 
 * @param baseMetadata - Base metadata to include
 * @returns Sanitized audit metadata
 */
export function buildAuditMetadata(baseMetadata: Record<string, unknown> = {}): Record<string, unknown> {
  return sanitizeAuditMetadata(baseMetadata);
}

/**
 * Exports audit logs for a given query.
 * Returns sanitized rows for external processing.
 * 
 * @param query - Query parameters for filtering
 * @returns Sanitized audit log rows
 */
export async function exportAuditLogs(query: AuditLogQuery = {}) {
  try {
    // Use a higher limit for exports
    const exportQuery = { ...query, limit: 1000 };
    const result = await getAuditLogs(exportQuery);
    
    // Return only the logs (not pagination info)
    return result.logs;
  } catch (error) {
    logger.error('Failed to export audit logs:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to export audit logs');
  }
}

// Append-only behavior: No update/delete functions for audit logs
// Audit logs are immutable once written
// Future: Database-level constraints and hash-chain verification
