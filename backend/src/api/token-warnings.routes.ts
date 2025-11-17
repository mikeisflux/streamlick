import { Router } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import { getDestinationsWithExpiringTokens, isTokenExpiringSoon } from '../services/facebook.service';
import logger from '../utils/logger';
import prisma from '../database/prisma';

const router = Router();

/**
 * Get destinations with expiring tokens for the authenticated user
 */
router.get('/expiring-tokens', authenticate, async (req: AuthRequest, res) => {
  try {
    const daysUntilExpiry = parseInt(req.query.days as string) || 7;

    const expiringDestinations = await getDestinationsWithExpiringTokens(daysUntilExpiry);

    // Filter to only this user's destinations
    const userDestinations = expiringDestinations.filter(
      dest => dest.userId === req.user!.userId
    );

    return res.json({
      destinations: userDestinations,
      count: userDestinations.length,
    });
  } catch (error) {
    logger.error('Error getting expiring tokens:', error);
    return res.status(500).json({ error: 'Failed to check expiring tokens' });
  }
});

/**
 * Check if a specific destination's token is expiring soon
 */
router.get('/check-destination/:destinationId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { destinationId } = req.params;
    const warningDays = parseInt(req.query.days as string) || 7;

    // CRITICAL FIX: Verify ownership before checking (IDOR protection)
    const destination = await prisma.destination.findUnique({
      where: { id: destinationId },
    });

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    if (destination.userId !== req.user!.userId) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    const result = await isTokenExpiringSoon(destinationId, warningDays);

    return res.json(result);
  } catch (error) {
    logger.error('Error checking destination token:', error);
    return res.status(500).json({ error: 'Failed to check destination token' });
  }
});

export default router;
