/**
 * BEST PRACTICE: Zod Schema Validation Middleware
 *
 * Provides type-safe request validation with descriptive error messages.
 * Uses Zod for schema definition and validation.
 *
 * Usage:
 * ```ts
 * import { validate } from '../middleware/validate';
 * import { loginSchema } from '../schemas/auth.schema';
 *
 * router.post('/login', validate(loginSchema), async (req, res) => {
 *   // req.body is now typed and validated
 * });
 * ```
 */

import { Request, Response, NextFunction } from 'express';
import { ZodSchema, ZodError } from 'zod';
import logger from '../utils/logger';

/**
 * Validation target specifies which part of the request to validate
 */
type ValidationTarget = 'body' | 'query' | 'params';

/**
 * Options for the validation middleware
 */
interface ValidateOptions {
  /** Strip unknown properties from the validated data (default: true) */
  stripUnknown?: boolean;
}

/**
 * Creates a validation middleware for the specified schema and target
 *
 * @param schema - Zod schema to validate against
 * @param target - Request property to validate (body, query, or params)
 * @param options - Validation options
 * @returns Express middleware function
 */
export function validate<T>(
  schema: ZodSchema<T>,
  target: ValidationTarget = 'body',
  options: ValidateOptions = {}
) {
  const { stripUnknown = true } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse and validate the target data
      const data = req[target];

      // Use safeParse to get detailed error information
      const result = await schema.safeParseAsync(data);

      if (!result.success) {
        // Format validation errors for user-friendly response
        const errors = formatZodErrors(result.error);

        // Log validation failure for debugging (without sensitive data)
        logger.debug('Validation failed:', {
          path: req.path,
          method: req.method,
          target,
          errors: errors.map(e => e.field),
        });

        return res.status(400).json({
          error: 'Validation failed',
          details: errors,
        });
      }

      // Replace the target with validated (and optionally stripped) data
      // This ensures type safety downstream
      (req as any)[target] = result.data;

      next();
    } catch (error) {
      // Unexpected error during validation
      logger.error('Validation middleware error:', error);
      return res.status(500).json({ error: 'Validation error' });
    }
  };
}

/**
 * Middleware for validating request body only (most common use case)
 */
export function validateBody<T>(schema: ZodSchema<T>, options?: ValidateOptions) {
  return validate(schema, 'body', options);
}

/**
 * Middleware for validating query parameters
 */
export function validateQuery<T>(schema: ZodSchema<T>, options?: ValidateOptions) {
  return validate(schema, 'query', options);
}

/**
 * Middleware for validating URL parameters
 */
export function validateParams<T>(schema: ZodSchema<T>, options?: ValidateOptions) {
  return validate(schema, 'params', options);
}

/**
 * Formats Zod errors into a user-friendly array of error objects
 */
function formatZodErrors(error: ZodError): Array<{ field: string; message: string }> {
  return error.errors.map((err) => ({
    field: err.path.join('.') || 'root',
    message: err.message,
  }));
}

/**
 * Type helper to extract the validated type from a schema
 * Useful for typing route handlers
 *
 * Usage:
 * ```ts
 * type LoginInput = ValidatedType<typeof loginSchema>;
 * ```
 */
export type ValidatedType<T extends ZodSchema> = T extends ZodSchema<infer U> ? U : never;
