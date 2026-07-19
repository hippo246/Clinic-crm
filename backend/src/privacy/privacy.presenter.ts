import type { AuthenticatedUser } from '../auth/auth.types';

// ==================== PRIVACY REQUEST OUTPUT SHAPING ====================

export function shapePrivacyRequestOutput(request: any, user: AuthenticatedUser) {
  // Admin can see full operational privacy data
  if (user.roles.includes('admin')) {
    return {
      id: request.id,
      patientId: request.patientId,
      requestType: request.requestType,
      status: request.status,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
      events: request.events,
    };
  }

  // Auditor can view metadata/status safely
  if (user.roles.includes('auditor')) {
    return {
      id: request.id,
      patientId: request.patientId,
      requestType: request.requestType,
      status: request.status,
      requestedAt: request.requestedAt,
      completedAt: request.completedAt,
    };
  }

  // Doctor/nurse/receptionist only see patient-linked privacy data if permission allows
  if (user.permissions.includes('view_privacy')) {
    return {
      id: request.id,
      patientId: request.patientId,
      requestType: request.requestType,
      status: request.status,
      requestedAt: request.requestedAt,
    };
  }

  // Readonly view-only and safe
  if (user.permissions.includes('readonly')) {
    return {
      id: request.id,
      requestType: request.requestType,
      status: request.status,
    };
  }

  // Unknown role denied upstream
  return null;
}

// ==================== CONSENT OUTPUT SHAPING ====================

export function shapeConsentOutput(consent: any, user: AuthenticatedUser) {
  // Admin can see full operational privacy data
  if (user.roles.includes('admin')) {
    return {
      id: consent.id,
      patientId: consent.patientId,
      consentType: consent.consentType,
      status: consent.status,
      signedAt: consent.signedAt,
      expiresAt: consent.expiresAt,
    };
  }

  // Auditor can view metadata/status safely
  if (user.roles.includes('auditor')) {
    return {
      id: consent.id,
      patientId: consent.patientId,
      consentType: consent.consentType,
      status: consent.status,
      signedAt: consent.signedAt,
      expiresAt: consent.expiresAt,
    };
  }

  // Doctor/nurse/receptionist only see patient-linked consent data if permission allows
  if (user.permissions.includes('view_privacy')) {
    return {
      id: consent.id,
      patientId: consent.patientId,
      consentType: consent.consentType,
      status: consent.status,
      signedAt: consent.signedAt,
    };
  }

  // Readonly view-only and safe
  if (user.permissions.includes('readonly')) {
    return {
      id: consent.id,
      consentType: consent.consentType,
      status: consent.status,
    };
  }

  // Unknown role denied upstream
  return null;
}

// ==================== COMMUNICATION PREFERENCE OUTPUT SHAPING ====================

export function shapeCommunicationPreferenceOutput(preference: any, user: AuthenticatedUser) {
  // Admin can see full operational privacy data
  if (user.roles.includes('admin')) {
    return {
      id: preference.id,
      patientId: preference.patientId,
      channel: preference.channel,
      preferred: preference.preferred,
      createdAt: preference.createdAt,
      updatedAt: preference.updatedAt,
    };
  }

  // Auditor can view metadata/status safely
  if (user.roles.includes('auditor')) {
    return {
      id: preference.id,
      patientId: preference.patientId,
      channel: preference.channel,
      preferred: preference.preferred,
    };
  }

  // Doctor/nurse/receptionist only see patient-linked preference data if permission allows
  if (user.permissions.includes('view_privacy')) {
    return {
      id: preference.id,
      patientId: preference.patientId,
      channel: preference.channel,
      preferred: preference.preferred,
    };
  }

  // Readonly view-only and safe
  if (user.permissions.includes('readonly')) {
    return {
      id: preference.id,
      channel: preference.channel,
      preferred: preference.preferred,
    };
  }

  // Unknown role denied upstream
  return null;
}

// ==================== RETENTION POLICY OUTPUT SHAPING ====================

export function shapeRetentionPolicyOutput(policy: any, _user: AuthenticatedUser) {
  // Retention policies are admin-only, so if we get here user is admin
  return {
    id: policy.id,
    policyName: policy.policyName,
    auditLogsRetentionDays: policy.auditLogsRetentionDays,
    securityEventsRetentionDays: policy.securityEventsRetentionDays,
    workflowActivityRetentionDays: policy.workflowActivityRetentionDays,
    uiActivityRetentionDays: policy.uiActivityRetentionDays,
    backupArchivesRetentionDays: policy.backupArchivesRetentionDays,
    isActive: policy.isActive,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

// ==================== RETENTION RUN OUTPUT SHAPING ====================

export function shapeRetentionRunOutput(run: any, _user: AuthenticatedUser) {
  // Retention runs are admin-only, so if we get here user is admin
  return {
    id: run.id,
    policyId: run.policyId,
    status: run.status,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    recordsDeleted: run.recordsDeleted,
    error: run.error,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
  };
}
