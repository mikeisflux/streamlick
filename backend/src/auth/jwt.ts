import jwt from 'jsonwebtoken';
import { JwtPayload, MagicLinkToken } from '../types';

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '15m';
const REFRESH_TOKEN_EXPIRATION = process.env.REFRESH_TOKEN_EXPIRATION || '7d';
const MAGIC_LINK_EXPIRATION = process.env.MAGIC_LINK_EXPIRATION || '15m';

export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION });
}

export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: REFRESH_TOKEN_EXPIRATION });
}

export function generateMagicLinkToken(email: string): string {
  const payload: MagicLinkToken = {
    email,
    exp: Math.floor(Date.now() / 1000) + 15 * 60, // 15 minutes
  };
  return jwt.sign(payload, JWT_SECRET);
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export function verifyMagicLinkToken(token: string): MagicLinkToken {
  return jwt.verify(token, JWT_SECRET) as MagicLinkToken;
}
