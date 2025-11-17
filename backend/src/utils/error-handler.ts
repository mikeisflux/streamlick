/**
 * Safe Error Handling Utility
 * Prevents exposure of sensitive error details to clients in production
 */

import logger from './logger';
import { Response } from 'express';

/**
 * Known safe error messages that can be shown to users
 * These are user-facing errors that don't expose system details
 */
const SAFE_ERROR_MESSAGES = [
  'Invalid email or password',
  'User already exists',
  'Email and password are required',
  'Invalid email format',
  'Password must be at least 8 characters long',
  'Not authorized',
  'User not found',
  'Invalid file type',
  'File size exceeds maximum',
  'Missing required fields',
  'Invalid MIME type',
  'Invalid file URL format',
  'Too many authentication attempts',
  'Too many requests',
  'Invalid verification token',
  'Email already verified',
  'Destination not found',
  'Broadcast not found',
  'Stream not found',
  'Admin access required',
];

/**
 * Check if an error message is safe to expose to clients
 */
function isSafeErrorMessage(message: string): boolean {
  return SAFE_ERROR_MESSAGES.some(safe => message.includes(safe));
}

/**
 * Safe error response that sanitizes error messages in production
 *
 * @param res Express response object
 * @param error The error object
 * @param fallbackMessage Generic message to show if error is not safe
 * @param statusCode HTTP status code (default: 500)
 */
export function sendSafeError(
  res: Response,
  error: any,
  fallbackMessage: string,
  statusCode: number = 500
): void {
  const errorMessage = error?.message || 'Unknown error';

  // Always log the full error server-side
  logger.error(`[Error Handler] ${fallbackMessage}:`, error);

  // In production, only send safe error messages
  if (process.env.NODE_ENV === 'production') {
    if (isSafeErrorMessage(errorMessage)) {
      res.status(statusCode).json({ error: errorMessage });
    } else {
      // Send generic message without exposing internal details
      res.status(statusCode).json({ error: fallbackMessage });
    }
  } else {
    // In development, send detailed error for debugging
    res.status(statusCode).json({
      error: fallbackMessage,
      details: errorMessage,
      stack: error?.stack,
    });
  }
}

/**
 * Safe error response with additional details field
 * Use this when you want to provide some context without exposing sensitive data
 */
export function sendSafeErrorWithDetails(
  res: Response,
  error: any,
  fallbackMessage: string,
  safeDetails?: string,
  statusCode: number = 500
): void {
  const errorMessage = error?.message || 'Unknown error';

  // Always log the full error server-side
  logger.error(`[Error Handler] ${fallbackMessage}:`, error);

  // In production, only send sanitized response
  if (process.env.NODE_ENV === 'production') {
    const response: any = { error: fallbackMessage };
    if (safeDetails) {
      response.details = safeDetails;
    }
    res.status(statusCode).json(response);
  } else {
    // In development, send full details for debugging
    res.status(statusCode).json({
      error: fallbackMessage,
      details: errorMessage,
      safeDetails,
      stack: error?.stack,
    });
  }
}

/**
 * Validation error response (400 status)
 * For user input errors that are safe to show
 */
export function sendValidationError(
  res: Response,
  message: string,
  details?: any
): void {
  const response: any = { error: message };
  if (details) {
    response.details = details;
  }
  res.status(400).json(response);
}

/**
 * Authorization error response (403 status)
 */
export function sendAuthorizationError(
  res: Response,
  message: string = 'Not authorized to perform this action'
): void {
  res.status(403).json({ error: message });
}

/**
 * Not found error response (404 status)
 */
export function sendNotFoundError(
  res: Response,
  resource: string
): void {
  res.status(404).json({ error: `${resource} not found` });
}

export default {
  sendSafeError,
  sendSafeErrorWithDetails,
  sendValidationError,
  sendAuthorizationError,
  sendNotFoundError,
};
