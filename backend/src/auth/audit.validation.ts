import { z } from 'zod';

export const auditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine((data) => {
  // Validate date range
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (from > to) {
      return false;
    }
  }
  return true;
}, {
  message: 'dateFrom must be before dateTo',
});

export const adminAuditQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  module: z.string().optional(),
  actor: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (from > to) {
      return false;
    }
  }
  return true;
}, {
  message: 'dateFrom must be before dateTo',
});

export const securityEventQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  eventType: z.string().optional(),
  severity: z.enum(['low', 'medium', 'high']).optional(),
  userId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (from > to) {
      return false;
    }
  }
  return true;
}, {
  message: 'dateFrom must be before dateTo',
});

export const deniedActionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (from > to) {
      return false;
    }
  }
  return true;
}, {
  message: 'dateFrom must be before dateTo',
});

export const destructiveActionQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  action: z.string().optional(),
  resourceType: z.string().optional(),
  actorId: z.string().uuid().optional(),
  dateFrom: z.string().datetime().optional(),
  dateTo: z.string().datetime().optional(),
}).refine((data) => {
  if (data.dateFrom && data.dateTo) {
    const from = new Date(data.dateFrom);
    const to = new Date(data.dateTo);
    if (from > to) {
      return false;
    }
  }
  return true;
}, {
  message: 'dateFrom must be before dateTo',
});

export type AuditQueryInput = z.infer<typeof auditQuerySchema>;
export type AdminAuditQueryInput = z.infer<typeof adminAuditQuerySchema>;
export type SecurityEventQueryInput = z.infer<typeof securityEventQuerySchema>;
export type DeniedActionQueryInput = z.infer<typeof deniedActionQuerySchema>;
export type DestructiveActionQueryInput = z.infer<typeof destructiveActionQuerySchema>;
