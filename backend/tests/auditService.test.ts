import { logAuditEvent, getAuditLogs, getAuditLogById, buildAuditMetadata } from '../src/services/auditService';
import { prisma } from '../src/db/client';

// Mock Prisma
jest.mock('../src/db/client', () => ({
  prisma: {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      findUnique: jest.fn(),
    },
  },
}));

describe('Audit Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('logAuditEvent', () => {
    it('should log audit event to database', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logAuditEvent({
        actorId: 'user-123',
        actorRole: 'doctor',
        action: 'create',
        resourceType: 'patient',
        resourceId: 'patient-456',
      });

      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          action: 'create',
          resourceType: 'patient',
          resourceId: 'patient-456',
          actorId: 'user-123',
          actorRole: 'doctor',
          metadata: undefined,
        },
      });
    });

    it('should sanitize metadata before writing', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logAuditEvent({
        actorId: 'user-123',
        actorRole: 'doctor',
        action: 'create',
        resourceType: 'patient',
        resourceId: 'patient-456',
        metadata: {
          patientName: 'John Doe',
          patientId: '456',
          email: 'john@example.com',
        },
      });

      const createCall = (prisma.auditLog.create as jest.Mock).mock.calls[0];
      const metadata = createCall[0].data.metadata;

      expect(metadata.patientName).toBeUndefined();
      expect(metadata.email).toBeUndefined();
      expect(metadata.patientId).toBe('456');
    });

    it('should fail silently on database error', async () => {
      (prisma.auditLog.create as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(
        logAuditEvent({
          actorId: 'user-123',
          action: 'create',
          resourceType: 'patient',
          resourceId: 'patient-456',
        })
      ).resolves.not.toThrow();
    });

    it('should include safe metadata fields', async () => {
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({ id: '123' });

      await logAuditEvent({
        actorId: 'user-123',
        action: 'create',
        resourceType: 'patient',
        resourceId: 'patient-456',
        patientId: '456',
        requestId: 'req-789',
      });

      const createCall = (prisma.auditLog.create as jest.Mock).mock.calls[0];
      const metadata = createCall[0].data.metadata;

      expect(metadata.patientId).toBe('456');
      expect(metadata.requestId).toBe('req-789');
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with pagination', async () => {
      const mockLogs = [
        { id: '1', action: 'create', createdAt: new Date() },
        { id: '2', action: 'update', createdAt: new Date() },
      ];
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue(mockLogs);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(2);

      const result = await getAuditLogs({ page: 1, limit: 10 });

      expect(result.logs).toEqual(mockLogs);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
      expect(result.pagination.total).toBe(2);
      expect(result.pagination.totalPages).toBe(1);
    });

    it('should apply filters', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({
        action: 'create',
        resourceType: 'patient',
        actorId: 'user-123',
      });

      const findManyCall = (prisma.auditLog.findMany as jest.Mock).mock.calls[0];
      const where = findManyCall[0].where;

      expect(where.action).toBe('create');
      expect(where.resourceType).toBe('patient');
      expect(where.actorId).toBe('user-123');
    });

    it('should enforce limit bounds', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.auditLog.count as jest.Mock).mockResolvedValue(0);

      await getAuditLogs({ limit: 300 });

      const findManyCall = (prisma.auditLog.findMany as jest.Mock).mock.calls[0];
      expect(findManyCall[0].take).toBe(200);
    });

    it('should throw error on database failure', async () => {
      (prisma.auditLog.findMany as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(getAuditLogs()).rejects.toThrow('Failed to retrieve audit logs');
    });
  });

  describe('getAuditLogById', () => {
    it('should retrieve single audit log', async () => {
      const mockLog = { id: '123', action: 'create' };
      (prisma.auditLog.findUnique as jest.Mock).mockResolvedValue(mockLog);

      const result = await getAuditLogById('123');

      expect(result).toEqual(mockLog);
      expect(prisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: '123' },
      });
    });

    it('should throw error on database failure', async () => {
      (prisma.auditLog.findUnique as jest.Mock).mockRejectedValue(new Error('DB error'));

      await expect(getAuditLogById('123')).rejects.toThrow('Failed to retrieve audit log');
    });
  });

  describe('buildAuditMetadata', () => {
    it('should sanitize metadata', () => {
      const metadata = buildAuditMetadata({
        patientName: 'John Doe',
        patientId: '123',
        email: 'john@example.com',
      });

      expect(metadata.patientName).toBeUndefined();
      expect(metadata.patientId).toBe('123');
      expect(metadata.email).toBeUndefined();
    });

    it('should handle empty metadata', () => {
      const metadata = buildAuditMetadata({});
      expect(metadata).toEqual({});
    });
  });
});
