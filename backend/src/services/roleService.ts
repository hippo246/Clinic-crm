import { prisma } from '../db/client';
import { logger } from '../utils/logger';

// Simple in-memory cache for roles/permissions
const roleCache = new Map<string, string[]>();
const permissionCache = new Map<string, string[]>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

interface UserRoleWithRole {
  role: {
    name: string;
    permissions?: {
      key: string;
    }[];
  };
}

export async function getUserRoles(userId: string): Promise<string[]> {
  // Check cache first
  const cached = roleCache.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: true,
      },
    }) as UserRoleWithRole[];

    const roles = userRoles.map((ur: UserRoleWithRole) => ur.role.name);
    
    // Cache the result
    roleCache.set(userId, roles);
    setTimeout(() => roleCache.delete(userId), CACHE_TTL);

    return roles;
  } catch (error) {
    logger.error('Failed to load user roles:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return [];
  }
}

export async function getUserPermissions(userId: string): Promise<string[]> {
  // Check cache first
  const cached = permissionCache.get(userId);
  if (cached) {
    return cached;
  }

  try {
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      include: {
        role: {
          include: {
            permissions: true,
          },
        },
      },
    }) as UserRoleWithRole[];

    const permissions = new Set<string>();
    userRoles.forEach((ur) => {
      ur.role.permissions?.forEach((p) => {
        permissions.add(p.key);
      });
    });

    const permissionArray = Array.from(permissions);
    
    // Cache the result
    permissionCache.set(userId, permissionArray);
    setTimeout(() => permissionCache.delete(userId), CACHE_TTL);

    return permissionArray;
  } catch (error) {
    logger.error('Failed to load user permissions:', { error: error instanceof Error ? error.message : 'Unknown error' });
    return [];
  }
}

export async function getUserRolesAndPermissions(userId: string): Promise<{
  roles: string[];
  permissions: string[];
}> {
  const [roles, permissions] = await Promise.all([
    getUserRoles(userId),
    getUserPermissions(userId),
  ]);

  return { roles, permissions };
}

export function clearUserCache(userId: string): void {
  roleCache.delete(userId);
  permissionCache.delete(userId);
}

export function clearAllCaches(): void {
  roleCache.clear();
  permissionCache.clear();
}
