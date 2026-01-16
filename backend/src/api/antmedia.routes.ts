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

// ============================================
// Admin Endpoints (require authentication)
// ============================================

/**
 * GET /api/antmedia/admin/status
 * Get Ant Media server status and health info
 */
router.get('/admin/status', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('[AntMedia] Checking server status');

    // Try to get server version/info
    const version = await antmediaRequest('/version');

    res.json({
      status: 'online',
      serverUrl: ANTMEDIA_URL,
      application: ANTMEDIA_APP,
      version: version,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Server status check failed:', error);
    res.json({
      status: 'offline',
      serverUrl: ANTMEDIA_URL,
      application: ANTMEDIA_APP,
      error: error.message,
    });
  }
});

/**
 * GET /api/antmedia/admin/broadcasts
 * List all active broadcasts on the server
 */
router.get('/admin/broadcasts', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { offset = 0, size = 50 } = req.query;

    logger.info('[AntMedia] Listing broadcasts:', { offset, size });

    // Get broadcast list with pagination
    const broadcasts = await antmediaRequest(
      `/broadcasts/list/${offset}/${size}`
    );

    res.json({
      broadcasts: broadcasts || [],
      count: broadcasts?.length || 0,
      offset: Number(offset),
      size: Number(size),
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to list broadcasts:', error);
    res.status(500).json({
      error: 'Failed to list broadcasts',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/admin/statistics
 * Get server statistics (CPU, memory, active streams)
 */
router.get('/admin/statistics', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('[AntMedia] Getting server statistics');

    // Get server stats
    const stats = await antmediaRequest('/server-statistics');

    res.json({
      serverStats: stats,
      serverUrl: ANTMEDIA_URL,
      application: ANTMEDIA_APP,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to get statistics:', error);
    res.status(500).json({
      error: 'Failed to get server statistics',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/admin/broadcast/:streamId
 * Get detailed info about a specific broadcast
 */
router.get('/admin/broadcast/:streamId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { streamId } = req.params;

    logger.info('[AntMedia] Getting broadcast details:', streamId);

    const broadcast = await antmediaRequest(`/broadcasts/${streamId}`);

    res.json(broadcast);
  } catch (error: any) {
    logger.error('[AntMedia] Failed to get broadcast:', error);
    res.status(404).json({
      error: 'Broadcast not found',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/antmedia/admin/broadcast/:streamId
 * Force delete a broadcast from the server
 */
router.delete('/admin/broadcast/:streamId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { streamId } = req.params;

    logger.info('[AntMedia] Force deleting broadcast:', streamId);

    await antmediaRequest(`/broadcasts/${streamId}`, 'DELETE');

    res.json({
      success: true,
      message: `Broadcast ${streamId} deleted`,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to delete broadcast:', error);
    res.status(500).json({
      error: 'Failed to delete broadcast',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/admin/app-settings
 * Get application settings from Ant Media
 */
router.get('/admin/app-settings', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    logger.info('[AntMedia] Getting application settings');

    const settings = await antmediaRequest('/applications/settings/LiveApp');

    res.json(settings);
  } catch (error: any) {
    logger.error('[AntMedia] Failed to get app settings:', error);
    res.status(500).json({
      error: 'Failed to get application settings',
      message: error.message,
    });
  }
});

// ============================================
// Composite Stream Control (Media Push Plugin)
// ============================================

/**
 * Get Media Push Plugin API URL (v1, not v2)
 */
function getMediaPushApiUrl(): string {
  return `${ANTMEDIA_URL}/${ANTMEDIA_APP}/rest/v1/media-push`;
}

/**
 * Make a request to Media Push Plugin API
 */
async function mediaPushRequest(
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'POST',
  body?: any,
  queryParams?: Record<string, string>
): Promise<any> {
  let url = `${getMediaPushApiUrl()}${endpoint}`;

  if (queryParams) {
    const params = new URLSearchParams(queryParams);
    url += `?${params.toString()}`;
  }

  const options: RequestInit = {
    method,
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
  };

  if (body && method !== 'GET') {
    options.body = JSON.stringify(body);
  }

  logger.info('[MediaPush] API Request:', { method, url, body });

  const response = await fetch(url, options);

  const responseText = await response.text();
  logger.info('[MediaPush] API Response:', { status: response.status, body: responseText });

  if (!response.ok) {
    throw new Error(`Media Push API error: ${response.status} - ${responseText}`);
  }

  try {
    return JSON.parse(responseText);
  } catch {
    return responseText;
  }
}

/**
 * POST /api/antmedia/composite/start
 * Start a server-side composite stream for a broadcast
 *
 * This uses Ant Media's Media Push Plugin to run headless Chrome
 * that renders our custom composite HTML and publishes the result
 */
router.post('/composite/start', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastId, layout = 3, backgroundUrl } = req.body;

    if (!broadcastId) {
      return res.status(400).json({ error: 'broadcastId is required' });
    }

    // Composite stream ID - matches what the composite HTML publishes
    // The composite HTML uses `${roomId}_composite` format to match participant pattern
    const compositeStreamId = `${broadcastId}_composite`;

    // Build the composite HTML URL with parameters
    const frontendUrl = process.env.FRONTEND_URL || 'https://app.streamlick.com';
    const compositeUrl = new URL(`${ANTMEDIA_URL.replace('https://', 'https://').replace(':5443', ':5443')}/${ANTMEDIA_APP}/streamlick_composite.html`);
    compositeUrl.searchParams.set('roomId', broadcastId);
    compositeUrl.searchParams.set('layout', layout.toString());
    if (backgroundUrl) {
      compositeUrl.searchParams.set('bg', backgroundUrl);
    }

    logger.info('[MediaPush] Starting composite stream:', {
      broadcastId,
      compositeStreamId,
      compositeUrl: compositeUrl.toString(),
    });

    // Start the Media Push Plugin to render our composite HTML
    const result = await mediaPushRequest(
      '/start',
      'POST',
      {
        url: compositeUrl.toString(),
        width: 1920,
        height: 1080,
        recordType: '', // Don't record by default
        extraChromeSwitches: '--autoplay-policy=no-user-gesture-required,--use-fake-ui-for-media-stream',
      },
      { streamId: compositeStreamId }
    );

    logger.info('[MediaPush] Composite started:', result);

    res.json({
      success: true,
      compositeStreamId,
      broadcastId,
      message: 'Composite stream started',
      result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to start composite:', error);
    res.status(500).json({
      error: 'Failed to start composite stream',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/composite/stop/:compositeStreamId
 * Stop a running composite stream
 */
router.post('/composite/stop/:compositeStreamId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;

    logger.info('[MediaPush] Stopping composite stream:', compositeStreamId);

    const result = await mediaPushRequest(`/stop/${compositeStreamId}`, 'POST');

    logger.info('[MediaPush] Composite stopped:', result);

    res.json({
      success: true,
      compositeStreamId,
      message: 'Composite stream stopped',
      result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to stop composite:', error);
    res.status(500).json({
      error: 'Failed to stop composite stream',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/composite/:compositeStreamId/command
 * Send a JavaScript command to a running composite stream
 *
 * This uses Media Push Plugin's send-command API to execute
 * JavaScript in the headless Chrome rendering the composite
 */
router.post('/composite/:compositeStreamId/command', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;
    const { command } = req.body;

    if (!command) {
      return res.status(400).json({ error: 'command is required' });
    }

    logger.info('[MediaPush] Sending command to composite:', { compositeStreamId, command });

    const result = await mediaPushRequest(
      `/send-command/${compositeStreamId}`,
      'POST',
      { jsCommand: command }
    );

    res.json({
      success: true,
      compositeStreamId,
      command,
      result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to send command:', error);
    res.status(500).json({
      error: 'Failed to send command to composite',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/composite/:compositeStreamId/layout
 * Change the layout of a running composite stream
 */
router.post('/composite/:compositeStreamId/layout', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;
    const { layoutId } = req.body;

    if (layoutId === undefined) {
      return res.status(400).json({ error: 'layoutId is required' });
    }

    logger.info('[MediaPush] Changing composite layout:', { compositeStreamId, layoutId });

    // Send JavaScript command to change layout
    const command = `window.setLayout(${layoutId})`;
    const result = await mediaPushRequest(
      `/send-command/${compositeStreamId}`,
      'POST',
      { jsCommand: command }
    );

    res.json({
      success: true,
      compositeStreamId,
      layoutId,
      result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to change layout:', error);
    res.status(500).json({
      error: 'Failed to change composite layout',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/composite/:compositeStreamId/background
 * Change the background of a running composite stream
 */
router.post('/composite/:compositeStreamId/background', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;
    const { backgroundUrl } = req.body;

    logger.info('[MediaPush] Changing composite background:', { compositeStreamId, backgroundUrl });

    // Send JavaScript command to change background
    const command = backgroundUrl
      ? `window.setBackground('${backgroundUrl}')`
      : `window.setBackground(null)`;

    const result = await mediaPushRequest(
      `/send-command/${compositeStreamId}`,
      'POST',
      { jsCommand: command }
    );

    res.json({
      success: true,
      compositeStreamId,
      backgroundUrl,
      result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to change background:', error);
    res.status(500).json({
      error: 'Failed to change composite background',
      message: error.message,
    });
  }
});

/**
 * POST /api/antmedia/composite/:compositeStreamId/rtmp
 * Add RTMP endpoint to forward composite stream to a destination
 *
 * This is key for the Streamyard-style architecture:
 * - Server composite renders all participants
 * - RTMP forwarding sends composite to YouTube/Facebook/etc
 * - Host browser does NOT stream directly
 */
router.post('/composite/:compositeStreamId/rtmp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;
    const { rtmpUrl } = req.body;

    if (!rtmpUrl) {
      return res.status(400).json({ error: 'rtmpUrl is required' });
    }

    logger.info('[AntMedia] Adding RTMP endpoint to composite:', { compositeStreamId, rtmpUrl });

    // Add RTMP endpoint to the composite stream
    const result = await antmediaRequest(
      `/broadcasts/${compositeStreamId}/rtmp-endpoint`,
      'POST',
      { rtmpUrl }
    );

    logger.info('[AntMedia] RTMP endpoint added to composite:', result);

    res.json({
      success: true,
      compositeStreamId,
      rtmpUrl,
      result,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to add RTMP to composite:', error);
    res.status(500).json({
      error: 'Failed to add RTMP endpoint to composite',
      message: error.message,
    });
  }
});

/**
 * DELETE /api/antmedia/composite/:compositeStreamId/rtmp
 * Remove RTMP endpoint from composite stream
 */
router.delete('/composite/:compositeStreamId/rtmp', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;
    const { rtmpUrl } = req.body;

    if (!rtmpUrl) {
      return res.status(400).json({ error: 'rtmpUrl is required' });
    }

    logger.info('[AntMedia] Removing RTMP endpoint from composite:', { compositeStreamId, rtmpUrl });

    // Remove RTMP endpoint from the composite stream
    const result = await antmediaRequest(
      `/broadcasts/${compositeStreamId}/rtmp-endpoint`,
      'DELETE',
      { rtmpUrl }
    );

    res.json({
      success: true,
      compositeStreamId,
      rtmpUrl,
      result,
    });
  } catch (error: any) {
    logger.error('[AntMedia] Failed to remove RTMP from composite:', error);
    res.status(500).json({
      error: 'Failed to remove RTMP endpoint from composite',
      message: error.message,
    });
  }
});

/**
 * GET /api/antmedia/composite/:compositeStreamId/state
 * Get the current state of a composite stream
 */
router.get('/composite/:compositeStreamId/state', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { compositeStreamId } = req.params;

    logger.info('[MediaPush] Getting composite state:', compositeStreamId);

    // Send JavaScript command to get state and capture result
    const command = `JSON.stringify(window.getState())`;
    const result = await mediaPushRequest(
      `/send-command/${compositeStreamId}`,
      'POST',
      { jsCommand: command }
    );

    res.json({
      success: true,
      compositeStreamId,
      state: result,
    });
  } catch (error: any) {
    logger.error('[MediaPush] Failed to get composite state:', error);
    res.status(500).json({
      error: 'Failed to get composite state',
      message: error.message,
    });
  }
});

export default router;
