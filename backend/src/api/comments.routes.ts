import { Router } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import { commentPostingService } from '../services/comment-posting.service';
import logger from '../utils/logger';

const router = Router();

/**
 * POST /api/comments/post
 * Post a comment to active streaming platforms
 */
router.post('/post', authenticate, async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const { message, platforms } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!platforms || !Array.isArray(platforms) || platforms.length === 0) {
      return res.status(400).json({ error: 'At least one platform must be specified' });
    }

    // Validate platforms
    const validPlatforms = ['youtube', 'facebook', 'twitch', 'linkedin', 'rumble'];
    const invalidPlatforms = platforms.filter(p => !validPlatforms.includes(p));
    if (invalidPlatforms.length > 0) {
      return res.status(400).json({
        error: `Invalid platforms: ${invalidPlatforms.join(', ')}`
      });
    }

    // Post to each platform
    const results = await commentPostingService.postToMultiplePlatforms(
      userId,
      message.trim(),
      platforms
    );

    // Check if all failed
    const allFailed = results.every(r => !r.success);
    if (allFailed) {
      return res.status(500).json({
        error: 'Failed to post to any platform',
        results,
      });
    }

    return res.status(200).json({
      message: 'Comment posted successfully',
      results,
    });
  } catch (error: any) {
    logger.error('Post comment error:', error);
    return res.status(500).json({ error: 'Failed to post comment' });
  }
});

export default router;
