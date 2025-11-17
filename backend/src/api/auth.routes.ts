import { Router } from 'express';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import prisma from '../database/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  storeRefreshToken,
  verifyStoredRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens
} from '../auth/jwt';
import { authenticate, AuthRequest } from '../auth/middleware';
import { sendVerificationEmail } from '../services/email';
import { setAuthCookies, clearAuthCookies, COOKIE_NAMES } from '../auth/cookies';
import { provideCsrfToken, validateCsrfToken } from '../auth/csrf';
import logger from '../utils/logger';
import { authRateLimiter, passwordResetRateLimiter } from '../middleware/rate-limit';

const router = Router();

// CSRF token endpoint - must be called before making authenticated requests
router.get('/csrf-token', provideCsrfToken);

// CRITICAL FIX: Apply rate limiting to login endpoint
// Protects against brute force attacks (5 attempts per 15 minutes per IP)
// Login with email/password
router.post('/login', authRateLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user by email
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role as 'user' | 'admin' });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role as 'user' | 'admin' });

    // CRITICAL FIX: Store refresh token in database for revocation capability
    await storeRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    // Set tokens in httpOnly cookies for XSS protection
    setAuthCookies(res, accessToken, refreshToken);

    // Return user data only (no tokens in response body)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        planType: user.planType,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// CRITICAL FIX: Apply rate limiting to register endpoint
// Protects against account creation abuse (5 attempts per 15 minutes per IP)
// Register new user
router.post('/register', authRateLimiter, async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    // Validate password strength (minimum 8 characters with complexity)
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Check password complexity: at least one uppercase, one lowercase, one number
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Check if user exists
    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Generate email verification token (valid for 24 hours)
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name,
        planType: 'free',
        role: 'user',
        emailVerified: false,
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send verification email with retry logic
    const maxEmailRetries = 3;
    let emailSent = false;

    for (let attempt = 1; attempt <= maxEmailRetries; attempt++) {
      try {
        await sendVerificationEmail(email, verificationToken);
        emailSent = true;
        logger.info(`Verification email sent successfully to ${email}`);
        break;
      } catch (emailError) {
        logger.warn(`Failed to send verification email (attempt ${attempt}/${maxEmailRetries}):`, emailError);

        if (attempt < maxEmailRetries) {
          // Wait before retrying with exponential backoff
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        } else {
          logger.error(`All ${maxEmailRetries} attempts to send verification email failed for ${email}`);
          // Email failure is not critical - user can resend later via resend endpoint
          // But we should notify admins via monitoring if this happens frequently
        }
      }
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email, role: user.role as 'user' | 'admin' });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email, role: user.role as 'user' | 'admin' });

    // CRITICAL FIX: Store refresh token in database for revocation capability
    await storeRefreshToken(
      user.id,
      refreshToken,
      req.headers['user-agent'],
      req.ip
    );

    // Set tokens in httpOnly cookies for XSS protection
    setAuthCookies(res, accessToken, refreshToken);

    // Return user data only (no tokens in response body)
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        planType: user.planType,
        role: user.role,
        emailVerified: user.emailVerified,
      },
      message: 'Registration successful. Please check your email to verify your account.',
    });
  } catch (error) {
    logger.error('Register error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Get current user
router.get('/me', authenticate, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        planType: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    logger.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Update profile
router.patch('/profile', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, avatarUrl } = req.body;

    const user = await prisma.user.update({
      where: { id: req.user!.userId },
      data: {
        ...(name !== undefined && { name }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      },
      select: {
        id: true,
        email: true,
        name: true,
        avatarUrl: true,
        planType: true,
        role: true,
        createdAt: true,
      },
    });

    res.json(user);
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Logout
router.post('/logout', authenticate, async (req: AuthRequest, res) => {
  try {
    // CRITICAL FIX: Revoke refresh token in database
    const refreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];
    if (refreshToken) {
      await revokeRefreshToken(refreshToken);
      logger.info(`Refresh token revoked for user ${req.user!.userId}`);
    }

    // Clear auth cookies
    clearAuthCookies(res);

    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    // Still clear cookies even if revocation fails
    clearAuthCookies(res);
    res.status(500).json({ error: 'Logout failed' });
  }
});

// CRITICAL FIX: Refresh access token using refresh token
// This endpoint allows clients to get a new access token when it expires
// Rate limited to prevent token refresh abuse
router.post('/refresh', authRateLimiter, async (req, res) => {
  try {
    const refreshToken = req.cookies[COOKIE_NAMES.REFRESH_TOKEN];

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    // Verify JWT signature and expiration
    let payload;
    try {
      payload = verifyRefreshToken(refreshToken);
    } catch (error) {
      logger.warn('Invalid refresh token JWT:', error);
      return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // CRITICAL FIX: Verify token hasn't been revoked
    const isValid = await verifyStoredRefreshToken(refreshToken);
    if (!isValid) {
      logger.warn(`Revoked or invalid refresh token used by user ${payload.userId}`);
      return res.status(401).json({ error: 'Refresh token has been revoked or expired' });
    }

    // Verify user still exists
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      logger.warn(`Refresh token for non-existent user ${payload.userId}`);
      return res.status(401).json({ error: 'User not found' });
    }

    // Generate new access token (NOT a new refresh token - refresh token rotation is optional)
    const newAccessToken = generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role as 'user' | 'admin',
    });

    // Set new access token in cookie
    res.cookie(COOKIE_NAMES.ACCESS_TOKEN, newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 15 * 60 * 1000, // 15 minutes
      path: '/',
    });

    res.json({
      message: 'Access token refreshed',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    logger.error('Token refresh error:', error);
    res.status(500).json({ error: 'Token refresh failed' });
  }
});

// CRITICAL FIX: Change password endpoint with token revocation
router.post('/change-password', authenticate, async (req: AuthRequest, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required' });
    }

    // Validate new password strength (minimum 8 characters with complexity)
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'New password must be at least 8 characters long' });
    }

    const hasUpperCase = /[A-Z]/.test(newPassword);
    const hasLowerCase = /[a-z]/.test(newPassword);
    const hasNumber = /[0-9]/.test(newPassword);

    if (!hasUpperCase || !hasLowerCase || !hasNumber) {
      return res.status(400).json({
        error: 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
      });
    }

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Verify current password
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password in database
    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // CRITICAL FIX: Revoke all refresh tokens for security
    // Forces re-authentication on all devices after password change
    await revokeAllUserTokens(userId);
    logger.info(`All refresh tokens revoked for user ${userId} after password change`);

    // Clear current session cookies
    clearAuthCookies(res);

    res.json({
      message: 'Password changed successfully. Please log in again with your new password.',
    });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// Verify email with token
router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Verification token is required' });
    }

    // Find user by verification token
    const user = await prisma.user.findFirst({
      where: {
        emailVerificationToken: token,
        emailVerificationExpiry: {
          gte: new Date(), // Token not expired
        },
      },
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid or expired verification token' });
    }

    // Update user as verified
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerified: true,
        emailVerificationToken: null,
        emailVerificationExpiry: null,
      },
    });

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    logger.error('Email verification error:', error);
    res.status(500).json({ error: 'Email verification failed' });
  }
});

// Resend verification email
// Rate limited to prevent email flooding
router.post('/resend-verification', authenticate, passwordResetRateLimiter, async (req: AuthRequest, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user!.userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (user.emailVerified) {
      return res.status(400).json({ error: 'Email already verified' });
    }

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Update user with new token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationToken: verificationToken,
        emailVerificationExpiry: verificationExpiry,
      },
    });

    // Send verification email
    await sendVerificationEmail(user.email, verificationToken);

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    logger.error('Resend verification error:', error);
    res.status(500).json({ error: 'Failed to resend verification email' });
  }
});

export default router;
