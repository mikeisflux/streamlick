import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../auth/jwt';
import { ChatManager, ChatMessage } from '../services/chat.service';
import { streamHealthMonitor, StreamHealthMetrics } from '../services/stream-health.service';
import logger from '../utils/logger';
import { setIOInstance } from './io-instance';
import prisma from '../database/prisma';

// Bitrate profile configuration for adaptive streaming
// Used by get-bitrate-profiles socket handler to return available quality presets
interface BitrateProfile {
  name: string;
  videoBitrate: number;
  audioBitrate: number;
  width: number;
  height: number;
  framerate: number;
}

interface SocketData {
  userId?: string;
  broadcastId?: string;
  participantId?: string;
}

// Store active chat managers
const activeChatManagers = new Map<string, ChatManager>();

/**
 * CRITICAL FIX: Validate UUID format to prevent DoS attacks
 * Invalid UUIDs can cause database errors and resource exhaustion
 */
function isValidUUID(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * CRITICAL: Verify broadcast ownership/permission
 * Returns true if user is authorized to control this broadcast
 */
async function verifyBroadcastAccess(userId: string, broadcastId: string): Promise<boolean> {
  try {
    // CRITICAL FIX: Validate UUID format first
    if (!isValidUUID(broadcastId)) {
      logger.warn(`Invalid broadcast ID format: ${broadcastId}`);
      return false;
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { userId: true },
    });

    if (!broadcast) {
      return false;
    }

    // User must be the broadcast owner
    return broadcast.userId === userId;
  } catch (error) {
    logger.error('Broadcast access verification error:', error);
    return false;
  }
}

export function initializeSocket(httpServer: HttpServer): SocketServer {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3002',
      credentials: true,
    },
  });

  // Authentication middleware
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth.token;

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
      // Authentication failed - disconnect socket
      return next(new Error('Authentication failed'));
    }
  });

  // Broadcast health metrics updates
  streamHealthMonitor.on('metrics-updated', (metrics: StreamHealthMetrics) => {
    io.to(`broadcast:${metrics.broadcastId}`).emit('health-metrics', metrics);
  });

  io.on('connection', (socket: Socket) => {
    logger.info(`Socket connected: ${socket.id}`);

    // Join studio room
    socket.on('join-studio', async ({ broadcastId, participantId }) => {
      try {
        const userId = socket.data.userId;

        // CRITICAL FIX: Validate UUID formats first to prevent DoS
        if (!isValidUUID(broadcastId)) {
          logger.warn(`Join studio rejected: Invalid broadcastId format: ${broadcastId}`);
          return socket.emit('error', { message: 'Invalid broadcast ID' });
        }

        if (!isValidUUID(participantId)) {
          logger.warn(`Join studio rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify participant belongs to this user or user owns broadcast
        const participant = await prisma.participant.findUnique({
          where: { id: participantId },
          include: { broadcast: true },
        });

        if (!participant) {
          logger.warn(`Join studio rejected: Participant ${participantId} not found`);
          return socket.emit('error', { message: 'Participant not found' });
        }

        if (participant.broadcastId !== broadcastId) {
          logger.warn(`Join studio rejected: Participant ${participantId} not in broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Participant not in this broadcast' });
        }

        // Verify user owns this participant OR owns the broadcast
        const isOwner = participant.broadcast.userId === userId;
        const isParticipant = participant.userId === userId;

        if (!isOwner && !isParticipant) {
          logger.warn(`Join studio rejected: User ${userId} not authorized for participant ${participantId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        socket.data.broadcastId = broadcastId;
        socket.data.participantId = participantId;

        await socket.join(`broadcast:${broadcastId}`);

        // Notify others in the room
        socket.to(`broadcast:${broadcastId}`).emit('participant-joined', {
          participantId,
          socketId: socket.id,
        });

        socket.emit('studio-joined', {
          broadcastId,
          participantId,
        });

        logger.info(`Participant ${participantId} joined broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Join studio error:', error);
        socket.emit('error', { message: 'Failed to join studio' });
      }
    });

    // Leave studio room
    socket.on('leave-studio', () => {
      const { broadcastId, participantId } = socket.data;
      if (broadcastId && participantId) {
        socket.to(`broadcast:${broadcastId}`).emit('participant-left', {
          participantId,
        });
        socket.leave(`broadcast:${broadcastId}`);
        logger.info(`Participant ${participantId} left broadcast ${broadcastId}`);
      }
    });

    // Media state changed (mute/unmute)
    socket.on('media-state-changed', ({ audio, video }) => {
      const { broadcastId, participantId } = socket.data;
      if (broadcastId && participantId) {
        socket.to(`broadcast:${broadcastId}`).emit('media-state-changed', {
          participantId,
          audio,
          video,
        });
      }
    });

    // Layout updated
    socket.on('layout-updated', (layout) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        socket.to(`broadcast:${broadcastId}`).emit('layout-updated', layout);
      }
    });

    // Participant position changed
    socket.on('participant-position-changed', ({ participantId, position }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        socket.to(`broadcast:${broadcastId}`).emit('participant-position-changed', {
          participantId,
          position,
        });
      }
    });

    // Promote participant to live
    socket.on('promote-to-live', async ({ participantId }) => {
      try {
        const { broadcastId } = socket.data;
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID format to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Promote rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast before promoting
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Promote rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        // Update participant role in database
        await prisma.participant.update({
          where: { id: participantId },
          data: { role: 'guest' }, // 'guest' means live guest
        });

        // Notify all participants in the broadcast
        io.to(`broadcast:${broadcastId}`).emit('participant-promoted', {
          participantId,
          role: 'guest',
        });

        logger.info(`Participant ${participantId} promoted to live in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Promote to live error:', error);
        socket.emit('error', { message: 'Failed to promote participant' });
      }
    });

    // Demote participant to backstage
    socket.on('demote-to-backstage', async ({ participantId }) => {
      try {
        const { broadcastId } = socket.data;
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID format to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Demote rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast before demoting
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Demote rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        // Update participant role in database
        await prisma.participant.update({
          where: { id: participantId },
          data: { role: 'backstage' },
        });

        // Notify all participants in the broadcast
        io.to(`broadcast:${broadcastId}`).emit('participant-demoted', {
          participantId,
          role: 'backstage',
        });

        logger.info(`Participant ${participantId} demoted to backstage in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Demote to backstage error:', error);
        socket.emit('error', { message: 'Failed to demote participant' });
      }
    });

    // Set participant volume
    socket.on('set-participant-volume', async ({ broadcastId, participantId, volume }) => {
      try {
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID formats to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Set volume rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Set volume rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('participant-volume-changed', {
          participantId,
          volume,
        });
        logger.info(`Participant ${participantId} volume set to ${volume}% in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Set participant volume error:', error);
        socket.emit('error', { message: 'Failed to set volume' });
      }
    });

    // Mute participant
    socket.on('mute-participant', async ({ broadcastId, participantId }) => {
      try {
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID formats to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Mute rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Mute rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('participant-muted', {
          participantId,
        });
        logger.info(`Participant ${participantId} muted in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Mute participant error:', error);
        socket.emit('error', { message: 'Failed to mute participant' });
      }
    });

    // Unmute participant
    socket.on('unmute-participant', async ({ broadcastId, participantId }) => {
      try {
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID formats to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Unmute rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Unmute rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('participant-unmuted', {
          participantId,
        });
        logger.info(`Participant ${participantId} unmuted in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Unmute participant error:', error);
        socket.emit('error', { message: 'Failed to unmute participant' });
      }
    });

    // Kick participant
    socket.on('kick-participant', async ({ broadcastId, participantId }) => {
      try {
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID formats to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Kick rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Kick rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('participant-kicked', {
          participantId,
        });
        logger.info(`Participant ${participantId} kicked from broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Kick participant error:', error);
        socket.emit('error', { message: 'Failed to kick participant' });
      }
    });

    // Ban participant
    socket.on('ban-participant', async ({ broadcastId, participantId }) => {
      try {
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Validate UUID formats to prevent DoS
        if (!isValidUUID(participantId)) {
          logger.warn(`Ban rejected: Invalid participantId format: ${participantId}`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Ban rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('participant-banned', {
          participantId,
        });
        logger.info(`Participant ${participantId} banned from broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Ban participant error:', error);
        socket.emit('error', { message: 'Failed to ban participant' });
      }
    });

    // Feature chat message
    socket.on('feature-message', ({ messageId }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('message-featured', { messageId });
      }
    });

    // Broadcast status changed
    socket.on('broadcast-status-changed', ({ status }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('broadcast-status', { status });
      }
    });

    // Start chat polling
    socket.on('start-chat', async ({ broadcastId }) => {
      try {
        const userId = socket.data.userId;
        if (!userId) {
          logger.error('No userId found for start-chat');
          return socket.emit('chat-error', { error: 'Not authenticated' });
        }

        // CRITICAL FIX: Verify user owns the broadcast before starting chat
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Start chat rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('chat-error', { error: 'Not authorized' });
        }

        // Stop existing chat manager if any
        if (activeChatManagers.has(broadcastId)) {
          activeChatManagers.get(broadcastId)?.stopAll();
          activeChatManagers.delete(broadcastId);
        }

        // Create new chat manager
        const chatManager = new ChatManager(broadcastId, userId, (message: ChatMessage) => {
          // Broadcast chat message to all participants in the studio
          io.to(`broadcast:${broadcastId}`).emit('chat-message', message);
        });

        await chatManager.startAll();
        activeChatManagers.set(broadcastId, chatManager);

        logger.info(`Chat polling started for broadcast ${broadcastId}`);
        socket.emit('chat-started', { broadcastId });
      } catch (error: any) {
        logger.error('Start chat error:', error);
        socket.emit('chat-error', { error: error.message });
      }
    });

    // Stop chat polling
    socket.on('stop-chat', async ({ broadcastId }) => {
      try {
        const userId = socket.data.userId;

        // CRITICAL FIX: Verify user owns the broadcast before stopping chat
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Stop chat rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('chat-error', { error: 'Not authorized' });
        }

        const chatManager = activeChatManagers.get(broadcastId);
        if (chatManager) {
          chatManager.stopAll();
          activeChatManagers.delete(broadcastId);
          logger.info(`Chat polling stopped for broadcast ${broadcastId}`);
        }
        socket.emit('chat-stopped', { broadcastId });
      } catch (error: any) {
        logger.error('Stop chat error:', error);
        socket.emit('chat-error', { error: error.message });
      }
    });

    // Start health monitoring
    socket.on('start-health-monitoring', ({ broadcastId }) => {
      try {
        streamHealthMonitor.startMonitoring(broadcastId);
        streamHealthMonitor.updateStatus(broadcastId, 'live');

        // Send initial metrics
        const metrics = streamHealthMonitor.getMetrics(broadcastId);
        if (metrics) {
          socket.emit('health-metrics', metrics);
        }

        logger.info(`Health monitoring started for broadcast ${broadcastId}`);
      } catch (error: any) {
        logger.error('Start health monitoring error:', error);
        socket.emit('error', { message: 'Failed to start health monitoring' });
      }
    });

    // Stop health monitoring
    socket.on('stop-health-monitoring', ({ broadcastId }) => {
      try {
        streamHealthMonitor.stopMonitoring(broadcastId);
        logger.info(`Health monitoring stopped for broadcast ${broadcastId}`);
      } catch (error: any) {
        logger.error('Stop health monitoring error:', error);
      }
    });

    // Update stream metrics (from media server or client)
    socket.on('update-stream-metrics', ({ broadcastId, bitrate, framerate }) => {
      try {
        if (bitrate !== undefined) {
          streamHealthMonitor.updateBitrate(broadcastId, bitrate);
        }
        if (framerate !== undefined) {
          streamHealthMonitor.updateFramerate(broadcastId, framerate);
        }
      } catch (error: any) {
        logger.error('Update stream metrics error:', error);
      }
    });

    // Update destination health
    socket.on('update-destination-health', ({ broadcastId, destinationId, health }) => {
      try {
        streamHealthMonitor.updateDestination(broadcastId, destinationId, health);
      } catch (error: any) {
        logger.error('Update destination health error:', error);
      }
    });

    // Get current health metrics
    socket.on('get-health-metrics', ({ broadcastId }) => {
      try {
        const metrics = streamHealthMonitor.getMetrics(broadcastId);
        socket.emit('health-metrics', metrics);
      } catch (error: any) {
        logger.error('Get health metrics error:', error);
        socket.emit('error', { message: 'Failed to get health metrics' });
      }
    });

    // Adaptive bitrate control events

    // Start adaptive bitrate
    socket.on('start-adaptive-bitrate', ({ broadcastId, initialProfile }) => {
      try {
        // This would integrate with the media-server's adaptive bitrate service
        logger.info(`Adaptive bitrate enabled for broadcast ${broadcastId}`);
        socket.emit('adaptive-bitrate-started', { broadcastId, profile: initialProfile });
      } catch (error: any) {
        logger.error('Start adaptive bitrate error:', error);
        socket.emit('error', { message: 'Failed to start adaptive bitrate' });
      }
    });

    // Stop adaptive bitrate
    socket.on('stop-adaptive-bitrate', ({ broadcastId }) => {
      try {
        logger.info(`Adaptive bitrate disabled for broadcast ${broadcastId}`);
        socket.emit('adaptive-bitrate-stopped', { broadcastId });
      } catch (error: any) {
        logger.error('Stop adaptive bitrate error:', error);
      }
    });

    // Set bitrate profile manually
    socket.on('set-bitrate-profile', ({ broadcastId, profileName }) => {
      try {
        logger.info(`Manual profile set for broadcast ${broadcastId}: ${profileName}`);
        socket.emit('bitrate-profile-updated', { broadcastId, profileName });
      } catch (error: any) {
        logger.error('Set bitrate profile error:', error);
        socket.emit('error', { message: 'Failed to set bitrate profile' });
      }
    });

    // Get available profiles
    socket.on('get-bitrate-profiles', () => {
      try {
        // Return available bitrate profiles
        const profiles: BitrateProfile[] = [
          { name: 'Ultra', videoBitrate: 6000, audioBitrate: 192, width: 1920, height: 1080, framerate: 60 },
          { name: 'High', videoBitrate: 4500, audioBitrate: 160, width: 1920, height: 1080, framerate: 30 },
          { name: 'Medium', videoBitrate: 2500, audioBitrate: 128, width: 1280, height: 720, framerate: 30 },
          { name: 'Low', videoBitrate: 1200, audioBitrate: 96, width: 854, height: 480, framerate: 30 },
          { name: 'Very Low', videoBitrate: 600, audioBitrate: 64, width: 640, height: 360, framerate: 24 },
        ];
        socket.emit('bitrate-profiles', profiles);
      } catch (error: any) {
        logger.error('Get bitrate profiles error:', error);
        socket.emit('error', { message: 'Failed to get bitrate profiles' });
      }
    });

    // WebRTC signaling
    socket.on('webrtc-offer', ({ targetId, offer }) => {
      io.to(targetId).emit('webrtc-offer', {
        senderId: socket.id,
        offer,
      });
    });

    socket.on('webrtc-answer', ({ targetId, answer }) => {
      io.to(targetId).emit('webrtc-answer', {
        senderId: socket.id,
        answer,
      });
    });

    socket.on('webrtc-ice-candidate', ({ targetId, candidate }) => {
      io.to(targetId).emit('webrtc-ice-candidate', {
        senderId: socket.id,
        candidate,
      });
    });

    // Screen share request (participant requests permission from host)
    socket.on('request-screen-share', ({ participantId, participantName, hasAudio }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        // Send request to host (broadcast owner)
        socket.to(`broadcast:${broadcastId}`).emit('screen-share-request', {
          participantId,
          participantName,
          hasAudio,
        });
        logger.info(`Screen share request from ${participantName} in broadcast ${broadcastId}`);
      }
    });

    // Approve screen share (host approves participant's request)
    socket.on('approve-screen-share', async ({ participantId }) => {
      try {
        const { broadcastId } = socket.data;
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast before approving screen share
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Approve screen share rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('screen-share-approved', {
          participantId,
        });
        logger.info(`Screen share approved for participant ${participantId} in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Approve screen share error:', error);
        socket.emit('error', { message: 'Failed to approve screen share' });
      }
    });

    // Deny screen share (host denies participant's request)
    socket.on('deny-screen-share', async ({ participantId, reason }) => {
      try {
        const { broadcastId } = socket.data;
        const userId = socket.data.userId;

        if (!broadcastId) {
          return socket.emit('error', { message: 'No broadcast ID' });
        }

        // CRITICAL FIX: Verify user owns the broadcast before denying screen share
        const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
        if (!hasAccess) {
          logger.warn(`Deny screen share rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }

        io.to(`broadcast:${broadcastId}`).emit('screen-share-denied', {
          participantId,
          reason,
        });
        logger.info(`Screen share denied for participant ${participantId} in broadcast ${broadcastId}`);
      } catch (error) {
        logger.error('Deny screen share error:', error);
        socket.emit('error', { message: 'Failed to deny screen share' });
      }
    });

    // Broadcaster screen share started
    socket.on('broadcaster-screen-share-started', ({ hasCamera, hasSystemAudio }) => {
      const { broadcastId, participantId } = socket.data;
      if (broadcastId) {
        socket.to(`broadcast:${broadcastId}`).emit('broadcaster-screen-share-started', {
          participantId,
          hasCamera,
          hasSystemAudio,
        });
        logger.info(`Broadcaster screen share started in broadcast ${broadcastId} (camera: ${hasCamera}, audio: ${hasSystemAudio})`);
      }
    });

    // Broadcaster screen share stopped
    socket.on('broadcaster-screen-share-stopped', () => {
      const { broadcastId, participantId } = socket.data;
      if (broadcastId) {
        socket.to(`broadcast:${broadcastId}`).emit('broadcaster-screen-share-stopped', {
          participantId,
        });
        logger.info(`Broadcaster screen share stopped in broadcast ${broadcastId}`);
      }
    });

    // Participant screen share started (after approval)
    socket.on('participant-screen-share-started', ({ participantId, hasAudio }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-screen-share-started', {
          participantId,
          hasAudio,
        });
        logger.info(`Participant ${participantId} screen share started in broadcast ${broadcastId}`);
      }
    });

    // Participant screen share stopped
    socket.on('participant-screen-share-stopped', ({ participantId }) => {
      const { broadcastId } = socket.data;
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-screen-share-stopped', {
          participantId,
        });
        logger.info(`Participant ${participantId} screen share stopped in broadcast ${broadcastId}`);
      }
    });

    // Disconnect
    socket.on('disconnect', () => {
      const { broadcastId, participantId } = socket.data;

      // CRITICAL FIX: Clean up resources on disconnect
      if (broadcastId) {
        // Stop health monitoring for this broadcast
        try {
          streamHealthMonitor.stopMonitoring(broadcastId);
          logger.info(`Health monitoring stopped for broadcast ${broadcastId} (disconnect)`);
        } catch (error) {
          logger.error('Error stopping health monitoring on disconnect:', error);
        }

        // Check if we should stop chat manager (if no other sockets in broadcast room)
        const roomSize = io.sockets.adapter.rooms.get(`broadcast:${broadcastId}`)?.size || 0;
        if (roomSize <= 1) { // Only this socket left, or already gone
          const chatManager = activeChatManagers.get(broadcastId);
          if (chatManager) {
            try {
              chatManager.stopAll();
              activeChatManagers.delete(broadcastId);
              logger.info(`Chat polling stopped for broadcast ${broadcastId} (last participant disconnect)`);
            } catch (error) {
              logger.error('Error stopping chat manager on disconnect:', error);
            }
          }
        }

        // Notify others in the room about disconnection
        if (participantId) {
          socket.to(`broadcast:${broadcastId}`).emit('participant-disconnected', {
            participantId,
          });
        }
      }

      logger.info(`Socket disconnected: ${socket.id} (broadcast: ${broadcastId}, participant: ${participantId})`);
    });
  });

  // Set global io instance for use in routes
  setIOInstance(io);

  return io;
}

export default initializeSocket;
