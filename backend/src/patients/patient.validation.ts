import { z } from 'zod';

// Patient status enum from Prisma
const PatientStatus = z.enum(['ACTIVE', 'INACTIVE', 'DECEASED', 'TRANSFERRED']);

// Create patient schema
export const createPatientSchema = z.object({
  externalId: z.string().optional(),
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  dateOfBirth: z.string().or(z.date()).refine((val) => {
    const date = typeof val === 'string' ? new Date(val) : val;
    return !isNaN(date.getTime());
  }, 'Invalid date of birth'),
  gender: z.string().min(1, 'Gender is required').max(50),
  phone: z.string().optional(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
  status: PatientStatus.optional(),
});

// Update patient schema (partial)
export const updatePatientSchema = createPatientSchema.partial();

// Patient list query schema
export const patientListQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform((val) => val ? Math.min(parseInt(val, 10), 100) : 20),
  status: PatientStatus.optional(),
  search: z.string().optional(),
  sortBy: z.enum(['createdAt', 'updatedAt', 'lastName', 'firstName', 'dateOfBirth']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  includeArchived: z.string().optional().transform((val) => val === 'true'),
});

// Patient search query schema
export const patientSearchQuerySchema = z.object({
  query: z.string().min(1, 'Search query is required').max(100),
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1),
  limit: z.string().optional().transform((val) => val ? Math.min(parseInt(val, 10), 100) : 20),
});

// Archive patient schema
export const archivePatientSchema = z.object({
  reasonCode: z.string().optional(),
  reason: z.string().max(500).optional(),
});

// Patient ID param schema
export const patientIdParamSchema = z.object({
  id: z.string().uuid('Invalid patient ID format'),
});

// Patient note create schema
export const patientNoteCreateSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
});

// Patient note update schema
export const patientNoteUpdateSchema = z.object({
  content: z.string().min(1, 'Note content is required').max(5000),
  deletedAt: z.date().optional(),
  deletedBy: z.string().optional(),
});

// Patient timeline event create schema
export const patientTimelineEventCreateSchema = z.object({
  eventType: z.string().min(1, 'Event type is required').max(100),
  description: z.string().min(1, 'Description is required').max(1000),
  metadata: z.record(z.unknown()).optional(),
});

// Types inferred from schemas
export type CreatePatientInput = z.infer<typeof createPatientSchema>;
export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;
export type PatientListQuery = z.infer<typeof patientListQuerySchema>;
export type PatientSearchQuery = z.infer<typeof patientSearchQuerySchema>;
export type ArchivePatientInput = z.infer<typeof archivePatientSchema>;
export type PatientNoteCreateInput = z.infer<typeof patientNoteCreateSchema>;
export type PatientNoteUpdateInput = z.infer<typeof patientNoteUpdateSchema>;
export type PatientTimelineEventCreateInput = z.infer<typeof patientTimelineEventCreateSchema>;
