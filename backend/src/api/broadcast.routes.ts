import { Router, Response } from 'express';
import { z } from 'zod';
import { randomBytes } from 'crypto';
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
  layout: z.string().optional(),
  backgroundColor: z.string().optional(),
  logoUrl: z.string().url().nullable().optional(),
  overlayText: z.string().nullable().optional(),
});

const updateBroadcastSchema = createBroadcastSchema.partial();

// GET /api/broadcasts - List user's broadcasts
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      where: { userId: req.user!.id },
      include: {
        participants: { select: { id: true, name: true, role: true, status: true } },
        outputs: { include: { destination: { select: { name: true, platform: true } } } },
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

    // Generate unique stream key
    const streamKey = randomBytes(16).toString('hex');

    // Get user name for host participant
    const user = await prisma.user.findUnique({
      where: { id: req.user!.id },
      select: { name: true, email: true },
    });

    const broadcast = await prisma.broadcast.create({
      data: {
        title: data.title,
        description: data.description,
        layout: data.layout || 'grid',
        backgroundColor: data.backgroundColor || '#1a1a2e',
        logoUrl: data.logoUrl,
        overlayText: data.overlayText,
        streamKey,
        userId: req.user!.id,
        // Create the host as a participant
        participants: {
          create: {
            name: user?.name || user?.email?.split('@')[0] || 'Host',
            role: 'HOST',
            status: 'WAITING',
            isOnStage: true,
            inviteToken: randomBytes(16).toString('hex'),
            userId: req.user!.id,
          },
        },
      },
      include: {
        participants: true,
        outputs: { include: { destination: true } },
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
          orderBy: { position: 'asc' },
        },
        outputs: {
          include: { destination: true },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(broadcast);
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
        layout: data.layout,
        backgroundColor: data.backgroundColor,
        logoUrl: data.logoUrl,
        overlayText: data.overlayText,
      },
    });

    if (broadcast.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
      include: { participants: true, outputs: { include: { destination: true } } },
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
      include: { outputs: { include: { destination: true } } },
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
      include: { participants: true, outputs: { include: { destination: true } } },
    });

    // Update all outputs to starting
    await prisma.broadcastOutput.updateMany({
      where: { broadcastId: req.params.id, status: 'IDLE' },
      data: { status: 'STARTING', startedAt: new Date() },
    });

    res.json(updated);
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

    // Update all outputs to stopped
    await prisma.broadcastOutput.updateMany({
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
    const { name, email } = z.object({
      name: z.string().min(1),
      email: z.string().email().optional(),
    }).parse(req.body);

    // Verify ownership
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Create participant with invite token
    const inviteToken = randomBytes(16).toString('hex');
    const participant = await prisma.participant.create({
      data: {
        name,
        email,
        role: 'GUEST',
        status: 'WAITING',
        inviteToken,
        broadcastId: req.params.id,
      },
    });

    // Generate invite URL
    const inviteUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/join/${inviteToken}`;

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

// POST /api/broadcasts/:id/outputs - Add output destination
router.post('/:id/outputs', async (req: AuthenticatedRequest, res: Response) => {
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
    const output = await prisma.broadcastOutput.create({
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
    console.error('Add output error:', error);
    res.status(500).json({ error: 'Failed to add output' });
  }
});

// DELETE /api/broadcasts/:id/outputs/:outputId - Remove output
router.delete('/:id/outputs/:outputId', async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Verify ownership through broadcast
    const broadcast = await prisma.broadcast.findFirst({
      where: { id: req.params.id, userId: req.user!.id },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    await prisma.broadcastOutput.delete({
      where: { id: req.params.outputId, broadcastId: broadcast.id },
    });

    res.json({ message: 'Output removed' });
  } catch (error) {
    console.error('Remove output error:', error);
    res.status(500).json({ error: 'Failed to remove output' });
  }
});

export default router;
