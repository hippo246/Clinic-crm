import helmet from 'helmet';
import { Request, Response, NextFunction } from 'express';

export function securityHeaders(req: Request, res: Response, next: NextFunction): void {
  helmet({
    contentSecurityPolicy: false, // Disabled for API
    crossOriginEmbedderPolicy: false,
  })(req, res, next);
}
