/**
 * Rate Limiting Middleware
 * Protects against brute force attacks and API abuse
 */

import rateLimit from 'express-rate-limit';
import logger from '../utils/logger';

/**
 * Aggressive rate limiting for authentication endpoints
 * Prevents brute force attacks on login/register
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: {
    error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
  },
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded for IP ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many authentication attempts from this IP, please try again after 15 minutes'
    });
  },
  // Skip successful requests from count (only count failed attempts)
  skipSuccessfulRequests: true,
  // Use custom key generator to handle proxies correctly
  keyGenerator: (req) => {
    // Trust X-Forwarded-For if behind proxy (configure Express trust proxy)
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Moderate rate limiting for password reset endpoints
 * Prevents email flooding and enumeration
 */
export const passwordResetRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 password reset requests per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many password reset requests from this IP, please try again after an hour'
  },
  handler: (req, res) => {
    logger.warn(`Password reset rate limit exceeded for IP ${req.ip}`);
    res.status(429).json({
      error: 'Too many password reset requests from this IP, please try again after an hour'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * General API rate limiting
 * Prevents API abuse and DoS attacks
 */
export const apiRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests from this IP, please try again later'
  },
  handler: (req, res) => {
    logger.warn(`API rate limit exceeded for IP ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests from this IP, please try again later'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * Strict rate limiting for expensive operations
 * Protects resource-intensive endpoints
 */
export const strictRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 requests per windowMs
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many requests, please try again later'
  },
  handler: (req, res) => {
    logger.warn(`Strict rate limit exceeded for IP ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many requests, please try again later'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

/**
 * CRITICAL FIX: Very strict rate limiting for upload endpoints
 * Prevents storage exhaustion and bandwidth abuse
 */
export const uploadRateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // Limit each IP to 20 uploads per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: 'Too many uploads, please try again later'
  },
  handler: (req, res) => {
    logger.warn(`Upload rate limit exceeded for IP ${req.ip} on ${req.path}`);
    res.status(429).json({
      error: 'Too many uploads, please try again later'
    });
  },
  keyGenerator: (req) => {
    return req.ip || req.connection.remoteAddress || 'unknown';
  },
});

export default {
  authRateLimiter,
  passwordResetRateLimiter,
  apiRateLimiter,
  strictRateLimiter,
  uploadRateLimiter,
};
