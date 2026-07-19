import { computeHash, buildHashPayload, computeAuditHash, verifyHash } from '../src/utils/hashChain';

describe('Hash Chain Helper', () => {
  describe('computeHash', () => {
    it('should compute a SHA-256 hash', () => {
      const hash = computeHash('test payload');
      
      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64); // SHA-256 produces 64 hex characters
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = computeHash('payload1');
      const hash2 = computeHash('payload2');
      
      expect(hash1).not.toBe(hash2);
    });

    it('should produce same hash for same input', () => {
      const hash1 = computeHash('same payload');
      const hash2 = computeHash('same payload');
      
      expect(hash1).toBe(hash2);
    });
  });

  describe('buildHashPayload', () => {
    it('should build a sorted JSON payload', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        actorId: '456',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const payload = buildHashPayload(fields);
      const parsed = JSON.parse(payload);

      // Keys should be sorted
      const keys = Object.keys(parsed);
      expect(keys).toEqual(['action', 'actorId', 'resourceId', 'resourceType', 'timestamp']);
    });

    it('should handle optional fields', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const payload = buildHashPayload(fields);
      const parsed = JSON.parse(payload);

      expect(parsed.action).toBe('create');
      expect(parsed.actorId).toBeUndefined();
    });
  });

  describe('computeAuditHash', () => {
    it('should compute hash from audit fields', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        actorId: '456',
        actorRole: 'doctor',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hash = computeAuditHash(fields);

      expect(hash).toBeDefined();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBe(64);
    });

    it('should be deterministic', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        actorId: '456',
        actorRole: 'doctor',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hash1 = computeAuditHash(fields);
      const hash2 = computeAuditHash(fields);

      expect(hash1).toBe(hash2);
    });
  });

  describe('verifyHash', () => {
    it('should verify matching hash', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        actorId: '456',
        actorRole: 'doctor',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const hash = computeAuditHash(fields);
      const isValid = verifyHash(hash, fields);

      expect(isValid).toBe(true);
    });

    it('should reject non-matching hash', () => {
      const fields = {
        action: 'create',
        resourceType: 'patient',
        resourceId: '123',
        actorId: '456',
        actorRole: 'doctor',
        timestamp: '2024-01-01T00:00:00Z',
      };

      const isValid = verifyHash('invalidhash123', fields);

      expect(isValid).toBe(false);
    });
  });
});
