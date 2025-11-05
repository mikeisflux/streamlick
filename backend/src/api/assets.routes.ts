import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Get all assets for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type } = req.query;

    const assets = await prisma.asset.findMany({
      where: {
        userId: req.user!.userId,
        ...(type && { type: type as string }),
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(assets);
  } catch (error) {
    logger.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// Upload new asset (simplified - in production you'd use S3/presigned URLs)
router.post('/upload', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type, name, fileUrl, fileSizeBytes, mimeType, metadata } = req.body;

    const asset = await prisma.asset.create({
      data: {
        userId: req.user!.userId,
        type,
        name,
        fileUrl,
        fileSizeBytes: fileSizeBytes ? BigInt(fileSizeBytes) : null,
        mimeType,
        metadata: metadata || {},
      },
    });

    res.status(201).json(asset);
  } catch (error) {
    logger.error('Upload asset error:', error);
    res.status(500).json({ error: 'Failed to upload asset' });
  }
});

// Delete asset
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.asset.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    res.json({ message: 'Asset deleted successfully' });
  } catch (error) {
    logger.error('Delete asset error:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

export default router;
