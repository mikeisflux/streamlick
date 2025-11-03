import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

/**
 * Ban a participant from a broadcast
 * POST /api/broadcasts/:broadcastId/ban
 */
router.post('/:broadcastId/ban', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId } = req.params;
    const { participantId } = req.body;
    const userId = (req as any).user.userId;

    // Verify user owns the broadcast
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Create ban record
    const ban = await prisma.participantBan.create({
      data: {
        broadcastId,
        participantId,
        bannedAt: new Date(),
      },
    });

    logger.info(`Participant ${participantId} banned from broadcast ${broadcastId}`);

    res.json({ success: true, ban });
  } catch (error: any) {
    logger.error('Ban participant error:', error);
    res.status(500).json({ error: 'Failed to ban participant' });
  }
});

/**
 * Unban a participant from a broadcast
 * DELETE /api/broadcasts/:broadcastId/ban/:participantId
 */
router.delete('/:broadcastId/ban/:participantId', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId, participantId } = req.params;
    const userId = (req as any).user.userId;

    // Verify user owns the broadcast
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete ban record
    await prisma.participantBan.deleteMany({
      where: {
        broadcastId,
        participantId,
      },
    });

    logger.info(`Participant ${participantId} unbanned from broadcast ${broadcastId}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Unban participant error:', error);
    res.status(500).json({ error: 'Failed to unban participant' });
  }
});

/**
 * Get list of banned participants for a broadcast
 * GET /api/broadcasts/:broadcastId/bans
 */
router.get('/:broadcastId/bans', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId } = req.params;
    const userId = (req as any).user.userId;

    // Verify user owns the broadcast
    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    if (broadcast.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Get all bans for this broadcast
    const bans = await prisma.participantBan.findMany({
      where: { broadcastId },
      orderBy: { bannedAt: 'desc' },
    });

    res.json({ bans });
  } catch (error: any) {
    logger.error('Get bans error:', error);
    res.status(500).json({ error: 'Failed to get bans' });
  }
});

/**
 * Check if a participant is banned from a broadcast
 * GET /api/broadcasts/:broadcastId/ban-check/:participantId
 */
router.get('/:broadcastId/ban-check/:participantId', async (req: Request, res: Response) => {
  try {
    const { broadcastId, participantId } = req.params;

    const ban = await prisma.participantBan.findFirst({
      where: {
        broadcastId,
        participantId,
      },
    });

    res.json({ isBanned: !!ban });
  } catch (error: any) {
    logger.error('Ban check error:', error);
    res.status(500).json({ error: 'Failed to check ban status' });
  }
});

export default router;
