import { Router } from 'express';
import { successResponse } from '../utils/apiResponse';
import { SERVICE_NAME, SERVICE_VERSION } from '../config/constants';
import { env } from '../config/env';
import type { HealthResponse } from '../types';

const router = Router();

router.get('/health', (_req, res) => {
  const uptime = process.uptime();
  const response: HealthResponse = {
    status: 'ok',
    service: SERVICE_NAME,
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime,
    version: SERVICE_VERSION,
  };

  successResponse(res, response);
});

export default router;
