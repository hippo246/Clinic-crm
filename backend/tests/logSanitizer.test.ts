import { 
  sanitizeMetadata, 
  sanitizeAuditMetadata, 
  isSensitiveKey, 
  isSafeKey 
} from '../src/utils/logSanitizer';

describe('Log Sanitizer', () => {
  describe('sanitizeMetadata', () => {
    it('should redact sensitive fields', () => {
      const metadata = {
        patientName: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
        patientId: '123',
        status: 'active',
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.patientName).toBe('[REDACTED]');
      expect(sanitized.email).toBe('[REDACTED]');
      expect(sanitized.phone).toBe('[REDACTED]');
      expect(sanitized.patientId).toBe('123');
      expect(sanitized.status).toBe('active');
    });

    it('should preserve safe ID fields', () => {
      const metadata = {
        patientId: '123',
        staffId: '456',
        userId: '789',
        resourceId: 'abc',
        count: 10,
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.patientId).toBe('123');
      expect(sanitized.staffId).toBe('456');
      expect(sanitized.userId).toBe('789');
      expect(sanitized.resourceId).toBe('abc');
      expect(sanitized.count).toBe(10);
    });

    it('should handle nested objects', () => {
      const metadata = {
        patient: {
          name: 'John Doe',
          id: '123',
        },
        staff: {
          email: 'staff@example.com',
          id: '456',
        },
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.patient.name).toBe('[REDACTED]');
      expect(sanitized.patient.id).toBe('123');
      expect(sanitized.staff.email).toBe('[REDACTED]');
      expect(sanitized.staff.id).toBe('456');
    });

    it('should handle arrays', () => {
      const metadata = {
        patients: [
          { name: 'John Doe', id: '123' },
          { name: 'Jane Smith', id: '456' },
        ],
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.patients[0].name).toBe('[REDACTED]');
      expect(sanitized.patients[0].id).toBe('123');
      expect(sanitized.patients[1].name).toBe('[REDACTED]');
      expect(sanitized.patients[1].id).toBe('456');
    });

    it('should never throw on weird input', () => {
      expect(() => sanitizeMetadata(null)).not.toThrow();
      expect(() => sanitizeMetadata(undefined)).not.toThrow();
      expect(() => sanitizeMetadata('string')).not.toThrow();
      expect(() => sanitizeMetadata(123)).not.toThrow();
      expect(() => sanitizeMetadata(true)).not.toThrow();
    });

    it('should handle circular references', () => {
      const obj: Record<string, unknown> = {};
      obj.self = obj;

      const sanitized = sanitizeMetadata(obj);

      expect(sanitized.self).toBe('[CIRCULAR]');
    });

    it('should redact password and token fields', () => {
      const metadata = {
        password: 'secret123',
        token: 'abc123',
        refreshToken: 'xyz789',
        accessToken: 'def456',
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
      expect(sanitized.refreshToken).toBe('[REDACTED]');
      expect(sanitized.accessToken).toBe('[REDACTED]');
    });

    it('should redact medical information', () => {
      const metadata = {
        diagnosis: 'Hypertension',
        symptoms: 'Headache',
        treatment: 'Medication',
        clinicalNotes: 'Patient reports...',
      };

      const sanitized = sanitizeMetadata(metadata);

      expect(sanitized.diagnosis).toBe('[REDACTED]');
      expect(sanitized.symptoms).toBe('[REDACTED]');
      expect(sanitized.treatment).toBe('[REDACTED]');
      expect(sanitized.clinicalNotes).toBe('[REDACTED]');
    });
  });

  describe('sanitizeAuditMetadata', () => {
    it('should only preserve explicitly safe keys', () => {
      const metadata = {
        patientId: '123',
        patientName: 'John Doe',
        email: 'john@example.com',
        status: 'active',
        action: 'create',
        count: 5,
      };

      const sanitized = sanitizeAuditMetadata(metadata);

      expect(sanitized.patientId).toBe('123');
      expect(sanitized.status).toBe('active');
      expect(sanitized.action).toBe('create');
      expect(sanitized.count).toBe(5);
      expect(sanitized.patientName).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
    });

    it('should omit unsafe keys entirely', () => {
      const metadata = {
        patientName: 'John Doe',
        email: 'john@example.com',
        phone: '555-1234',
      };

      const sanitized = sanitizeAuditMetadata(metadata);

      expect(sanitized.patientName).toBeUndefined();
      expect(sanitized.email).toBeUndefined();
      expect(sanitized.phone).toBeUndefined();
    });

    it('should handle nested objects safely', () => {
      const metadata = {
        patient: {
          id: '123',
          name: 'John Doe',
        },
        count: 5,
      };

      const sanitized = sanitizeAuditMetadata(metadata);

      expect(sanitized.count).toBe(5);
      expect(sanitized.patient).toBeUndefined();
    });

    it('should never throw', () => {
      expect(() => sanitizeAuditMetadata(null)).not.toThrow();
      expect(() => sanitizeAuditMetadata(undefined)).not.toThrow();
      expect(() => sanitizeAuditMetadata({ patientName: 'John' })).not.toThrow();
    });
  });

  describe('isSensitiveKey', () => {
    it('should identify sensitive keys', () => {
      expect(isSensitiveKey('patientName')).toBe(true);
      expect(isSensitiveKey('email')).toBe(true);
      expect(isSensitiveKey('password')).toBe(true);
      expect(isSensitiveKey('token')).toBe(true);
      expect(isSensitiveKey('diagnosis')).toBe(true);
    });

    it('should identify non-sensitive keys', () => {
      expect(isSensitiveKey('patientId')).toBe(false);
      expect(isSensitiveKey('status')).toBe(false);
      expect(isSensitiveKey('action')).toBe(false);
      expect(isSensitiveKey('count')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isSensitiveKey('PatientName')).toBe(true);
      expect(isSensitiveKey('EMAIL')).toBe(true);
      expect(isSensitiveKey('Password')).toBe(true);
    });

    it('should match partial key names', () => {
      expect(isSensitiveKey('patientNameFirst')).toBe(true);
      expect(isSensitiveKey('emailAddress')).toBe(true);
      expect(isSensitiveKey('phoneNumber')).toBe(true);
    });
  });

  describe('isSafeKey', () => {
    it('should identify safe keys', () => {
      expect(isSafeKey('patientId')).toBe(true);
      expect(isSafeKey('staffId')).toBe(true);
      expect(isSafeKey('userId')).toBe(true);
      expect(isSafeKey('status')).toBe(true);
      expect(isSafeKey('action')).toBe(true);
    });

    it('should identify unsafe keys', () => {
      expect(isSafeKey('patientName')).toBe(false);
      expect(isSafeKey('email')).toBe(false);
      expect(isSafeKey('password')).toBe(false);
      expect(isSafeKey('token')).toBe(false);
    });

    it('should be case-insensitive', () => {
      expect(isSafeKey('PatientId')).toBe(true);
      expect(isSafeKey('STATUS')).toBe(true);
      expect(isSafeKey('Action')).toBe(true);
    });
  });
});
