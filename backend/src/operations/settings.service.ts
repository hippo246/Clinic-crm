import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { logAdminOperation } from '../services/adminAuditService';
import {
  ClinicSettingsInput,
  SystemSettingInput,
  SettingsUpdateInput,
} from './operations.validation';

// Secret-like keys that should be rejected
const SECRET_KEY_PATTERNS = [
  'password',
  'token',
  'secret',
  'privateKey',
  'apiKey',
  'credential',
  'auth',
  'key',
];

/**
 * Check if a key looks like a secret
 */
function isSecretKey(key: string): boolean {
  const lowerKey = key.toLowerCase();
  return SECRET_KEY_PATTERNS.some(pattern => lowerKey.includes(pattern));
}

/**
 * Get clinic settings
 */
export async function getClinicSettings() {
  try {
    const settings = await prisma.clinicSettings.findMany({
      orderBy: { settingKey: 'asc' },
    });

    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach(setting => {
      settingsObj[setting.settingKey] = setting.settingValue;
    });

    return settingsObj;
  } catch (error) {
    logger.error('Failed to get clinic settings', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get clinic settings');
  }
}

/**
 * Update clinic setting
 */
export async function updateClinicSetting(
  settingKey: string,
  data: ClinicSettingsInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Check if key looks like a secret
    if (isSecretKey(settingKey)) {
      throw new Error('Cannot store secret-like keys through settings API');
    }

    const existing = await prisma.clinicSettings.findUnique({
      where: { settingKey },
    });

    let setting;
    if (existing) {
      setting = await prisma.clinicSettings.update({
        where: { settingKey },
        data: {
          settingValue: data.settingValue,
          description: data.description,
          updatedBy: actorId,
        },
      });
    } else {
      setting = await prisma.clinicSettings.create({
        data: {
          settingKey,
          settingValue: data.settingValue,
          description: data.description,
          updatedBy: actorId,
        },
      });
    }

    // Log admin audit event
    await logAdminOperation({
      action: 'settings_updated',
      module: 'settings',
      resourceType: 'clinic_setting',
      resourceId: setting.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        settingKey,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log settings update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return setting;
  } catch (error) {
    logger.error('Failed to update clinic setting', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update clinic setting');
  }
}

/**
 * Get system settings
 */
export async function getSystemSettings() {
  try {
    const settings = await prisma.systemSetting.findMany({
      orderBy: { settingKey: 'asc' },
    });

    // Convert to key-value object
    const settingsObj: Record<string, string> = {};
    settings.forEach(setting => {
      settingsObj[setting.settingKey] = setting.settingValue;
    });

    return settingsObj;
  } catch (error) {
    logger.error('Failed to get system settings', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get system settings');
  }
}

/**
 * Update system setting
 */
export async function updateSystemSetting(
  settingKey: string,
  data: SystemSettingInput,
  actorId: string,
  actorRole: string
) {
  try {
    // Check if key looks like a secret
    if (isSecretKey(settingKey)) {
      throw new Error('Cannot store secret-like keys through settings API');
    }

    const existing = await prisma.systemSetting.findUnique({
      where: { settingKey },
    });

    let setting;
    if (existing) {
      setting = await prisma.systemSetting.update({
        where: { settingKey },
        data: {
          settingValue: data.settingValue,
          description: data.description,
        },
      });
    } else {
      setting = await prisma.systemSetting.create({
        data: {
          settingKey,
          settingValue: data.settingValue,
          description: data.description,
        },
      });
    }

    // Log admin audit event
    await logAdminOperation({
      action: 'system_setting_updated',
      module: 'settings',
      resourceType: 'system_setting',
      resourceId: setting.id,
      actor: actorId,
      role: actorRole,
      metadata: {
        settingKey,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log system setting update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return setting;
  } catch (error) {
    logger.error('Failed to update system setting', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to update system setting');
  }
}

/**
 * Get all settings (clinic + system)
 */
export async function getAllSettings() {
  try {
    const [clinicSettings, systemSettings] = await Promise.all([
      getClinicSettings(),
      getSystemSettings(),
    ]);

    return {
      clinic: clinicSettings,
      system: systemSettings,
    };
  } catch (error) {
    logger.error('Failed to get all settings', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to get all settings');
  }
}

/**
 * Batch update settings
 */
export async function batchUpdateSettings(
  data: SettingsUpdateInput,
  actorId: string,
  actorRole: string
) {
  try {
    const updatedKeys: string[] = [];
    const rejectedKeys: string[] = [];

    for (const [key, value] of Object.entries(data)) {
      // Check if key looks like a secret
      if (isSecretKey(key)) {
        rejectedKeys.push(key);
        continue;
      }

      // Try to update clinic setting first, then system setting
      try {
        const existingClinic = await prisma.clinicSettings.findUnique({
          where: { settingKey: key },
        });

        if (existingClinic) {
          await prisma.clinicSettings.update({
            where: { settingKey: key },
            data: {
              settingValue: String(value),
              updatedBy: actorId,
            },
          });
        } else {
          await prisma.clinicSettings.create({
            data: {
              settingKey: key,
              settingValue: String(value),
              updatedBy: actorId,
            },
          });
        }
        updatedKeys.push(key);
      } catch (error) {
        // If clinic update fails, try system setting
        try {
          const existingSystem = await prisma.systemSetting.findUnique({
            where: { settingKey: key },
          });

          if (existingSystem) {
            await prisma.systemSetting.update({
              where: { settingKey: key },
              data: {
                settingValue: String(value),
              },
            });
          } else {
            await prisma.systemSetting.create({
              data: {
                settingKey: key,
                settingValue: String(value),
              },
            });
          }
          updatedKeys.push(key);
        } catch (systemError) {
          logger.warn(`Failed to update setting ${key}`, { error: systemError instanceof Error ? systemError.message : 'Unknown error' });
        }
      }
    }

    // Log admin audit event
    await logAdminOperation({
      action: 'settings_updated',
      module: 'settings',
      resourceType: 'settings',
      resourceId: 'batch',
      actor: actorId,
      role: actorRole,
      metadata: {
        updatedCount: updatedKeys.length,
        rejectedCount: rejectedKeys.length,
      },
    }).catch((err: unknown) => {
      logger.warn('Failed to log batch settings update admin audit event', { error: err instanceof Error ? err.message : 'Unknown error' });
    });

    return {
      updatedKeys,
      rejectedKeys,
    };
  } catch (error) {
    logger.error('Failed to batch update settings', { error: error instanceof Error ? error.message : 'Unknown error' });
    throw new Error('Failed to batch update settings');
  }
}
