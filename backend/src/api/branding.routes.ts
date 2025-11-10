/**
 * Branding Configuration API
 * Handles logo/favicon uploads and branding settings
 */

import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { authenticateToken, requireAdmin } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Create upload directory if it doesn't exist
const uploadDir = path.join(__dirname, '../../public/assets/branding');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const fieldName = file.fieldname; // 'logo' or 'favicon'
    cb(null, `${fieldName}-${Date.now()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 2 * 1024 * 1024, // 2MB max (for hero images)
  },
  fileFilter: (req, file, cb) => {
    // Validate file types
    if (file.fieldname === 'logo') {
      const allowedTypes = /jpeg|jpg|png|gif|svg/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        return cb(new Error('Only image files (JPEG, PNG, GIF, SVG) are allowed for logo'));
      }
    } else if (file.fieldname === 'favicon') {
      const allowedTypes = /ico|png/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());

      if (extname) {
        return cb(null, true);
      } else {
        return cb(new Error('Only ICO or PNG files are allowed for favicon'));
      }
    } else if (file.fieldname === 'hero') {
      const allowedTypes = /jpeg|jpg|png|webp/;
      const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
      const mimetype = allowedTypes.test(file.mimetype);

      if (extname && mimetype) {
        return cb(null, true);
      } else {
        return cb(new Error('Only image files (JPEG, PNG, WebP) are allowed for hero image'));
      }
    }

    cb(null, true);
  },
});

/**
 * POST /api/admin/branding
 * Upload logo/favicon and save branding settings
 * Requires admin authentication
 */
router.post(
  '/',
  authenticateToken,
  requireAdmin,
  upload.fields([
    { name: 'logo', maxCount: 1 },
    { name: 'favicon', maxCount: 1 },
    { name: 'hero', maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      const config = req.body.config ? JSON.parse(req.body.config) : {};

      logger.info('Saving branding settings:', {
        logo: files?.logo?.[0]?.filename,
        favicon: files?.favicon?.[0]?.filename,
        hero: files?.hero?.[0]?.filename,
        config,
      });

      // Build response with file paths
      const response: any = {
        success: true,
        message: 'Branding settings saved successfully',
        config,
      };

      if (files?.logo?.[0]) {
        response.logoUrl = `/assets/branding/${files.logo[0].filename}`;
      }

      if (files?.favicon?.[0]) {
        response.faviconUrl = `/assets/branding/${files.favicon[0].filename}`;
      }

      if (files?.hero?.[0]) {
        response.heroUrl = `/assets/branding/${files.hero[0].filename}`;
      }

      // TODO: Store branding config in database (systemSettings table)
      // For now, we'll return the config and file URLs
      // In production, you should save this to a database table

      res.json(response);
    } catch (error: any) {
      logger.error('Failed to save branding settings:', error);
      res.status(500).json({
        error: 'Failed to save branding settings',
        details: error.message,
      });
    }
  }
);

/**
 * GET /api/admin/branding
 * Get current branding settings (requires admin auth)
 */
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    // TODO: Fetch from database
    // For now, return default config

    // Check if logo/favicon/hero files exist
    const brandingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const logo = brandingFiles.find((f) => f.startsWith('logo-'));
    const favicon = brandingFiles.find((f) => f.startsWith('favicon-'));
    const hero = brandingFiles.find((f) => f.startsWith('hero-'));

    res.json({
      config: {
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        accentColor: '#ec4899',
        platformName: 'Streamlick',
        tagline: 'Browser-based Live Streaming Studio',
      },
      logoUrl: logo ? `/assets/branding/${logo}` : null,
      faviconUrl: favicon ? `/assets/branding/${favicon}` : null,
      heroUrl: hero ? `/assets/branding/${hero}` : null,
    });
  } catch (error: any) {
    logger.error('Failed to get branding settings:', error);
    res.status(500).json({
      error: 'Failed to get branding settings',
      details: error.message,
    });
  }
});

// Public branding router for unauthenticated access
export const publicBrandingRouter = Router();

/**
 * GET /api/branding
 * Get current branding settings (public endpoint)
 */
publicBrandingRouter.get('/', async (req, res) => {
  try {
    // Check if logo/favicon/hero files exist
    const brandingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const logo = brandingFiles.find((f) => f.startsWith('logo-'));
    const favicon = brandingFiles.find((f) => f.startsWith('favicon-'));
    const hero = brandingFiles.find((f) => f.startsWith('hero-'));

    res.json({
      config: {
        primaryColor: '#6366f1',
        secondaryColor: '#8b5cf6',
        accentColor: '#ec4899',
        platformName: 'Streamlick',
        tagline: 'Browser-based Live Streaming Studio',
      },
      logoUrl: logo ? `/assets/branding/${logo}` : null,
      faviconUrl: favicon ? `/assets/branding/${favicon}` : null,
      heroUrl: hero ? `/assets/branding/${hero}` : null,
    });
  } catch (error: any) {
    logger.error('Failed to get branding settings:', error);
    res.status(500).json({
      error: 'Failed to get branding settings',
      details: error.message,
    });
  }
});

export default router;
