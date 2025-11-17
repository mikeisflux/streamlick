import { Router, Request, Response } from 'express';
import { authenticate as authMiddleware } from '../auth/middleware';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { URL } from 'url';
import logger from '../utils/logger';
import prisma from '../database/prisma';

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

    // Add pagination
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    // Build where clause
    const where: any = { userId };
    if (type && ['video', 'audio', 'image'].includes(type as string)) {
      where.type = type;
    }

    // Fetch clips with pagination
    const [clips, total] = await Promise.all([
      prisma.mediaClip.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.mediaClip.count({ where }),
    ]);

    return res.json({
      clips,
      pagination: {
        limit,
        offset,
        total,
        hasMore: offset + limit < total,
      },
    });
  } catch (error: any) {
    logger.error('Get media clips error:', error);
    return res.status(500).json({ error: 'Failed to retrieve media clips' });
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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { name, description, hotkey, volume } = req.body;

    // Validate volume
    const volumeValue = volume ? parseInt(volume) : 100;
    if (isNaN(volumeValue) || volumeValue < 0 || volumeValue > 100) {
      fs.unlinkSync(file.path);
      return res.status(400).json({ error: 'Volume must be between 0 and 100' });
    }

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

    // Save to database
    const clip = await prisma.mediaClip.create({
      data: {
        userId,
        name: name || file.originalname,
        description: description || null,
        type: clipType,
        fileUrl: fileUrl,
        thumbnailUrl: null,
        fileSizeBytes: BigInt(file.size),
        mimeType: file.mimetype,
        durationMs: null,
        hotkey: hotkey || null,
        volume: volumeValue,
        isActive: true,
      },
    });

    logger.info(`Media clip uploaded: ${clip.name} (${clip.type}) by user ${userId}`);

    return res.status(201).json({ clip });
  } catch (error: any) {
    logger.error('Upload media clip error:', error);

    // Clean up file if database operation failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    return res.status(500).json({ error: 'Failed to upload media clip' });
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

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    if (!url || !name || !type) {
      return res.status(400).json({ error: 'URL, name, and type are required' });
    }

    if (!['video', 'audio', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Type must be video, audio, or image' });
    }

    // Validate volume
    const volumeValue = volume ? parseInt(volume) : 100;
    if (isNaN(volumeValue) || volumeValue < 0 || volumeValue > 100) {
      return res.status(400).json({ error: 'Volume must be between 0 and 100' });
    }

    // SSRF Protection: Validate URL
    try {
      const parsedUrl = new URL(url);

      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return res.status(400).json({ error: 'Only HTTP/HTTPS URLs are allowed' });
      }

      // Block internal/private IP addresses
      const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '169.254.169.254', '[::1]'];
      const hostname = parsedUrl.hostname.toLowerCase();

      if (blockedHosts.includes(hostname)) {
        return res.status(400).json({ error: 'Invalid URL: internal addresses not allowed' });
      }

      // Block private IP ranges (10.x.x.x, 172.16-31.x.x, 192.168.x.x)
      const isPrivateIP =
        /^10\./.test(hostname) ||
        /^172\.(1[6-9]|2[0-9]|3[01])\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^fc00:/i.test(hostname) || // IPv6 private
        /^fe80:/i.test(hostname);   // IPv6 link-local

      if (isPrivateIP) {
        return res.status(400).json({ error: 'Invalid URL: private IP addresses not allowed' });
      }
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Save to database
    const clip = await prisma.mediaClip.create({
      data: {
        userId,
        name,
        description: description || null,
        type,
        fileUrl: url,
        thumbnailUrl: null,
        fileSizeBytes: BigInt(0), // Unknown for external files
        mimeType: '', // Unknown for external files
        durationMs: null,
        hotkey: hotkey || null,
        volume: volumeValue,
        isActive: true,
      },
    });

    logger.info(`Media clip linked: ${clip.name} (${clip.type}) by user ${userId}`);

    return res.status(201).json({ clip });
  } catch (error: any) {
    logger.error('Link media clip error:', error);
    return res.status(500).json({ error: 'Failed to link media clip' });
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

    // CRITICAL FIX: Verify ownership before update (IDOR protection)
    const clip = await prisma.mediaClip.findUnique({
      where: { id },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    if (clip.userId !== userId) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    // Validate volume if provided
    if (volume !== undefined) {
      const volumeValue = parseInt(volume);
      if (isNaN(volumeValue) || volumeValue < 0 || volumeValue > 100) {
        return res.status(400).json({ error: 'Volume must be between 0 and 100' });
      }
    }

    // Update clip
    const updated = await prisma.mediaClip.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(description !== undefined && { description }),
        ...(hotkey !== undefined && { hotkey }),
        ...(volume !== undefined && { volume: parseInt(volume) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    logger.info(`Media clip updated: ${id} by user ${userId}`);

    return res.json({ clip: updated });
  } catch (error: any) {
    logger.error('Update media clip error:', error);
    return res.status(500).json({ error: 'Failed to update media clip' });
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

    // CRITICAL FIX: Verify ownership before delete (IDOR protection)
    const clip = await prisma.mediaClip.findUnique({
      where: { id },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    if (clip.userId !== userId) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    // Delete file if it's a local upload
    if (clip.fileUrl && clip.fileUrl.startsWith('/uploads/')) {
      const filePath = path.join(__dirname, '../..', clip.fileUrl);
      if (fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (fileError) {
          logger.error(`Failed to delete file: ${filePath}`, fileError);
          // Continue with database deletion even if file deletion fails
        }
      }
    }

    // Delete from database
    await prisma.mediaClip.delete({ where: { id } });

    logger.info(`Media clip deleted: ${id} by user ${userId}`);

    return res.json({ success: true });
  } catch (error: any) {
    logger.error('Delete media clip error:', error);
    return res.status(500).json({ error: 'Failed to delete media clip' });
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

    // CRITICAL FIX: Verify ownership (IDOR protection)
    const clip = await prisma.mediaClip.findUnique({
      where: { id },
    });

    if (!clip) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    if (clip.userId !== userId) {
      return res.status(404).json({ error: 'Media clip not found' });
    }

    return res.json({ clip });
  } catch (error: any) {
    logger.error('Get media clip error:', error);
    return res.status(500).json({ error: 'Failed to retrieve media clip' });
  }
});

export default router;
