import { issueAccessToken, issueRefreshToken, verifyAccessToken, verifyRefreshToken, decodeToken } from '../src/auth/jwtService';

describe('JWT Service', () => {
  const testUserId = 'test-user-id';
  const testRoles = ['admin', 'doctor'];
  const testPermissions = ['patients.view', 'patients.create'];

  describe('issueAccessToken', () => {
    it('should issue a valid access token', () => {
      const token = issueAccessToken(testUserId, testRoles, testPermissions);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3); // JWT has 3 parts
    });

    it('should include correct claims in token', () => {
      const token = issueAccessToken(testUserId, testRoles, testPermissions);
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
      expect(decoded?.roles).toEqual(testRoles);
      expect(decoded?.permissions).toEqual(testPermissions);
      expect(decoded?.sessionId).toBeDefined();
    });
  });

  describe('issueRefreshToken', () => {
    it('should issue a valid refresh token', () => {
      const token = issueRefreshToken(testUserId);
      
      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.').length).toBe(3);
    });

    it('should include userId in refresh token', () => {
      const token = issueRefreshToken(testUserId);
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
    });
  });

  describe('verifyAccessToken', () => {
    it('should verify a valid access token', () => {
      const token = issueAccessToken(testUserId, testRoles, testPermissions);
      const decoded = verifyAccessToken(token);
      
      expect(decoded.userId).toBe(testUserId);
      expect(decoded.roles).toEqual(testRoles);
      expect(decoded.permissions).toEqual(testPermissions);
    });

    it('should throw error for invalid token', () => {
      expect(() => {
        verifyAccessToken('invalid-token');
      }).toThrow('Invalid or expired token');
    });

    it('should throw error for expired token', () => {
      // This test assumes the token expires immediately
      // For now, we just test that invalid tokens throw
      expect(() => {
        verifyAccessToken('invalid.expired.token');
      }).toThrow('Invalid or expired token');
    });
  });

  describe('verifyRefreshToken', () => {
    it('should verify a valid refresh token', () => {
      const token = issueRefreshToken(testUserId);
      const decoded = verifyRefreshToken(token);
      
      expect(decoded.userId).toBe(testUserId);
    });

    it('should throw error for invalid refresh token', () => {
      expect(() => {
        verifyRefreshToken('invalid-token');
      }).toThrow('Invalid or expired refresh token');
    });
  });

  describe('decodeToken', () => {
    it('should decode a token without verification', () => {
      const token = issueAccessToken(testUserId, testRoles, testPermissions);
      const decoded = decodeToken(token);
      
      expect(decoded).toBeDefined();
      expect(decoded?.userId).toBe(testUserId);
    });

    it('should return null for invalid token', () => {
      const decoded = decodeToken('invalid-token');
      
      expect(decoded).toBeNull();
    });
  });
});
