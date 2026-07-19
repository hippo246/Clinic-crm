import { Router, Request, Response } from 'express';
import { verifyFirebaseToken } from '../auth/firebaseAdmin';
import { issueAccessToken, issueRefreshToken, verifyRefreshToken } from '../auth/jwtService';
import { getUserRolesAndPermissions } from '../services/roleService';
import { prisma } from '../db/client';
import { createSession, getSession, revokeSession } from '../auth/sessionService';
import { logSecurityEvent } from '../services/securityEventService';
import { loginSchema, refreshTokenSchema } from '../auth/auth.validation';
import { AuthenticatedRequest } from '../auth/auth.types';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { logger } from '../utils/logger';
import { env } from '../config/env';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate input
    const validationResult = loginSchema.safeParse(req.body);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid request body', 400);
      return;
    }

    const { token, mockUserId } = validationResult.data;

    let userId: string;
    let email: string;

    if (env.AUTH_MODE === 'mock') {
      // Mock mode: use mockUserId or find seeded demo user
      if (mockUserId) {
        const user = await prisma.user.findUnique({
          where: { id: mockUserId },
        });
        if (!user) {
          await logSecurityEvent('login_failed', { userId: mockUserId });
          errorResponse(res, 'USER_NOT_FOUND', 'User not found', 401);
          return;
        }
        userId = user.id;
        email = user.email;
      } else {
        // Use seeded demo user
        const demoUser = await prisma.user.findFirst({
          where: { email: 'admin@demo.clinic' },
        });
        if (!demoUser) {
          await logSecurityEvent('login_failed', {});
          errorResponse(res, 'DEMO_USER_NOT_FOUND', 'Demo user not found. Run seed script first.', 401);
          return;
        }
        userId = demoUser.id;
        email = demoUser.email;
      }
    } else {
      // Firebase mode: verify token
      if (!token) {
        await logSecurityEvent('login_failed', {});
        errorResponse(res, 'TOKEN_REQUIRED', 'Firebase token required', 401);
        return;
      }

      const firebaseResult = await verifyFirebaseToken(token);
      
      // Find or create user by Firebase UID
      let user = await prisma.user.findFirst({
        where: { authId: firebaseResult.firebaseUid },
      });

      if (!user) {
        // Auto-create user for Firebase (safe for this phase)
        user = await prisma.user.create({
          data: {
            authId: firebaseResult.firebaseUid,
            authProvider: 'firebase',
            email: firebaseResult.email || `firebase-${firebaseResult.firebaseUid}@placeholder.com`,
            status: 'ACTIVE',
          },
        });
      }

      userId = user.id;
      email = user.email;
    }

    // Load roles and permissions
    const { roles, permissions } = await getUserRolesAndPermissions(userId);

    // Create session
    const session = createSession(userId, req.get('user-agent'), undefined);

    // Issue tokens
    const accessToken = issueAccessToken(userId, roles, permissions);
    const refreshToken = issueRefreshToken(userId);

    // Log success
    await logSecurityEvent('login_success', { userId });

    successResponse(res, {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email,
        roles,
        permissions,
      },
      session,
    });
  } catch (error) {
    logger.error('Login error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    await logSecurityEvent('login_failed', {});
    errorResponse(res, 'LOGIN_ERROR', 'Login failed', 500);
  }
});

// POST /api/auth/refresh
router.post('/refresh', async (req: Request, res: Response): Promise<void> => {
  try {
    const validationResult = refreshTokenSchema.safeParse(req.body);
    if (!validationResult.success) {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid request body', 400);
      return;
    }

    const { refreshToken } = validationResult.data;

    try {
      const { userId } = verifyRefreshToken(refreshToken);

      // Load roles and permissions
      const { roles, permissions } = await getUserRolesAndPermissions(userId);

      // Issue new access token
      const accessToken = issueAccessToken(userId, roles, permissions);

      // Log success
      await logSecurityEvent('token_refresh', { userId });

      successResponse(res, {
        accessToken,
      });
    } catch (error) {
      await logSecurityEvent('token_invalid', {});
      errorResponse(res, 'INVALID_REFRESH_TOKEN', 'Invalid or expired refresh token', 401);
    }
  } catch (error) {
    logger.error('Token refresh error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'REFRESH_ERROR', 'Token refresh failed', 500);
  }
});

// POST /api/auth/logout
router.post('/logout', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Logout works even without auth (best effort)
    const sessionId = req.sessionId;
    if (sessionId) {
      revokeSession(sessionId);
    }

    if (req.user) {
      await logSecurityEvent('logout', { userId: req.user.id });
    }

    successResponse(res, { message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'LOGOUT_ERROR', 'Logout failed', 500);
  }
});

// GET /api/auth/me
router.get('/me', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      errorResponse(res, 'AUTH_REQUIRED', 'Authentication required', 401);
      return;
    }

    const session = req.sessionId ? getSession(req.sessionId) : null;

    successResponse(res, {
      id: req.user.id,
      email: req.user.email,
      roles: req.user.roles,
      permissions: req.user.permissions,
      session: session || { sessionId: 'unknown', userId: req.user.id, createdAt: new Date(), expiresAt: new Date() },
    });
  } catch (error) {
    logger.error('Get user error:', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'GET_USER_ERROR', 'Failed to get user info', 500);
  }
});

export default router;
