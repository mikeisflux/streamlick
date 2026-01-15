/**
 * Ant Media Server API Routes
 *
 * Endpoints for managing Ant Media Server conferences and streams
 * Used by the frontend WebRTC service for SFU connections
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';

const router = Router();

// Ant Media configuration from environment
const ANTMEDIA_URL = process.env.ANTMEDIA_URL || 'https://media.streamlick.com:5443';
const ANTMEDIA_APP = process.env.ANTMEDIA_APP || 'LiveApp';

/**
 * Get Ant Media REST API base URL
 */
function getApiUrl(): string {
  return `${ANTMEDIA_URL}/${ANTMEDIA_APP}/rest/v2`;
}

/**
 * Make a request to Ant Media REST API
 */
async function antmediaRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  body?: any
): Promise<any> {
  const url = `${getApiUrl()}${endpoint}`;

  const options: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  logger.info('[AntMedia] API Request:', { method, url });

  const response = await fetch(url, options);

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('[AntMedia] API Error:', { status: response.status, error: errorText });
    throw new Error(`Ant Media API error: ${response.status} - ${errorText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }
  return response.text();
}

/**
 * POST /api/antmedia/conference
 * Create or get a conference room
 */
router.post('/conference', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastId, mode = 'mcu' } = req.body;

    if (!broadcastId) {
      return res.status(400).json({
        error: 'Missing broadcastId',
      });
    }

    const roomId = `streamlick-${broadcastId}`;

    logger.info('[AntMedia] Creating/getting conference:', { roomId, mode });

    // Check if stream/room already exists
    try {
      const existing = await antmediaRequest(`/broadcasts/${roomId}`);
      if (existing) {
        logger.info('[AntMedia] Conference already exists:', roomId);
        return res.json({
          roomId,
          streamId: existing.streamId || roomId,
          status: existing.status,
          exists: true,
        });
      }
    } catch (e) {
      // Room doesn't exist, create it
    }

    // Create new conference room
    const conference = await antmediaRequest('/broadcasts/create', 'POST', {
      streamId: roomId,
      name: `Streamlick Broadcast ${broadcastId}`,
      type: 'liveStream',
      publicStream: true,
      is360: false,
      listenerHookURL: '',
      category: '',
      ipAddr: '',
      username: '',
      password: '',
      quality: '',
      speed: 0,
      streamUrl: '',
      originAdress: '',
      mp4Enabled: 0,
      webMEnabled: 0,
      expireDurationMS: 0,
      rtmpURL: '',
      zombi: false,
      pendingPacketSize: 0,
      hlsViewerCount: 0,
      webRTCViewerCount: 0,
      rtmpViewerCount: 0,
      startTime: 0,
      receivedBytes: 0,
      duration: 0,
      bitrate: 0,
      userAgent: '',
      latitude: '',
      longitude: '',
      altitude: '',
      mainTrackStreamId: '',
      subTrackStreamIds: [],
      absoluteStartTimeMs: 0,
      webRTCViewerLimit: -1,
      hlsViewerLimit: -1,
      subFolder: '',
      playlistLoopEnabled: true,
      conferenceMode: mode,
    });

    logger.info('[AntMedia] Conference created:', conference);

    res.json({
      roomId,
      streamId: conference.streamId || roomId,
      status: 'created',
      exists: false,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to create conference:', error);
    res.status(500).json({
      error: 'Failed to create conference',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/conference/:roomId
 * Get conference room info
 */
router.get('/conference/:roomId', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    logger.info('[AntMedia] Getting conference info:', roomId);

    const conference = await antmediaRequest(`/broadcasts/${roomId}`);

    res.json({
      roomId,
      streamId: conference.streamId,
      status: conference.status,
      hlsViewerCount: conference.hlsViewerCount,
      webRTCViewerCount: conference.webRTCViewerCount,
      rtmpViewerCount: conference.rtmpViewerCount,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to get conference:', error);
    res.status(404).json({
      error: 'Conference not found',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/antmedia/conference/:roomId
 * Delete a conference room
 */
router.delete('/conference/:roomId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params;

    logger.info('[AntMedia] Deleting conference:', roomId);

    await antmediaRequest(`/broadcasts/${roomId}`, 'DELETE');

    res.json({ success: true, roomId });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to delete conference:', error);
    res.status(500).json({
      error: 'Failed to delete conference',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/conference/:roomId/rtmp
 * Add RTMP endpoint to broadcast for restreaming
 */
router.post('/conference/:roomId/rtmp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { roomId } = req.params;
    const { rtmpUrl } = req.body;

    if (!rtmpUrl) {
      return res.status(400).json({ error: 'rtmpUrl is required' });
    }

    logger.info('[AntMedia] Adding RTMP endpoint:', { roomId, rtmpUrl });

    // Add RTMP endpoint
    const result = await antmediaRequest(
      `/broadcasts/${roomId}/rtmp-endpoint`,
      'POST',
      { rtmpUrl }
    );

    res.json({ success: true, result });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to add RTMP endpoint:', error);
    res.status(500).json({
      error: 'Failed to add RTMP endpoint',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/room/:roomId/participants
 * Get list of participants in a conference room
 */
router.get('/room/:roomId/participants', async (req: Request, res: Response) => {
  try {
    const { roomId } = req.params;

    logger.info('[AntMedia] Getting room participants:', roomId);

    // Get conference info which includes sub-tracks (participants)
    const conference = await antmediaRequest(`/broadcasts/${roomId}`);

    const participants = conference.subTrackStreamIds || [];

    res.json({
      roomId,
      participants,
      count: participants.length,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to get participants:', error);
    res.status(500).json({
      error: 'Failed to get participants',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/webhook
 * Handle webhooks from Ant Media Server
 */
router.post('/webhook', async (req: Request, res: Response) => {
  try {
    const { id, action, streamName, category, vodName, vodId } = req.body;

    logger.info('[AntMedia] Webhook received:', { id, action, streamName });

    // Handle different webhook actions
    switch (action) {
      case 'liveStreamStarted':
        logger.info('[AntMedia] Stream started:', streamName);
        break;
      case 'liveStreamEnded':
        logger.info('[AntMedia] Stream ended:', streamName);
        break;
      case 'vodReady':
        logger.info('[AntMedia] VOD ready:', vodName);
        break;
      case 'encoderNotOpenedError':
        logger.error('[AntMedia] Encoder error:', streamName);
        break;
      default:
        logger.info('[AntMedia] Unknown action:', action);
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error('[AntMedia] Webhook error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/antmedia/config
 * Get Ant Media configuration for frontend
 */
router.get('/config', (req: Request, res: Response) => {
  res.json({
    wsUrl: `wss://${new URL(ANTMEDIA_URL).host}/${ANTMEDIA_APP}/websocket`,
    app: ANTMEDIA_APP,
    // Don't expose the full URL for security
  });
});

export default router;
