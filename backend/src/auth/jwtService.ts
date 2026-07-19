import jwt, { SignOptions } from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { env } from '../config/env';
import { JwtClaims } from './auth.types';

export function issueAccessToken(userId: string, roles: string[], permissions: string[]): string {
  const sessionId = uuidv4();
  
  const claims: JwtClaims = {
    userId,
    roles,
    permissions,
    sessionId,
  };

  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as '1h' | '7d' | '15m' | '30d' | number,
  };

  return jwt.sign(claims, env.JWT_SECRET || 'dev-secret-min-32-chars-long', options);
}

export function issueRefreshToken(userId: string): string {
  const claims = {
    userId,
    type: 'refresh' as const,
  };

  const options: SignOptions = {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN as '1h' | '7d' | '15m' | '30d' | number,
  };

  return jwt.sign(claims, env.JWT_SECRET || 'dev-secret-min-32-chars-long', options);
}

export function verifyAccessToken(token: string): JwtClaims {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET || 'dev-secret-min-32-chars-long') as JwtClaims;
    return decoded;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
}

export function verifyRefreshToken(token: string): { userId: string } {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET || 'dev-secret-min-32-chars-long') as { userId: string; type?: string };
    
    if (decoded.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }
    
    return { userId: decoded.userId };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
}

export function decodeToken(token: string): JwtClaims | null {
  try {
    const decoded = jwt.decode(token) as JwtClaims;
    return decoded;
  } catch (error) {
    return null;
  }
}
