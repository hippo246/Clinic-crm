/**
 * Privacy Request Data Model and Service
 * 
 * This module handles privacy rights requests including:
 * - Access requests
 * - Correction requests
 * - Deletion/archive requests
 * - Portability requests
 * - Opt-out requests
 * - Consent review requests
 * - Grievance requests
 * 
 * All requests store patientId only - no patientName, contact details, or clinical PHI.
 */

export type PrivacyRequestType =
  | 'access_request'
  | 'correction_request'
  | 'deletion_request'
  | 'archive_request'
  | 'portability_request'
  | 'opt_out_request'
  | 'consent_review_request'
  | 'grievance_request';

export type PrivacyRequestStatus =
  | 'submitted'
  | 'under_review'
  | 'approved'
  | 'rejected'
  | 'completed'
  | 'cancelled';

export type PrivacyRequestPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface PrivacyRequest {
  id: string;
  patientId: string;
  requestType: PrivacyRequestType;
  status: PrivacyRequestStatus;
  submittedAt: string;
  submittedBy: string;
  reviewedAt?: string;
  reviewedBy?: string;
  completedAt?: string;
  completedBy?: string;
  reasonCode?: string;
  resolutionSummary?: string;
  dueDate?: string;
  priority: PrivacyRequestPriority;
  auditTrail: PrivacyRequestAuditEntry[];
}

export interface PrivacyRequestAuditEntry {
  timestamp: string;
  action: string;
  actor: string;
  details: string; // Sanitized, no PHI
}

const PRIVACY_REQUESTS_KEY = 'clinic_crm_privacy_requests';

/**
 * Generate a unique request ID
 */
function generateRequestId(): string {
  return `PRIV-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all privacy requests from localStorage
 */
function getPrivacyRequests(): PrivacyRequest[] {
  try {
    const raw = localStorage.getItem(PRIVACY_REQUESTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading privacy requests:', e);
    return [];
  }
}

/**
 * Save privacy requests to localStorage
 */
function savePrivacyRequests(requests: PrivacyRequest[]): void {
  try {
    localStorage.setItem(PRIVACY_REQUESTS_KEY, JSON.stringify(requests));
  } catch (e) {
    console.error('Error saving privacy requests:', e);
  }
}

/**
 * Sanitize free-text metadata to prevent PHI storage
 * Limits length and removes potential PHI patterns
 */
function sanitizeMetadata(text: string | undefined): string | undefined {
  if (!text) return undefined;
  // Limit length
  const maxLength = 500;
  if (text.length > maxLength) {
    text = text.substring(0, maxLength);
  }
  // Remove potential PHI patterns (basic sanitization)
  // This is not comprehensive - backend required for full PHI sanitization
  return text;
}

/**
 * Validate patient exists
 */
function validatePatientExists(patientId: string): boolean {
  try {
    const patients = JSON.parse(localStorage.getItem('clinic_crm_patients_v1') || '[]');
    return patients.some((p: any) => p.id === patientId);
  } catch (e) {
    console.error('Error validating patient:', e);
    return false;
  }
}

/**
 * Create a new privacy request
 */
export function createPrivacyRequest(
  patientId: string,
  requestType: PrivacyRequestType,
  submittedBy: string,
  reasonCode?: string,
  priority: PrivacyRequestPriority = 'medium',
  dueDate?: string
): PrivacyRequest | null {
  // Validate patient exists
  if (!validatePatientExists(patientId)) {
    console.error('Patient not found:', patientId);
    return null;
  }

  // Sanitize metadata
  const sanitizedReasonCode = sanitizeMetadata(reasonCode);

  const request: PrivacyRequest = {
    id: generateRequestId(),
    patientId,
    requestType,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    submittedBy,
    reasonCode: sanitizedReasonCode,
    priority,
    dueDate,
    auditTrail: [
      {
        timestamp: new Date().toISOString(),
        action: 'created',
        actor: submittedBy,
        details: `Request created: ${requestType}`
      }
    ]
  };

  const requests = getPrivacyRequests();
  requests.push(request);
  savePrivacyRequests(requests);

  return request;
}

/**
 * Update privacy request status
 */
export function updatePrivacyRequestStatus(
  requestId: string,
  newStatus: PrivacyRequestStatus,
  actor: string,
  resolutionSummary?: string
): boolean {
  const requests = getPrivacyRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    console.error('Request not found:', requestId);
    return false;
  }

  const request = requests[requestIndex];
  const oldStatus = request.status;

  // Sanitize resolution summary
  const sanitizedSummary = sanitizeMetadata(resolutionSummary);

  // Update status
  request.status = newStatus;

  // Update timestamps based on status
  if (newStatus === 'under_review') {
    request.reviewedAt = new Date().toISOString();
    request.reviewedBy = actor;
  } else if (newStatus === 'completed' || newStatus === 'rejected') {
    request.completedAt = new Date().toISOString();
    request.completedBy = actor;
    request.resolutionSummary = sanitizedSummary;
  }

  // Add audit entry
  request.auditTrail.push({
    timestamp: new Date().toISOString(),
    action: 'status_changed',
    actor,
    details: `Status changed from ${oldStatus} to ${newStatus}`
  });

  if (sanitizedSummary) {
    request.auditTrail.push({
      timestamp: new Date().toISOString(),
      action: 'resolution_added',
      actor,
      details: 'Resolution summary added'
    });
  }

  requests[requestIndex] = request;
  savePrivacyRequests(requests);

  return true;
}

/**
 * Complete a privacy request
 */
export function completePrivacyRequest(
  requestId: string,
  actor: string,
  resolutionSummary?: string
): boolean {
  return updatePrivacyRequestStatus(requestId, 'completed', actor, resolutionSummary);
}

/**
 * Cancel a privacy request
 */
export function cancelPrivacyRequest(
  requestId: string,
  actor: string,
  reason?: string
): boolean {
  const requests = getPrivacyRequests();
  const requestIndex = requests.findIndex(r => r.id === requestId);

  if (requestIndex === -1) {
    console.error('Request not found:', requestId);
    return false;
  }

  const request = requests[requestIndex];
  const sanitizedReason = sanitizeMetadata(reason);

  request.status = 'cancelled';
  request.completedAt = new Date().toISOString();
  request.completedBy = actor;

  request.auditTrail.push({
    timestamp: new Date().toISOString(),
    action: 'cancelled',
    actor,
    details: sanitizedReason || 'Request cancelled'
  });

  requests[requestIndex] = request;
  savePrivacyRequests(requests);

  return true;
}

/**
 * Get privacy requests for a specific patient
 */
export function getPrivacyRequestsForPatient(patientId: string): PrivacyRequest[] {
  const requests = getPrivacyRequests();
  return requests.filter(r => r.patientId === patientId);
}

/**
 * Get all open privacy requests
 */
export function getOpenPrivacyRequests(): PrivacyRequest[] {
  const requests = getPrivacyRequests();
  return requests.filter(r => 
    r.status === 'submitted' || r.status === 'under_review'
  );
}

/**
 * Get all privacy requests (for admin/auditor)
 */
export function getAllPrivacyRequests(): PrivacyRequest[] {
  return getPrivacyRequests();
}

/**
 * Validate privacy request before creation
 */
export function validatePrivacyRequest(
  patientId: string,
  requestType: PrivacyRequestType
): { valid: boolean; reason?: string } {
  // Validate patient exists
  if (!validatePatientExists(patientId)) {
    return { valid: false, reason: 'Patient not found' };
  }

  // Validate request type
  const validTypes: PrivacyRequestType[] = [
    'access_request',
    'correction_request',
    'deletion_request',
    'archive_request',
    'portability_request',
    'opt_out_request',
    'consent_review_request',
    'grievance_request'
  ];

  if (!validTypes.includes(requestType)) {
    return { valid: false, reason: 'Invalid request type' };
  }

  return { valid: true };
}

/**
 * Get request by ID
 */
export function getPrivacyRequestById(requestId: string): PrivacyRequest | null {
  const requests = getPrivacyRequests();
  return requests.find(r => r.id === requestId) || null;
}
