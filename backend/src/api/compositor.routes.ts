import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticateToken);

// Helper to get studioConfig as object
function getStudioConfig(broadcast: { studioConfig: unknown }): Record<string, unknown> {
  return (broadcast.studioConfig as Record<string, unknown>) || {};
}

// POST /api/compositor/:broadcastId/layout - Update broadcast layout
router.post('/:broadcastId/layout', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { layout } = z.object({
      layout: z.enum(['grid', 'spotlight', 'side-by-side', 'picture-in-picture', 'single']),
    }).parse(req.body);

    // Get current broadcast to preserve existing studioConfig
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.broadcastId,
        userId: req.user!.id,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const currentConfig = getStudioConfig(broadcast);
    const updatedConfig = { ...currentConfig, layout };

    await prisma.broadcast.update({
      where: { id: req.params.broadcastId },
      data: { studioConfig: updatedConfig },
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

    // Get current broadcast to preserve existing studioConfig
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.broadcastId,
        userId: req.user!.id,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const currentConfig = getStudioConfig(broadcast);
    const updatedConfig = {
      ...currentConfig,
      ...(data.backgroundColor !== undefined && { backgroundColor: data.backgroundColor }),
      ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
      ...(data.overlayText !== undefined && { overlayText: data.overlayText }),
    };

    await prisma.broadcast.update({
      where: { id: req.params.broadcastId },
      data: { studioConfig: updatedConfig },
    });

    res.json({
      backgroundColor: updatedConfig.backgroundColor || '#1a1a2e',
      logoUrl: updatedConfig.logoUrl || null,
      overlayText: updatedConfig.overlayText || null,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update branding error:', error);
    res.status(500).json({ error: 'Failed to update branding' });
  }
});

// POST /api/compositor/:broadcastId/reorder - Reorder participants
// Note: Since position is managed client-side, this returns participants in order received
router.post('/:broadcastId/reorder', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { participantIds } = z.object({
      participantIds: z.array(z.string()),
    }).parse(req.body);

    // Verify ownership
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.broadcastId, userId: req.user!.id },
      include: { participants: true },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Return participants in the order specified by participantIds
    type ParticipantType = typeof broadcast.participants[number];
    const participantMap = new Map<string, ParticipantType>(
      broadcast.participants.map((p: ParticipantType) => [p.id, p])
    );
    const orderedParticipants = participantIds
      .map((id: string) => participantMap.get(id))
      .filter(Boolean);

    // Add any remaining participants not in the list
    const orderedSet = new Set(participantIds);
    const remaining = broadcast.participants.filter((p: ParticipantType) => !orderedSet.has(p.id));

    res.json([...orderedParticipants, ...remaining]);
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
      where: {
        id: req.params.broadcastId,
        userId: req.user!.id,
      },
      include: {
        participants: {
          where: { status: 'ONSTAGE' },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const config = getStudioConfig(broadcast);

    type ParticipantType = typeof broadcast.participants[number];
    res.json({
      broadcastId: broadcast.id,
      layout: config.layout || 'grid',
      backgroundColor: config.backgroundColor || '#1a1a2e',
      logoUrl: config.logoUrl || null,
      overlayText: config.overlayText || null,
      participants: broadcast.participants.map((p: ParticipantType, index: number) => ({
        id: p.id,
        name: p.name,
        position: index, // Use array index as position
      })),
    });
  } catch (error) {
    console.error('Get compositor state error:', error);
    res.status(500).json({ error: 'Failed to get compositor state' });
  }
});

export default router;
