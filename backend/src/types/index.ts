export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    requestId?: string;
  };
  requestId?: string;
}

export interface HealthResponse {
  status: string;
  service: string;
  environment: string;
  timestamp: string;
  uptime: number;
  version?: string;
}

export interface ApiRootResponse {
  service: string;
  status: string;
  version?: string;
  endpoints: string[];
  message: string;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    requestId?: string;
  };
  requestId?: string;
}

declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}
