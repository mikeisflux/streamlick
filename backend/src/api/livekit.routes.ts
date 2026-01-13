/**
 * LiveKit API Routes
 *
 * Endpoints for generating LiveKit access tokens
 * Used by the frontend WebRTC service for SFU connections
 */

import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

const router = Router();

// LiveKit configuration from environment
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';

/**
 * Generate a LiveKit access token
 * This creates a JWT token that allows a participant to join a LiveKit room
 */
function generateLiveKitToken(
  roomName: string,
  participantName: string,
  options: {
    canPublish?: boolean;
    canSubscribe?: boolean;
    canPublishData?: boolean;
    metadata?: string;
  } = {}
): string {
  const {
    canPublish = true,
    canSubscribe = true,
    canPublishData = true,
    metadata = '',
  } = options;

  const now = Math.floor(Date.now() / 1000);

  // LiveKit JWT payload structure
  const payload = {
    exp: now + 86400, // 24 hours
    iss: LIVEKIT_API_KEY,
    nbf: now,
    sub: participantName,
    video: {
      roomJoin: true,
      room: roomName,
      canPublish,
      canSubscribe,
      canPublishData,
    },
    metadata,
    name: participantName,
  };

  // Sign with the API secret
  return jwt.sign(payload, LIVEKIT_API_SECRET, { algorithm: 'HS256' });
}

/**
 * POST /api/livekit/token
 * Generate a LiveKit access token for joining a room
 *
 * Body:
 * - roomName: string - The room to join
 * - participantName: string - Display name for the participant
 * - canPublish?: boolean - Whether participant can publish (default: true)
 * - canSubscribe?: boolean - Whether participant can subscribe (default: true)
 */
router.post('/token', async (req: Request, res: Response) => {
  try {
    const { roomName, participantName, canPublish, canSubscribe, metadata } = req.body;

    if (!roomName || !participantName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'roomName and participantName are required',
      });
    }

    logger.info('[LiveKit] Generating token:', { roomName, participantName });

    const token = generateLiveKitToken(roomName, participantName, {
      canPublish: canPublish !== false,
      canSubscribe: canSubscribe !== false,
      canPublishData: true,
      metadata: metadata || '',
    });

    res.json({ token });
  } catch (error: any) {
    logger.error('[LiveKit] Failed to generate token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message,
    });
  }
});

/**
 * POST /api/livekit/token/host
 * Generate a LiveKit token for a broadcast host (authenticated)
 */
router.post('/token/host', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { broadcastId } = req.body;

    if (!broadcastId) {
      return res.status(400).json({
        error: 'Missing broadcastId',
      });
    }

    const roomName = `streamlick-${broadcastId}`;
    const participantName = `host_${req.user?.id || 'unknown'}`;

    logger.info('[LiveKit] Generating host token:', { roomName, participantName });

    const token = generateLiveKitToken(roomName, participantName, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'host', userId: req.user?.id }),
    });

    res.json({
      token,
      roomName,
      participantName,
    });
  } catch (error: any) {
    logger.error('[LiveKit] Failed to generate host token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message,
    });
  }
});

/**
 * POST /api/livekit/token/guest
 * Generate a LiveKit token for a guest (no auth required, uses invite link)
 */
router.post('/token/guest', async (req: Request, res: Response) => {
  try {
    const { broadcastId, guestName, inviteToken } = req.body;

    if (!broadcastId || !guestName) {
      return res.status(400).json({
        error: 'Missing required fields',
        message: 'broadcastId and guestName are required',
      });
    }

    // TODO: Validate inviteToken against database

    const roomName = `streamlick-${broadcastId}`;
    const participantName = `guest_${guestName}_${Date.now()}`;

    logger.info('[LiveKit] Generating guest token:', { roomName, participantName });

    const token = generateLiveKitToken(roomName, participantName, {
      canPublish: true,
      canSubscribe: true,
      canPublishData: true,
      metadata: JSON.stringify({ role: 'guest', guestName }),
    });

    res.json({
      token,
      roomName,
      participantName,
    });
  } catch (error: any) {
    logger.error('[LiveKit] Failed to generate guest token:', error);
    res.status(500).json({
      error: 'Failed to generate token',
      message: error.message,
    });
  }
});

export default router;
