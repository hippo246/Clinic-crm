import { Response } from 'express';
import { logger } from '../utils/logger';
import {
  getClinicSettings as getClinicSettingsService,
  updateClinicSetting as updateClinicSettingService,
  getSystemSettings as getSystemSettingsService,
  updateSystemSetting as updateSystemSettingService,
  getAllSettings as getAllSettingsService,
  batchUpdateSettings as batchUpdateSettingsService,
} from './settings.service';
import {
  clinicSettingsSchema,
  systemSettingSchema,
  settingsUpdateSchema,
} from './operations.validation';
import { successResponse, errorResponse } from '../utils/apiResponse';
import { AuthenticatedRequest } from '../auth/auth.types';

// ==================== CLINIC SETTINGS CONTROLLERS ====================

export async function getClinicSettings(req: AuthenticatedRequest, res: Response) {
  try {
    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view clinic settings', 403);
      return;
    }

    const settings = await getClinicSettingsService();

    successResponse(res, settings, 'Clinic settings retrieved successfully');
  } catch (error) {
    logger.error('Get clinic settings controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get clinic settings', 500);
  }
}

export async function updateClinicSetting(req: AuthenticatedRequest, res: Response) {
  try {
    const { key } = req.params;
    const validatedData = clinicSettingsSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update clinic settings', 403);
      return;
    }

    const setting = await updateClinicSettingService(key, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, setting, 'Clinic setting updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot store secret-like keys through settings API') {
      errorResponse(res, 'INVALID_KEY', error.message, 400);
      return;
    }
    logger.error('Update clinic setting controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update clinic setting', 500);
  }
}

// ==================== SYSTEM SETTINGS CONTROLLERS ====================

export async function getSystemSettings(req: AuthenticatedRequest, res: Response) {
  try {
    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view system settings', 403);
      return;
    }

    const settings = await getSystemSettingsService();

    successResponse(res, settings, 'System settings retrieved successfully');
  } catch (error) {
    logger.error('Get system settings controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get system settings', 500);
  }
}

export async function updateSystemSetting(req: AuthenticatedRequest, res: Response) {
  try {
    const { key } = req.params;
    const validatedData = systemSettingSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update system settings', 403);
      return;
    }

    const setting = await updateSystemSettingService(key, validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, setting, 'System setting updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    if (error instanceof Error && error.message === 'Cannot store secret-like keys through settings API') {
      errorResponse(res, 'INVALID_KEY', error.message, 400);
      return;
    }
    logger.error('Update system setting controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to update system setting', 500);
  }
}

// ==================== ALL SETTINGS CONTROLLERS ====================

export async function getAllSettings(req: AuthenticatedRequest, res: Response) {
  try {
    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to view settings', 403);
      return;
    }

    const settings = await getAllSettingsService();

    successResponse(res, settings, 'All settings retrieved successfully');
  } catch (error) {
    logger.error('Get all settings controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to get all settings', 500);
  }
}

export async function batchUpdateSettings(req: AuthenticatedRequest, res: Response) {
  try {
    const validatedData = settingsUpdateSchema.parse(req.body);

    // Check permissions - admin only
    if (!req.user?.roles.includes('admin')) {
      errorResponse(res, 'PERMISSION_DENIED', 'You do not have permission to update settings', 403);
      return;
    }

    const result = await batchUpdateSettingsService(validatedData, req.user.id, req.user.roles.join(','));

    successResponse(res, result, 'Settings batch updated successfully');
  } catch (error) {
    if (error instanceof Error && error.name === 'ZodError') {
      errorResponse(res, 'VALIDATION_ERROR', 'Invalid input data', 400);
      return;
    }
    logger.error('Batch update settings controller error', { error: error instanceof Error ? error.message : 'Unknown error' });
    errorResponse(res, 'INTERNAL_ERROR', 'Failed to batch update settings', 500);
  }
}
