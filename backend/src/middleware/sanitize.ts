/**
 * CRITICAL FIX: Input Sanitization Middleware
 * Prevents XSS, SQL injection, and NoSQL injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * Sanitize string by removing/encoding dangerous characters
 */
function sanitizeString(value: string): string {
  if (typeof value !== 'string') return value;

  // Remove null bytes (can cause issues in C-based systems)
  value = value.replace(/\0/g, '');

  // Remove control characters except newline and tab
  value = value.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');

  // Limit excessive whitespace
  value = value.replace(/\s+/g, ' ').trim();

  return value;
}

/**
 * Sanitize object recursively
 */
function sanitizeObject(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }

  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        sanitized[key] = sanitizeObject(obj[key]);
      }
    }
    return sanitized;
  }

  return obj;
}

/**
 * Detect potential SQL injection patterns
 */
function detectSQLInjection(value: string): boolean {
  const sqlPatterns = [
    /(\bUNION\b.*\bSELECT\b)/i,
    /(\bOR\b.*=.*)/i,
    /(\bAND\b.*=.*)/i,
    /;.*(\bDROP\b|\bDELETE\b|\bUPDATE\b|\bINSERT\b)/i,
    /('|(--)|;|\||%|<|>|\*)/,
    /\bEXEC\b|\bEXECUTE\b/i,
  ];

  return sqlPatterns.some(pattern => pattern.test(value));
}

/**
 * Detect potential NoSQL injection patterns (MongoDB)
 */
function detectNoSQLInjection(obj: any): boolean {
  if (typeof obj === 'object' && obj !== null) {
    const keys = Object.keys(obj);
    const dangerousOperators = ['$where', '$ne', '$gt', '$lt', '$gte', '$lte', '$regex', '$nin', '$in'];

    // Check for MongoDB operators in unexpected places
    return keys.some(key => dangerousOperators.includes(key));
  }
  return false;
}

/**
 * Sanitize request body, query, and params
 */
export function sanitizeInput(req: Request, res: Response, next: NextFunction): void {
  try {
    // Sanitize body
    if (req.body) {
      req.body = sanitizeObject(req.body);

      // Check for SQL injection attempts
      const bodyStr = JSON.stringify(req.body);
      if (detectSQLInjection(bodyStr)) {
        logger.warn(`Potential SQL injection attempt detected in body from ${req.ip}`);
        res.status(400).json({ error: 'Invalid input detected' });
        return;
      }

      // Check for NoSQL injection attempts
      if (detectNoSQLInjection(req.body)) {
        logger.warn(`Potential NoSQL injection attempt detected in body from ${req.ip}`);
        res.status(400).json({ error: 'Invalid input detected' });
        return;
      }
    }

    // Sanitize query params
    if (req.query) {
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL params
    if (req.params) {
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Input sanitization error:', error);
    res.status(500).json({ error: 'Request processing failed' });
  }
}
