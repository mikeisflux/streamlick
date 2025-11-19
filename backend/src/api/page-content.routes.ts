import { Router } from 'express';
import { authenticate, AuthRequest, requireAdmin } from '../auth/middleware';
import logger from '../utils/logger';
import prisma from '../database/prisma';

const router = Router();

/**
 * Get all page content (admin only)
 */
router.get('/', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const pages = await prisma.systemSetting.findMany({
      where: {
        category: 'page_content',
      },
    });

    const content: Record<string, string> = {};
    pages.forEach((page) => {
      content[page.key] = page.value;
    });

    res.json(content);
  } catch (error) {
    logger.error('Get page content error:', error);
    res.status(500).json({ error: 'Failed to get page content' });
  }
});

/**
 * Get specific page content (public)
 */
router.get('/:page', async (req, res) => {
  try {
    const { page } = req.params;

    const pageContent = await prisma.systemSetting.findFirst({
      where: {
        category: 'page_content',
        key: page,
      },
    });

    if (!pageContent) {
      return res.status(404).json({ error: 'Page not found' });
    }

    res.json({ content: pageContent.value });
  } catch (error) {
    logger.error('Get specific page content error:', error);
    res.status(500).json({ error: 'Failed to get page content' });
  }
});

/**
 * Update page content (admin only)
 */
router.put('/:page', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { page } = req.params;
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    // CRITICAL FIX: Input validation to prevent XSS and DoS
    // Validate content is a string
    if (typeof content !== 'string') {
      return res.status(400).json({ error: 'Content must be a string' });
    }

    // Validate content length (max 1MB)
    const MAX_CONTENT_LENGTH = 1024 * 1024; // 1MB
    if (content.length > MAX_CONTENT_LENGTH) {
      logger.warn(`Page content too large: ${content.length} bytes (max ${MAX_CONTENT_LENGTH})`);
      return res.status(400).json({ error: `Content too large (max ${MAX_CONTENT_LENGTH} bytes)` });
    }

    // Validate page type
    const validPages = ['privacy', 'terms', 'dataDeletion'];
    if (!validPages.includes(page)) {
      return res.status(400).json({ error: 'Invalid page type' });
    }

    // SECURITY NOTE: Content is stored as-is since this is admin-controlled.
    // Frontend MUST sanitize this content before rendering to prevent XSS.
    // Use DOMPurify or similar on the client side when displaying.

    // Upsert page content
    const updated = await prisma.systemSetting.upsert({
      where: {
        category_key: {
          category: 'page_content',
          key: page,
        },
      },
      update: {
        value: content,
        updatedAt: new Date(),
      },
      create: {
        category: 'page_content',
        key: page,
        value: content,
        description: `Content for ${page} page`,
      },
    });

    logger.info(`Page content updated: ${page} by user ${req.user!.userId}`);
    res.json({ message: 'Page content updated successfully', page: updated });
  } catch (error) {
    logger.error('Update page content error:', error);
    res.status(500).json({ error: 'Failed to update page content' });
  }
});

/**
 * Delete page content (admin only)
 */
router.delete('/:page', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { page } = req.params;

    await prisma.systemSetting.deleteMany({
      where: {
        category: 'page_content',
        key: page,
      },
    });

    logger.info(`Page content deleted: ${page} by user ${req.user!.userId}`);
    res.json({ message: 'Page content deleted successfully' });
  } catch (error) {
    logger.error('Delete page content error:', error);
    res.status(500).json({ error: 'Failed to delete page content' });
  }
});

export default router;
