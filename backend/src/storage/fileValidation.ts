import { env } from '../config/env';

export interface FileValidationResult {
  valid: boolean;
  error?: string;
}

export interface FileValidationOptions {
  maxSizeMB?: number;
  allowedMimeTypes?: string[];
}

/**
 * Validate file size
 */
export function validateFileSize(sizeBytes: number, maxSizeMB: number): FileValidationResult {
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  
  if (sizeBytes === 0) {
    return { valid: false, error: 'File is empty' };
  }
  
  if (sizeBytes > maxSizeBytes) {
    return { valid: false, error: `File size exceeds maximum allowed size of ${maxSizeMB}MB` };
  }
  
  return { valid: true };
}

/**
 * Validate MIME type against allowlist
 */
export function validateMimeType(mimeType: string, allowedMimeTypes: string[]): FileValidationResult {
  if (!allowedMimeTypes.includes(mimeType)) {
    return { valid: false, error: `File type ${mimeType} is not allowed` };
  }
  
  return { valid: true };
}

/**
 * Check for suspicious double extensions
 */
export function checkSuspiciousExtensions(filename: string): FileValidationResult {
  const suspiciousPatterns = [
    /\.exe\.exe$/i,
    /\.bat\.bat$/i,
    /\.cmd\.cmd$/i,
    /\.scr\.scr$/i,
    /\.pif\.pif$/i,
    /\.vbs\.vbs$/i,
    /\.js\.js$/i,
    /\.jar\.jar$/i,
  ];
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(filename)) {
      return { valid: false, error: 'File has suspicious double extension' };
    }
  }
  
  return { valid: true };
}

/**
 * Block executable and script file types
 */
export function blockExecutableTypes(mimeType: string, filename: string): FileValidationResult {
  const blockedMimeTypes = [
    'application/x-msdownload',
    'application/x-msdos-program',
    'application/x-executable',
    'application/x-sh',
    'application/x-bat',
    'application/x-csh',
    'application/javascript',
    'application/x-javascript',
  ];
  
  const blockedExtensions = [
    '.exe',
    '.bat',
    '.cmd',
    '.scr',
    '.pif',
    '.vbs',
    '.js',
    '.jar',
    '.sh',
    '.csh',
    '.com',
  ];
  
  if (blockedMimeTypes.includes(mimeType.toLowerCase())) {
    return { valid: false, error: 'Executable file types are not allowed' };
  }
  
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (blockedExtensions.includes(ext)) {
    return { valid: false, error: 'Executable file types are not allowed' };
  }
  
  return { valid: true };
}

/**
 * Sanitize filename for display purposes only
 * Never use the sanitized filename for storage keys
 */
export function sanitizeFilename(filename: string): string {
  // Remove path components
  const name = filename.replace(/^.*[\\\/]/, '');
  
  // Remove null bytes and other dangerous characters
  return name.replace(/[\x00-\x1f\x80-\x9f]/g, '').replace(/[<>:"|?*]/g, '_');
}

/**
 * Comprehensive file validation
 */
export function validateFile(
  sizeBytes: number,
  mimeType: string,
  originalFilename: string,
  options?: FileValidationOptions
): FileValidationResult {
  const maxSizeMB = options?.maxSizeMB ?? parseInt(env.DOCUMENT_MAX_FILE_SIZE_MB, 10);
  const allowedMimeTypes = options?.allowedMimeTypes ?? env.DOCUMENT_ALLOWED_MIME_TYPES.split(',');
  
  // Validate file size
  const sizeValidation = validateFileSize(sizeBytes, maxSizeMB);
  if (!sizeValidation.valid) {
    return sizeValidation;
  }
  
  // Validate MIME type
  const mimeValidation = validateMimeType(mimeType, allowedMimeTypes);
  if (!mimeValidation.valid) {
    return mimeValidation;
  }
  
  // Check for suspicious extensions
  const extensionCheck = checkSuspiciousExtensions(originalFilename);
  if (!extensionCheck.valid) {
    return extensionCheck;
  }
  
  // Block executable types
  const executableCheck = blockExecutableTypes(mimeType, originalFilename);
  if (!executableCheck.valid) {
    return executableCheck;
  }
  
  return { valid: true };
}
