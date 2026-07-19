/**
 * Staff API Adapter
 * Typed API functions for staff-related backend endpoints
 */

import { apiClient } from './apiClient';
import { PaginatedResponse } from './apiTypes';

/**
 * Staff types
 */
export interface Staff {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'billing' | 'auditor' | 'readonly';
  department?: string;
  phone?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt: string;
}

export interface CreateStaffInput {
  name: string;
  email: string;
  role: Staff['role'];
  department?: string;
  phone?: string;
}

export interface UpdateStaffInput {
  name?: string;
  email?: string;
  role?: Staff['role'];
  department?: string;
  phone?: string;
  status?: Staff['status'];
}

export interface StaffListQuery {
  role?: Staff['role'];
  department?: string;
  status?: Staff['status'];
  page?: number;
  limit?: number;
}

/**
 * Staff functions
 */
export async function listStaff(query: StaffListQuery = {}): Promise<PaginatedResponse<Staff>> {
  const { role, department, status, page = 1, limit = 20 } = query;
  const params = new URLSearchParams();
  
  if (role) params.append('role', role);
  if (department) params.append('department', department);
  if (status) params.append('status', status);
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  const response = await apiClient.get<{ data: Staff[]; total: number; page: number; limit: number }>(
    `/staff?${params.toString()}`
  );
  
  return {
    data: response.data.data,
    total: response.data.total,
    page: response.data.page,
    limit: response.data.limit,
    totalPages: Math.ceil(response.data.total / response.data.limit),
  };
}

export async function getStaff(staffId: string): Promise<Staff> {
  const response = await apiClient.get<Staff>(`/staff/${staffId}`);
  return response.data;
}

export async function createStaff(input: CreateStaffInput): Promise<Staff> {
  const response = await apiClient.post<Staff>('/staff', input);
  return response.data;
}

export async function updateStaff(staffId: string, input: UpdateStaffInput): Promise<Staff> {
  const response = await apiClient.put<Staff>(`/staff/${staffId}`, input);
  return response.data;
}

export async function deactivateStaff(staffId: string, reason?: string): Promise<Staff> {
  const response = await apiClient.post<Staff>(`/staff/${staffId}/deactivate`, { reason });
  return response.data;
}
