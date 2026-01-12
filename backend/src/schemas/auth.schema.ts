/**
 * BEST PRACTICE: Zod Schemas for Authentication Routes
 *
 * Centralized schema definitions for all auth-related API endpoints.
 * Provides:
 * - Type-safe validation
 * - Descriptive error messages
 * - Password complexity requirements
 * - Email format validation (RFC 5322 compliant)
 */

import { z } from 'zod';

/**
 * Password validation schema with complexity requirements
 * - Minimum 8 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one number
 */
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters long')
  .refine((val) => /[A-Z]/.test(val), {
    message: 'Password must contain at least one uppercase letter',
  })
  .refine((val) => /[a-z]/.test(val), {
    message: 'Password must contain at least one lowercase letter',
  })
  .refine((val) => /[0-9]/.test(val), {
    message: 'Password must contain at least one number',
  });

/**
 * Email validation schema (RFC 5322 compliant)
 */
export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email must be less than 254 characters')
  .transform((val) => val.toLowerCase().trim());

/**
 * Login request schema
 */
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

/**
 * Registration request schema
 */
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  name: z
    .string()
    .min(1, 'Name is required')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

/**
 * Profile update request schema
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name must be less than 100 characters')
    .optional(),
  avatarUrl: z
    .string()
    .url('Avatar URL must be a valid URL')
    .max(2048, 'Avatar URL must be less than 2048 characters')
    .optional()
    .nullable(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

/**
 * Change password request schema
 */
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: passwordSchema,
}).refine((data) => data.currentPassword !== data.newPassword, {
  message: 'New password must be different from current password',
  path: ['newPassword'],
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/**
 * Email verification request schema
 */
export const verifyEmailSchema = z.object({
  token: z
    .string()
    .min(32, 'Invalid verification token')
    .max(128, 'Invalid verification token'),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

/**
 * Password reset request schema (initial request)
 */
export const requestPasswordResetSchema = z.object({
  email: emailSchema,
});

export type RequestPasswordResetInput = z.infer<typeof requestPasswordResetSchema>;

/**
 * Password reset confirmation schema
 */
export const resetPasswordSchema = z.object({
  token: z
    .string()
    .min(32, 'Invalid reset token')
    .max(128, 'Invalid reset token'),
  newPassword: passwordSchema,
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
