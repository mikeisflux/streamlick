import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { COOKIE_NAMES, setCsrfCookie } from './cookies';
import logger from '../utils/logger';

/**
 * CSRF Protection Middleware
 *
 * Protects against Cross-Site Request Forgery attacks by requiring a valid
 * CSRF token for all state-changing operations (POST, PUT, PATCH, DELETE).
 *
 * Flow:
 * 1. Client requests CSRF token via GET /api/auth/csrf-token
 * 2. Server generates token and stores in httpOnly cookie + returns in response
 * 3. Client includes token in X-CSRF-Token header for protected requests
 * 4. Server validates token matches cookie value
 */

const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a new CSRF token
 */
export function generateCsrfToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Middleware to provide CSRF token to client
 * Use on GET /api/auth/csrf-token endpoint
 */
export function provideCsrfToken(req: Request, res: Response): void {
  const token = generateCsrfToken();
  setCsrfCookie(res, token);
  res.json({ csrfToken: token });
}

/**
 * Middleware to validate CSRF token on protected routes
 *
 * Validates that:
 * 1. CSRF token exists in cookie
 * 2. CSRF token exists in X-CSRF-Token header
 * 3. Both tokens match
 *
 * Safe methods (GET, HEAD, OPTIONS) are exempt from CSRF protection
 */
export function validateCsrfToken(req: Request, res: Response, next: NextFunction): void {
  // Exempt safe methods from CSRF protection
  const safeMethods = ['GET', 'HEAD', 'OPTIONS'];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Exempt auth endpoints (login, register) - they occur before CSRF token can be obtained
  // Also exempt webhook endpoints (they use signature validation instead)
  const exemptPaths = [
    '/api/auth/login',
    '/api/auth/register',
    '/api/auth/refresh',
    '/api/webhooks/',
    '/api/oauth/callback'
  ];
  if (exemptPaths.some(path => req.path.startsWith(path) || req.path === path)) {
    return next();
  }

  const cookieToken = req.cookies[COOKIE_NAMES.CSRF_TOKEN];
  const headerToken = req.headers['x-csrf-token'] as string;

  // Check if tokens exist
  if (!cookieToken) {
    logger.warn('CSRF validation failed: No CSRF token in cookie', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(403).json({ error: 'CSRF token missing. Please refresh and try again.' });
    return;
  }

  if (!headerToken) {
    logger.warn('CSRF validation failed: No CSRF token in header', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(403).json({ error: 'CSRF token required in X-CSRF-Token header' });
    return;
  }

  // Validate tokens match (constant-time comparison to prevent timing attacks)
  if (!crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken))) {
    logger.warn('CSRF validation failed: Token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip
    });
    res.status(403).json({ error: 'Invalid CSRF token. Please refresh and try again.' });
    return;
  }

  // CSRF token valid
  next();
}
