/**
 * Data Exchange Constants
 * Allowed data types, formats, and field configurations
 */

import type { ImportDataType, ExportDataType, ExportFormat, ImportFormat } from './dataExchange.types';

// Allowed import data types
export const ALLOWED_IMPORT_DATA_TYPES: ImportDataType[] = [
  'patients',
  'staff',
  'settings',
  'communication_preferences',
  'consents',
];

// Allowed export data types
export const ALLOWED_EXPORT_DATA_TYPES: ExportDataType[] = [
  'patients',
  'appointments',
  'consultations',
  'prescriptions',
  'lab_results',
  'billing',
  'documents',
  'communications',
  'audit',
  'privacy',
  'all',
];

// Allowed export formats
export const ALLOWED_EXPORT_FORMATS: ExportFormat[] = ['JSON', 'CSV'];

// Allowed import formats
export const ALLOWED_IMPORT_FORMATS: ImportFormat[] = ['JSON', 'CSV'];

// Typed confirmation strings
export const IMPORT_EXECUTE_CONFIRMATION = 'EXECUTE VALIDATED IMPORT';
export const FULL_PHI_EXPORT_CONFIRMATION = 'EXPORT FULL PHI DATA';
export const BACKUP_CREATE_CONFIRMATION = 'CREATE BACKUP ARCHIVE';
export const BACKUP_RESTORE_CONFIRMATION = 'RESTORE BACKUP ARCHIVE';

// CSV formula injection patterns
export const CSV_FORMULA_PATTERNS = [/^[=+\-@]/];

// Sensitive field exclusion lists (by data type)
export const SENSITIVE_FIELDS: Record<string, string[]> = {
  patients: ['diagnosis', 'clinicalNotes', 'fullAddress', 'phone', 'email'],
  appointments: ['patientName', 'patientContact', 'notes'],
  consultations: ['diagnosis', 'symptoms', 'treatment', 'notes'],
  prescriptions: ['medication', 'dosage', 'instructions'],
  lab_results: ['resultValue', 'notes'],
  billing: ['paymentSecret', 'cardNumber'],
  documents: ['fileName', 'fileContent'],
  communications: ['message', 'subject', 'phoneNumber', 'email'],
  audit: [],
  privacy: ['requestDetails', 'responseDetails'],
  all: [],
};

// Sanitized field allowlists (by data type)
export const SANITIZED_FIELDS: Record<string, string[]> = {
  patients: ['id', 'status', 'createdAt', 'updatedAt'],
  appointments: ['id', 'status', 'scheduledAt', 'completedAt'],
  consultations: ['id', 'status', 'patientId', 'consultationDate'],
  prescriptions: ['id', 'status', 'patientId', 'issuedAt'],
  lab_results: ['id', 'status', 'patientId', 'resultDate'],
  billing: ['id', 'invoiceNumber', 'total', 'status', 'createdAt'],
  documents: ['id', 'documentType', 'createdAt'],
  communications: ['id', 'channel', 'status', 'sentAt'],
  audit: ['id', 'action', 'resourceType', 'createdAt'],
  privacy: ['id', 'requestType', 'status', 'createdAt'],
  all: [],
};

// Maximum file sizes (bytes)
export const MAX_IMPORT_FILE_SIZE = 10 * 1024 * 1024; // 10MB
export const MAX_EXPORT_FILE_SIZE = 100 * 1024 * 1024; // 100MB

// Maximum row counts
export const MAX_IMPORT_ROWS = 10000;
export const MAX_EXPORT_ROWS = 100000;

// Prototype pollution keys to reject
export const PROTOTYPE_POLLUTION_KEYS = ['__proto__', 'constructor', 'prototype'];
