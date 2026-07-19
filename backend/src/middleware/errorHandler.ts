import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { errorResponse } from '../utils/apiResponse';

export function errorHandler(
  err: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Log error without PHI (no request body, no sensitive headers)
  logger.error('Request error:', {
    message: err.message,
    requestId: req.requestId,
    path: req.path,
    method: req.method,
  });

  // Safe error response (no stack trace in production)
  const isDevelopment = process.env.NODE_ENV === 'development';
  const statusCode = (err as any).statusCode || 500;
  const code = (err as any).code || 'INTERNAL_ERROR';
  const message = isDevelopment ? err.message : 'An error occurred';

  errorResponse(res, code, message, statusCode);
}
