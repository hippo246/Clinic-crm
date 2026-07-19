import { env } from '../config/env';
import { logger } from '../utils/logger';
import { StorageAdapter, StorageDriver } from './storage.types';
import { LocalStorageAdapter } from './localStorage.adapter';
import { S3StorageAdapter } from './s3Storage.adapter';

let storageAdapter: StorageAdapter | null = null;

export function getStorageAdapter(): StorageAdapter {
  if (storageAdapter) {
    return storageAdapter;
  }

  const driver: StorageDriver = env.DOCUMENT_STORAGE_DRIVER as StorageDriver;

  switch (driver) {
    case 'local':
      storageAdapter = new LocalStorageAdapter(env.DOCUMENT_LOCAL_STORAGE_PATH);
      logger.info('Using local storage adapter', { path: env.DOCUMENT_LOCAL_STORAGE_PATH });
      break;

    case 's3':
      if (!env.S3_ENDPOINT || !env.S3_BUCKET || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
        throw new Error('S3 storage driver selected but required S3 environment variables are missing');
      }
      storageAdapter = new S3StorageAdapter({
        endpoint: env.S3_ENDPOINT,
        region: env.S3_REGION || 'us-east-1',
        bucket: env.S3_BUCKET,
        accessKeyId: env.S3_ACCESS_KEY_ID,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY,
        forcePathStyle: env.S3_FORCE_PATH_STYLE === 'true',
      });
      logger.info('Using S3 storage adapter', { endpoint: env.S3_ENDPOINT, bucket: env.S3_BUCKET });
      break;

    default:
      throw new Error(`Unsupported storage driver: ${driver}`);
  }

  return storageAdapter;
}

export function resetStorageAdapter(): void {
  storageAdapter = null;
}
