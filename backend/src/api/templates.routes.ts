import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Get all templates for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const templates = await prisma.studioTemplate.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: 'desc' },
    });

    res.json(templates);
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to get templates' });
  }
});

// Save current studio as template
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { name, config, isDefault } = req.body;

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.studioTemplate.updateMany({
        where: {
          userId: req.user!.userId,
          isDefault: true,
        },
        data: { isDefault: false },
      });
    }

    const template = await prisma.studioTemplate.create({
      data: {
        userId: req.user!.userId,
        name,
        config,
        isDefault: isDefault || false,
      },
    });

    res.status(201).json(template);
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Delete template
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.studioTemplate.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Template not found' });
    }

    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

export default router;
