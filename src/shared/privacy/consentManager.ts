/**
 * Consent Manager Service
 * 
 * This module handles consent management with versioning, history tracking,
 * and expiration detection.
 * 
 * All consent records store patientId only - no patientName or clinical PHI.
 */

export type ConsentType =
  | 'treatment_consent'
  | 'data_processing_consent'
  | 'communication_consent'
  | 'research_consent'
  | 'abdm_consent'
  | 'marketing_consent';

export type ConsentStatus = 'granted' | 'revoked' | 'expired' | 'pending';

export interface ConsentRecord {
  id: string;
  patientId: string;
  consentType: ConsentType;
  status: ConsentStatus;
  version: number;
  grantedAt?: string;
  revokedAt?: string;
  expiresAt?: string;
  changedBy: string;
  source: string;
  requestId?: string; // If tied to privacy request
  previousStatus?: ConsentStatus;
}

export interface ConsentHistoryEntry {
  timestamp: string;
  consentType: ConsentType;
  status: ConsentStatus;
  version: number;
  changedBy: string;
  source: string;
}

const CONSENT_RECORDS_KEY = 'clinic_crm_consent_records';

/**
 * Generate a unique consent ID
 */
function generateConsentId(): string {
  return `CONSENT-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Get all consent records from localStorage
 */
function getConsentRecords(): ConsentRecord[] {
  try {
    const raw = localStorage.getItem(CONSENT_RECORDS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('Error reading consent records:', e);
    return [];
  }
}

/**
 * Save consent records to localStorage
 */
function saveConsentRecords(records: ConsentRecord[]): void {
  try {
    localStorage.setItem(CONSENT_RECORDS_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('Error saving consent records:', e);
  }
}

/**
 * Get current version for a consent type for a patient
 */
function getCurrentVersion(patientId: string, consentType: ConsentType): number {
  const records = getConsentRecords();
  const patientRecords = records.filter(r => r.patientId === patientId && r.consentType === consentType);
  if (patientRecords.length === 0) return 0;
  return Math.max(...patientRecords.map(r => r.version));
}

/**
 * Grant consent
 */
export function grantConsent(
  patientId: string,
  consentType: ConsentType,
  changedBy: string,
  source: string,
  expiresAt?: string,
  requestId?: string
): ConsentRecord | null {
  const currentVersion = getCurrentVersion(patientId, consentType);
  const newVersion = currentVersion + 1;

  const consent: ConsentRecord = {
    id: generateConsentId(),
    patientId,
    consentType,
    status: 'granted',
    version: newVersion,
    grantedAt: new Date().toISOString(),
    expiresAt,
    changedBy,
    source,
    requestId,
    previousStatus: undefined
  };

  const records = getConsentRecords();
  records.push(consent);
  saveConsentRecords(records);

  return consent;
}

/**
 * Revoke consent
 */
export function revokeConsent(
  patientId: string,
  consentType: ConsentType,
  changedBy: string,
  source: string,
  requestId?: string
): ConsentRecord | null {
  const records = getConsentRecords();
  const currentVersion = getCurrentVersion(patientId, consentType);
  const newVersion = currentVersion + 1;

  // Find current granted consent
  const currentConsent = records.find(
    r => r.patientId === patientId && r.consentType === consentType && r.status === 'granted'
  );

  if (!currentConsent) {
    console.error('No active consent to revoke');
    return null;
  }

  const revokedConsent: ConsentRecord = {
    id: generateConsentId(),
    patientId,
    consentType,
    status: 'revoked',
    version: newVersion,
    revokedAt: new Date().toISOString(),
    changedBy,
    source,
    requestId,
    previousStatus: 'granted'
  };

  records.push(revokedConsent);
  saveConsentRecords(records);

  return revokedConsent;
}

/**
 * Get current consent status for a patient and consent type
 */
export function getConsentStatus(patientId: string, consentType: ConsentType): ConsentStatus | null {
  const records = getConsentRecords();
  const patientRecords = records.filter(r => r.patientId === patientId && r.consentType === consentType);
  
  if (patientRecords.length === 0) return null;
  
  // Get the most recent record
  const latest = patientRecords.sort((a, b) => b.version - a.version)[0];
  
  // Check if expired
  if (latest.status === 'granted' && latest.expiresAt) {
    const expiryDate = new Date(latest.expiresAt);
    if (expiryDate < new Date()) {
      // Mark as expired
      latest.status = 'expired';
      saveConsentRecords(records);
      return 'expired';
    }
  }
  
  return latest.status;
}

/**
 * Get all consents for a patient
 */
export function getPatientConsents(patientId: string): ConsentRecord[] {
  const records = getConsentRecords();
  return records.filter(r => r.patientId === patientId);
}

/**
 * Get consent history for a patient
 */
export function getConsentHistory(patientId: string): ConsentHistoryEntry[] {
  const records = getConsentRecords();
  const patientRecords = records.filter(r => r.patientId === patientId);
  
  return patientRecords.map(r => ({
    timestamp: r.grantedAt || r.revokedAt || new Date().toISOString(),
    consentType: r.consentType,
    status: r.status,
    version: r.version,
    changedBy: r.changedBy,
    source: r.source
  })).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

/**
 * Check if consent is expiring soon (within 30 days)
 */
export function isConsentExpiringSoon(patientId: string, consentType: ConsentType): boolean {
  const records = getConsentRecords();
  const patientRecords = records.filter(
    r => r.patientId === patientId && r.consentType === consentType && r.status === 'granted'
  );
  
  if (patientRecords.length === 0) return false;
  
  const latest = patientRecords.sort((a, b) => b.version - a.version)[0];
  
  if (!latest.expiresAt) return false;
  
  const expiryDate = new Date(latest.expiresAt);
  const thirtyDaysFromNow = new Date();
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
  
  return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
}

/**
 * Get all expiring consents for a patient
 */
export function getExpiringConsents(patientId: string): ConsentRecord[] {
  const records = getConsentRecords();
  const patientRecords = records.filter(r => r.patientId === patientId && r.status === 'granted');
  
  return patientRecords.filter(r => {
    if (!r.expiresAt) return false;
    const expiryDate = new Date(r.expiresAt);
    const thirtyDaysFromNow = new Date();
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
    return expiryDate <= thirtyDaysFromNow && expiryDate > new Date();
  });
}

/**
 * Get all expired consents for a patient
 */
export function getExpiredConsents(patientId: string): ConsentRecord[] {
  const records = getConsentRecords();
  const patientRecords = records.filter(r => r.patientId === patientId && r.status === 'granted');
  
  const expired: ConsentRecord[] = [];
  
  patientRecords.forEach(r => {
    if (!r.expiresAt) return;
    const expiryDate = new Date(r.expiresAt);
    if (expiryDate < new Date()) {
      r.status = 'expired';
      expired.push(r);
    }
  });
  
  if (expired.length > 0) {
    saveConsentRecords(records);
  }
  
  return expired;
}

/**
 * Update consent expiry date
 */
export function updateConsentExpiry(
  patientId: string,
  consentType: ConsentType,
  newExpiryDate: string,
  changedBy: string,
  source: string
): boolean {
  const records = getConsentRecords();
  const currentConsent = records.find(
    r => r.patientId === patientId && r.consentType === consentType && r.status === 'granted'
  );
  
  if (!currentConsent) {
    console.error('No active consent to update');
    return false;
  }
  
  currentConsent.expiresAt = newExpiryDate;
  currentConsent.changedBy = changedBy;
  currentConsent.source = source;
  
  saveConsentRecords(records);
  return true;
}

/**
 * Get consent summary for a patient
 */
export function getConsentSummary(patientId: string): {
  total: number;
  granted: number;
  revoked: number;
  expired: number;
  expiringSoon: number;
} {
  const consents = getPatientConsents(patientId);
  
  const summary = {
    total: consents.length,
    granted: 0,
    revoked: 0,
    expired: 0,
    expiringSoon: 0
  };
  
  consents.forEach(c => {
    if (c.status === 'granted') {
      if (isConsentExpiringSoon(patientId, c.consentType)) {
        summary.expiringSoon++;
      } else {
        summary.granted++;
      }
    } else if (c.status === 'revoked') {
      summary.revoked++;
    } else if (c.status === 'expired') {
      summary.expired++;
    }
  });
  
  return summary;
}
