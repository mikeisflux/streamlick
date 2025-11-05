import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';

const router = Router();

// Configure multer for file uploads
const UPLOAD_DIR = path.join(__dirname, '../../uploads/media-clips');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

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
    fileSize: 100 * 1024 * 1024, // 100MB max file size
  },
  fileFilter: (req, file, cb) => {
    // Accept video, audio, and image files
    const allowedMimeTypes = [
      // Video
      'video/mp4',
      'video/webm',
      'video/ogg',
      'video/quicktime',
      // Audio
      'audio/mpeg',
      'audio/mp3',
      'audio/wav',
      'audio/ogg',
      'audio/webm',
      // Image
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
    ];

    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only video, audio, and image files are allowed.'));
    }
  },
});

/**
 * GET /api/media-clips
 * Get all media clips for the authenticated user
 */
router.get('/', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { type } = req.query;

    // In production, fetch from database
    // For now, return mock data structure
    const clips = [];

    if (type) {
      // Filter by type if provided
    }

    res.json({ clips });
  } catch (error: any) {
    logger.error('Get media clips error:', error);
    res.status(500).json({ error: 'Failed to retrieve media clips' });
  }
});

/**
 * POST /api/media-clips/upload
 * Upload a new media clip
 */
router.post('/upload', authMiddleware, upload.single('file'), async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, description, hotkey, volume } = req.body;

    // Determine clip type from mime type
    let clipType: 'video' | 'audio' | 'image';
    if (file.mimetype.startsWith('video/')) {
      clipType = 'video';
    } else if (file.mimetype.startsWith('audio/')) {
      clipType = 'audio';
    } else if (file.mimetype.startsWith('image/')) {
      clipType = 'image';
    } else {
      // Clean up uploaded file
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Invalid file type' });
    }

    // Generate URL for the uploaded file
    const fileUrl = `/uploads/media-clips/${file.filename}`;

    // Create clip record
    const clip = {
      id: uuidv4(),
      userId,
      name: name || file.originalname,
      description: description || null,
      type: clipType,
      url: fileUrl,
      thumbnailUrl: null, // Could generate thumbnails for videos
      duration: null, // Could extract duration from video/audio metadata
      fileSize: file.size,
      mimeType: file.mimetype,
      hotkey: hotkey || null,
      volume: volume ? parseInt(volume) : 100,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In production, save to database
    // await db.mediaClip.create({ data: clip });

    logger.info(`Media clip uploaded: ${clip.name} (${clip.type}) by user ${userId}`);

    res.status(201).json({ clip });
  } catch (error: any) {
    logger.error('Upload media clip error:', error);
    res.status(500).json({ error: 'Failed to upload media clip' });
  }
});

/**
 * POST /api/media-clips/link
 * Link an external media file by URL
 */
router.post('/link', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { url, name, description, type, hotkey, volume } = req.body;

    if (!url || !name || !type) {
      return res.status(400).json({ error: 'URL, name, and type are required' });
    }

    if (!['video', 'audio', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Type must be video, audio, or image' });
    }

    const clip = {
      id: uuidv4(),
      userId,
      name,
      description: description || null,
      type,
      url,
      thumbnailUrl: null,
      duration: null,
      fileSize: 0, // Unknown for external files
      mimeType: '', // Unknown for external files
      hotkey: hotkey || null,
      volume: volume || 100,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // In production, save to database
    // await db.mediaClip.create({ data: clip });

    logger.info(`Media clip linked: ${clip.name} (${clip.type}) by user ${userId}`);

    res.status(201).json({ clip });
  } catch (error: any) {
    logger.error('Link media clip error:', error);
    res.status(500).json({ error: 'Failed to link media clip' });
  }
});

/**
 * PATCH /api/media-clips/:id
 * Update a media clip
 */
router.patch('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const { name, description, hotkey, volume, isActive } = req.body;

    // In production, update in database
    // await db.mediaClip.update({
    //   where: { id, userId },
    //   data: { name, description, hotkey, volume, isActive, updatedAt: new Date() }
    // });

    logger.info(`Media clip updated: ${id} by user ${userId}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Update media clip error:', error);
    res.status(500).json({ error: 'Failed to update media clip' });
  }
});

/**
 * DELETE /api/media-clips/:id
 * Delete a media clip
 */
router.delete('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // In production, fetch clip from database to get file path
    // const clip = await db.mediaClip.findUnique({ where: { id, userId } });

    // Delete file if it's a local upload
    // if (clip && clip.url.startsWith('/uploads/')) {
    //   const filePath = path.join(__dirname, '../..', clip.url);
    //   if (fs.existsSync(filePath)) {
    //     fs.unlinkSync(filePath);
    //   }
    // }

    // Delete from database
    // await db.mediaClip.delete({ where: { id, userId } });

    logger.info(`Media clip deleted: ${id} by user ${userId}`);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete media clip error:', error);
    res.status(500).json({ error: 'Failed to delete media clip' });
  }
});

/**
 * GET /api/media-clips/:id
 * Get a specific media clip
 */
router.get('/:id', authMiddleware, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;

    // In production, fetch from database
    // const clip = await db.mediaClip.findUnique({ where: { id, userId } });

    // if (!clip) {
    //   return res.status(404).json({ error: 'Media clip not found' });
    // }

    res.json({ clip: null });
  } catch (error: any) {
    logger.error('Get media clip error:', error);
    res.status(500).json({ error: 'Failed to retrieve media clip' });
  }
});

export default router;
