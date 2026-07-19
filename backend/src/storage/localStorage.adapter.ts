import { promises as fs } from 'fs';
import * as fsSync from 'fs';
import * as path from 'path';
import { logger } from '../utils/logger';
import { StorageAdapter, PutObjectResult, GetObjectResult, StorageObjectMetadata, SignedUrlResult } from './storage.types';

export class LocalStorageAdapter implements StorageAdapter {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = path.resolve(basePath);
  }

  private getFullPath(key: string): string {
    // Prevent path traversal
    const normalizedKey = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, '');
    return path.join(this.basePath, normalizedKey);
  }

  private ensureDirectoryExists(filePath: string): void {
    const dir = path.dirname(filePath);
    fsSync.mkdirSync(dir, { recursive: true });
  }

  async putObject(key: string, body: Buffer | NodeJS.ReadableStream, contentType: string): Promise<PutObjectResult> {
    try {
      const fullPath = this.getFullPath(key);
      this.ensureDirectoryExists(fullPath);

      if (Buffer.isBuffer(body)) {
        await fs.writeFile(fullPath, body);
      } else {
        // Handle stream
        const writeStream = fsSync.createWriteStream(fullPath);
        await new Promise((resolve, reject) => {
          body.pipe(writeStream);
          body.on('end', resolve);
          body.on('error', reject);
          writeStream.on('error', reject);
        });
      }

      const stats = await fs.stat(fullPath);
      return {
        key,
        size: stats.size,
        contentType,
      };
    } catch (error) {
      logger.error('Failed to put object in local storage', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to store file');
    }
  }

  async getObject(key: string): Promise<GetObjectResult> {
    try {
      const fullPath = this.getFullPath(key);
      const stats = await fs.stat(fullPath);

      if (!stats.isFile()) {
        throw new Error('Object not found or is not a file');
      }

      const stream = fsSync.createReadStream(fullPath);
      const metadata: StorageObjectMetadata = {
        key,
        size: stats.size,
        contentType: 'application/octet-stream', // Local storage doesn't store MIME type separately
        lastModified: stats.mtime,
      };

      return { stream, metadata };
    } catch (error) {
      logger.error('Failed to get object from local storage', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to retrieve file');
    }
  }

  async deleteObject(key: string): Promise<void> {
    try {
      const fullPath = this.getFullPath(key);
      await fs.unlink(fullPath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, consider it deleted
        return;
      }
      logger.error('Failed to delete object from local storage', { error: error instanceof Error ? error.message : 'Unknown error' });
      throw new Error('Failed to delete file');
    }
  }

  async objectExists(key: string): Promise<boolean> {
    try {
      const fullPath = this.getFullPath(key);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  async getObjectMetadata(key: string): Promise<StorageObjectMetadata | null> {
    try {
      const fullPath = this.getFullPath(key);
      const stats = await fs.stat(fullPath);

      if (!stats.isFile()) {
        return null;
      }

      return {
        key,
        size: stats.size,
        contentType: 'application/octet-stream',
        lastModified: stats.mtime,
      };
    } catch {
      return null;
    }
  }

  async getSignedReadUrl(key: string, expiresIn: number): Promise<SignedUrlResult> {
    // Local storage doesn't support real signed URLs
    // Return a placeholder URL that routes through the backend
    const expiresAt = new Date(Date.now() + expiresIn * 1000);
    return {
      url: `/api/documents/file/${key}`,
      expiresAt,
    };
  }

  async getSignedWriteUrl(): Promise<SignedUrlResult> {
    // Local storage doesn't support signed write URLs
    throw new Error('Signed write URLs not supported for local storage');
  }
}
