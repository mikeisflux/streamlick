import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticateToken);

// POST /api/compositor/:broadcastId/layout - Update broadcast layout
router.post('/:broadcastId/layout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { layout } = z.object({
      layout: z.enum(['grid', 'spotlight', 'side-by-side', 'picture-in-picture', 'single']),
    }).parse(req.body);

    await prisma.broadcast.update({
      where: { id: req.params.broadcastId, userId: req.user!.id },
      data: { layout },
    });

    res.json({ layout });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update layout error:', error);
    res.status(500).json({ error: 'Failed to update layout' });
  }
});

// POST /api/compositor/:broadcastId/branding - Update branding
router.post('/:broadcastId/branding', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = z.object({
      backgroundColor: z.string().optional(),
      logoUrl: z.string().url().nullable().optional(),
      overlayText: z.string().nullable().optional(),
    }).parse(req.body);

    const broadcast = await prisma.broadcast.update({
      where: { id: req.params.broadcastId, userId: req.user!.id },
      data,
      select: { backgroundColor: true, logoUrl: true, overlayText: true },
    });

    res.json(broadcast);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// POST /api/compositor/:broadcastId/reorder - Reorder participants
router.post('/:broadcastId/reorder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participantIds } = z.object({
      participantIds: z.array(z.string()),
    }).parse(req.body);

    // Verify ownership
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.broadcastId, userId: req.user!.id },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Update positions
    await Promise.all(
      participantIds.map((id, index) =>
        prisma.participant.update({
          where: { id },
          data: { position: index },
        })
      )
    );

    const participants = await prisma.participant.findMany({
      where: { broadcastId: broadcast.id },
      orderBy: { position: 'asc' },
    });

    res.json(participants);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Reorder error:', error);
    res.status(500).json({ error: 'Failed to reorder participants' });
  }
});

// GET /api/compositor/:broadcastId/state - Get compositor state
router.get('/:broadcastId/state', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.broadcastId, userId: req.user!.id },
      include: {
        participants: {
          where: { isOnStage: true },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({
      broadcastId: broadcast.id,
      layout: broadcast.layout,
      backgroundColor: broadcast.backgroundColor,
      logoUrl: broadcast.logoUrl,
      overlayText: broadcast.overlayText,
      participants: broadcast.participants.map((p: typeof broadcast.participants[number]) => ({
        id: p.id,
        name: p.name,
        streamId: p.streamId,
        position: p.position,
        audioEnabled: p.audioEnabled,
        videoEnabled: p.videoEnabled,
      })),
    });
  } catch (error) {
    console.error('Get compositor state error:', error);
    res.status(500).json({ error: 'Failed to get compositor state' });
  }
});

export default router;
