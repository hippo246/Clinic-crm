import { Request } from 'express';

export interface JwtClaims {
  userId: string;
  roles: string[];
  permissions: string[];
  sessionId: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  status: string;
}

export interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  expiresAt: Date;
  userAgent?: string;
  ipHash?: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
  sessionId?: string;
}

export type RoleName = 'admin' | 'doctor' | 'nurse' | 'receptionist' | 'billing' | 'auditor' | 'readonly';

export type PermissionKey = 
  | 'patients.view'
  | 'patients.create'
  | 'patients.edit'
  | 'patients.delete'
  | 'appointments.view'
  | 'appointments.create'
  | 'appointments.edit'
  | 'appointments.delete'
  | 'billing.view'
  | 'billing.create'
  | 'billing.edit'
  | 'billing.delete'
  | 'staff.view'
  | 'staff.create'
  | 'staff.edit'
  | 'staff.delete'
  | 'audit.view'
  | 'settings.manage';

export interface FirebaseTokenResult {
  firebaseUid: string;
  email?: string;
  emailVerified?: boolean;
}

export interface LoginRequest {
  token?: string;
  mockUserId?: string;
  role?: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken?: string;
  user: {
    id: string;
    email: string;
    roles: string[];
    permissions: string[];
  };
  session: SessionInfo;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface MeResponse {
  id: string;
  email: string;
  roles: string[];
  permissions: string[];
  session: SessionInfo;
}
