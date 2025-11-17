import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from './jwt';
import { COOKIE_NAMES } from './cookies';
import logger from '../utils/logger';

// AuthRequest is an alias for Request type
// The 'user' property is added to Request via Express's declaration merging in @types/express-serve-static-core
// This allows us to access req.user with proper typing after authentication middleware runs
export type AuthRequest = Request;

export async function authenticate(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    // Try to get token from httpOnly cookie first (preferred for XSS protection)
    let token = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];

    // Fallback to Authorization header for backwards compatibility
    // TODO: Remove this fallback once all clients are updated to use cookies
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const payload = verifyAccessToken(token);

    req.user = payload;
    next();
  } catch (error) {
    logger.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  try {
    // Try to get token from httpOnly cookie first
    let token = req.cookies[COOKIE_NAMES.ACCESS_TOKEN];

    // Fallback to Authorization header for backwards compatibility
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (token) {
      const payload = verifyAccessToken(token);
      req.user = payload;
    }
  } catch (error) {
    // Ignore errors for optional auth
  }
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  if (req.user.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }

  next();
}

// Alias for compatibility
export const authenticateToken = authenticate;
