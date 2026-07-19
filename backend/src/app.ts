import express, { Application } from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { env, corsOrigins } from './config/env';
import { requestId } from './middleware/requestId';
import { securityHeaders } from './middleware/securityHeaders';
import { requestLogger } from './middleware/requestLogger';
import { notFoundHandler } from './middleware/notFoundHandler';
import { errorHandler } from './middleware/errorHandler';
import routes from './routes';

export function createApp(): Application {
  const app = express();

  // Security headers
  app.use(securityHeaders);

  // CORS
  app.use(cors({
    origin: corsOrigins,
    credentials: true,
  }));

  // Request ID
  app.use(requestId);

  // Request logging (PHI-safe: no body, no sensitive headers)
  if (env.NODE_ENV !== 'test') {
    app.use(morgan('combined', {
      skip: () => env.NODE_ENV === 'test',
      stream: {
        write: (message: string) => console.log(message.trim()),
      },
    }));
  }

  // Custom request logger
  app.use(requestLogger);

  // JSON body parser with sane limit
  app.use(express.json({ limit: '10mb' }));

  // Routes
  app.use(env.API_PREFIX, routes);

  // Not found handler
  app.use(notFoundHandler);

  // Error handler
  app.use(errorHandler);

  return app;
}
