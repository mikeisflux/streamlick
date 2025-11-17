import jwt, { SignOptions } from 'jsonwebtoken';
import crypto from 'crypto';
import { JwtPayload } from '../types';
import prisma from '../database/prisma';

// CRITICAL FIX: Require JWT_SECRET to be set, no weak default
if (!process.env.JWT_SECRET) {
  throw new Error('CRITICAL: JWT_SECRET environment variable must be set. Generate one with: openssl rand -base64 64');
}

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m'; // 15 minutes for access tokens
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || '7d'; // 7 days for refresh tokens

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION } as SignOptions);
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION } as SignOptions);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

/**
 * CRITICAL FIX: Hash refresh token for secure storage
 * Tokens should never be stored in plain text
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * CRITICAL FIX: Store refresh token in database
 * Enables token revocation on logout and security events
 */
export async function storeRefreshToken(
  userId: string,
  token: string,
  deviceInfo?: string,
  ipAddress?: string
): Promise<void> {
  const tokenHash = hashToken(token);

  // Calculate expiration based on token
  const decoded = jwt.decode(token) as any;
  const expiresAt = new Date(decoded.exp * 1000);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      deviceInfo,
      ipAddress,
      expiresAt,
    },
  });
}

/**
 * CRITICAL FIX: Verify refresh token is valid and not revoked
 */
export async function verifyStoredRefreshToken(token: string): Promise<boolean> {
  const tokenHash = hashToken(token);

  const storedToken = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!storedToken) {
    return false; // Token not found
  }

  if (storedToken.isRevoked) {
    return false; // Token has been revoked
  }

  if (storedToken.expiresAt < new Date()) {
    return false; // Token has expired
  }

  return true;
}

/**
 * CRITICAL FIX: Revoke refresh token on logout
 */
export async function revokeRefreshToken(token: string): Promise<void> {
  const tokenHash = hashToken(token);

  await prisma.refreshToken.updateMany({
    where: { tokenHash },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  });
}

/**
 * CRITICAL FIX: Revoke all refresh tokens for a user
 * Used when user changes password or on security events
 */
export async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: {
      userId,
      isRevoked: false,
    },
    data: {
      isRevoked: true,
      revokedAt: new Date(),
    },
  });
}

/**
 * CRITICAL FIX: Cleanup expired tokens (run periodically)
 */
export async function cleanupExpiredTokens(): Promise<number> {
  const result = await prisma.refreshToken.deleteMany({
    where: {
      expiresAt: {
        lt: new Date(),
      },
    },
  });

  return result.count;
}
