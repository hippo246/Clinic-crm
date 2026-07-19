import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  API_PREFIX: z.string().default('/api'),
  CORS_ORIGIN: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  DATABASE_URL: z.string().url().optional(),
  DATABASE_SSL: z.enum(['true', 'false']).default('false'),
  DB_LOG_QUERIES: z.enum(['true', 'false']).default('false'),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),
  AUTH_MODE: z.enum(['mock', 'firebase']).default('mock'),
  // Document storage configuration
  DOCUMENT_STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  DOCUMENT_LOCAL_STORAGE_PATH: z.string().default('./storage/documents'),
  DOCUMENT_MAX_FILE_SIZE_MB: z.string().default('10'),
  DOCUMENT_ALLOWED_MIME_TYPES: z.string().default('application/pdf,image/jpeg,image/png,image/webp'),
  // S3/MinIO configuration (optional)
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_FORCE_PATH_STYLE: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof envSchema>;

function parseEnv(): Env {
  const result = envSchema.safeParse(process.env);
  
  if (!result.success) {
    console.error('Invalid environment variables:', result.error.format());
    process.exit(1);
  }
  
  return result.data;
}

export const env = parseEnv();

export const corsOrigins = env.CORS_ORIGIN.split(',').map(origin => origin.trim());
