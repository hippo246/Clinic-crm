import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { isPatientSuitableForWorkflow } from './clinicalSafety';

/**
 * Check if patient exists and is suitable for workflow operations
 */
export async function validatePatientForWorkflow(patientId: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: {
        id: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!patient) {
      return { valid: false, error: 'Patient not found' };
    }

    const safetyCheck = isPatientSuitableForWorkflow(patient);
    
    if (!safetyCheck.valid) {
      return safetyCheck;
    }

    return { valid: true };
  } catch (error) {
    logger.error('Failed to validate patient for workflow', { error: error instanceof Error ? error.message : 'Unknown error' });
    return { valid: false, error: 'Failed to validate patient' };
  }
}
