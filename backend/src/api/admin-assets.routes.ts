import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { authenticate as authMiddleware } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// Middleware to check admin role
const adminMiddleware = async (req: Request, res: Response, next: any) => {
  try {
    const userId = (req as any).user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (error) {
    logger.error('Admin middleware error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

// Create upload directories
const UPLOAD_DIRS = {
  backgrounds: path.join(__dirname, '../../uploads/assets/backgrounds'),
  sounds: path.join(__dirname, '../../uploads/assets/sounds'),
  images: path.join(__dirname, '../../uploads/assets/images'),
  overlays: path.join(__dirname, '../../uploads/assets/overlays'),
};

Object.values(UPLOAD_DIRS).forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure multer for file uploads
const createMulterStorage = (assetType: string) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, UPLOAD_DIRS[assetType as keyof typeof UPLOAD_DIRS]);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
      cb(null, uniqueName);
    },
  });
};

const createUploadMiddleware = (assetType: string, mimeTypes: string[]) => {
  return multer({
    storage: createMulterStorage(assetType),
    limits: {
      fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (req, file, cb) => {
      if (mimeTypes.some(type => file.mimetype.startsWith(type))) {
        cb(null, true);
      } else {
        cb(new Error(`Invalid file type. Allowed: ${mimeTypes.join(', ')}`));
      }
    },
  });
};

/**
 * Get all assets of a specific type
 * GET /api/admin/assets/:type
 */
router.get('/:type', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    if (!['backgrounds', 'sounds', 'images', 'overlays'].includes(type)) {
      return res.status(400).json({ error: 'Invalid asset type' });
    }

    const assets = await prisma.defaultAsset.findMany({
      where: { type },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ assets });
  } catch (error: any) {
    logger.error('Get assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

/**
 * Upload a new default asset
 * POST /api/admin/assets/:type/upload
 */
router.post('/:type/upload', authMiddleware, adminMiddleware, (req: Request, res: Response, next: any) => {
  const { type } = req.params;

  let mimeTypes: string[] = [];
  if (type === 'backgrounds' || type === 'images') {
    mimeTypes = ['image/'];
  } else if (type === 'sounds') {
    mimeTypes = ['audio/'];
  } else if (type === 'overlays') {
    mimeTypes = ['image/', 'video/'];
  } else {
    return res.status(400).json({ error: 'Invalid asset type' });
  }

  const upload = createUploadMiddleware(type, mimeTypes);

  upload.single('file')(req, res, async (err) => {
    if (err) {
      logger.error('Upload error:', err);
      return res.status(400).json({ error: err.message });
    }

    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'No file uploaded' });
      }

      const { name, category, isDefault } = req.body;

      const asset = await prisma.defaultAsset.create({
        data: {
          id: uuidv4(),
          type,
          name: name || file.originalname,
          category: category || 'default',
          url: `/uploads/assets/${type}/${file.filename}`,
          fileSizeBytes: file.size,
          mimeType: file.mimetype,
          isDefault: isDefault === 'true',
          isActive: true,
        },
      });

      logger.info(`Default asset uploaded: ${asset.id} (${type})`);

      res.json({ asset });
    } catch (error: any) {
      logger.error('Create asset error:', error);
      res.status(500).json({ error: 'Failed to create asset' });
    }
  });
});

/**
 * Update asset properties
 * PATCH /api/admin/assets/:type/:id
 */
router.patch('/:type/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;
    const { name, category, isActive } = req.body;

    const asset = await prisma.defaultAsset.findUnique({
      where: { id },
    });

    if (!asset || asset.type !== type) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    const updated = await prisma.defaultAsset.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(category !== undefined && { category }),
        ...(isActive !== undefined && { isActive }),
        updatedAt: new Date(),
      },
    });

    logger.info(`Asset updated: ${id}`);

    res.json({ asset: updated });
  } catch (error: any) {
    logger.error('Update asset error:', error);
    res.status(500).json({ error: 'Failed to update asset' });
  }
});

/**
 * Delete asset
 * DELETE /api/admin/assets/:type/:id
 */
router.delete('/:type/:id', authMiddleware, adminMiddleware, async (req: Request, res: Response) => {
  try {
    const { type, id } = req.params;

    const asset = await prisma.defaultAsset.findUnique({
      where: { id },
    });

    if (!asset || asset.type !== type) {
      return res.status(404).json({ error: 'Asset not found' });
    }

    // Delete file from disk
    const filePath = path.join(__dirname, '../..', asset.url);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.defaultAsset.delete({
      where: { id },
    });

    logger.info(`Asset deleted: ${id}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete asset error:', error);
    res.status(500).json({ error: 'Failed to delete asset' });
  }
});

/**
 * Get active assets for users (public endpoint)
 * GET /api/assets/:type/defaults
 */
router.get('/:type/defaults', async (req: Request, res: Response) => {
  try {
    const { type } = req.params;

    if (!['backgrounds', 'sounds', 'images', 'overlays'].includes(type)) {
      return res.status(400).json({ error: 'Invalid asset type' });
    }

    const assets = await prisma.defaultAsset.findMany({
      where: {
        type,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        url: true,
        thumbnailUrl: true,
        category: true,
        type: true,
      },
    });

    res.json({ assets });
  } catch (error: any) {
    logger.error('Get default assets error:', error);
    res.status(500).json({ error: 'Failed to get assets' });
  }
});

export default router;
