import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAuditEvent } from '../services/auditService';
import { validatePatientForWorkflow } from '../workflow/patientWorkflowGuard';
import {
  updateCommunicationPreferenceSchema,
  optOutSchema,
  optInSchema,
} from './privacy.validation';
import type { z } from 'zod';

type UpdateCommunicationPreferenceInput = z.infer<typeof updateCommunicationPreferenceSchema>;
type OptOutInput = z.infer<typeof optOutSchema>;
type OptInInput = z.infer<typeof optInSchema>;

/**
 * Get communication preferences for a patient
 */
export async function getCommunicationPreferences(patientId: string) {
  try {
    const preferences = await prisma.communicationPreference.findMany({
      where: { patientId },
    });

    return preferences;
  } catch (error) {
    logger.error('Failed to get communication preferences', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get communication preferences');
  }
}

/**
 * Update communication preference
 */
export async function updateCommunicationPreference(
  patientId: string,
  data: UpdateCommunicationPreferenceInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient exists and is active
    const patientValidation = await validatePatientForWorkflow(patientId);
    if (!patientValidation.valid) {
      throw new Error('Patient not suitable for communication preference update');
    }

    const preference = await prisma.communicationPreference.upsert({
      where: {
        patientId_channel: {
          patientId,
          channel: data.channel,
        },
      },
      create: {
        patientId,
        channel: data.channel,
        preferred: data.preferred,
      },
      update: {
        preferred: data.preferred,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_preference_updated',
      resourceType: 'communication_preference',
      resourceId: preference.id,
      actorId,
      actorRole,
      metadata: {
        preferenceId: preference.id,
        patientId,
        channel: data.channel,
        preferred: data.preferred,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication preference update audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return preference;
  } catch (error) {
    logger.error('Failed to update communication preference', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update communication preference');
  }
}

/**
 * Opt out of communication
 */
export async function optOutCommunication(
  patientId: string,
  data: OptOutInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient exists and is active
    const patientValidation = await validatePatientForWorkflow(patientId);
    if (!patientValidation.valid) {
      throw new Error('Patient not suitable for communication opt-out');
    }

    const preference = await prisma.communicationPreference.upsert({
      where: {
        patientId_channel: {
          patientId,
          channel: data.channel,
        },
      },
      create: {
        patientId,
        channel: data.channel,
        preferred: false,
      },
      update: {
        preferred: false,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_opted_out',
      resourceType: 'communication_preference',
      resourceId: preference.id,
      actorId,
      actorRole,
      metadata: {
        preferenceId: preference.id,
        patientId,
        channel: data.channel,
        purpose: data.purpose,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication opt-out audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return preference;
  } catch (error) {
    logger.error('Failed to opt out of communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to opt out of communication');
  }
}

/**
 * Opt in to communication
 */
export async function optInCommunication(
  patientId: string,
  data: OptInInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Validate patient exists and is active
    const patientValidation = await validatePatientForWorkflow(patientId);
    if (!patientValidation.valid) {
      throw new Error('Patient not suitable for communication opt-in');
    }

    const preference = await prisma.communicationPreference.upsert({
      where: {
        patientId_channel: {
          patientId,
          channel: data.channel,
        },
      },
      create: {
        patientId,
        channel: data.channel,
        preferred: true,
      },
      update: {
        preferred: true,
      },
    });

    // Log audit event
    await logAuditEvent({
      action: 'communication_opted_in',
      resourceType: 'communication_preference',
      resourceId: preference.id,
      actorId,
      actorRole,
      metadata: {
        preferenceId: preference.id,
        patientId,
        channel: data.channel,
        purpose: data.purpose,
      },
    }).catch((err) => {
      logger.warn('Failed to log communication opt-in audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return preference;
  } catch (error) {
    logger.error('Failed to opt in to communication', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to opt in to communication');
  }
}

/**
 * Check if patient has opted out for a channel/purpose
 */
export async function checkOptOutStatus(patientId: string, channel: string, purpose?: string) {
  try {
    const preference = await prisma.communicationPreference.findUnique({
      where: {
        patientId_channel: {
          patientId,
          channel: channel as any,
        },
      },
    });

    // If no preference exists, default to allowing appointment/clinical/billing but blocking marketing
    if (!preference) {
      if (purpose === 'MARKETING') {
        return true; // Block marketing by default without explicit consent
      }
      return false; // Allow other purposes by default
    }

    // If preference exists, check if opted out
    if (!preference.preferred) {
      // Emergency and clinical purposes may override opt-out
      if (purpose === 'EMERGENCY' || purpose === 'CLINICAL') {
        return false; // Allow emergency/clinical even if opted out
      }
      return true; // Block other purposes if opted out
    }

    return false; // Allow if opted in
  } catch (error) {
    logger.error('Failed to check opt-out status', { error: error instanceof Error ? error.message : 'Unknown error' });
    // Default to allowing if check fails
    return false;
  }
}
