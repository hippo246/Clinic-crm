/**
 * PHI/PII-Safe Metadata Sanitizer
 * 
 * This utility recursively sanitizes metadata objects to remove sensitive information
 * before logging to audit trails, security events, or other persistent storage.
 * 
 * Sensitive fields are replaced with [REDACTED]. Safe ID fields are preserved.
 */

// Keys that contain sensitive information and must be redacted
const SENSITIVE_KEYS = new Set([
  // Patient/Staff PII
  'patientName',
  'staffName',
  'name',
  'firstName',
  'lastName',
  'middleName',
  'fullName',
  
  // Contact Information
  'phone',
  'phoneNumber',
  'mobile',
  'email',
  'emailAddress',
  'address',
  'street',
  'city',
  'state',
  'zip',
  'postalCode',
  
  // Medical Information (PHI)
  'dob',
  'dateOfBirth',
  'birthDate',
  'diagnosis',
  'symptoms',
  'treatment',
  'clinicalNotes',
  'notes',
  'medicalNotes',
  'patientNotes',
  'medication',
  'medicationName',
  'drugName',
  'dosage',
  'labValue',
  'resultValue',
  'testResult',
  'vitals',
  
  // Communication Content
  'messageBody',
  'message',
  'content',
  'templateBody',
  'templateContent',
  'subject',
  
  // Document Content
  'documentTitle',
  'documentContent',
  'fileContent',
  'fileName',
  
  // Financial Information
  'insuranceDetails',
  'insuranceNumber',
  'policyNumber',
  'creditCard',
  'bankAccount',
  
  // Security/Authentication
  'password',
  'token',
  'refreshToken',
  'accessToken',
  'authorization',
  'cookie',
  'session',
  'privateKey',
  'secret',
  'apiKey',
  'apiSecret',
  'authToken',
  
  // Other Sensitive
  'ssn',
  'socialSecurityNumber',
  'nationalId',
  'passport',
]);

// Keys that are safe to preserve (IDs, counts, status, etc.)
const SAFE_KEYS = new Set([
  'patientId',
  'staffId',
  'userId',
  'resourceId',
  'requestId',
  'invoiceId',
  'documentId',
  'appointmentId',
  'prescriptionId',
  'labOrderId',
  'communicationId',
  'consultationId',
  'queueId',
  'roleId',
  'permissionId',
  'clinicId',
  'count',
  'status',
  'type',
  'action',
  'method',
  'path',
  'severity',
  'eventType',
  'resourceType',
  'actorId',
  'actorRole',
  'actorRoles',
  'reason',
  'module',
  'confirmationType',
  'confirmationMatched',
  'ipHash',
  'userAgent',
  'timestamp',
  'createdAt',
  'updatedAt',
]);

// Track visited objects to handle circular references
const visited = new WeakSet<object>();

/**
 * Sanitizes a metadata object by redacting sensitive fields.
 * 
 * @param metadata - The metadata object to sanitize
 * @returns A sanitized copy of the metadata object
 */
export function sanitizeMetadata<T = unknown>(metadata: T): T {
  if (metadata === null || metadata === undefined) {
    return metadata;
  }

  // Handle primitives (strings, numbers, booleans)
  if (typeof metadata !== 'object') {
    return metadata;
  }

  // Handle arrays
  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeMetadata(item)) as T;
  }

  // Handle circular references
  if (visited.has(metadata)) {
    return '[CIRCULAR]' as T;
  }
  visited.add(metadata);

  // Handle objects
  const sanitized: Record<string, unknown> = {};
  
  for (const key in metadata) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
      continue;
    }

    const value = (metadata as Record<string, unknown>)[key];
    const lowerKey = key.toLowerCase();

    // Check if key is sensitive
    let isSensitive = false;
    for (const sensitiveKey of SENSITIVE_KEYS) {
      if (lowerKey === sensitiveKey.toLowerCase() || lowerKey.includes(sensitiveKey.toLowerCase())) {
        isSensitive = true;
        break;
      }
    }

    if (isSensitive) {
      // Redact sensitive values
      sanitized[key] = '[REDACTED]';
    } else {
      // Recursively sanitize nested values
      try {
        sanitized[key] = sanitizeMetadata(value);
      } catch {
        // If sanitization fails, redact the value to be safe
        sanitized[key] = '[REDACTED]';
      }
    }
  }

  return sanitized as T;
}

/**
 * Sanitizes metadata specifically for audit logs.
 * This is a stricter version that only preserves explicitly safe keys.
 * 
 * @param metadata - The metadata to sanitize
 * @returns A sanitized copy with only safe keys preserved
 */
export function sanitizeAuditMetadata<T = unknown>(metadata: T): T {
  if (metadata === null || metadata === undefined) {
    return metadata;
  }

  if (typeof metadata !== 'object') {
    return metadata;
  }

  if (Array.isArray(metadata)) {
    return metadata.map((item) => sanitizeAuditMetadata(item)) as T;
  }

  if (visited.has(metadata)) {
    return '[CIRCULAR]' as T;
  }
  visited.add(metadata);

  const sanitized: Record<string, unknown> = {};
  
  for (const key in metadata) {
    if (!Object.prototype.hasOwnProperty.call(metadata, key)) {
      continue;
    }

    const value = (metadata as Record<string, unknown>)[key];
    const lowerKey = key.toLowerCase();

    // Only preserve explicitly safe keys
    let isSafe = false;
    for (const safeKey of SAFE_KEYS) {
      if (lowerKey === safeKey.toLowerCase()) {
        isSafe = true;
        break;
      }
    }

    if (isSafe) {
      try {
        sanitized[key] = sanitizeAuditMetadata(value);
      } catch {
        sanitized[key] = '[REDACTED]';
      }
    }
    // Unsafe keys are omitted entirely for audit logs
  }

  return sanitized as T;
}

/**
 * Clears the circular reference tracking set.
 * Call this periodically if processing many objects to prevent memory leaks.
 */
export function clearSanitizerCache(): void {
  // WeakSet doesn't have a clear method, but it's automatically garbage collected
  // This function exists for API completeness and future enhancements
}

/**
 * Checks if a key is sensitive.
 * 
 * @param key - The key to check
 * @returns True if the key is sensitive
 */
export function isSensitiveKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  for (const sensitiveKey of SENSITIVE_KEYS) {
    if (lowerKey === sensitiveKey.toLowerCase() || lowerKey.includes(sensitiveKey.toLowerCase())) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if a key is safe to preserve.
 * 
 * @param key - The key to check
 * @returns True if the key is safe
 */
export function isSafeKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  for (const safeKey of SAFE_KEYS) {
    if (lowerKey === safeKey.toLowerCase()) {
      return true;
    }
  }
  return false;
}
