import { v4 as uuidv4 } from 'uuid';
import { SessionInfo } from './auth.types';

// In-memory session storage for now
// TODO: Implement database-backed sessions when Session model is added
const sessions = new Map<string, SessionInfo>();

export function createSession(userId: string, userAgent?: string, ipHash?: string): SessionInfo {
  const sessionId = uuidv4();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session: SessionInfo = {
    sessionId,
    userId,
    createdAt: now,
    expiresAt,
    userAgent,
    ipHash,
  };

  sessions.set(sessionId, session);

  // Clean up expired sessions periodically
  cleanupExpiredSessions();

  return session;
}

export function getSession(sessionId: string): SessionInfo | null {
  const session = sessions.get(sessionId);
  
  if (!session) {
    return null;
  }

  // Check if expired
  if (session.expiresAt < new Date()) {
    sessions.delete(sessionId);
    return null;
  }

  return session;
}

export function revokeSession(sessionId: string): void {
  sessions.delete(sessionId);
}

export function revokeUserSessions(userId: string): void {
  for (const [sessionId, session] of sessions.entries()) {
    if (session.userId === userId) {
      sessions.delete(sessionId);
    }
  }
}

function cleanupExpiredSessions(): void {
  const now = new Date();
  for (const [sessionId, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(sessionId);
    }
  }
}

// Run cleanup every hour
setInterval(cleanupExpiredSessions, 60 * 60 * 1000);
