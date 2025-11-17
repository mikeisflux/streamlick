import { Response } from 'express';
import { CookieOptions } from 'express';

/**
 * Cookie configuration for JWT tokens
 *
 * Security features:
 * - httpOnly: Prevents XSS attacks by making cookies inaccessible to JavaScript
 * - secure: Only sent over HTTPS (enabled in production)
 * - sameSite: Prevents CSRF attacks
 * - path: Restricts cookie to specific paths
 */

const isProduction = process.env.NODE_ENV === 'production';

export const COOKIE_NAMES = {
  ACCESS_TOKEN: 'accessToken',
  REFRESH_TOKEN: 'refreshToken',
  CSRF_TOKEN: 'csrfToken'
} as const;

// Access token: Short-lived (15 minutes)
export const accessTokenCookieOptions: CookieOptions = {
  httpOnly: true, // Prevents XSS
  secure: isProduction, // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

// Refresh token: Long-lived (7 days)
export const refreshTokenCookieOptions: CookieOptions = {
  httpOnly: true, // Prevents XSS
  secure: isProduction, // HTTPS only in production
  sameSite: 'strict', // CSRF protection
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth/refresh', // Only sent to refresh endpoint
};

// CSRF token: Same lifetime as access token
export const csrfTokenCookieOptions: CookieOptions = {
  httpOnly: false, // Must be readable by JavaScript
  secure: isProduction, // HTTPS only in production
  sameSite: 'strict',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

/**
 * Set authentication cookies
 */
export function setAuthCookies(res: Response, accessToken: string, refreshToken: string): void {
  res.cookie(COOKIE_NAMES.ACCESS_TOKEN, accessToken, accessTokenCookieOptions);
  res.cookie(COOKIE_NAMES.REFRESH_TOKEN, refreshToken, refreshTokenCookieOptions);
}

/**
 * Clear authentication cookies
 */
export function clearAuthCookies(res: Response): void {
  res.clearCookie(COOKIE_NAMES.ACCESS_TOKEN, { path: '/' });
  res.clearCookie(COOKIE_NAMES.REFRESH_TOKEN, { path: '/api/auth/refresh' });
  res.clearCookie(COOKIE_NAMES.CSRF_TOKEN, { path: '/' });
}

/**
 * Set CSRF token cookie
 */
export function setCsrfCookie(res: Response, token: string): void {
  res.cookie(COOKIE_NAMES.CSRF_TOKEN, token, csrfTokenCookieOptions);
}
