/**
 * BEST PRACTICE: Zod Schemas for Broadcast Routes
 *
 * Centralized schema definitions for all broadcast-related API endpoints.
 * Provides type-safe validation for creating, updating, and managing broadcasts.
 */

import { z } from 'zod';

/**
 * Common ID schema for UUIDs
 */
export const uuidSchema = z
  .string()
  .uuid('Invalid ID format');

/**
 * Broadcast status enum
 */
export const broadcastStatusSchema = z.enum([
  'scheduled',
  'countdown',
  'live',
  'ended',
  'error',
]);

export type BroadcastStatus = z.infer<typeof broadcastStatusSchema>;

/**
 * Privacy status for platform broadcasts
 */
export const privacyStatusSchema = z.enum([
  'public',
  'unlisted',
  'private',
]);

export type PrivacyStatus = z.infer<typeof privacyStatusSchema>;

/**
 * Studio configuration schema
 */
export const studioConfigSchema = z.object({
  layout: z.string().optional(),
  backgroundId: z.string().optional(),
  overlayIds: z.array(z.string()).optional(),
  showChat: z.boolean().optional(),
  showBranding: z.boolean().optional(),
  resolution: z.enum(['720p', '1080p', '4k']).optional(),
  framerate: z.enum(['24', '30', '60']).optional(),
}).passthrough(); // Allow additional properties for flexibility

export type StudioConfig = z.infer<typeof studioConfigSchema>;

/**
 * Create broadcast request schema
 */
export const createBroadcastSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(200, 'Title must be less than 200 characters'),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .nullable(),
  scheduledAt: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .nullable()
    .refine((val) => {
      if (!val) return true;
      const date = new Date(val);
      return date > new Date();
    }, 'Scheduled time must be in the future'),
  studioConfig: studioConfigSchema.optional(),
});

export type CreateBroadcastInput = z.infer<typeof createBroadcastSchema>;

/**
 * Update broadcast request schema
 */
export const updateBroadcastSchema = z.object({
  title: z
    .string()
    .min(1, 'Title cannot be empty')
    .max(200, 'Title must be less than 200 characters')
    .optional(),
  description: z
    .string()
    .max(5000, 'Description must be less than 5000 characters')
    .optional()
    .nullable(),
  scheduledAt: z
    .string()
    .datetime('Invalid date format')
    .optional()
    .nullable(),
  studioConfig: studioConfigSchema.optional(),
  status: broadcastStatusSchema.optional(),
}).refine((data) => Object.keys(data).length > 0, {
  message: 'At least one field must be provided for update',
});

export type UpdateBroadcastInput = z.infer<typeof updateBroadcastSchema>;

/**
 * Destination settings for starting a broadcast
 */
export const destinationSettingsSchema = z.record(
  z.string().uuid(),
  z.object({
    privacyStatus: privacyStatusSchema.optional(),
    scheduledStartTime: z.string().datetime().optional().nullable(),
    title: z.string().max(200).optional(),
    description: z.string().max(5000).optional(),
  })
);

export type DestinationSettings = z.infer<typeof destinationSettingsSchema>;

/**
 * Start broadcast request schema
 */
export const startBroadcastSchema = z.object({
  destinationIds: z
    .array(uuidSchema)
    .max(10, 'Maximum 10 destinations allowed')
    .optional()
    .default([]),
  destinationSettings: destinationSettingsSchema.optional().default({}),
});

export type StartBroadcastInput = z.infer<typeof startBroadcastSchema>;

/**
 * Pagination query schema
 */
export const paginationSchema = z.object({
  page: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '1', 10);
      return isNaN(num) || num < 1 ? 1 : num;
    }),
  limit: z
    .string()
    .optional()
    .transform((val) => {
      const num = parseInt(val || '20', 10);
      if (isNaN(num) || num < 1) return 20;
      return Math.min(num, 100); // Cap at 100
    }),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

/**
 * Broadcast ID params schema
 */
export const broadcastIdParamsSchema = z.object({
  id: uuidSchema,
});

export type BroadcastIdParams = z.infer<typeof broadcastIdParamsSchema>;
