import { Router } from 'express';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

const router = Router();

router.get('/db', async (_req, res) => {
  try {
    // Lightweight query to check database connectivity
    await prisma.$queryRaw`SELECT 1`;
    
    successResponse(res, {
      status: 'healthy',
      message: 'Database connection successful',
    });
  } catch (error) {
    logger.error('Database health check failed:', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'DB_UNAVAILABLE', 'Database connection failed', 503);
  }
});

export default router;
