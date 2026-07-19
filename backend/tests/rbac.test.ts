import { Response, NextFunction } from 'express';
import { requireRole, requirePermission, requireAnyPermission, denyByDefault } from '../src/middleware/rbac';
import { AuthenticatedRequest } from '../src/auth/auth.types';

describe('RBAC Middleware', () => {
  let mockReq: Partial<AuthenticatedRequest>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      user: {
        id: 'test-user-id',
        email: 'test@example.com',
        roles: ['doctor'],
        permissions: ['patients.view', 'appointments.view'],
        status: 'ACTIVE',
      },
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      req: { requestId: 'test-request-id' } as any,
    };
    mockNext = jest.fn();
  });

  describe('requireRole', () => {
    it('should pass when user has required role', async () => {
      const middleware = requireRole('doctor', 'admin');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when user is admin', async () => {
      mockReq.user = {
        id: 'admin-id',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: ['all'],
        status: 'ACTIVE',
      };
      
      const middleware = requireRole('doctor');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when user lacks required role', async () => {
      const middleware = requireRole('admin');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should deny when user is not authenticated', async () => {
      mockReq.user = undefined;
      
      const middleware = requireRole('doctor');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('requirePermission', () => {
    it('should pass when user has all required permissions', async () => {
      const middleware = requirePermission('patients.view', 'appointments.view');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should pass when user is admin', async () => {
      mockReq.user = {
        id: 'admin-id',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: ['all'],
        status: 'ACTIVE',
      };
      
      const middleware = requirePermission('patients.delete');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when user lacks required permission', async () => {
      const middleware = requirePermission('patients.delete');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('requireAnyPermission', () => {
    it('should pass when user has at least one required permission', async () => {
      const middleware = requireAnyPermission('patients.delete', 'patients.view');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny when user has none of the required permissions', async () => {
      const middleware = requireAnyPermission('patients.delete', 'billing.delete');
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });

  describe('denyByDefault', () => {
    it('should pass when user is admin', async () => {
      mockReq.user = {
        id: 'admin-id',
        email: 'admin@example.com',
        roles: ['admin'],
        permissions: ['all'],
        status: 'ACTIVE',
      };
      
      const middleware = denyByDefault();
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should block unsafe methods for auditor role', async () => {
      mockReq.user = {
        id: 'auditor-id',
        email: 'auditor@example.com',
        roles: ['auditor'],
        permissions: ['audit.view'],
        status: 'ACTIVE',
      };
      mockReq.method = 'POST';
      
      const middleware = denyByDefault();
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should allow safe methods for auditor role', async () => {
      mockReq.user = {
        id: 'auditor-id',
        email: 'auditor@example.com',
        roles: ['auditor'],
        permissions: ['audit.view'],
        status: 'ACTIVE',
      };
      mockReq.method = 'GET';
      
      const middleware = denyByDefault();
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });

    it('should deny for non-admin, non-readonly roles', async () => {
      mockReq.method = 'GET';
      
      const middleware = denyByDefault();
      await middleware(mockReq as AuthenticatedRequest, mockRes as Response, mockNext);
      
      expect(mockNext).not.toHaveBeenCalled();
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalled();
    });
  });
});
