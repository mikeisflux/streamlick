import { Router, Response } from 'express';
import { z } from 'zod';
import { prisma } from '../services/prisma.js';
import { authenticateToken } from '../middleware/auth.js';
import { AuthenticatedRequest } from '../types/index.js';

const router = Router();
router.use(authenticateToken);

// Validation schemas
const createDestinationSchema = z.object({
  name: z.string().min(1).max(100),
  platform: z.enum(['YOUTUBE', 'TWITCH', 'FACEBOOK', 'CUSTOM_RTMP']),
  rtmpUrl: z.string().url(),
  streamKey: z.string().min(1),
});

const updateDestinationSchema = createDestinationSchema.partial();

// GET /api/destinations - List user's destinations
router.get('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const destinations = await prisma.destination.findMany({
      where: { userId: req.user!.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json(destinations);
  } catch (error) {
    console.error('List destinations error:', error);
    res.status(500).json({ error: 'Failed to list destinations' });
  }
});

// POST /api/destinations - Create destination
router.post('/', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = createDestinationSchema.parse(req.body);

    const destination = await prisma.destination.create({
      data: {
        ...data,
        userId: req.user!.id,
      },
    });

    res.status(201).json(destination);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create destination error:', error);
    res.status(500).json({ error: 'Failed to create destination' });
  }
});

// GET /api/destinations/:id - Get destination
router.get('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const destination = await prisma.destination.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.json(destination);
  } catch (error) {
    console.error('Get destination error:', error);
    res.status(500).json({ error: 'Failed to get destination' });
  }
});

// PATCH /api/destinations/:id - Update destination
router.patch('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const data = updateDestinationSchema.parse(req.body);

    const result = await prisma.destination.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
      data,
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    const updated = await prisma.destination.findUnique({
      where: { id: req.params.id },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update destination error:', error);
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

// DELETE /api/destinations/:id - Delete destination
router.delete('/:id', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await prisma.destination.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.id,
      },
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.json({ message: 'Destination deleted' });
  } catch (error) {
    console.error('Delete destination error:', error);
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

export default router;
