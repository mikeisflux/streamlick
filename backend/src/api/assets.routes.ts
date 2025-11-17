import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Get all assets for user (with pagination)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type } = req.query;

    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200); // Max 200 per page
    const skip = (page - 1) * limit;

    const where = {
      userId: req.user!.userId,
      ...(type && { type: type as string }),
    };

    // CRITICAL FIX: Add pagination to prevent performance issues with large asset collections
    const [assets, total] = await Promise.all([
      prisma.asset.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.asset.count({ where }),
    ]);

    // Return paginated response with metadata
    res.json({
      assets,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    logger.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

// Allowed MIME types for asset uploads
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
  // Videos
  'video/mp4',
  'video/webm',
  'video/ogg',
  'video/quicktime',
  'video/x-msvideo',
  // Audio
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/ogg',
  'audio/webm',
  'audio/aac',
  // Documents (if needed)
  'application/pdf',
];

// Upload new asset (simplified - in production you'd use S3/presigned URLs)
router.post('/upload', authenticate, async (req: AuthRequest, res) => {
  try {
    const { type, name, fileUrl, fileSizeBytes, mimeType, metadata } = req.body;

    // CRITICAL FIX: Validate required fields
    if (!type || !name || !fileUrl) {
      return res.status(400).json({ error: 'Missing required fields: type, name, fileUrl' });
    }

    // CRITICAL FIX: Validate MIME type if provided
    if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
      return res.status(400).json({
        error: 'Invalid MIME type',
        allowedTypes: ALLOWED_MIME_TYPES
      });
    }

    // CRITICAL FIX: Validate file size (max 2GB)
    if (fileSizeBytes && fileSizeBytes > 2 * 1024 * 1024 * 1024) {
      return res.status(400).json({ error: 'File size exceeds maximum allowed (2GB)' });
    }

    // CRITICAL FIX: Validate fileUrl format
    if (!fileUrl.startsWith('http://') && !fileUrl.startsWith('https://') && !fileUrl.startsWith('/')) {
      return res.status(400).json({ error: 'Invalid file URL format' });
    }

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
