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

// Create uploads directory if it doesn't exist
const UPLOAD_DIR = path.join(__dirname, '../../uploads/backgrounds');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only images are allowed.'));
    }
  },
});

/**
 * Upload custom background
 * POST /api/backgrounds/upload
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name } = req.body;

    // Save to database
    const background = await prisma.asset.create({
      data: {
        id: uuidv4(),
        userId,
        type: 'background',
        name: name || file.originalname,
        fileUrl: `/uploads/backgrounds/${file.filename}`,
        fileSizeBytes: file.size,
        mimeType: file.mimetype,
      },
    });

    logger.info(`Background uploaded: ${background.id} by user ${userId}`);

    res.json({ background });
  } catch (error: any) {
    logger.error('Background upload error:', error);
    res.status(500).json({ error: 'Failed to upload background' });
  }
});

/**
 * Get user's custom backgrounds
 * GET /api/backgrounds/custom
 */
router.get('/custom', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.userId;

    const backgrounds = await prisma.asset.findMany({
      where: {
        userId,
        type: 'background',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json({ backgrounds });
  } catch (error: any) {
    logger.error('Get backgrounds error:', error);
    res.status(500).json({ error: 'Failed to get backgrounds' });
  }
});

/**
 * Delete custom background
 * DELETE /api/backgrounds/:id
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = (req as any).user.userId;

    // Get background
    const background = await prisma.asset.findUnique({
      where: { id },
    });

    if (!background) {
      return res.status(404).json({ error: 'Background not found' });
    }

    if (background.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    // Delete file
    const filePath = path.join(__dirname, '../..', background.fileUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await prisma.asset.delete({
      where: { id },
    });

    logger.info(`Background deleted: ${id}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete background error:', error);
    res.status(500).json({ error: 'Failed to delete background' });
  }
});

export default router;
