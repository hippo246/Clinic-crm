import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// PrismaClient singleton to avoid multiple instances
let clientInstance: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!clientInstance) {
    clientInstance = new PrismaClient({
      log: env.DB_LOG_QUERIES === 'true' 
        ? ['query', 'error', 'warn'] 
        : ['error', 'warn'],
    });

    // Only attempt connection if not in test environment
    if (env.NODE_ENV !== 'test') {
      // Log connection events (PHI-safe - no credentials)
      clientInstance.$connect()
        .then(() => {
          logger.info('Database connected');
        })
        .catch((error: Error) => {
          logger.error('Database connection failed:', { error: error.message });
        });
    }
  }

  return clientInstance;
}

export async function disconnectPrisma(): Promise<void> {
  if (clientInstance) {
    await clientInstance.$disconnect();
    clientInstance = null;
    logger.info('Database disconnected');
  }
}

// Export a default client instance
export const prisma = getPrismaClient();
