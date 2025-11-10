import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
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

// Apply authentication and admin check to all routes
router.use(authMiddleware, adminMiddleware);

/**
 * USER MANAGEMENT ROUTES
 */

// Get all users
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Transform role to isAdmin for frontend compatibility
    const transformedUsers = users.map(user => ({
      ...user,
      isAdmin: user.role === 'admin',
    }));

    res.json(transformedUsers);
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// Update user (admin status, etc)
router.patch('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { isAdmin } = req.body;

    // Prevent user from removing their own admin status
    const currentUserId = (req as any).user.userId;
    if (id === currentUserId && isAdmin === false) {
      return res.status(400).json({ error: 'Cannot remove your own admin status' });
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        role: isAdmin ? 'admin' : 'user',
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    res.json({
      ...user,
      isAdmin: user.role === 'admin',
    });
  } catch (error) {
    logger.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Prevent user from deleting themselves
    const currentUserId = (req as any).user.userId;
    if (id === currentUserId) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    await prisma.user.delete({
      where: { id },
    });

    logger.info(`User deleted by admin: ${id}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

/**
 * BROADCAST MANAGEMENT ROUTES
 */

// Get all broadcasts
router.get('/broadcasts', async (req: Request, res: Response) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    res.json(broadcasts);
  } catch (error) {
    logger.error('Get broadcasts error:', error);
    res.status(500).json({ error: 'Failed to fetch broadcasts' });
  }
});

/**
 * TEMPLATE MANAGEMENT ROUTES
 */

// Get all templates
router.get('/templates', async (req: Request, res: Response) => {
  try {
    const templates = await prisma.studioTemplate.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });

    res.json(templates);
  } catch (error) {
    logger.error('Get templates error:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create template
router.post('/templates', async (req: Request, res: Response) => {
  try {
    const { name, config } = req.body;
    const userId = (req as any).user.userId;

    if (!name) {
      return res.status(400).json({ error: 'Template name is required' });
    }

    const template = await prisma.studioTemplate.create({
      data: {
        userId,
        name,
        config: config || {},
        isDefault: false,
      },
    });

    logger.info(`Template created: ${template.id}`);
    res.json(template);
  } catch (error) {
    logger.error('Create template error:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Delete template
router.delete('/templates/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.studioTemplate.delete({
      where: { id },
    });

    logger.info(`Template deleted: ${id}`);
    res.json({ message: 'Template deleted successfully' });
  } catch (error) {
    logger.error('Delete template error:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

/**
 * ANALYTICS ROUTES
 */

// Get analytics data
router.get('/analytics', async (req: Request, res: Response) => {
  try {
    const { range = '7d' } = req.query;

    // Calculate date range
    const now = new Date();
    let startDate = new Date();

    switch (range) {
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date(0);
        break;
    }

    // Get all data in parallel
    const [totalUsers, broadcasts, recentActivity] = await Promise.all([
      // Total users
      prisma.user.count(),

      // Broadcasts
      prisma.broadcast.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
            },
          },
        },
      }),

      // Recent activity (last 20 actions)
      prisma.broadcast.findMany({
        where: {
          createdAt: {
            gte: startDate,
          },
        },
        include: {
          user: {
            select: {
              email: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: 20,
      }),
    ]);

    // Calculate statistics
    const totalBroadcasts = broadcasts.length;
    const activeBroadcasts = broadcasts.filter((b) => b.status === 'live').length;

    // Calculate average duration (for ended broadcasts)
    const endedBroadcasts = broadcasts.filter(
      (b) => b.status === 'ended' && b.startedAt && b.endedAt
    );
    const avgBroadcastDuration = endedBroadcasts.length > 0
      ? endedBroadcasts.reduce((sum, b) => {
          const duration = new Date(b.endedAt!).getTime() - new Date(b.startedAt!).getTime();
          return sum + duration / 1000 / 60; // minutes
        }, 0) / endedBroadcasts.length
      : 0;

    // Calculate total view time (approximate based on broadcast durations)
    const totalViewTime = endedBroadcasts.reduce((sum, b) => {
      const duration = new Date(b.endedAt!).getTime() - new Date(b.startedAt!).getTime();
      return sum + duration / 1000 / 60; // minutes
    }, 0);

    // Top broadcasters
    const broadcasterMap = new Map<string, { userId: string; email: string; count: number }>();
    broadcasts.forEach((b) => {
      if (b.user) {
        const existing = broadcasterMap.get(b.user.id);
        if (existing) {
          existing.count++;
        } else {
          broadcasterMap.set(b.user.id, {
            userId: b.user.id,
            email: b.user.email,
            count: 1,
          });
        }
      }
    });

    const topBroadcasters = Array.from(broadcasterMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((b) => ({
        userId: b.userId,
        email: b.email,
        broadcastCount: b.count,
      }));

    // Format recent activity
    const formattedActivity = recentActivity.map((b) => ({
      type: b.status,
      message: `${b.user?.email || 'Unknown'} ${
        b.status === 'live' ? 'started' : b.status === 'ended' ? 'ended' : 'created'
      } broadcast: ${b.title}`,
      timestamp: b.createdAt.toISOString(),
    }));

    res.json({
      totalUsers,
      totalBroadcasts,
      activeBroadcasts,
      totalViewTime,
      avgBroadcastDuration,
      topBroadcasters,
      recentActivity: formattedActivity,
    });
  } catch (error) {
    logger.error('Get analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

export default router;
