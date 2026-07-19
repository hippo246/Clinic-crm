import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  req.startTime = startTime;

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { method, url, requestId } = req;
    const { statusCode } = res;

    // PHI-safe logging: no query values, no body, no headers except requestId
    logger.info(`${method} ${url}`, {
      requestId,
      statusCode,
      duration,
    });
  });

  next();
}
