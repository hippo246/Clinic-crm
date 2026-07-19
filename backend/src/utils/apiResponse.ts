import { Response } from 'express';
import { ApiResponse, ErrorResponse } from '../types';

export function successResponse<T>(
  res: Response,
  data: T,
  message?: string,
  statusCode: number = 200
): Response {
  const response: ApiResponse<T> = {
    success: true,
    data,
    requestId: res.req.requestId,
  };

  if (message) {
    (response as any).message = message;
  }

  return res.status(statusCode).json(response);
}

export function errorResponse(
  res: Response,
  code: string,
  message: string,
  statusCode: number = 500
): Response {
  const response: ErrorResponse = {
    success: false,
    error: {
      code,
      message,
      requestId: res.req.requestId,
    },
    requestId: res.req.requestId,
  };

  return res.status(statusCode).json(response);
}
