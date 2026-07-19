import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { sanitizeAuditMetadata } from '../utils/logSanitizer';
export type SecurityEventType = 
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'token_refresh'
  | 'token_invalid'
  | 'permission_denied'
  | 'role_denied'
  | 'auth_missing'
  | 'auth_invalid'
  | 'suspicious_activity'
  | 'rate_limit_exceeded';

export interface SecurityEventMetadata {
  userId?: string;
  role?: string;
  permission?: string;
  resource?: string;
  action?: string;
  method?: string;
  path?: string;
  ipHash?: string;
  userAgent?: string;
  requestId?: string;
}

export interface SecurityEventQuery {
  page?: number;
  limit?: number;
  eventType?: string;
  severity?: string;
  userId?: string;
  dateFrom?: string;
  dateTo?: string;
}

/**
 * Logs a security event to the database.
 * Sanitizes metadata before writing to ensure no PHI/PII is stored.
 * Fails silently to avoid disrupting user actions.
 * 
 * @param eventType - The type of security event
 * @param metadata - Additional metadata about the event
 */
export async function logSecurityEvent(
  eventType: SecurityEventType,
  metadata: SecurityEventMetadata = {}
): Promise<void> {
  try {
    // Sanitize metadata before writing
    const sanitizedMetadata = sanitizeAuditMetadata(metadata);

    // Try to log to database
    await prisma.securityEvent.create({
      data: {
        eventType,
        severity: getSeverityForEvent(eventType),
        description: getDescriptionForEvent(eventType),
        metadata: Object.keys(sanitizedMetadata).length > 0 ? (sanitizedMetadata as any) : undefined,
      },
    });
  } catch (error) {
    // If database is unavailable, fall back to console logging
    logger.warn('Failed to log security event to database, using console fallback', {
      eventType,
      metadata: sanitizeAuditMetadata(metadata),
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    
    // Safe console fallback with minimal information
    console.info('[SECURITY]', {
      eventType,
      severity: getSeverityForEvent(eventType),
      userId: metadata.userId,
      role: metadata.role,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * Retrieves security events with pagination and filtering.
 * 
 * @param query - Query parameters for filtering and pagination
 * @param isExport - Whether this is an export request (allows higher limit)
 * @returns Paginated security events
 */
export async function getSecurityEvents(query: SecurityEventQuery = {}, isExport = false) {
  try {
    const page = Math.max(1, query.page || 1);
    const maxLimit = isExport ? 1000 : 200;
    const limit = Math.min(maxLimit, Math.max(1, query.limit || 50));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};

    if (query.eventType) {
      where.eventType = query.eventType;
    }

    if (query.severity) {
      where.severity = query.severity;
    }

    if (query.userId) {
      where.metadata = {
        path: ['userId'],
        equals: query.userId,
      };
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

    const [events, total] = await Promise.all([
      prisma.securityEvent.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.securityEvent.count({ where }),
    ]);

    return {
      events,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  } catch (error) {
    logger.error('Failed to retrieve security events:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to retrieve security events');
  }
}

/**
 * Exports security events for a given query.
 * Returns sanitized rows for external processing.
 * 
 * @param query - Query parameters for filtering
 * @returns Sanitized security event rows
 */
export async function exportSecurityEvents(query: SecurityEventQuery = {}) {
  try {
    // Use a higher limit for exports
    const exportQuery = { ...query, limit: 1000 };
    const result = await getSecurityEvents(exportQuery, true);
    
    // Return only the events (not pagination info)
    return result.events;
  } catch (error) {
    logger.error('Failed to export security events:', { 
      error: error instanceof Error ? error.message : 'Unknown error' 
    });
    throw new Error('Failed to export security events');
  }
}

function getSeverityForEvent(eventType: SecurityEventType): 'LOW' | 'MEDIUM' | 'HIGH' {
  switch (eventType) {
    case 'login_failed':
    case 'token_invalid':
    case 'permission_denied':
    case 'role_denied':
    case 'suspicious_activity':
      return 'MEDIUM';
    case 'rate_limit_exceeded':
      return 'HIGH';
    case 'login_success':
    case 'logout':
    case 'token_refresh':
    case 'auth_missing':
    case 'auth_invalid':
      return 'LOW';
    default:
      return 'LOW';
  }
}

function getDescriptionForEvent(eventType: SecurityEventType): string {
  switch (eventType) {
    case 'login_success':
      return 'User successfully logged in';
    case 'login_failed':
      return 'User login attempt failed';
    case 'logout':
      return 'User logged out';
    case 'token_refresh':
      return 'Access token was refreshed';
    case 'token_invalid':
      return 'Invalid or expired token provided';
    case 'permission_denied':
      return 'User lacked required permission';
    case 'role_denied':
      return 'User lacked required role';
    case 'auth_missing':
      return 'Authentication token was missing';
    case 'auth_invalid':
      return 'Authentication token was invalid';
    case 'suspicious_activity':
      return 'Suspicious activity detected';
    case 'rate_limit_exceeded':
      return 'Rate limit was exceeded';
    default:
      return 'Security event';
  }
}

// Append-only behavior: No update/delete functions for security events
// Security events are immutable once written
// Future: Database-level constraints and hash-chain verification
// Future: Database-level constraints and hash-chain verification
// Future: Database-level constraints and hash-chain verification
