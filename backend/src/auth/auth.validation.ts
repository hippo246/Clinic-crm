import { z } from 'zod';

export const loginSchema = z.object({
  token: z.string().optional(),
  mockUserId: z.string().optional(),
  role: z.string().optional(),
}).refine((data) => {
  // Either token (for Firebase) or mockUserId (for mock mode) must be provided
  return !!(data.token || data.mockUserId);
}, {
  message: 'Either token or mockUserId must be provided',
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
