/**
 * Media Server Pool Management API
 * Endpoints for monitoring and managing media server pool
 */

import { Router } from 'express';
import { mediaServerPool } from '../services/media-server-pool.service';
import { authenticateToken, requireAdmin } from '../auth/middleware';

const router = Router();

/**
 * GET /api/media-servers
 * Get all media servers and their stats
 */
router.get('/', authenticateToken, async (req, res) => {
  try {
    const servers = mediaServerPool.getAllServers();
    res.json(servers);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/media-servers/stats
 * Get pool statistics and scaling recommendations
 */
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const stats = mediaServerPool.getPoolStats();
    const recommendation = mediaServerPool.getScalingRecommendation();

    res.json({
      ...stats,
      recommendation,
      hasCapacity: mediaServerPool.hasCapacity(),
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/media-servers/:serverId
 * Get specific server stats
 */
router.get('/:serverId', authenticateToken, async (req, res) => {
  try {
    const { serverId } = req.params;
    const server = mediaServerPool.getServer(serverId);

    if (!server) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json(server);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media-servers
 * Add a new media server to the pool (Admin only)
 */
router.post('/', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'Server URL is required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch (e) {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    const serverId = mediaServerPool.addServer(url);
    const server = mediaServerPool.getServer(serverId);

    res.json({
      message: 'Media server added successfully',
      server,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/media-servers/:serverId
 * Remove a media server from the pool (Admin only)
 */
router.delete('/:serverId', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { serverId } = req.params;
    const removed = mediaServerPool.removeServer(serverId);

    if (!removed) {
      return res.status(404).json({ error: 'Server not found' });
    }

    res.json({
      message: 'Media server removed successfully',
      serverId,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/media-servers/select
 * Select best server for new stream (internal use)
 */
router.post('/select', authenticateToken, async (req, res) => {
  try {
    const server = mediaServerPool.selectServer();

    if (!server) {
      return res.status(503).json({
        error: 'No media servers available',
        message: 'All media servers are unhealthy or pool is empty',
      });
    }

    res.json({
      serverId: server.id,
      url: server.url,
      ip: server.ip,
      activeStreams: server.activeStreams,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
