import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Get all recordings for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const recordings = await prisma.recording.findMany({
      where: {
        broadcast: {
          userId: req.user!.userId,
        },
      },
      include: {
        broadcast: {
          select: {
            id: true,
            title: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(recordings);
  } catch (error) {
    logger.error('Get recordings error:', error);
    res.status(500).json({ error: 'Failed to get recordings' });
  }
});

// Get recording details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const recording = await prisma.recording.findFirst({
      where: {
        id: req.params.id,
        broadcast: {
          userId: req.user!.userId,
        },
      },
      include: {
        broadcast: true,
      },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    res.json(recording);
  } catch (error) {
    logger.error('Get recording error:', error);
    res.status(500).json({ error: 'Failed to get recording' });
  }
});

// Delete recording
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const recording = await prisma.recording.findFirst({
      where: {
        id: req.params.id,
        broadcast: {
          userId: req.user!.userId,
        },
      },
    });

    if (!recording) {
      return res.status(404).json({ error: 'Recording not found' });
    }

    await prisma.recording.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Recording deleted successfully' });
  } catch (error) {
    logger.error('Delete recording error:', error);
    res.status(500).json({ error: 'Failed to delete recording' });
  }
});

export default router;
