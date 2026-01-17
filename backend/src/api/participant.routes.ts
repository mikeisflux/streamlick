import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// Helper to get studioConfig as object
function getStudioConfig(studioConfig: unknown): Record<string, unknown> {
  return (studioConfig as Record<string, unknown>) || {};
}

// GET /api/participants/join/:token - Get participant info by invite token (no auth required)
router.get('/join/:token', async (req, res) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { joinLinkToken: req.params.token },
      include: {
        broadcast: {
          select: {
            id: true,
            title: true,
            status: true,
            studioConfig: true,
          },
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    if (participant.status === 'LEFT') {
      return res.status(400).json({ error: 'This invite has expired' });
    }

    // Extract branding info from studioConfig for frontend compatibility
    const config = getStudioConfig(participant.broadcast.studioConfig);
    const response = {
      ...participant,
      broadcast: {
        ...participant.broadcast,
        backgroundColor: config.backgroundColor || '#1a1a2e',
        logoUrl: config.logoUrl || null,
      },
    };

    res.json(response);
  } catch (error) {
    console.error('Get participant error:', error);
    res.status(500).json({ error: 'Failed to get participant' });
  }
});

// POST /api/participants/join/:token - Join broadcast as guest
router.post('/join/:token', async (req, res) => {
  try {
    const { name } = z.object({
      name: z.string().min(1).optional(),
    }).parse(req.body);

    const participant = await prisma.participant.findUnique({
      where: { joinLinkToken: req.params.token },
      include: {
        broadcast: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    if (participant.broadcast.status === 'ENDED') {
      return res.status(400).json({ error: 'This broadcast has ended' });
    }

    // Update participant
    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        name: name || participant.name,
        status: 'GREENROOM',
        joinedAt: new Date(),
      },
      include: {
        broadcast: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Join error:', error);
    res.status(500).json({ error: 'Failed to join' });
  }
});

// Authenticated routes below
router.use(authenticateToken);

// PATCH /api/participants/:id - Update participant (host only)
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = z.object({
      name: z.string().min(1).optional(),
      status: z.enum(['WAITING', 'GREENROOM', 'ONSTAGE', 'LEFT']).optional(),
    }).parse(req.body);

    // Verify the participant belongs to a broadcast owned by the user
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: { select: { userId: true } } },
    });

    if (!participant || participant.broadcast.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const updated = await prisma.participant.update({
      where: { id: req.params.id },
      data: {
        name: data.name,
        status: data.status,
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update participant error:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// POST /api/participants/:id/bring-on-stage - Bring participant on stage
router.post('/:id/bring-on-stage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: { select: { userId: true } } },
    });

    if (!participant || participant.broadcast.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const updated = await prisma.participant.update({
      where: { id: req.params.id },
      data: {
        status: 'ONSTAGE',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Bring on stage error:', error);
    res.status(500).json({ error: 'Failed to bring participant on stage' });
  }
});

// POST /api/participants/:id/remove-from-stage - Remove participant from stage
router.post('/:id/remove-from-stage', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: { select: { userId: true } } },
    });

    if (!participant || participant.broadcast.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    const updated = await prisma.participant.update({
      where: { id: req.params.id },
      data: {
        status: 'GREENROOM',
      },
    });

    res.json(updated);
  } catch (error) {
    console.error('Remove from stage error:', error);
    res.status(500).json({ error: 'Failed to remove participant from stage' });
  }
});

// DELETE /api/participants/:id - Remove participant from broadcast
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: { select: { userId: true } } },
    });

    if (!participant || participant.broadcast.userId !== req.user!.id) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    await prisma.participant.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Participant removed' });
  } catch (error) {
    console.error('Delete participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

export default router;
