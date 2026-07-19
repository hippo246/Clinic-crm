import { z } from 'zod';

// Pagination and sorting helpers
const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const sortSchema = z.object({
  sortBy: z.string().default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// ==================== DOCUMENT VALIDATION ====================

export const createDocumentMetadataSchema = z.object({
  patientId: z.string().uuid().optional(),
  storageKey: z.string().min(1),
  fileName: z.string().min(1),
  fileType: z.string().min(1),
  fileSize: z.number().int().nonnegative(),
  category: z.string().optional(),
});

export const updateDocumentMetadataSchema = z.object({
  patientId: z.string().uuid().optional(),
  storageKey: z.string().min(1).optional(),
  fileName: z.string().min(1).optional(),
  fileType: z.string().min(1).optional(),
  fileSize: z.number().int().nonnegative().optional(),
  category: z.string().optional(),
});

export const documentListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  category: z.string().optional(),
  sortBy: z.enum(['createdAt', 'fileName', 'category', 'archivedAt']).default('createdAt'),
});

export const documentStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'ARCHIVED', 'DELETED']),
});

export const renewDocumentSchema = z.object({
  expiryDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const signDocumentSchema = z.object({
  signedBy: z.string().uuid(),
  signedAt: z.string().datetime(),
  notes: z.string().optional(),
});

// ==================== DOCUMENT FILE UPLOAD/DOWNLOAD VALIDATION ====================

export const uploadDocumentSchema = z.object({
  patientId: z.string().uuid().optional(),
  category: z.string().optional(),
});

export const documentDownloadQuerySchema = z.object({
  disposition: z.enum(['inline', 'attachment']).default('attachment'),
});

export const documentSignedUrlQuerySchema = z.object({
  expiresIn: z.coerce.number().int().min(60).max(900).default(300), // 1-15 minutes
});

export const documentFileReplaceSchema = z.object({
  // File replacement validation - no additional fields needed beyond file upload
});

export const documentFileArchiveSchema = z.object({
  reason: z.string().optional(),
});

export const documentFileAccessParamsSchema = z.object({
  documentId: z.string().uuid(),
});

// ==================== BILLING VALIDATION ====================

export const createInvoiceSchema = z.object({
  patientId: z.string().uuid(),
  invoiceNumber: z.string().optional(),
  totalAmount: z.number().nonnegative(),
  issuedAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const updateInvoiceSchema = z.object({
  patientId: z.string().uuid().optional(),
  invoiceNumber: z.string().optional(),
  totalAmount: z.number().nonnegative().optional(),
  issuedAt: z.string().datetime().optional(),
  dueDate: z.string().datetime().optional(),
  paidAt: z.string().datetime().optional(),
  notes: z.string().optional(),
});

export const createInvoiceItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
  totalPrice: z.number().nonnegative(),
});

export const updateInvoiceItemSchema = z.object({
  description: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().nonnegative().optional(),
  totalPrice: z.number().nonnegative().optional(),
});

export const createPaymentSchema = z.object({
  invoiceId: z.string().uuid(),
  amount: z.number().nonnegative(),
  paymentMethod: z.string().min(1),
  reference: z.string().optional(),
});

export const updatePaymentSchema = z.object({
  amount: z.number().nonnegative().optional(),
  paymentMethod: z.string().min(1).optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  reference: z.string().optional(),
});

export const createInsuranceRecordSchema = z.object({
  patientId: z.string().uuid(),
  provider: z.string().min(1),
  policyNumber: z.string().optional(),
  groupNumber: z.string().optional(),
  validFrom: z.string().datetime(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const updateInsuranceRecordSchema = z.object({
  provider: z.string().min(1).optional(),
  policyNumber: z.string().optional(),
  groupNumber: z.string().optional(),
  validFrom: z.string().datetime().optional(),
  validTo: z.string().datetime().optional(),
  isActive: z.boolean().optional(),
});

export const invoiceListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID', 'ARCHIVED']).optional(),
  sortBy: z.enum(['createdAt', 'issuedAt', 'dueDate', 'totalAmount']).default('createdAt'),
});

export const paymentListQuerySchema = paginationSchema.merge(sortSchema).extend({
  invoiceId: z.string().uuid().optional(),
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).optional(),
  sortBy: z.enum(['createdAt', 'paidAt', 'amount']).default('createdAt'),
});

export const invoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID', 'ARCHIVED']),
});

export const voidInvoiceSchema = z.object({
  reason: z.string().optional(),
});

// ==================== COMMUNICATION VALIDATION ====================

export const createCommunicationSchema = z.object({
  patientId: z.string().uuid(),
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']),
  subject: z.string().optional(),
  message: z.string().min(1),
  scheduledAt: z.string().datetime().optional(),
  purpose: z.enum(['APPOINTMENT', 'BILLING', 'CLINICAL', 'MARKETING', 'GENERAL', 'EMERGENCY']).optional(),
});

export const updateCommunicationSchema = z.object({
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']).optional(),
  subject: z.string().optional(),
  message: z.string().min(1).optional(),
  scheduledAt: z.string().datetime().optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED']).optional(),
});

export const scheduleCommunicationSchema = z.object({
  patientId: z.string().uuid(),
  templateId: z.string().uuid().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']),
  scheduledAt: z.string().datetime(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  metadata: z.record(z.unknown()).optional(),
  purpose: z.enum(['APPOINTMENT', 'BILLING', 'CLINICAL', 'MARKETING', 'GENERAL', 'EMERGENCY']).optional(),
});

export const communicationTemplateSchema = z.object({
  name: z.string().min(1),
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']),
  subject: z.string().optional(),
  body: z.string().min(1),
  isActive: z.boolean().optional(),
});

export const updateCommunicationTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  channel: z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']).optional(),
  subject: z.string().optional(),
  body: z.string().min(1).optional(),
  isActive: z.boolean().optional(),
});

export const createCallLogSchema = z.object({
  patientId: z.string().uuid().optional(),
  phoneNumber: z.string().min(1),
  direction: z.enum(['INCOMING', 'OUTGOING']),
  duration: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  calledBy: z.string().uuid().optional(),
});

export const updateCallLogSchema = z.object({
  phoneNumber: z.string().min(1).optional(),
  direction: z.enum(['INCOMING', 'OUTGOING']).optional(),
  duration: z.number().int().nonnegative().optional(),
  notes: z.string().optional(),
  calledBy: z.string().uuid().optional(),
});

export const communicationListQuerySchema = paginationSchema.merge(sortSchema).extend({
  patientId: z.string().uuid().optional(),
  channel: z.enum(['EMAIL', 'SMS', 'WHATSAPP', 'CALL', 'IN_PERSON']).optional(),
  status: z.enum(['DRAFT', 'SCHEDULED', 'SENT', 'DELIVERED', 'FAILED']).optional(),
  sortBy: z.enum(['createdAt', 'scheduledAt', 'sentAt']).default('createdAt'),
});

// ==================== STAFF VALIDATION ====================

export const createStaffSchema = z.object({
  userId: z.string().uuid().optional(),
  employeeId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
});

export const updateStaffSchema = z.object({
  userId: z.string().uuid().optional(),
  employeeId: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  specialization: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
});

export const staffListQuerySchema = paginationSchema.merge(sortSchema).extend({
  department: z.string().optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']).optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'department']).default('createdAt'),
});

export const staffStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'INACTIVE', 'ON_LEAVE', 'TERMINATED']),
});

export const createStaffScheduleSchema = z.object({
  staffId: z.string().uuid(),
  date: z.string().datetime(),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
});

export const updateStaffScheduleSchema = z.object({
  date: z.string().datetime().optional(),
  startTime: z.string().min(1).optional(),
  endTime: z.string().min(1).optional(),
});

// ==================== SETTINGS VALIDATION ====================

export const clinicSettingsSchema = z.object({
  settingKey: z.string().min(1),
  settingValue: z.string(),
  description: z.string().optional(),
});

export const systemSettingSchema = z.object({
  settingValue: z.string(),
  description: z.string().optional(),
});

export const settingsUpdateSchema = z.record(z.string(), z.unknown());

export const notificationSettingsSchema = z.object({
  emailEnabled: z.boolean().optional(),
  smsEnabled: z.boolean().optional(),
  whatsappEnabled: z.boolean().optional(),
});

// ==================== TYPE EXPORTS ====================

export type CreateDocumentMetadataInput = z.infer<typeof createDocumentMetadataSchema>;
export type UpdateDocumentMetadataInput = z.infer<typeof updateDocumentMetadataSchema>;
export type DocumentListQuery = z.infer<typeof documentListQuerySchema>;
export type DocumentStatusInput = z.infer<typeof documentStatusSchema>;
export type RenewDocumentInput = z.infer<typeof renewDocumentSchema>;
export type SignDocumentInput = z.infer<typeof signDocumentSchema>;

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.infer<typeof updateInvoiceSchema>;
export type CreateInvoiceItemInput = z.infer<typeof createInvoiceItemSchema>;
export type UpdateInvoiceItemInput = z.infer<typeof updateInvoiceItemSchema>;
export type CreatePaymentInput = z.infer<typeof createPaymentSchema>;
export type UpdatePaymentInput = z.infer<typeof updatePaymentSchema>;
export type CreateInsuranceRecordInput = z.infer<typeof createInsuranceRecordSchema>;
export type UpdateInsuranceRecordInput = z.infer<typeof updateInsuranceRecordSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
export type InvoiceStatusInput = z.infer<typeof invoiceStatusSchema>;
export type VoidInvoiceInput = z.infer<typeof voidInvoiceSchema>;

export type CreateCommunicationInput = z.infer<typeof createCommunicationSchema>;
export type UpdateCommunicationInput = z.infer<typeof updateCommunicationSchema>;
export type ScheduleCommunicationInput = z.infer<typeof scheduleCommunicationSchema>;
export type CommunicationTemplateInput = z.infer<typeof communicationTemplateSchema>;
export type UpdateCommunicationTemplateInput = z.infer<typeof updateCommunicationTemplateSchema>;
export type CreateCallLogInput = z.infer<typeof createCallLogSchema>;
export type UpdateCallLogInput = z.infer<typeof updateCallLogSchema>;
export type CommunicationListQuery = z.infer<typeof communicationListQuerySchema>;

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type StaffListQuery = z.infer<typeof staffListQuerySchema>;
export type StaffStatusInput = z.infer<typeof staffStatusSchema>;
export type CreateStaffScheduleInput = z.infer<typeof createStaffScheduleSchema>;
export type UpdateStaffScheduleInput = z.infer<typeof updateStaffScheduleSchema>;

export type ClinicSettingsInput = z.infer<typeof clinicSettingsSchema>;
export type SystemSettingInput = z.infer<typeof systemSettingSchema>;
export type SettingsUpdateInput = z.infer<typeof settingsUpdateSchema>;
export type NotificationSettingsInput = z.infer<typeof notificationSettingsSchema>;

// Type inference for document file operations
export type UploadDocumentInput = z.infer<typeof uploadDocumentSchema>;
