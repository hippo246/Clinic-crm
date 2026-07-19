import { z } from 'zod';

// Common pagination and query schemas
const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const sortSchema = z.object({
  sortBy: z.enum(['createdAt', 'updatedAt', 'date', 'priority', 'status']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Appointment Status Enum (from Prisma)
const AppointmentStatus = z.enum(['SCHEDULED', 'CONFIRMED', 'CHECKED_IN', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW']);

// Appointment Validation Schemas
export const createAppointmentSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  date: z.string().or(z.date()),
  time: z.string().min(1),
  duration: z.coerce.number().int().min(1).optional(),
  notes: z.string().max(1000).optional(),
});

export const updateAppointmentSchema = createAppointmentSchema.partial();

export const appointmentStatusSchema = z.object({
  status: AppointmentStatus,
});

export const appointmentListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  status: AppointmentStatus.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// Queue Status Enum (from Prisma)
const QueueStatus = z.enum(['WAITING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'SKIPPED']);

// Queue Validation Schemas
export const createQueueEntrySchema = z.object({
  patientId: z.string().uuid(),
  appointmentId: z.string().uuid().optional(),
  priority: z.coerce.number().int().min(0).max(10).default(0),
});

export const updateQueueEntrySchema = createQueueEntrySchema.partial();

export const queueStatusSchema = z.object({
  status: QueueStatus,
});

export const queuePrioritySchema = z.object({
  priority: z.coerce.number().int().min(0).max(10),
});

export const queueListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  status: QueueStatus.optional(),
  priority: z.coerce.number().int().min(0).max(10).optional(),
});

// Consultation Status Enum (from Prisma)
const ConsultationStatus = z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

// Consultation Validation Schemas
export const createConsultationSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  appointmentId: z.string().uuid().optional(),
  chiefComplaint: z.string().max(500).optional(),
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateConsultationSchema = createConsultationSchema.partial();

export const consultationStatusSchema = z.object({
  status: ConsultationStatus,
});

export const completeConsultationSchema = z.object({
  diagnosis: z.string().max(1000).optional(),
  notes: z.string().max(5000),
});

export const consultationListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  status: ConsultationStatus.optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

// Consultation Template Schema
export const consultationTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  template: z.record(z.unknown()),
});

// Prescription Status Enum (from Prisma)
const PrescriptionStatus = z.enum(['DRAFT', 'ISSUED', 'DISPENSED', 'CANCELLED', 'EXPIRED']);

// Prescription Validation Schemas
export const createPrescriptionSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  consultationId: z.string().uuid().optional(),
  medication: z.string().min(1).max(200),
  dosage: z.string().max(100).optional(),
  frequency: z.string().max(100).optional(),
  duration: z.string().max(100).optional(),
  instructions: z.string().max(1000).optional(),
});

export const updatePrescriptionSchema = createPrescriptionSchema.partial();

export const prescriptionStatusSchema = z.object({
  status: PrescriptionStatus,
});

export const prescriptionRefillSchema = z.object({
  dispensedBy: z.string().uuid().optional(),
  notes: z.string().max(500).optional(),
});

export const prescriptionListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  status: PrescriptionStatus.optional(),
  medication: z.string().optional(),
});

// Lab Order Status Enum (from Prisma)
const LabOrderStatus = z.enum(['ORDERED', 'SAMPLE_COLLECTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

// Lab Result Status Enum (from Prisma)
const LabResultStatus = z.enum(['PENDING', 'REVIEWED', 'APPROVED', 'REJECTED']);

// Lab Order Validation Schemas
export const createLabOrderSchema = z.object({
  patientId: z.string().uuid(),
  staffId: z.string().uuid().optional(),
  testType: z.string().min(1).max(100),
  notes: z.string().max(500).optional(),
});

export const updateLabOrderSchema = createLabOrderSchema.partial();

export const labOrderStatusSchema = z.object({
  status: LabOrderStatus,
});

export const labOrderListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  staffId: z.string().uuid().optional(),
  status: LabOrderStatus.optional(),
  testType: z.string().optional(),
});

// Lab Result Validation Schemas
export const createLabResultSchema = z.object({
  labOrderId: z.string().uuid(),
  resultType: z.string().min(1).max(100),
  resultValue: z.string().min(1).max(1000),
  notes: z.string().max(500).optional(),
});

export const updateLabResultSchema = createLabResultSchema.partial();

export const approveLabResultSchema = z.object({
  reviewedBy: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const rejectLabResultSchema = z.object({
  reviewedBy: z.string().uuid(),
  notes: z.string().max(500),
});

export const labResultListQuerySchema = paginationSchema.merge(sortSchema).extend({
  labOrderId: z.string().uuid().optional(),
  status: LabResultStatus.optional(),
  resultType: z.string().optional(),
});

// Type exports
export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;
export type UpdateAppointmentInput = z.infer<typeof updateAppointmentSchema>;
export type AppointmentListQuery = z.infer<typeof appointmentListQuerySchema>;

export type CreateQueueEntryInput = z.infer<typeof createQueueEntrySchema>;
export type UpdateQueueEntryInput = z.infer<typeof updateQueueEntrySchema>;
export type QueueListQuery = z.infer<typeof queueListQuerySchema>;

export type CreateConsultationInput = z.infer<typeof createConsultationSchema>;
export type UpdateConsultationInput = z.infer<typeof updateConsultationSchema>;
export type CompleteConsultationInput = z.infer<typeof completeConsultationSchema>;
export type ConsultationListQuery = z.infer<typeof consultationListQuerySchema>;

export type CreatePrescriptionInput = z.infer<typeof createPrescriptionSchema>;
export type UpdatePrescriptionInput = z.infer<typeof updatePrescriptionSchema>;
export type PrescriptionRefillInput = z.infer<typeof prescriptionRefillSchema>;
export type PrescriptionListQuery = z.infer<typeof prescriptionListQuerySchema>;

export type CreateLabOrderInput = z.infer<typeof createLabOrderSchema>;
export type UpdateLabOrderInput = z.infer<typeof updateLabOrderSchema>;
export type LabOrderListQuery = z.infer<typeof labOrderListQuerySchema>;

export type CreateLabResultInput = z.infer<typeof createLabResultSchema>;
export type UpdateLabResultInput = z.infer<typeof updateLabResultSchema>;
export type ApproveLabResultInput = z.infer<typeof approveLabResultSchema>;
export type RejectLabResultInput = z.infer<typeof rejectLabResultSchema>;
export type LabResultListQuery = z.infer<typeof labResultListQuerySchema>;
