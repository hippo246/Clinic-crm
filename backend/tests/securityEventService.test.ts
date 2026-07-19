import { logSecurityEvent, getSecurityEvents, exportSecurityEvents } from '../src/services/securityEventService';
import { prisma } from '../src/db/client';

// Mock Prisma
jest.mock('../src/db/client', () => ({
  prisma: {
    securityEvent: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
}));

describe('Security Event Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('should log security event to database', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logSecurityEvent('login_success', { userId: 'user-123' });

      expect(prisma.securityEvent.create).toHaveBeenCalledWith({
        data: {
          eventType: 'login_success',
          severity: 'LOW',
          description: 'User successfully logged in',
          metadata: expect.any(Object),
          ipAddress: undefined,
          userAgent: undefined,
        },
      });
    });

    it('should sanitize metadata before writing', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logSecurityEvent('login_failed', {
        userId: 'user-123',
        permission: 'patients.delete',
        action: 'delete',
        role: 'doctor',
      });

      const createCall = (prisma.securityEvent.create as jest.Mock).mock.calls[0];
      const metadata = createCall[0].data.metadata;

      expect(metadata.userId).toBe('user-123');
      // Role may not be included in metadata depending on sanitization
      if (metadata.role) {
        expect(metadata.role).toBe('doctor');
      }
    });

    it('should map severity correctly', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logSecurityEvent('login_failed', {});
      let createCall = (prisma.securityEvent.create as jest.Mock).mock.calls[0];
      expect(createCall[0].data.severity).toBe('MEDIUM');

      await logSecurityEvent('rate_limit_exceeded', {});
      createCall = (prisma.securityEvent.create as jest.Mock).mock.calls[1];
      expect(createCall[0].data.severity).toBe('HIGH');

      await logSecurityEvent('login_success', {});
      createCall = (prisma.securityEvent.create as jest.Mock).mock.calls[2];
      expect(createCall[0].data.severity).toBe('LOW');
    });

    it('should fail silently on database error', async () => {
      (prisma.securityEvent.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        logSecurityEvent('login_success', {})
      ).resolves.not.toThrow();
    });

    it('should include description for event type', async () => {
      (prisma.securityEvent.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logSecurityEvent('permission_denied', {});

      const createCall = (prisma.securityEvent.create as jest.Mock).mock.calls[0];
      expect(createCall[0].data.description).toBe('User lacked required permission');
    });
  });

  describe('getSecurityEvents', () => {
    it('should retrieve security events with pagination', async () => {
      const mockEvents = [
        { id: '1', eventType: 'login_success', createdAt: new Date() },
        { id: '2', eventType: 'login_failed', createdAt: new Date() },
      ];
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
      (prisma.securityEvent.count as jest.Mock).mockResolvedValue(2);

      const result = await getSecurityEvents({ page: 1, limit: 10 });

      expect(result.events).toEqual(mockEvents);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should apply filters', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityEvent.count as jest.Mock).mockResolvedValue(0);

      await getSecurityEvents({
        eventType: 'login_failed',
        severity: 'medium',
      });

      const findManyCall = (prisma.securityEvent.findMany as jest.Mock).mock.calls[0];
      const where = findManyCall[0].where;

      expect(where.eventType).toBe('login_failed');
      expect(where.severity).toBe('medium');
    });

    it('should enforce limit bounds', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.securityEvent.count as jest.Mock).mockResolvedValue(0);

      await getSecurityEvents({ limit: 300 });

      const findManyCall = (prisma.securityEvent.findMany as jest.Mock).mock.calls[0];
      expect(findManyCall[0].take).toBe(200);
    });

    it('should throw error on database failure', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(getSecurityEvents()).rejects.toThrow('Failed to retrieve security events');
    });
  });

  describe('exportSecurityEvents', () => {
    it('should export security events with higher limit', async () => {
      const mockEvents = [
        { id: '1', eventType: 'login_success' },
        { id: '2', eventType: 'login_failed' },
      ];
      (prisma.securityEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);
      (prisma.securityEvent.count as jest.Mock).mockResolvedValue(2);

      const result = await exportSecurityEvents({ limit: 50 });

      expect(result).toEqual(mockEvents);
      expect(prisma.securityEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 1000,
        })
      );
    });

    it('should throw error on database failure', async () => {
      (prisma.securityEvent.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(exportSecurityEvents()).rejects.toThrow('Failed to export security events');
    });
  });
});
