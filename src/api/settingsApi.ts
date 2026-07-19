/**
 * Settings API Adapter
 * Typed API functions for settings-related backend endpoints
 */

import { apiClient } from './apiClient';

/**
 * Settings types
 */
export interface ClinicSettings {
  id: string;
  clinicName: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  timezone?: string;
  currency?: string;
  language?: string;
  updatedAt: string;
}

export interface UpdateClinicSettingsInput {
  clinicName?: string;
  clinicAddress?: string;
  clinicPhone?: string;
  clinicEmail?: string;
  timezone?: string;
  currency?: string;
  language?: string;
}

/**
 * Settings functions
 */
export async function getClinicSettings(): Promise<ClinicSettings> {
  const response = await apiClient.get<ClinicSettings>('/settings/clinic');
  return response.data;
}

export async function updateClinicSettings(input: UpdateClinicSettingsInput): Promise<ClinicSettings> {
  const response = await apiClient.put<ClinicSettings>('/settings/clinic', input);
  return response.data;
}
