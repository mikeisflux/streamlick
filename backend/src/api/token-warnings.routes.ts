import { Router } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import { getDestinationsWithExpiringTokens, isTokenExpiringSoon } from '../services/facebook.service';
import logger from '../utils/logger';

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

    res.json({
      destinations: userDestinations,
      count: userDestinations.length,
    });
  } catch (error) {
    logger.error('Error getting expiring tokens:', error);
    res.status(500).json({ error: 'Failed to check expiring tokens' });
  }
});

/**
 * Check if a specific destination's token is expiring soon
 */
router.get('/check-destination/:destinationId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { destinationId } = req.params;
    const warningDays = parseInt(req.query.days as string) || 7;

    const result = await isTokenExpiringSoon(destinationId, warningDays);

    res.json(result);
  } catch (error) {
    logger.error('Error checking destination token:', error);
    res.status(500).json({ error: 'Failed to check destination token' });
  }
});

export default router;
