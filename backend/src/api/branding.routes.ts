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

// Create upload directory for branding images
// Store in backend uploads folder so they persist and can be served with CORS headers
const uploadDir = path.join(__dirname, '../../uploads/site-images');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true, mode: 0o755 });
}

// Path to branding config JSON file
const configPath = path.join(__dirname, '../../uploads/branding-config.json');

// Default branding config
const defaultConfig = {
  primaryColor: '#6366f1',
  secondaryColor: '#8b5cf6',
  accentColor: '#ec4899',
  platformName: 'Streamlick',
  tagline: 'Browser-based Live Streaming Studio',
};

// Helper functions to read/write branding config
const readBrandingConfig = () => {
  try {
    if (fs.existsSync(configPath)) {
      const data = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(data);
    }
  } catch (error) {
    logger.error('Failed to read branding config:', error);
  }
  return defaultConfig;
};

const writeBrandingConfig = (config: any) => {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    fs.chmodSync(configPath, 0o644);
  } catch (error) {
    logger.error('Failed to write branding config:', error);
    throw error;
  }
};

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
      // Recommended: 300x134px PNG or SVG
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
      // CRITICAL FIX: Also validate MIME type for favicon
      const allowedMimeTypes = /image\/(x-icon|vnd\.microsoft\.icon|png)/;
      const mimetype = allowedMimeTypes.test(file.mimetype);

      if (extname && mimetype) {
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
      const files = req.files as any;
      const config = req.body.config ? JSON.parse(req.body.config) : {};

      // Delete old files, excluding the newly uploaded ones
      const existingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];

      if (files?.logo?.[0]) {
        const newLogoFilename = files.logo[0].filename;
        // Delete old logo files (excluding the new one)
        existingFiles.filter(f => f.startsWith('logo-') && f !== newLogoFilename).forEach(f => {
          try {
            fs.unlinkSync(path.join(uploadDir, f));
          } catch (err) {
            logger.error('Failed to delete old logo:', err);
          }
        });
        fs.chmodSync(files.logo[0].path, 0o644);
      }

      if (files?.favicon?.[0]) {
        const newFaviconFilename = files.favicon[0].filename;
        // Delete old favicon files (excluding the new one)
        existingFiles.filter(f => f.startsWith('favicon-') && f !== newFaviconFilename).forEach(f => {
          try {
            fs.unlinkSync(path.join(uploadDir, f));
          } catch (err) {
            logger.error('Failed to delete old favicon:', err);
          }
        });
        fs.chmodSync(files.favicon[0].path, 0o644);
      }

      if (files?.hero?.[0]) {
        const newHeroFilename = files.hero[0].filename;
        // Delete old hero files (excluding the new one)
        existingFiles.filter(f => f.startsWith('hero-') && f !== newHeroFilename).forEach(f => {
          try {
            fs.unlinkSync(path.join(uploadDir, f));
          } catch (err) {
            logger.error('Failed to delete old hero:', err);
          }
        });
        fs.chmodSync(files.hero[0].path, 0o644);
      }

      // Save branding config to JSON file if provided
      if (config && Object.keys(config).length > 0) {
        writeBrandingConfig(config);
      }

      // Build response with file paths
      const response: any = {
        success: true,
        message: 'Branding settings saved successfully',
        config: config && Object.keys(config).length > 0 ? config : readBrandingConfig(),
      };

      if (files?.logo?.[0]) {
        response.logoUrl = `/uploads/site-images/${files.logo[0].filename}`;
      }

      if (files?.favicon?.[0]) {
        response.faviconUrl = `/uploads/site-images/${files.favicon[0].filename}`;
      }

      if (files?.hero?.[0]) {
        response.heroUrl = `/uploads/site-images/${files.hero[0].filename}`;
      }

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
    // Read saved config from JSON file
    const config = readBrandingConfig();

    // Check if logo/favicon/hero files exist
    const brandingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const logo = brandingFiles.find((f) => f.startsWith('logo-'));
    const favicon = brandingFiles.find((f) => f.startsWith('favicon-'));
    const hero = brandingFiles.find((f) => f.startsWith('hero-'));

    res.json({
      config,
      logoUrl: logo ? `/uploads/site-images/${logo}` : null,
      faviconUrl: favicon ? `/uploads/site-images/${favicon}` : null,
      heroUrl: hero ? `/uploads/site-images/${hero}` : null,
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
    // Read saved config from JSON file
    const config = readBrandingConfig();

    // Check if logo/favicon/hero files exist
    const brandingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const logo = brandingFiles.find((f) => f.startsWith('logo-'));
    const favicon = brandingFiles.find((f) => f.startsWith('favicon-'));
    const hero = brandingFiles.find((f) => f.startsWith('hero-'));

    res.json({
      config,
      logoUrl: logo ? `/uploads/site-images/${logo}` : null,
      faviconUrl: favicon ? `/uploads/site-images/${favicon}` : null,
      heroUrl: hero ? `/uploads/site-images/${hero}` : null,
    });
  } catch (error: any) {
    logger.error('Failed to get branding settings:', error);
    res.status(500).json({
      error: 'Failed to get branding settings',
      details: error.message,
    });
  }
});

/**
 * DELETE /api/admin/branding/:type
 * Delete a branding image (logo, favicon, or hero)
 */
router.delete('/:type', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type } = req.params;

    if (!['logo', 'favicon', 'hero'].includes(type)) {
      return res.status(400).json({ error: 'Invalid type. Must be logo, favicon, or hero' });
    }

    // Find the file to delete
    const brandingFiles = fs.existsSync(uploadDir) ? fs.readdirSync(uploadDir) : [];
    const fileToDelete = brandingFiles.find((f) => f.startsWith(`${type}-`));

    if (!fileToDelete) {
      return res.status(404).json({ error: `No ${type} image found` });
    }

    // Delete the file
    const filePath = path.join(uploadDir, fileToDelete);
    fs.unlinkSync(filePath);


    res.json({
      success: true,
      message: `${type} image deleted successfully`,
      deletedFile: fileToDelete
    });
  } catch (error: any) {
    logger.error('Failed to delete branding image:', error);
    res.status(500).json({
      error: 'Failed to delete branding image',
      details: error.message,
    });
  }
});

export default router;
