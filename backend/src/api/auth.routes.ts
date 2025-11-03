import { Router } from 'express';
import prisma from '../database/prisma';
import { generateMagicLinkToken, verifyMagicLinkToken, generateAccessToken, generateRefreshToken } from '../auth/jwt';
import { sendMagicLink } from '../services/email';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Send magic link
router.post('/send-magic-link', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Valid email is required' });
    }

    // Find or create user
    let user = await prisma.user.findUnique({ where: { email } });

    if (!user) {
      user = await prisma.user.create({
        data: { email, planType: 'free' },
      });
    }

    const token = generateMagicLinkToken(email);
    await sendMagicLink(email, token);

    res.json({ message: 'Magic link sent to your email' });
  } catch (error) {
    logger.error('Send magic link error:', error);
    res.status(500).json({ error: 'Failed to send magic link' });
  }
});

// Verify magic link token
router.post('/verify-token', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    const payload = verifyMagicLinkToken(token);
    const user = await prisma.user.findUnique({ where: { email: payload.email } });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const accessToken = generateAccessToken({ userId: user.id, email: user.email });
    const refreshToken = generateRefreshToken({ userId: user.id, email: user.email });

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        planType: user.planType,
      },
    });
  } catch (error) {
    logger.error('Verify token error:', error);
    res.status(401).json({ error: 'Invalid or expired token' });
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
  // In a production app, you'd invalidate the refresh token here
  res.json({ message: 'Logged out successfully' });
});

export default router;
