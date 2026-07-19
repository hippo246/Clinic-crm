import { describe, it, expect } from '@jest/globals';
import {
  validateFileSize,
  validateMimeType,
  checkSuspiciousExtensions,
  blockExecutableTypes,
  sanitizeFilename,
  validateFile,
} from '../src/storage/fileValidation';

describe('File Validation', () => {
  describe('validateFileSize', () => {
    it('should accept valid file size', () => {
      const result = validateFileSize(1024 * 1024, 10); // 1MB, max 10MB
      expect(result.valid).toBe(true);
    });

    it('should reject empty file', () => {
      const result = validateFileSize(0, 10);
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File is empty');
    });

    it('should reject file exceeding max size', () => {
      const result = validateFileSize(11 * 1024 * 1024, 10); // 11MB, max 10MB
      expect(result.valid).toBe(false);
      expect(result.error).toContain('exceeds maximum allowed size');
    });
  });

  describe('validateMimeType', () => {
    it('should accept allowed MIME type', () => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const result = validateMimeType('application/pdf', allowedTypes);
      expect(result.valid).toBe(true);
    });

    it('should reject disallowed MIME type', () => {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
      const result = validateMimeType('application/exe', allowedTypes);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('is not allowed');
    });
  });

  describe('checkSuspiciousExtensions', () => {
    it('should detect double extensions', () => {
      const result = checkSuspiciousExtensions('file.exe.exe');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('File has suspicious double extension');
    });

    it('should accept normal filenames', () => {
      const result = checkSuspiciousExtensions('document.pdf');
      expect(result.valid).toBe(true);
    });
  });

  describe('blockExecutableTypes', () => {
    it('should block executable MIME types', () => {
      const result = blockExecutableTypes('application/x-msdownload', 'file.exe');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Executable file types are not allowed');
    });

    it('should block executable extensions', () => {
      const result = blockExecutableTypes('application/octet-stream', 'file.exe');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Executable file types are not allowed');
    });

    it('should accept safe file types', () => {
      const result = blockExecutableTypes('application/pdf', 'document.pdf');
      expect(result.valid).toBe(true);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove dangerous characters', () => {
      const result = sanitizeFilename('file<>:"|?*.txt');
      expect(result).toBe('file_______.txt');
    });

    it('should remove path components', () => {
      const result = sanitizeFilename('/path/to/file.txt');
      expect(result).toBe('file.txt');
    });

    it('should preserve safe characters', () => {
      const result = sanitizeFilename('document-v1.2_final.pdf');
      expect(result).toBe('document-v1.2_final.pdf');
    });
  });

  describe('validateFile (comprehensive)', () => {
    it('should pass all validations for valid file', () => {
      const result = validateFile(
        1024 * 1024, // 1MB
        'application/pdf',
        'document.pdf',
        {
          maxSizeMB: 10,
          allowedMimeTypes: ['application/pdf', 'image/jpeg'],
        }
      );
      expect(result.valid).toBe(true);
    });

    it('should fail on file size validation', () => {
      const result = validateFile(
        11 * 1024 * 1024, // 11MB
        'application/pdf',
        'document.pdf',
        {
          maxSizeMB: 10,
          allowedMimeTypes: ['application/pdf'],
        }
      );
      expect(result.valid).toBe(false);
    });

    it('should fail on MIME type validation', () => {
      const result = validateFile(
        1024 * 1024,
        'application/exe',
        'file.exe',
        {
          maxSizeMB: 10,
          allowedMimeTypes: ['application/pdf'],
        }
      );
      expect(result.valid).toBe(false);
    });

    it('should fail on executable type check', () => {
      const result = validateFile(
        1024 * 1024,
        'application/x-msdownload',
        'malicious.exe',
        {
          maxSizeMB: 10,
          allowedMimeTypes: ['application/x-msdownload'],
        }
      );
      expect(result.valid).toBe(false);
    });
  });
});
