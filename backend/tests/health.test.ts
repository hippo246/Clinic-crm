import request from 'supertest';
import { createApp } from '../src/app';

describe('Health Endpoint', () => {
  const app = createApp();

  it('should return 200 OK for GET /api/health', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('service');
    expect(response.body.data).toHaveProperty('environment');
    expect(response.body.data).toHaveProperty('timestamp');
    expect(response.body.data).toHaveProperty('uptime');
    expect(response.body.data).toHaveProperty('version');
  });

  it('should include request ID in response', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('requestId');
    expect(response.body.requestId).toMatch(/^[0-9a-f-]{36}$/); // UUID format
  });

  it('should return X-Request-ID header', async () => {
    const response = await request(app).get('/api/health');
    
    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty('x-request-id');
  });
});
