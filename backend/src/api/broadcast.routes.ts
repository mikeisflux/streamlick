import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Validation schemas
const createBroadcastSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  studioConfig: z.record(z.unknown()).optional(),
});

const updateBroadcastSchema = createBroadcastSchema.partial();

// GET /api/broadcasts - List user's broadcasts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      where: { userId: req.user!.id },
      include: {
        participants: { select: { id: true, name: true, role: true, status: true } },
        destinations: { include: { destination: { select: { name: true, platform: true } } } },
        _count: { select: { participants: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(broadcasts);
  } catch (error) {
    console.error('List broadcasts error:', error);
    res.status(500).json({ error: 'Failed to list broadcasts' });
  }
});

// POST /api/broadcasts - Create new broadcast
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createBroadcastSchema.parse(req.body);

    const broadcast = await prisma.broadcast.create({
      data: {
        title: data.title,
        description: data.description,
        studioConfig: data.studioConfig || {},
        userId: req.user!.id,
        // Create the host as a participant
        participants: {
          create: {
            name: req.user!.email.split('@')[0],
            role: 'HOST',
            status: 'WAITING',
            userId: req.user!.id,
          },
        },
      },
      include: {
        participants: true,
      },
    });

    res.status(201).json(broadcast);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create broadcast error:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// GET /api/broadcasts/:id - Get broadcast details
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      include: {
        participants: {
          orderBy: { createdAt: 'asc' },
        },
        destinations: {
          include: { destination: true },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Parse studioConfig and add legacy fields for frontend compatibility
    const config = (broadcast.studioConfig as Record<string, unknown>) || {};
    const response = {
      ...broadcast,
      layout: config.layout || 'grid',
      backgroundColor: config.backgroundColor || '#1a1a2e',
      logoUrl: config.logoUrl || null,
      overlayText: config.overlayText || null,
      outputs: broadcast.destinations, // Legacy alias
    };

    res.json(response);
  } catch (error) {
    console.error('Get broadcast error:', error);
    res.status(500).json({ error: 'Failed to get broadcast' });
  }
});

// PATCH /api/broadcasts/:id - Update broadcast
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updateBroadcastSchema.parse(req.body);

    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      data: {
        title: data.title,
        description: data.description,
        studioConfig: data.studioConfig,
      },
    });

    if (broadcast.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
      include: { participants: true },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update broadcast error:', error);
    res.status(500).json({ error: 'Failed to update broadcast' });
  }
});

// DELETE /api/broadcasts/:id - Delete broadcast
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const deleted = await prisma.broadcast.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({ message: 'Broadcast deleted' });
  } catch (error) {
    console.error('Delete broadcast error:', error);
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

// POST /api/broadcasts/:id/start - Start greenroom
router.post('/:id/start', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        status: 'IDLE',
      },
      data: {
        status: 'GREENROOM',
      },
    });

    if (broadcast.count === 0) {
      return res.status(400).json({ error: 'Broadcast not found or already started' });
    }

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
      include: { participants: true },
    });

    res.json(updated);
  } catch (error) {
    console.error('Start broadcast error:', error);
    res.status(500).json({ error: 'Failed to start broadcast' });
  }
});

// POST /api/broadcasts/:id/go-live - Start live streaming
router.post('/:id/go-live', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        status: 'GREENROOM',
      },
      include: { destinations: { include: { destination: true } } },
    });

    if (!broadcast) {
      return res.status(400).json({ error: 'Broadcast not found or not in greenroom' });
    }

    // Update status to LIVE
    const updated = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: 'LIVE',
        startedAt: new Date(),
      },
      include: { participants: true, destinations: { include: { destination: true } } },
    });

    // Update all destinations to starting
    await prisma.broadcastDestination.updateMany({
      where: { broadcastId: req.params.id, status: 'IDLE' },
      data: { status: 'STARTING', startedAt: new Date() },
    });

    res.json({ ...updated, outputs: updated.destinations });
  } catch (error) {
    console.error('Go live error:', error);
    res.status(500).json({ error: 'Failed to go live' });
  }
});

// POST /api/broadcasts/:id/end - End broadcast
router.post('/:id/end', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
        status: { in: ['GREENROOM', 'LIVE'] },
      },
      data: {
        status: 'ENDED',
        endedAt: new Date(),
      },
    });

    if (broadcast.count === 0) {
      return res.status(400).json({ error: 'Broadcast not found or already ended' });
    }

    // Update all destinations to stopped
    await prisma.broadcastDestination.updateMany({
      where: { broadcastId: req.params.id },
      data: { status: 'STOPPED', endedAt: new Date() },
    });

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
    });

    res.json(updated);
  } catch (error) {
    console.error('End broadcast error:', error);
    res.status(500).json({ error: 'Failed to end broadcast' });
  }
});

// POST /api/broadcasts/:id/invite - Create guest invite link
router.post('/:id/invite', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name } = z.object({
      name: z.string().min(1),
    }).parse(req.body);

    // Verify ownership
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Create participant with invite token
    const participant = await prisma.participant.create({
      data: {
        name,
        role: 'GUEST',
        status: 'WAITING',
        broadcastId: req.params.id,
      },
    });

    // Generate invite URL using joinLinkToken
    const inviteUrl = `${process.env.FRONTEND_URL}/join/${participant.joinLinkToken}`;

    res.json({
      participant,
      inviteUrl,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create invite error:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// POST /api/broadcasts/:id/destinations - Add destination to broadcast
router.post('/:id/destinations', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { destinationId } = z.object({
      destinationId: z.string(),
    }).parse(req.body);

    // Verify ownership
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Verify destination ownership
    const destination = await prisma.destination.findFirst({
      where: { id: destinationId, userId: req.user!.id },
    });

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    // Create output
    const output = await prisma.broadcastDestination.create({
      data: {
        broadcastId: req.params.id,
        destinationId,
      },
      include: { destination: true },
    });

    res.json(output);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Add destination error:', error);
    res.status(500).json({ error: 'Failed to add destination' });
  }
});

export default router;
