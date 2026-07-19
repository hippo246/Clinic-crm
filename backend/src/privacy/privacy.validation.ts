import { z } from 'zod';

// ==================== PRIVACY REQUEST VALIDATION ====================

const privacyRequestTypeEnum = z.enum(['ACCESS', 'DELETION', 'CORRECTION', 'RESTRICTION']);
const privacyRequestStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'DENIED', 'EXPIRED']);

export const createPrivacyRequestSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  requestType: privacyRequestTypeEnum,
  metadata: z.record(z.any()).optional(),
});

export const updatePrivacyRequestSchema = z.object({
  status: privacyRequestStatusEnum.optional(),
  metadata: z.record(z.any()).optional(),
});

export const updatePrivacyRequestStatusSchema = z.object({
  status: privacyRequestStatusEnum,
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export const privacyRequestListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  patientId: z.string().uuid().optional(),
  requestType: privacyRequestTypeEnum.optional(),
  status: privacyRequestStatusEnum.optional(),
  sortBy: z.enum(['requestedAt', 'completedAt', 'status', 'requestType']).default('requestedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const privacyRequestIdParamSchema = z.object({
  id: z.string().uuid('Invalid privacy request ID'),
});

export const privacyRequestDecisionSchema = z.object({
  decision: z.enum(['APPROVE', 'REJECT']),
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export const privacyRequestCompletionSchema = z.object({
  completionDetails: z.string().max(1000, 'Completion details must be 1000 characters or less').optional(),
});

// ==================== CONSENT VALIDATION ====================

const consentStatusEnum = z.enum(['ACTIVE', 'EXPIRED', 'REVOKED', 'PENDING']);

export const createConsentRecordSchema = z.object({
  patientId: z.string().uuid('Invalid patient ID'),
  consentType: z.string().min(1, 'Consent type is required').max(100, 'Consent type must be 100 characters or less'),
  status: consentStatusEnum.optional().default('ACTIVE'),
  signedAt: z.coerce.date().optional(),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const updateConsentRecordSchema = z.object({
  consentType: z.string().min(1).max(100).optional(),
  status: consentStatusEnum.optional(),
  expiresAt: z.coerce.date().optional(),
  metadata: z.record(z.any()).optional(),
});

export const revokeConsentSchema = z.object({
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export const consentListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  patientId: z.string().uuid().optional(),
  consentType: z.string().optional(),
  status: consentStatusEnum.optional(),
  sortBy: z.enum(['signedAt', 'expiresAt', 'status', 'consentType']).default('signedAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const consentTypeSchema = z.object({
  consentType: z.string().min(1).max(100),
});

// ==================== COMMUNICATION PREFERENCE VALIDATION ====================

const communicationChannelEnum = z.enum(['EMAIL', 'SMS', 'PHONE', 'IN_PERSON', 'MAIL']);
const communicationPurposeEnum = z.enum(['APPOINTMENT', 'BILLING', 'CLINICAL', 'MARKETING', 'GENERAL', 'EMERGENCY']);

export const updateCommunicationPreferenceSchema = z.object({
  channel: communicationChannelEnum,
  preferred: z.boolean(),
  purpose: communicationPurposeEnum.optional(),
});

export const communicationPreferenceListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  patientId: z.string().uuid().optional(),
  channel: communicationChannelEnum.optional(),
  sortBy: z.enum(['createdAt', 'channel']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const optOutSchema = z.object({
  channel: communicationChannelEnum,
  purpose: communicationPurposeEnum,
  reason: z.string().max(500, 'Reason must be 500 characters or less').optional(),
});

export const optInSchema = z.object({
  channel: communicationChannelEnum,
  purpose: communicationPurposeEnum,
});

export const communicationChannelSchema = z.object({
  channel: communicationChannelEnum,
});

export const communicationPurposeSchema = z.object({
  purpose: communicationPurposeEnum,
});

// ==================== RETENTION VALIDATION ====================

export const retentionJobStatusEnum = z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED']);

export const createRetentionPolicySchema = z.object({
  policyName: z.string().min(1, 'Policy name is required').max(100, 'Policy name must be 100 characters or less'),
  auditLogsRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  securityEventsRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  workflowActivityRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  uiActivityRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  backupArchivesRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
});

export const updateRetentionPolicySchema = z.object({
  policyName: z.string().min(1).max(100).optional(),
  auditLogsRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  securityEventsRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  workflowActivityRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  uiActivityRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
  backupArchivesRetentionDays: z.coerce.number().int().min(30).max(36500).optional(),
});

export const retentionPolicyListQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  isActive: z.coerce.boolean().optional(),
  sortBy: z.enum(['policyName', 'createdAt', 'isActive']).default('policyName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export const retentionPreviewQuerySchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  dryRun: z.coerce.boolean().default(true),
});

export const retentionRunSchema = z.object({
  policyId: z.string().uuid('Invalid policy ID'),
  confirmation: z.string().refine((val) => val === 'APPLY RETENTION CLEANUP', {
    message: 'Confirmation must be exactly "APPLY RETENTION CLEANUP"',
  }),
  dryRun: z.coerce.boolean().default(false),
});

export const retentionRunIdParamSchema = z.object({
  id: z.string().uuid('Invalid retention run ID'),
});
