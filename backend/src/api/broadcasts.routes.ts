import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Get all broadcasts for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      where: { userId: req.user!.userId },
      include: {
        participants: true,
        recordings: true,
        broadcastDestinations: {
          include: { destination: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(broadcasts);
  } catch (error) {
    logger.error('Get broadcasts error:', error);
    res.status(500).json({ error: 'Failed to get broadcasts' });
  }
});

// Create new broadcast
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, scheduledAt, studioConfig } = req.body;

    const broadcast = await prisma.broadcast.create({
      data: {
        userId: req.user!.userId,
        title,
        description,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        studioConfig: studioConfig || {},
        status: 'scheduled',
      },
    });

    res.status(201).json(broadcast);
  } catch (error) {
    logger.error('Create broadcast error:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// Get broadcast details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        participants: true,
        recordings: true,
        broadcastDestinations: {
          include: { destination: true },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(broadcast);
  } catch (error) {
    logger.error('Get broadcast error:', error);
    res.status(500).json({ error: 'Failed to get broadcast' });
  }
});

// Update broadcast
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, scheduledAt, studioConfig, status } = req.body;

    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(studioConfig && { studioConfig }),
        ...(status && { status }),
      },
    });

    if (broadcast.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update broadcast error:', error);
    res.status(500).json({ error: 'Failed to update broadcast' });
  }
});

// Delete broadcast
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.broadcast.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({ message: 'Broadcast deleted successfully' });
  } catch (error) {
    logger.error('Delete broadcast error:', error);
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

// Start broadcast
router.post('/:id/start', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const updated = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: 'live',
        startedAt: new Date(),
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Start broadcast error:', error);
    res.status(500).json({ error: 'Failed to start broadcast' });
  }
});

// End broadcast
router.post('/:id/end', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const endedAt = new Date();
    const durationSeconds = broadcast.startedAt
      ? Math.floor((endedAt.getTime() - broadcast.startedAt.getTime()) / 1000)
      : 0;

    const updated = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: 'ended',
        endedAt,
        durationSeconds,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('End broadcast error:', error);
    res.status(500).json({ error: 'Failed to end broadcast' });
  }
});

// Get broadcast statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        participants: true,
        chatMessages: true,
        broadcastDestinations: true,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const stats = {
      totalParticipants: broadcast.participants.length,
      totalMessages: broadcast.chatMessages.length,
      totalViewers: broadcast.broadcastDestinations.reduce(
        (sum, dest) => sum + dest.viewerCount,
        0
      ),
      duration: broadcast.durationSeconds,
      platforms: broadcast.broadcastDestinations.map(dest => dest.status),
    };

    res.json(stats);
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

export default router;
