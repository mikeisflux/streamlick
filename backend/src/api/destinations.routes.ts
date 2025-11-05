import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import { encrypt, decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();

// Get all destinations for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const destinations = await prisma.destination.findMany({
      where: { userId: req.user!.userId },
      select: {
        id: true,
        platform: true,
        platformUserId: true,
        displayName: true,
        rtmpUrl: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    res.json(destinations);
  } catch (error) {
    logger.error('Get destinations error:', error);
    res.status(500).json({ error: 'Failed to get destinations' });
  }
});

// Add new destination
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { platform, displayName, rtmpUrl, streamKey, accessToken } = req.body;

    const destination = await prisma.destination.create({
      data: {
        userId: req.user!.userId,
        platform,
        displayName,
        rtmpUrl,
        streamKey: streamKey ? encrypt(streamKey) : null,
        accessToken: accessToken ? encrypt(accessToken) : null,
        isActive: true,
      },
    });

    res.status(201).json({
      id: destination.id,
      platform: destination.platform,
      displayName: destination.displayName,
      rtmpUrl: destination.rtmpUrl,
      isActive: destination.isActive,
    });
  } catch (error) {
    logger.error('Add destination error:', error);
    res.status(500).json({ error: 'Failed to add destination' });
  }
});

// Get destination details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const destination = await prisma.destination.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!destination) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.json({
      id: destination.id,
      platform: destination.platform,
      displayName: destination.displayName,
      rtmpUrl: destination.rtmpUrl,
      isActive: destination.isActive,
      createdAt: destination.createdAt,
      updatedAt: destination.updatedAt,
    });
  } catch (error) {
    logger.error('Get destination error:', error);
    res.status(500).json({ error: 'Failed to get destination' });
  }
});

// Update destination
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { displayName, rtmpUrl, streamKey, isActive } = req.body;

    const updated = await prisma.destination.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      data: {
        ...(displayName && { displayName }),
        ...(rtmpUrl && { rtmpUrl }),
        ...(streamKey && { streamKey: encrypt(streamKey) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    if (updated.count === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    const destination = await prisma.destination.findUnique({
      where: { id: req.params.id },
    });

    res.json({
      id: destination!.id,
      platform: destination!.platform,
      displayName: destination!.displayName,
      rtmpUrl: destination!.rtmpUrl,
      isActive: destination!.isActive,
    });
  } catch (error) {
    logger.error('Update destination error:', error);
    res.status(500).json({ error: 'Failed to update destination' });
  }
});

// Delete destination
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.destination.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Destination not found' });
    }

    res.json({ message: 'Destination deleted successfully' });
  } catch (error) {
    logger.error('Delete destination error:', error);
    res.status(500).json({ error: 'Failed to delete destination' });
  }
});

export default router;
