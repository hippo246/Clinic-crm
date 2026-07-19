/**
 * Communication Opt-Out Manager Service
 * 
 * This module handles communication preferences and opt-out management.
 * 
 * All preferences store patientId only - no patientName or contact details.
 */

export type CommunicationChannel =
  | 'sms'
  | 'whatsapp'
  | 'email'
  | 'phone_call'
  | 'marketing'
  | 'appointment_reminders'
  | 'billing_notifications'
  | 'clinical_notifications';

export interface CommunicationPreferences {
  patientId: string;
  preferences: Record<CommunicationChannel, boolean>;
  updatedAt: string;
  updatedBy: string;
}

const COMMUNICATION_PREFERENCES_KEY = 'clinic_crm_communication_preferences';

/**
 * Get communication preferences for a patient
 */
export function getCommunicationPreferences(patientId: string): CommunicationPreferences | null {
  try {
    const raw = localStorage.getItem(COMMUNICATION_PREFERENCES_KEY);
    if (!raw) return null;
    const all = JSON.parse(raw);
    return all[patientId] || null;
  } catch (e) {
    console.error('Error reading communication preferences:', e);
    return null;
  }
}

/**
 * Save communication preferences for a patient
 */
function saveCommunicationPreferences(preferences: CommunicationPreferences): void {
  try {
    const raw = localStorage.getItem(COMMUNICATION_PREFERENCES_KEY);
    const all = raw ? JSON.parse(raw) : {};
    all[preferences.patientId] = preferences;
    localStorage.setItem(COMMUNICATION_PREFERENCES_KEY, JSON.stringify(all));
  } catch (e) {
    console.error('Error saving communication preferences:', e);
  }
}

/**
 * Set default communication preferences for a patient
 */
export function setDefaultCommunicationPreferences(
  patientId: string,
  updatedBy: string
): CommunicationPreferences {
  const preferences: CommunicationPreferences = {
    patientId,
    preferences: {
      sms: true,
      whatsapp: true,
      email: true,
      phone_call: true,
      marketing: false,
      appointment_reminders: true,
      billing_notifications: true,
      clinical_notifications: true
    },
    updatedAt: new Date().toISOString(),
    updatedBy
  };
  
  saveCommunicationPreferences(preferences);
  return preferences;
}

/**
 * Update a single communication preference
 */
export function updateCommunicationPreference(
  patientId: string,
  channel: CommunicationChannel,
  optedOut: boolean,
  updatedBy: string
): boolean {
  let preferences = getCommunicationPreferences(patientId);
  
  if (!preferences) {
    preferences = setDefaultCommunicationPreferences(patientId, updatedBy);
  }
  
  preferences.preferences[channel] = !optedOut; // true = opted in, false = opted out
  preferences.updatedAt = new Date().toISOString();
  preferences.updatedBy = updatedBy;
  
  saveCommunicationPreferences(preferences);
  return true;
}

/**
 * Check if a channel is opted out for a patient
 */
export function isChannelOptedOut(patientId: string, channel: CommunicationChannel): boolean {
  const preferences = getCommunicationPreferences(patientId);
  
  if (!preferences) {
    // Default: marketing is opted out, others are opted in
    return channel === 'marketing';
  }
  
  return !preferences.preferences[channel];
}

/**
 * Check if communication is allowed for a channel
 * Clinical/safety-critical communications may be allowed even if opted out
 */
export function isCommunicationAllowed(
  patientId: string,
  channel: CommunicationChannel,
  isClinicalCritical: boolean = false
): boolean {
  // Clinical critical communications are always allowed
  if (isClinicalCritical && (channel === 'clinical_notifications' || channel === 'appointment_reminders')) {
    return true;
  }
  
  // Marketing is always blocked if opted out
  if (channel === 'marketing') {
    return !isChannelOptedOut(patientId, channel);
  }
  
  // Other channels respect opt-out
  return !isChannelOptedOut(patientId, channel);
}

/**
 * Get all opted-out channels for a patient
 */
export function getOptedOutChannels(patientId: string): CommunicationChannel[] {
  const preferences = getCommunicationPreferences(patientId);
  
  if (!preferences) {
    return ['marketing']; // Default marketing opt-out
  }
  
  const optedOut: CommunicationChannel[] = [];
  
  Object.entries(preferences.preferences).forEach(([channel, optedIn]) => {
    if (!optedIn) {
      optedOut.push(channel as CommunicationChannel);
    }
  });
  
  return optedOut;
}

/**
 * Reset communication preferences to defaults
 */
export function resetCommunicationPreferences(
  patientId: string,
  updatedBy: string
): CommunicationPreferences {
  return setDefaultCommunicationPreferences(patientId, updatedBy);
}
