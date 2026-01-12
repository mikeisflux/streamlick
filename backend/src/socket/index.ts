/**
 * Socket.IO Server Initialization
 *
 * This module initializes the Socket.IO server with authentication middleware
 * and registers all socket event handlers from modular handler files.
 *
 * Handler modules:
 * - studio.handlers: Join/leave studio, media state, layout updates
 * - participant.handlers: Promote/demote/kick/ban/mute participants
 * - greenroom.handlers: Guest backstage management
 * - chat.handlers: Chat messages and polling
 * - screen-share.handlers: Screen share lifecycle
 * - webrtc-signaling.handlers: Preview and guest stream WebRTC
 * - health-monitoring.handlers: Stream health and adaptive bitrate
 * - rtmp.handlers: RTMP streaming to destinations
 * - disconnect.handler: Socket disconnection cleanup
 */

import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../auth/jwt';
import { streamHealthMonitor, StreamHealthMetrics } from '../services/stream-health.service';
import logger from '../utils/logger';
import { setIOInstance } from './io-instance';
import prisma from '../database/prisma';

// Import all handler registration functions
import {
  registerStudioHandlers,
  registerParticipantHandlers,
  registerGreenroomHandlers,
  registerChatHandlers,
  registerScreenShareHandlers,
  registerWebRTCSignalingHandlers,
  registerHealthMonitoringHandlers,
  registerRtmpHandlers,
  registerDisconnectHandler,
} from './handlers';

export function initializeSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3002',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      // Check for guest authentication via participant token first
      const participantToken = socket.handshake.auth.participantToken;
      if (participantToken) {
        // Validate participant token against database
        const participant = await prisma.participant.findUnique({
          where: { joinLinkToken: participantToken },
          select: { id: true, broadcastId: true, status: true, joinLinkExpiry: true },
        });

        if (!participant) {
          logger.warn(`Socket connection rejected: Invalid participant token (${socket.id})`);
          return next(new Error('Invalid participant token'));
        }

        // Check if invite link has expired
        if (participant.joinLinkExpiry && participant.joinLinkExpiry < new Date()) {
          logger.warn(`Socket connection rejected: Expired participant token (${socket.id})`);
          return next(new Error('Participant token expired'));
        }

        // Guest authentication successful - set participant data
        socket.data.participantId = participant.id;
        socket.data.broadcastId = participant.broadcastId;
        socket.data.isGuest = true;
        logger.info(`[Socket] Guest connected with participant token: ${participant.id}`);
        return next();
      }

      // Try to get token from auth object first (backward compatibility)
      let token = socket.handshake.auth.token;

      // If no auth token, try to get from cookies
      if (!token) {
        const cookies = socket.handshake.headers.cookie;
        if (cookies) {
          const cookieMatch = cookies.match(/accessToken=([^;]+)/);
          if (cookieMatch) {
            token = cookieMatch[1];
          }
        }
      }

      // Require authentication - no token means no connection
      if (!token) {
        logger.warn(`Socket connection rejected: No authentication token provided (${socket.id})`);
        return next(new Error('Authentication required'));
      }

      // Verify token
      const payload = verifyAccessToken(token);
      socket.data.userId = payload.userId;
      socket.data.userEmail = payload.email;
      socket.data.userRole = payload.role;

      next();
    } catch (error) {
      logger.error('Socket auth error:', error);
      return next(new Error('Authentication failed'));
    }
  });

  // Broadcast health metrics updates
  streamHealthMonitor.on('metrics-updated', (metrics: StreamHealthMetrics) => {
    io.to(`broadcast:${metrics.broadcastId}`).emit('health-metrics', metrics);
  });

  // Connection handler - register all socket event handlers
  io.on('connection', (socket: Socket) => {
    // Register handlers from modular files
    // Order matters: studio handlers set up socket.data properties used by others
    registerStudioHandlers(socket, io);
    registerParticipantHandlers(socket, io);
    registerGreenroomHandlers(socket, io);
    registerChatHandlers(socket, io);
    registerScreenShareHandlers(socket, io);
    registerWebRTCSignalingHandlers(socket, io);
    registerHealthMonitoringHandlers(socket, io);
    registerRtmpHandlers(socket, io);

    // Disconnect handler should be registered last
    registerDisconnectHandler(socket, io);
  });

  // Set global io instance for use in routes
  setIOInstance(io);

  return io;
}

export default initializeSocket;
