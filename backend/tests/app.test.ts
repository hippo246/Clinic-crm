import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('API Root', () => {

  it('should return 200 OK for GET /api', async () => {
    const response = await request(app).get('/api');
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('success', true);
    expect(response.body.data).toHaveProperty('service');
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('version');
    expect(response.body.data).toHaveProperty('endpoints');
    expect(response.body.data).toHaveProperty('message');
    expect(response.body.data.message).toContain('Backend scaffold');
  });

  it('should include available endpoints', async () => {
    const response = await request(app).get('/api');
    
    expect(response.status).toBe(200);
    expect(response.body.data.endpoints).toContain('/health');
  });
});

describe('Not Found Handler', () => {
  it('should return 404 for unknown routes', async () => {
    const response = await request(app).get('/api/unknown');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('success', false);
    expect(response.body.error).toHaveProperty('code', 'NOT_FOUND');
    expect(response.body.error).toHaveProperty('message', 'Resource not found');
  });

  it('should include request ID in error response', async () => {
    const response = await request(app).get('/api/unknown');
    
    expect(response.status).toBe(404);
    expect(response.body).toHaveProperty('requestId');
  });
});

describe('Request ID Middleware', () => {
  it('should generate request ID if not provided', async () => {
    const response = await request(app).get('/api');
    
    expect(response.status).toBe(200);
    expect(response.headers).toHaveProperty('x-request-id');
    expect(response.body).toHaveProperty('requestId');
  });

  it('should use provided request ID', async () => {
    const customRequestId = 'custom-request-id-123';
    const response = await request(app)
      .get('/api')
      .set('X-Request-ID', customRequestId);
    
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBe(customRequestId);
    expect(response.body.requestId).toBe(customRequestId);
  });
});
