import { Request, Response, NextFunction } from 'express';
import { logger } from './logger';

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      logger.error('Async handler error:', { error: error.message, requestId: req.requestId });
      next(error);
    });
  };
}
