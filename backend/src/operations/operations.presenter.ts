/**
 * Operations Output Shaping Helper
 * 
 * This helper shapes output for operations/admin APIs based on user roles.
 * It ensures that sensitive PII is only returned to authorized roles.
 */

interface User {
  roles: string[];
  permissions: string[];
}

/**
 * Check if user is admin
 */

/**
 * Check if user can view clinical data
 */

/**
 * Check if user can view staff PII
 */
function canViewStaffPII(user: User): boolean {
  return user.roles.includes('admin');
}

/**
 * Check if user can view billing data
 */
function canViewBillingData(user: User): boolean {
  return user.roles.includes('admin') || 
         user.roles.includes('billing') ||
         user.permissions.includes('view_billing');
}

/**
 * Check if user can view communication content
 */
function canViewCommunicationContent(user: User): boolean {
  return user.roles.includes('admin') || 
         user.roles.includes('doctor') || 
         user.roles.includes('nurse') ||
         user.permissions.includes('send_communications');
}

/**
 * Check if user can mutate
 */
function canMutate(user: User): boolean {
  return !user.roles.includes('auditor') && !user.roles.includes('readonly');
}

// ==================== DOCUMENT OUTPUT SHAPING ====================

export function shapeDocumentOutput(document: any, _user: User) {
  // All roles can view basic document metadata
  return {
    id: document.id,
    patientId: document.patientId,
    fileName: document.fileName,
    fileType: document.fileType,
    fileSize: document.fileSize,
    category: document.category,
    uploadedAt: document.uploadedAt,
    archivedAt: document.archivedAt,
    // storageKey is internal metadata
  };
}

// ==================== BILLING OUTPUT SHAPING ====================

export function shapeInvoiceOutput(invoice: any, user: User) {
  if (!canViewBillingData(user)) {
    // Non-billing roles get minimal info
    return {
      id: invoice.id,
      patientId: invoice.patientId,
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      issuedAt: invoice.issuedAt,
      dueDate: invoice.dueDate,
    };
  }

  // Billing/admin roles get full invoice
  return {
    id: invoice.id,
    patientId: invoice.patientId,
    invoiceNumber: invoice.invoiceNumber,
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    issuedAt: invoice.issuedAt,
    dueDate: invoice.dueDate,
    paidAt: invoice.paidAt,
    notes: invoice.notes,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

export function shapePaymentOutput(payment: any, user: User) {
  if (!canViewBillingData(user)) {
    // Non-billing roles get minimal info
    return {
      id: payment.id,
      invoiceId: payment.invoiceId,
      status: payment.status,
      paidAt: payment.paidAt,
    };
  }

  // Billing/admin roles get full payment
  return {
    id: payment.id,
    invoiceId: payment.invoiceId,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    status: payment.status,
    paidAt: payment.paidAt,
    reference: payment.reference,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
  };
}

export function shapeInsuranceOutput(insurance: any, user: User) {
  if (!canViewBillingData(user)) {
    // Non-billing roles get minimal info
    return {
      id: insurance.id,
      patientId: insurance.patientId,
      provider: insurance.provider,
      isActive: insurance.isActive,
    };
  }

  // Billing/admin roles get full insurance
  return {
    id: insurance.id,
    patientId: insurance.patientId,
    provider: insurance.provider,
    policyNumber: insurance.policyNumber,
    groupNumber: insurance.groupNumber,
    validFrom: insurance.validFrom,
    validTo: insurance.validTo,
    isActive: insurance.isActive,
    createdAt: insurance.createdAt,
    updatedAt: insurance.updatedAt,
  };
}

// ==================== COMMUNICATION OUTPUT SHAPING ====================

export function shapeCommunicationOutput(communication: any, user: User) {
  if (!canViewCommunicationContent(user)) {
    // Non-clinical roles get metadata only
    return {
      id: communication.id,
      patientId: communication.patientId,
      channel: communication.channel,
      status: communication.status,
      scheduledAt: communication.scheduledAt,
      sentAt: communication.sentAt,
      deliveredAt: communication.deliveredAt,
      createdBy: communication.createdBy,
      createdAt: communication.createdAt,
    };
  }

  // Clinical/admin roles get full communication
  return {
    id: communication.id,
    patientId: communication.patientId,
    channel: communication.channel,
    status: communication.status,
    subject: communication.subject,
    message: communication.message,
    scheduledAt: communication.scheduledAt,
    sentAt: communication.sentAt,
    deliveredAt: communication.deliveredAt,
    failedReason: communication.failedReason,
    createdBy: communication.createdBy,
    createdAt: communication.createdAt,
    updatedAt: communication.updatedAt,
  };
}

export function shapeCommunicationTemplateOutput(template: any, user: User) {
  if (!canViewCommunicationContent(user)) {
    // Non-clinical roles get metadata only
    return {
      id: template.id,
      name: template.name,
      channel: template.channel,
      isActive: template.isActive,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }

  // Clinical/admin roles get full template
  return {
    id: template.id,
    name: template.name,
    channel: template.channel,
    subject: template.subject,
    body: template.body,
    isActive: template.isActive,
    createdAt: template.createdAt,
    updatedAt: template.updatedAt,
  };
}

export function shapeCallLogOutput(callLog: any, user: User) {
  if (!canViewCommunicationContent(user)) {
    // Non-clinical roles get metadata only
    return {
      id: callLog.id,
      patientId: callLog.patientId,
      direction: callLog.direction,
      duration: callLog.duration,
      calledBy: callLog.calledBy,
      createdAt: callLog.createdAt,
    };
  }

  // Clinical/admin roles get full call log
  return {
    id: callLog.id,
    patientId: callLog.patientId,
    phoneNumber: callLog.phoneNumber,
    direction: callLog.direction,
    duration: callLog.duration,
    notes: callLog.notes,
    calledBy: callLog.calledBy,
    createdAt: callLog.createdAt,
  };
}

// ==================== STAFF OUTPUT SHAPING ====================

export function shapeStaffOutput(staff: any, user: User) {
  if (!canViewStaffPII(user)) {
    // Non-admin roles get minimal info
    return {
      id: staff.id,
      employeeId: staff.employeeId,
      firstName: staff.firstName,
      lastName: staff.lastName,
      department: staff.department,
      specialization: staff.specialization,
      status: staff.status,
    };
  }

  // Admin roles get full staff including PII
  return {
    id: staff.id,
    userId: staff.userId,
    employeeId: staff.employeeId,
    firstName: staff.firstName,
    lastName: staff.lastName,
    email: staff.email,
    phone: staff.phone,
    department: staff.department,
    specialization: staff.specialization,
    status: staff.status,
    createdAt: staff.createdAt,
    updatedAt: staff.updatedAt,
  };
}

// ==================== SETTINGS OUTPUT SHAPING ====================

export function shapeSettingsOutput(settings: any, _user: User) {
  // Settings are admin-only, so if we get here user is admin
  return settings;
}

// ==================== MUTATION PERMISSION HELPER ====================

export function canUserMutate(user: User): boolean {
  return canMutate(user);
}
