/**
 * Daily.co API Routes
 *
 * Endpoints for managing Daily rooms and live streaming
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import { dailyServiceBackend } from '../services/daily.service';
import logger from '../utils/logger';

const router = Router();

/**
 * Middleware to allow media server to call Daily endpoints without user auth
 * Media server requests include a special header
 */
const authenticateOrMediaServer = (req: Request, res: Response, next: NextFunction) => {
  // Check if this is a media server request
  const mediaServerSecret = req.headers['x-media-server-secret'];
  const expectedSecret = process.env.MEDIA_SERVER_SECRET || 'streamlick-media-server-secret';

  if (mediaServerSecret === expectedSecret) {
    // Media server authenticated - continue without user auth
    return next();
  }

  // Otherwise require user authentication
  return authenticate(req as AuthRequest, res, next);
};

// Apply authentication to all routes (user auth OR media server auth)
router.use(authenticateOrMediaServer);

/**
 * Initialize Daily service (should be called on server startup)
 */
export async function initializeDailyService(): Promise<void> {
  try {
    await dailyServiceBackend.initialize();
    logger.info('[Daily Routes] Daily service initialized');
  } catch (error) {
    logger.error('[Daily Routes] Failed to initialize Daily service:', error);
  }
}

/**
 * POST /api/daily/broadcasts/:broadcastId/room
 * Create or get Daily room for a broadcast
 */
router.post('/broadcasts/:broadcastId/room', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    logger.info(`[Daily Routes] Creating/getting room for broadcast ${broadcastId}`);

    const room = await dailyServiceBackend.getOrCreateBroadcastRoom(broadcastId);

    // Create meeting token for the broadcaster
    const token = await dailyServiceBackend.createMeetingToken(room.name, {
      user_name: req.user?.email || 'Broadcaster',
      is_owner: true,
    });

    res.json({
      room: {
        name: room.name,
        url: room.url,
        id: room.id,
      },
      token,
    });
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to create/get room:', error);
    res.status(500).json({
      error: 'Failed to create Daily room',
      message: error.message,
    });
  }
});

/**
 * POST /api/daily/broadcasts/:broadcastId/streaming/start
 * Start RTMP streaming for a broadcast
 */
router.post('/broadcasts/:broadcastId/streaming/start', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { destinations, layout } = req.body;

    if (!destinations || destinations.length === 0) {
      return res.status(400).json({ error: 'At least one destination is required' });
    }

    logger.info(`[Daily Routes] Starting streaming for broadcast ${broadcastId} to ${destinations.length} destination(s)`);

    const roomName = `streamlick-broadcast-${broadcastId}`;

    // Format outputs for Daily API - use separate 'url' and 'streamKey' properties
    // Matches Daily.co best practice format
    const outputs = destinations.map((dest: any) => ({
      url: dest.rtmpUrl,
      streamKey: dest.streamKey,
    }));

    await dailyServiceBackend.startLiveStreaming(roomName, {
      outputs,
      layout: layout || {
        preset: 'single-participant', // Only show broadcaster
      },
    });

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to start streaming:', error);
    res.status(500).json({
      error: 'Failed to start live streaming',
      message: error.message,
    });
  }
});

/**
 * POST /api/daily/broadcasts/:broadcastId/streaming/stop
 * Stop RTMP streaming for a broadcast
 */
router.post('/broadcasts/:broadcastId/streaming/stop', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    logger.info(`[Daily Routes] Stopping streaming for broadcast ${broadcastId}`);

    const roomName = `streamlick-broadcast-${broadcastId}`;

    await dailyServiceBackend.stopLiveStreaming(roomName);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to stop streaming:', error);
    res.status(500).json({
      error: 'Failed to stop live streaming',
      message: error.message,
    });
  }
});

/**
 * GET /api/daily/broadcasts/:broadcastId/streaming/status
 * Get streaming status for a broadcast
 */
router.get('/broadcasts/:broadcastId/streaming/status', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const roomName = `streamlick-broadcast-${broadcastId}`;

    const status = await dailyServiceBackend.getLiveStreamingStatus(roomName);

    res.json(status);
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to get streaming status:', error);
    res.status(500).json({
      error: 'Failed to get streaming status',
      message: error.message,
    });
  }
});

/**
 * POST /api/daily/broadcasts/:broadcastId/streaming/add-endpoints
 * Add additional RTMP destinations to active stream
 */
router.post('/broadcasts/:broadcastId/streaming/add-endpoints', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const { destinations } = req.body;

    if (!destinations || destinations.length === 0) {
      return res.status(400).json({ error: 'At least one destination is required' });
    }

    logger.info(`[Daily Routes] Adding ${destinations.length} output(s) for broadcast ${broadcastId}`);

    const roomName = `streamlick-broadcast-${broadcastId}`;

    const outputs = destinations.map((dest: any) => ({
      url: dest.rtmpUrl,
      streamKey: dest.streamKey,
    }));

    await dailyServiceBackend.updateLiveStreamingEndpoints(roomName, outputs);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to add endpoints:', error);
    res.status(500).json({
      error: 'Failed to add streaming endpoints',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/daily/broadcasts/:broadcastId/room
 * Delete Daily room for a broadcast (cleanup after broadcast ends)
 */
router.delete('/broadcasts/:broadcastId/room', async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;
    const roomName = `streamlick-broadcast-${broadcastId}`;

    logger.info(`[Daily Routes] Deleting room for broadcast ${broadcastId}`);

    await dailyServiceBackend.deleteRoom(roomName);

    res.json({ success: true });
  } catch (error: any) {
    logger.error('[Daily Routes] Failed to delete room:', error);
    res.status(500).json({
      error: 'Failed to delete room',
      message: error.message,
    });
  }
});

export default router;
