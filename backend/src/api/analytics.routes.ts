import { Router } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import analyticsService from '../services/analytics.service';
import logger from '../utils/logger';

const router = Router();

// Apply authentication to all routes
router.use(authenticate);

/**
 * Get user analytics (lifetime stats)
 */
router.get('/user/:userId', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;

    // Check if user is requesting their own analytics or is admin
    if (req.user!.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const analytics = await analyticsService.getUserAnalytics(userId);

    if (!analytics) {
      return res.status(404).json({ error: 'Analytics not found' });
    }

    res.json(analytics);
  } catch (error: any) {
    logger.error('Get user analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get user analytics' });
  }
});

/**
 * Get broadcast analytics
 */
router.get('/broadcast/:broadcastId', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    const analytics = await analyticsService.getBroadcastAnalytics(broadcastId);

    if (!analytics) {
      return res.status(404).json({ error: 'Analytics not found' });
    }

    res.json(analytics);
  } catch (error: any) {
    logger.error('Get broadcast analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get broadcast analytics' });
  }
});

/**
 * Get stream metrics (real-time/historical data points)
 */
router.get('/broadcast/:broadcastId/metrics', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { startTime, endTime } = req.query;

    const start = startTime ? new Date(startTime as string) : undefined;
    const end = endTime ? new Date(endTime as string) : undefined;

    const metrics = await analyticsService.getStreamMetrics(broadcastId, start, end);

    res.json(metrics);
  } catch (error: any) {
    logger.error('Get stream metrics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get stream metrics' });
  }
});

/**
 * Get user broadcast history
 */
router.get('/user/:userId/broadcasts', async (req: AuthRequest, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;

    // Check if user is requesting their own data or is admin
    if (req.user!.userId !== userId && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const history = await analyticsService.getUserBroadcastHistory(userId, limit);

    res.json(history);
  } catch (error: any) {
    logger.error('Get user broadcast history error:', error);
    res.status(500).json({ error: error.message || 'Failed to get broadcast history' });
  }
});

/**
 * Get platform analytics
 */
router.get('/platform/:platform', async (req: AuthRequest, res) => {
  try {
    const { platform } = req.params;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate and endDate are required' });
    }

    const start = new Date(startDate as string);
    const end = new Date(endDate as string);

    const analytics = await analyticsService.getPlatformAnalytics(platform, start, end);

    res.json(analytics);
  } catch (error: any) {
    logger.error('Get platform analytics error:', error);
    res.status(500).json({ error: error.message || 'Failed to get platform analytics' });
  }
});

/**
 * Record stream metric (called by client or media server)
 */
router.post('/metrics', async (req: AuthRequest, res) => {
  try {
    const metricData = req.body;

    if (!metricData.broadcastId) {
      return res.status(400).json({ error: 'broadcastId is required' });
    }

    await analyticsService.recordMetric(metricData);

    res.json({ message: 'Metric recorded successfully' });
  } catch (error: any) {
    logger.error('Record metric error:', error);
    res.status(500).json({ error: error.message || 'Failed to record metric' });
  }
});

/**
 * Start analytics collection for a broadcast
 */
router.post('/broadcast/:broadcastId/start', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const userId = req.user!.userId;

    await analyticsService.startMetricsCollection(broadcastId, userId);

    res.json({ message: 'Analytics collection started' });
  } catch (error: any) {
    logger.error('Start analytics collection error:', error);
    res.status(500).json({ error: error.message || 'Failed to start analytics collection' });
  }
});

/**
 * Stop analytics collection for a broadcast
 */
router.post('/broadcast/:broadcastId/stop', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    await analyticsService.stopMetricsCollection(broadcastId);

    res.json({ message: 'Analytics collection stopped' });
  } catch (error: any) {
    logger.error('Stop analytics collection error:', error);
    res.status(500).json({ error: error.message || 'Failed to stop analytics collection' });
  }
});

export default router;
