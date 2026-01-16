import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.js';
import { antMediaService } from '../services/antmedia.js';
import { AuthenticatedSocket } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

// Track connected participants per broadcast
const broadcastRooms = new Map<string, Set<string>>();

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const inviteToken = socket.handshake.auth.inviteToken;

      if (token) {
        // Authenticated user (host)
        const decoded = jwt.verify(token, JWT_SECRET) as { id: string };
        socket.userId = decoded.id;
      } else if (inviteToken) {
        // Guest with invite token
        const participant = await prisma.participant.findUnique({
          where: { inviteToken },
          include: { broadcast: true },
        });

        if (!participant) {
          return next(new Error('Invalid invite token'));
        }

        socket.participantId = participant.id;
        socket.broadcastId = participant.broadcastId;
      }

      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    console.log(`Socket connected: ${socket.id}, User: ${socket.userId || 'guest'}`);

    // =========================================================================
    // BROADCAST ROOM MANAGEMENT
    // =========================================================================

    socket.on('join-broadcast', async (broadcastId: string) => {
      try {
        // Verify access
        let broadcast;
        if (socket.userId) {
          broadcast = await prisma.broadcast.findFirst({
            where: { id: broadcastId, userId: socket.userId },
            include: { participants: true },
          });
        } else if (socket.participantId) {
          const participant = await prisma.participant.findUnique({
            where: { id: socket.participantId },
            include: { broadcast: { include: { participants: true } } },
          });
          broadcast = participant?.broadcast;
        }

        if (!broadcast) {
          socket.emit('error', { message: 'Broadcast not found' });
          return;
        }

        // Join the room
        socket.broadcastId = broadcastId;
        socket.join(`broadcast:${broadcastId}`);

        // Track participant
        if (!broadcastRooms.has(broadcastId)) {
          broadcastRooms.set(broadcastId, new Set());
        }
        broadcastRooms.get(broadcastId)?.add(socket.id);

        // Send current state
        socket.emit('broadcast-state', {
          broadcast: {
            id: broadcast.id,
            title: broadcast.title,
            status: broadcast.status,
            layout: broadcast.layout,
            backgroundColor: broadcast.backgroundColor,
            logoUrl: broadcast.logoUrl,
          },
          participants: broadcast.participants.map(p => ({
            id: p.id,
            name: p.name,
            role: p.role,
            status: p.status,
            streamId: p.streamId,
            isOnStage: p.isOnStage,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          })),
        });

        // Notify others
        socket.to(`broadcast:${broadcastId}`).emit('participant-joined', {
          socketId: socket.id,
          participantId: socket.participantId,
          userId: socket.userId,
        });

        console.log(`Socket ${socket.id} joined broadcast ${broadcastId}`);
      } catch (error) {
        console.error('Join broadcast error:', error);
        socket.emit('error', { message: 'Failed to join broadcast' });
      }
    });

    socket.on('leave-broadcast', () => {
      if (socket.broadcastId) {
        socket.leave(`broadcast:${socket.broadcastId}`);
        broadcastRooms.get(socket.broadcastId)?.delete(socket.id);
        socket.to(`broadcast:${socket.broadcastId}`).emit('participant-left', {
          socketId: socket.id,
          participantId: socket.participantId,
        });
      }
    });

    // =========================================================================
    // WEBRTC SIGNALING
    // =========================================================================

    socket.on('publish-stream', async (data: { streamId: string }) => {
      if (!socket.broadcastId) return;

      try {
        // Update participant with stream ID
        if (socket.participantId) {
          await prisma.participant.update({
            where: { id: socket.participantId },
            data: { streamId: data.streamId },
          });
        }

        // Notify compositor and other participants
        io.to(`broadcast:${socket.broadcastId}`).emit('stream-published', {
          participantId: socket.participantId || socket.userId,
          streamId: data.streamId,
        });
      } catch (error) {
        console.error('Publish stream error:', error);
      }
    });

    socket.on('unpublish-stream', async () => {
      if (!socket.broadcastId) return;

      if (socket.participantId) {
        await prisma.participant.update({
          where: { id: socket.participantId },
          data: { streamId: null },
        });
      }

      io.to(`broadcast:${socket.broadcastId}`).emit('stream-unpublished', {
        participantId: socket.participantId || socket.userId,
      });
    });

    // =========================================================================
    // HOST CONTROLS
    // =========================================================================

    socket.on('bring-on-stage', async (participantId: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const participant = await prisma.participant.update({
          where: { id: participantId },
          data: { isOnStage: true, status: 'ONSTAGE' },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', participant);
      } catch (error) {
        console.error('Bring on stage error:', error);
      }
    });

    socket.on('remove-from-stage', async (participantId: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const participant = await prisma.participant.update({
          where: { id: participantId },
          data: { isOnStage: false, status: 'GREENROOM' },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', participant);
      } catch (error) {
        console.error('Remove from stage error:', error);
      }
    });

    socket.on('set-layout', async (layout: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        await prisma.broadcast.update({
          where: { id: socket.broadcastId },
          data: { layout },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('layout-changed', { layout });
      } catch (error) {
        console.error('Set layout error:', error);
      }
    });

    socket.on('update-branding', async (data: { backgroundColor?: string; logoUrl?: string; overlayText?: string }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const broadcast = await prisma.broadcast.update({
          where: { id: socket.broadcastId },
          data,
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('branding-updated', {
          backgroundColor: broadcast.backgroundColor,
          logoUrl: broadcast.logoUrl,
          overlayText: broadcast.overlayText,
        });
      } catch (error) {
        console.error('Update branding error:', error);
      }
    });

    socket.on('mute-participant', async (data: { participantId: string; audio?: boolean; video?: boolean }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const participant = await prisma.participant.update({
          where: { id: data.participantId },
          data: {
            audioEnabled: data.audio ?? undefined,
            videoEnabled: data.video ?? undefined,
          },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', participant);
      } catch (error) {
        console.error('Mute participant error:', error);
      }
    });

    // =========================================================================
    // BROADCAST STATUS
    // =========================================================================

    socket.on('go-live', async () => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const broadcast = await prisma.broadcast.update({
          where: { id: socket.broadcastId },
          data: { status: 'LIVE', startedAt: new Date() },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('broadcast-live', {
          status: 'LIVE',
          startedAt: broadcast.startedAt,
        });
      } catch (error) {
        console.error('Go live error:', error);
      }
    });

    socket.on('end-broadcast', async () => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const broadcast = await prisma.broadcast.update({
          where: { id: socket.broadcastId },
          data: { status: 'ENDED', endedAt: new Date() },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('broadcast-ended', {
          status: 'ENDED',
          endedAt: broadcast.endedAt,
        });
      } catch (error) {
        console.error('End broadcast error:', error);
      }
    });

    // =========================================================================
    // COMPOSITOR COMMUNICATION
    // =========================================================================

    socket.on('compositor-ready', async (data: { compositeStreamId: string }) => {
      if (!socket.broadcastId) return;

      // Store the composite stream ID for preview subscription
      await prisma.broadcast.update({
        where: { id: socket.broadcastId },
        data: { previewUrl: data.compositeStreamId },
      });

      io.to(`broadcast:${socket.broadcastId}`).emit('preview-available', {
        streamId: data.compositeStreamId,
      });
    });

    // =========================================================================
    // CHAT
    // =========================================================================

    socket.on('chat-message', (data: { message: string }) => {
      if (!socket.broadcastId) return;

      io.to(`broadcast:${socket.broadcastId}`).emit('chat-message', {
        from: socket.participantId || socket.userId,
        message: data.message,
        timestamp: new Date().toISOString(),
      });
    });

    // =========================================================================
    // DISCONNECT
    // =========================================================================

    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);

      if (socket.broadcastId) {
        broadcastRooms.get(socket.broadcastId)?.delete(socket.id);

        // Update participant status
        if (socket.participantId) {
          await prisma.participant.update({
            where: { id: socket.participantId },
            data: { status: 'LEFT', leftAt: new Date() },
          });
        }

        socket.to(`broadcast:${socket.broadcastId}`).emit('participant-left', {
          socketId: socket.id,
          participantId: socket.participantId,
        });
      }
    });
  });
}
