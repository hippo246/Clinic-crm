/**
 * Storage abstraction types for document/file storage
 */

export interface StorageObjectMetadata {
  key: string;
  size: number;
  contentType: string;
  lastModified?: Date;
  etag?: string;
}

export interface PutObjectResult {
  key: string;
  size: number;
  contentType: string;
}

export interface GetObjectResult {
  stream: NodeJS.ReadableStream;
  metadata: StorageObjectMetadata;
}

export interface SignedUrlResult {
  url: string;
  expiresAt: Date;
}

export interface StorageAdapter {
  /**
   * Store an object
   */
  putObject(key: string, body: Buffer | NodeJS.ReadableStream, contentType: string): Promise<PutObjectResult>;

  /**
   * Retrieve an object
   */
  getObject(key: string): Promise<GetObjectResult>;

  /**
   * Delete an object
   */
  deleteObject(key: string): Promise<void>;

  /**
   * Check if an object exists
   */
  objectExists(key: string): Promise<boolean>;

  /**
   * Get object metadata without retrieving the object
   */
  getObjectMetadata(key: string): Promise<StorageObjectMetadata | null>;

  /**
   * Generate a signed read URL (for S3/MinIO)
   * For local storage, returns a controlled backend access URL
   */
  getSignedReadUrl(key: string, expiresIn: number): Promise<SignedUrlResult>;

  /**
   * Generate a signed write URL (for S3/MinIO)
   * For local storage, may not be supported
   */
  getSignedWriteUrl?(key: string, expiresIn: number): Promise<SignedUrlResult>;
}

export type StorageDriver = 'local' | 's3';
