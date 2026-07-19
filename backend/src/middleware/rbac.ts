import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../auth/auth.types';
import { errorResponse } from '../utils/apiResponse';
import { logDeniedAction } from '../services/deniedActionService';
import { logSecurityEvent } from '../services/securityEventService';

// Unsafe HTTP methods that should be blocked for read-only roles
const UNSAFE_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
    return;
  }
  next();
}

export function requireRole(...allowedRoles: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
      return;
    }

    // Admin can pass all role checks
    if (req.user.roles.includes('admin')) {
      next();
      return;
    }

    const hasRole = req.user.roles.some((role) => allowedRoles.includes(role));
    
    if (!hasRole) {
      // Log denied action
      await logDeniedAction({
        actorId: req.user.id,
        actorRoles: req.user.roles,
        action: 'role_check',
        resourceType: req.path,
        reason: `Required roles: ${allowedRoles.join(', ')}`,
        method: req.method,
        path: req.path,
      });
      
      // Log security event
      await logSecurityEvent('role_denied', {
        userId: req.user.id,
        role: req.user.roles.join(','),
        method: req.method,
        path: req.path,
      });
      
      errorResponse(res, 'ROLE_DENIED', 'Insufficient role permissions', 403);
      return;
    }

    next();
  };
}

export function requirePermission(...requiredPermissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
      return;
    }

    // Admin can pass all permission checks
    if (req.user.roles.includes('admin')) {
      next();
      return;
    }

    const hasPermission = requiredPermissions.every((perm) => 
      req.user!.permissions.includes(perm)
    );
    
    if (!hasPermission) {
      // Log denied action
      await logDeniedAction({
        actorId: req.user.id,
        actorRoles: req.user.roles,
        action: 'permission_check',
        resourceType: req.path,
        reason: `Required permissions: ${requiredPermissions.join(', ')}`,
        method: req.method,
        path: req.path,
      });
      
      // Log security event
      await logSecurityEvent('permission_denied', {
        userId: req.user.id,
        role: req.user.roles.join(','),
        permission: requiredPermissions.join(','),
        method: req.method,
        path: req.path,
      });
      
      errorResponse(res, 'PERMISSION_DENIED', 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}

export function requireAnyPermission(...permissions: string[]) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
      return;
    }

    // Admin can pass all permission checks
    if (req.user.roles.includes('admin')) {
      next();
      return;
    }

    const hasPermission = permissions.some((perm) => 
      req.user!.permissions.includes(perm)
    );
    
    if (!hasPermission) {
      // Log denied action
      await logDeniedAction({
        actorId: req.user.id,
        actorRoles: req.user.roles,
        action: 'permission_check',
        resourceType: req.path,
        reason: `Required one of: ${permissions.join(', ')}`,
        method: req.method,
        path: req.path,
      });
      
      // Log security event
      await logSecurityEvent('permission_denied', {
        userId: req.user.id,
        role: req.user.roles.join(','),
        permission: permissions.join(','),
        method: req.method,
        path: req.path,
      });
      
      errorResponse(res, 'PERMISSION_DENIED', 'Insufficient permissions', 403);
      return;
    }

    next();
  };
}

export function requireAllPermissions(...permissions: string[]) {
  return requirePermission(...permissions);
}

export function denyByDefault() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
      return;
    }

    // Admin can pass deny-by-default
    if (req.user.roles.includes('admin')) {
      next();
      return;
    }

    // Auditor and readonly roles can only perform safe operations
    if (req.user.roles.includes('auditor') || req.user.roles.includes('readonly')) {
      const method = req.method;
      if (UNSAFE_METHODS.includes(method)) {
        // Log denied action
        await logDeniedAction({
          actorId: req.user.id,
          actorRoles: req.user.roles,
          action: 'unsafe_method',
          resourceType: req.path,
          reason: 'Read-only role cannot perform unsafe methods',
          method: req.method,
          path: req.path,
        });
        
        // Log security event
        await logSecurityEvent('permission_denied', {
          userId: req.user.id,
          role: req.user.roles.join(','),
          method: req.method,
          path: req.path,
        });
        
        errorResponse(res, 'PERMISSION_DENIED', 'Read-only role cannot perform this action', 403);
        return;
      }
    }

    // For other roles, deny by default unless explicitly allowed
    // Log denied action
    await logDeniedAction({
      actorId: req.user.id,
      actorRoles: req.user.roles,
      action: 'default_deny',
      resourceType: req.path,
      reason: 'Access denied by default',
      method: req.method,
      path: req.path,
    });
    
    errorResponse(res, 'PERMISSION_DENIED', 'Access denied', 403);
  };
}
