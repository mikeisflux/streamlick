import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import { verifyAccessToken } from '../auth/jwt';
import { ChatManager, ChatMessage } from '../services/chat.service';
import { streamHealthMonitor, StreamHealthMetrics } from '../services/stream-health.service';
import logger from '../utils/logger';

// Import adaptive bitrate service (will be available after media-server is compiled)
// For now, we'll create placeholder types
interface BitrateProfile {
  name: string;
  videoBitrate: number;
  audioBitrate: number;
  width: number;
  height: number;
  framerate: number;
}

interface BitrateAdjustment {
  broadcastId: string;
  oldProfile: BitrateProfile;
  newProfile: BitrateProfile;
  reason: string;
  timestamp: Date;
}

interface SocketData {
  userId?: string;
  broadcastId?: string;
  participantId?: string;
}

// Store active chat managers
const activeChatManagers = new Map<string, ChatManager>();

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
      if (token) {
        const payload = verifyAccessToken(token);
        socket.data.userId = payload.userId;
      }
      next();
    } catch (error) {
      logger.error('Socket auth error:', error);
      next(new Error('Authentication failed'));
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
        if (!broadcastId) {
          socket.emit('error', { message: 'No broadcast ID' });
          return;
        }

        // Update participant role in database
        const prisma = require('../database/prisma').default;
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
        if (!broadcastId) {
          socket.emit('error', { message: 'No broadcast ID' });
          return;
        }

        // Update participant role in database
        const prisma = require('../database/prisma').default;
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
    socket.on('set-participant-volume', ({ broadcastId, participantId, volume }) => {
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-volume-changed', {
          participantId,
          volume,
        });
        logger.info(`Participant ${participantId} volume set to ${volume}% in broadcast ${broadcastId}`);
      }
    });

    // Mute participant
    socket.on('mute-participant', ({ broadcastId, participantId }) => {
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-muted', {
          participantId,
        });
        logger.info(`Participant ${participantId} muted in broadcast ${broadcastId}`);
      }
    });

    // Unmute participant
    socket.on('unmute-participant', ({ broadcastId, participantId }) => {
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-unmuted', {
          participantId,
        });
        logger.info(`Participant ${participantId} unmuted in broadcast ${broadcastId}`);
      }
    });

    // Kick participant
    socket.on('kick-participant', ({ broadcastId, participantId }) => {
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-kicked', {
          participantId,
        });
        logger.info(`Participant ${participantId} kicked from broadcast ${broadcastId}`);
      }
    });

    // Ban participant
    socket.on('ban-participant', ({ broadcastId, participantId }) => {
      if (broadcastId) {
        io.to(`broadcast:${broadcastId}`).emit('participant-banned', {
          participantId,
        });
        logger.info(`Participant ${participantId} banned from broadcast ${broadcastId}`);
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
          return;
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
    socket.on('stop-chat', ({ broadcastId }) => {
      try {
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

    // Disconnect
    socket.on('disconnect', () => {
      const { broadcastId, participantId } = socket.data;
      if (broadcastId && participantId) {
        socket.to(`broadcast:${broadcastId}`).emit('participant-disconnected', {
          participantId,
        });
      }
      logger.info(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
}

export default initializeSocket;
