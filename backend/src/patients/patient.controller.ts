import { Response } from 'express';
import { logger } from '../utils/logger';
import { 
  createPatient as createPatientService,
  getPatientById as getPatientByIdService,
  listPatients as listPatientsService,
  updatePatient as updatePatientService,
  archivePatient as archivePatientService,
  restorePatient as restorePatientService,
  getPatientAuditTrail as getPatientAuditTrailService,
  createPatientNote as createPatientNoteService,
  updatePatientNote as updatePatientNoteService,
  deletePatientNote as deletePatientNoteService,
  addPatientTimelineEvent as addPatientTimelineEventService,
  getPatientTimelineEvents as getPatientTimelineEventsService,
  getPatientNotes as getPatientNotesService,
} from './patient.service';
import { 
  createPatientSchema,
  updatePatientSchema,
  patientListQuerySchema,
  archivePatientSchema,
  patientNoteCreateSchema,
  patientNoteUpdateSchema,
  patientTimelineEventCreateSchema,
} from './patient.validation';
import { 
  shapePatientOutput, 
  shapePatientListOutput,
  shapePatientNoteOutput,
  shapePatientNoteListOutput,
  shapePatientTimelineEventOutput,
  shapePatientTimelineEventListOutput,
  determineUserRole,
} from './patient.presenter';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';
import { logAuditEvent } from '../services/auditService';

/**
 * Create patient controller
 */
export async function createPatient(req: AuthenticatedRequest, res: Response) {
  try {
    // Validate request body
    const validatedData = createPatientSchema.parse(req.body);

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create patients', 403);
      return;
    }

    const patient = await createPatientService(
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedPatient = shapePatientOutput(patient, determineUserRole(req.user.roles));

    successResponse(res, shapedPatient, 'Patient created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create patient controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create patient', 500);
  }
}

/**
 * Get patient by ID controller
 */
export async function getPatientById(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if user has view permission
    if (!req.user?.permissions.includes('view_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view patients', 403);
      return;
    }

    const includeArchived = req.user.roles.includes('admin');
    const patient = await getPatientByIdService(id, includeArchived);

    if (!patient) {
      errorResponse(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }

    const shapedPatient = shapePatientOutput(patient, determineUserRole(req.user.roles));

    // Log patient view (optional - depends on strategy)
    await logAuditEvent({
      action: 'patient_viewed',
      resourceType: 'patient',
      resourceId: patient.id,
      actorId: req.user.id,
      actorRole: req.user.roles.join(','),
      metadata: {
        patientId: patient.id,
      },
    }).catch((err) => {
      logger.warn('Failed to log patient view audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    successResponse(res, shapedPatient, 'Patient retrieved successfully');
  } catch (error) {
    logger.error('Get patient by ID controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get patient', 500);
  }
}

/**
 * List patients controller
 */
export async function listPatients(req: AuthenticatedRequest, res: Response) {
  try {
    // Validate query parameters
    const validatedQuery = patientListQuerySchema.parse(req.query);

    // Check if user has view permission
    if (!req.user?.permissions.includes('view_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view patients', 403);
      return;
    }

    const includeArchived = req.user.roles.includes('admin') && validatedQuery.includeArchived;
    const result = await listPatientsService(validatedQuery, includeArchived);

    const shapedPatients = shapePatientListOutput(result.patients, determineUserRole(req.user.roles));

    successResponse(res, {
      patients: shapedPatients,
      total: result.total,
      page: result.page,
      limit: result.limit,
      totalPages: result.totalPages,
    }, 'Patients retrieved successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid query parameters', 400);
      return;
    }
    logger.error('List patients controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to list patients', 500);
  }
}

/**
 * Update patient controller
 */
export async function updatePatient(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = updatePatientSchema.parse(req.body);

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update patients', 403);
      return;
    }

    const patient = await updatePatientService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedPatient = shapePatientOutput(patient, determineUserRole(req.user.roles));

    successResponse(res, shapedPatient, 'Patient updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Patient not found') {
      errorResponse(res, 'NOT_FOUND', 'Patient not found', 404);
      return;
    }
    logger.error('Update patient controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update patient', 500);
  }
}

/**
 * Archive patient controller
 */
export async function archivePatient(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = archivePatientSchema.parse(req.body);

    // Check if user has delete permission or is admin
    if (!req.user?.permissions.includes('delete_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to archive patients', 403);
      return;
    }

    const patient = await archivePatientService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedPatient = shapePatientOutput(patient, determineUserRole(req.user.roles));

    successResponse(res, shapedPatient, 'Patient archived successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Archive patient controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to archive patient', 500);
  }
}

/**
 * Restore patient controller
 */
export async function restorePatient(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if user has delete permission or is admin
    if (!req.user?.permissions.includes('delete_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to restore patients', 403);
      return;
    }

    const patient = await restorePatientService(
      id,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedPatient = shapePatientOutput(patient, determineUserRole(req.user.roles));

    successResponse(res, shapedPatient, 'Patient restored successfully');
  } catch (error) {
    logger.error('Restore patient controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to restore patient', 500);
  }
}

/**
 * Get patient audit trail controller
 */
export async function getPatientAuditTrail(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if user has audit view permission or is admin/auditor
    if (!req.user?.permissions.includes('view_audit') && 
        !req.user?.roles.includes('admin') && 
        !req.user?.roles.includes('auditor')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view audit trail', 403);
      return;
    }

    const auditLogs = await getPatientAuditTrailService(id);

    successResponse(res, auditLogs, 'Audit trail retrieved successfully');
  } catch (error) {
    logger.error('Get patient audit trail controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get audit trail', 500);
  }
}

/**
 * Get patient timeline events controller
 */
export async function getPatientTimelineEvents(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if user has view permission
    if (!req.user?.permissions.includes('view_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view patient timeline', 403);
      return;
    }

    const events = await getPatientTimelineEventsService(id);
    const shapedEvents = shapePatientTimelineEventListOutput(events);

    successResponse(res, shapedEvents, 'Timeline events retrieved successfully');
  } catch (error) {
    logger.error('Get patient timeline events controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get timeline events', 500);
  }
}

/**
 * Add patient timeline event controller
 */
export async function addPatientTimelineEvent(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = patientTimelineEventCreateSchema.parse(req.body);

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to add timeline events', 403);
      return;
    }

    const event = await addPatientTimelineEventService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedEvent = shapePatientTimelineEventOutput(event);

    successResponse(res, shapedEvent, 'Timeline event added successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Add patient timeline event controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to add timeline event', 500);
  }
}

/**
 * Get patient notes controller
 */
export async function getPatientNotes(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Check if user has view permission
    if (!req.user?.permissions.includes('view_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view patient notes', 403);
      return;
    }

    const notes = await getPatientNotesService(id);
    const shapedNotes = shapePatientNoteListOutput(notes);

    successResponse(res, shapedNotes, 'Patient notes retrieved successfully');
  } catch (error) {
    logger.error('Get patient notes controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get patient notes', 500);
  }
}

/**
 * Create patient note controller
 */
export async function createPatientNote(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    // Validate request body
    const validatedData = patientNoteCreateSchema.parse(req.body);

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to create patient notes', 403);
      return;
    }

    const note = await createPatientNoteService(
      id,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedNote = shapePatientNoteOutput(note);

    successResponse(res, shapedNote, 'Patient note created successfully', 201);
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Create patient note controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to create patient note', 500);
  }
}

/**
 * Update patient note controller
 */
export async function updatePatientNote(req: AuthenticatedRequest, res: Response) {
  try {
    const { noteId } = req.params;

    // Validate request body
    const validatedData = patientNoteUpdateSchema.parse(req.body);

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update patient notes', 403);
      return;
    }

    const note = await updatePatientNoteService(
      noteId,
      validatedData,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedNote = shapePatientNoteOutput(note);

    successResponse(res, shapedNote, 'Patient note updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Update patient note controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update patient note', 500);
  }
}

/**
 * Delete patient note controller
 */
export async function deletePatientNote(req: AuthenticatedRequest, res: Response) {
  try {
    const { noteId } = req.params;

    // Check if user has edit permission
    if (!req.user?.permissions.includes('edit_patients') && !req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to delete patient notes', 403);
      return;
    }

    const note = await deletePatientNoteService(
      noteId,
      req.user.id,
      req.user.roles.join(',')
    );

    const shapedNote = shapePatientNoteOutput(note);

    successResponse(res, shapedNote, 'Patient note deleted successfully');
  } catch (error) {
    logger.error('Delete patient note controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to delete patient note', 500);
  }
}
