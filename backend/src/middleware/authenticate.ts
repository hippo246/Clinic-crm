import { Response, NextFunction } from 'express';
import { verifyAccessToken } from '../auth/jwtService';
import { prisma } from '../db/client';
import { AuthenticatedRequest, AuthenticatedUser } from '../auth/auth.types';
import { errorResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { logSecurityEvent } from '../services/securityEventService';

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      await logSecurityEvent('auth_missing', { 
        method: req.method,
        path: req.path,
      });
      errorResponse(res, 'AUTH_MISSING', 'Authentication required', 401);
      return;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    try {
      const claims = verifyAccessToken(token);
      
      // Load user from database
      const user = await prisma.user.findUnique({
        where: { id: claims.userId },
      });

      if (!user) {
        await logSecurityEvent('auth_invalid', { 
          userId: claims.userId,
          method: req.method,
          path: req.path,
        });
        errorResponse(res, 'AUTH_USER_NOT_FOUND', 'User not found', 401);
        return;
      }

      if (user.status !== 'ACTIVE') {
        await logSecurityEvent('auth_invalid', { 
          userId: claims.userId,
          role: claims.roles.join(','),
          method: req.method,
          path: req.path,
        });
        errorResponse(res, 'AUTH_USER_INACTIVE', 'User account is inactive', 401);
        return;
      }

      // Attach authenticated user to request
      const authenticatedUser: AuthenticatedUser = {
        id: user.id,
        email: user.email,
        roles: claims.roles,
        permissions: claims.permissions,
        status: user.status,
      };

      req.user = authenticatedUser;
      req.sessionId = claims.sessionId;

      next();
    } catch (error) {
      await logSecurityEvent('auth_invalid', { 
        method: req.method,
        path: req.path,
      });
      errorResponse(res, 'AUTH_INVALID', 'Invalid or expired token', 401);
    }
  } catch (error) {
    logger.error('Authentication error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'AUTH_ERROR', 'Authentication error', 500);
  }
}

export function optionalAuthenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next();
    return;
  }

  authenticate(req, res, next);
}
