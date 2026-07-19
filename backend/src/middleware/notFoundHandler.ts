import { Request, Response } from 'express';
import { errorResponse } from '../utils/apiResponse';

export function notFoundHandler(_req: Request, res: Response): void {
  errorResponse(res, 'NOT_FOUND', 'Resource not found', 404);
}
