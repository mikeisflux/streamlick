/**
 * CRITICAL FIX: File Upload Validation Middleware
 * Prevents file upload attacks and storage exhaustion
 */

import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

// Allowed file types by category
const ALLOWED_TYPES = {
  image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
  video: ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'],
  audio: ['audio/mpeg', 'audio/ogg', 'audio/wav', 'audio/webm'],
};

// Maximum file sizes (in bytes)
const MAX_SIZES = {
  image: 10 * 1024 * 1024, // 10 MB
  video: 2 * 1024 * 1024 * 1024, // 2 GB
  audio: 50 * 1024 * 1024, // 50 MB
};

/**
 * Validate file uploads before processing
 */
export function validateFileUpload(category: 'image' | 'video' | 'audio') {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const contentType = req.headers['content-type'];
      const contentLength = parseInt(req.headers['content-length'] || '0', 10);

      // Check content type
      if (!contentType) {
        res.status(400).json({ error: 'Content-Type header required' });
        return;
      }

      // Validate MIME type
      const allowedTypes = ALLOWED_TYPES[category];
      const isValidType = allowedTypes.some(type => contentType.includes(type));

      if (!isValidType) {
        logger.warn(`Invalid file type uploaded: ${contentType} for category ${category} from ${req.ip}`);
        res.status(400).json({
          error: 'Invalid file type for this category'
        });
        return;
      }

      // Validate file size
      const maxSize = MAX_SIZES[category];
      if (contentLength > maxSize) {
        logger.warn(`File too large: ${contentLength} bytes (max ${maxSize}) from ${req.ip}`);
        res.status(413).json({
          error: 'File too large for this category'
        });
        return;
      }

      // Check for suspiciously small files (possible attack)
      if (contentLength < 100) {
        logger.warn(`Suspiciously small file upload: ${contentLength} bytes from ${req.ip}`);
        res.status(400).json({ error: 'File too small or corrupted' });
        return;
      }

      next();
    } catch (error) {
      logger.error('File upload validation error:', error);
      res.status(500).json({ error: 'File validation failed' });
    }
  };
}

/**
 * Sanitize filename to prevent directory traversal
 */
export function sanitizeFilename(filename: string): string {
  // Remove path separators and null bytes
  filename = filename.replace(/[\/\\]|\0/g, '');

  // Remove leading dots
  filename = filename.replace(/^\.+/, '');

  // Limit length
  if (filename.length > 255) {
    const ext = filename.split('.').pop();
    filename = filename.substring(0, 240) + '.' + ext;
  }

  // Replace special characters
  filename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');

  return filename || 'unnamed';
}
