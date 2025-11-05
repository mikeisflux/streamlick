import { Router } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import chatModerationService from '../services/chat-moderation.service';
import logger from '../utils/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * Ban user from chat on specific platform
 */
router.post('/:broadcastId/ban', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { platform, userId, username, reason } = req.body;
    const moderatorId = req.user!.userId;

    if (!platform || !userId || !username) {
      return res.status(400).json({ error: 'Platform, userId, and username are required' });
    }

    const action = await chatModerationService.banUser(
      broadcastId,
      platform,
      userId,
      username,
      reason || 'Banned by moderator',
      moderatorId
    );

    res.json(action);
  } catch (error: any) {
    logger.error('Ban user error:', error);
    res.status(500).json({ error: error.message || 'Failed to ban user' });
  }
});

/**
 * Timeout user from chat on specific platform
 */
router.post('/:broadcastId/timeout', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { platform, userId, username, duration, reason } = req.body;
    const moderatorId = req.user!.userId;

    if (!platform || !userId || !username || !duration) {
      return res.status(400).json({ error: 'Platform, userId, username, and duration are required' });
    }

    const action = await chatModerationService.timeoutUser(
      broadcastId,
      platform,
      userId,
      username,
      parseInt(duration, 10),
      reason || 'Timed out by moderator',
      moderatorId
    );

    res.json(action);
  } catch (error: any) {
    logger.error('Timeout user error:', error);
    res.status(500).json({ error: error.message || 'Failed to timeout user' });
  }
});

/**
 * Unban user from chat
 */
router.post('/:broadcastId/unban', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { platform, userId, username } = req.body;
    const moderatorId = req.user!.userId;

    if (!platform || !userId || !username) {
      return res.status(400).json({ error: 'Platform, userId, and username are required' });
    }

    await chatModerationService.unbanUser(
      broadcastId,
      platform,
      userId,
      username,
      moderatorId
    );

    res.json({ message: 'User unbanned successfully' });
  } catch (error: any) {
    logger.error('Unban user error:', error);
    res.status(500).json({ error: error.message || 'Failed to unban user' });
  }
});

/**
 * Ban user from all connected platforms
 */
router.post('/:broadcastId/ban-cross-platform', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { userId, username, reason } = req.body;
    const moderatorId = req.user!.userId;

    if (!userId || !username) {
      return res.status(400).json({ error: 'userId and username are required' });
    }

    const actions = await chatModerationService.banUserCrossPlatform(
      broadcastId,
      userId,
      username,
      reason || 'Banned cross-platform by moderator',
      moderatorId
    );

    res.json({ actions, count: actions.length });
  } catch (error: any) {
    logger.error('Cross-platform ban error:', error);
    res.status(500).json({ error: error.message || 'Failed to ban user cross-platform' });
  }
});

/**
 * Get moderation history for broadcast
 */
router.get('/:broadcastId/history', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 100;

    const history = await chatModerationService.getModerationHistory(broadcastId, limit);

    res.json(history);
  } catch (error: any) {
    logger.error('Get moderation history error:', error);
    res.status(500).json({ error: error.message || 'Failed to get moderation history' });
  }
});

/**
 * Get active moderation actions for broadcast
 */
router.get('/:broadcastId/active', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    const actions = await chatModerationService.getActiveActions(broadcastId);

    res.json(actions);
  } catch (error: any) {
    logger.error('Get active actions error:', error);
    res.status(500).json({ error: error.message || 'Failed to get active actions' });
  }
});

/**
 * Check if user is moderated
 */
router.get('/:broadcastId/check/:platform/:userId', async (req: AuthRequest, res) => {
  try {
    const { broadcastId, platform, userId } = req.params;

    const result = await chatModerationService.isUserModerated(broadcastId, platform, userId);

    res.json(result);
  } catch (error: any) {
    logger.error('Check user moderated error:', error);
    res.status(500).json({ error: error.message || 'Failed to check user status' });
  }
});

export default router;
