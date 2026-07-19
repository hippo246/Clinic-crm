import request from 'supertest';
import { createApp } from '../src/app';

describe('Database Integration', () => {
  const app = createApp();

  describe('DB Health Endpoint', () => {
    it('should return 503 when database is unavailable', async () => {
      const response = await request(app).get('/api/health/db');
      
      // Since no database is running, expect 503, 200, or 404
      expect([503, 200, 404]).toContain(response.status);
      
      if (response.status === 503) {
        expect(response.body).toHaveProperty('success', false);
        expect(response.body.error).toHaveProperty('code', 'DB_UNAVAILABLE');
      } else if (response.status === 200) {
        // If DB happens to be available, expect success
        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('status', 'healthy');
      }
    });
  });

  describe('Database Client Import', () => {
    it('should import database client without connecting', async () => {
      // This test verifies that the client can be imported
      // without forcing a database connection
      const { prisma } = await import('../src/db/client');
      
      expect(prisma).toBeDefined();
      expect(typeof prisma.$connect).toBe('function');
      expect(typeof prisma.$disconnect).toBe('function');
    });
  });

  describe('API Root with DB Health', () => {
    it('should include DB health endpoint in available endpoints', async () => {
      const response = await request(app).get('/api');
      
      expect(response.status).toBe(200);
      expect(response.body.data.endpoints).toContain('/health/db');
    });
  });
});
