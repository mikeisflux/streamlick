import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.js';
import { AuthenticatedSocket } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

// Track connected participants per broadcast
const broadcastRooms = new Map<string, Set<string>>();

// Track compositor sockets per broadcast
const compositorSockets = new Map<string, Socket>();

export function setupSocketHandlers(io: Server) {
  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const inviteToken = socket.handshake.auth.inviteToken;
      const isCompositor = socket.handshake.auth.isCompositor;
      const compositorSecret = socket.handshake.auth.compositorSecret;

      if (isCompositor) {
        // Compositor authentication
        if (compositorSecret === process.env.COMPOSITOR_SECRET) {
          (socket as any).isCompositor = true;
          return next();
        }
        return next(new Error('Invalid compositor secret'));
      }

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
    const isCompositor = (socket as any).isCompositor;
    console.log(`Socket connected: ${socket.id}, ${isCompositor ? 'COMPOSITOR' : `User: ${socket.userId || 'guest'}`}`);

    // =========================================================================
    // COMPOSITOR CONNECTION
    // =========================================================================

    if (isCompositor) {
      socket.on('compositor-join', async (broadcastId: string) => {
        console.log(`[Compositor] Joining broadcast ${broadcastId}`);
        socket.broadcastId = broadcastId;
        socket.join(`broadcast:${broadcastId}`);
        socket.join(`compositor:${broadcastId}`);
        compositorSockets.set(broadcastId, socket);

        // Send full state to compositor
        const broadcast = await prisma.broadcast.findUnique({
          where: { id: broadcastId },
          include: { participants: { orderBy: { position: 'asc' } } },
        });

        if (broadcast) {
          socket.emit('full-state', {
            state: {
              isLive: broadcast.status === 'LIVE',
              layout: broadcast.layout,
              backgroundColor: broadcast.backgroundColor,
              backgroundType: 'color',
              backgroundUrl: null,
              logoUrl: broadcast.logoUrl,
              logoVisible: !!broadcast.logoUrl,
              lowerThird: { visible: false, title: '', subtitle: '' },
              ticker: { visible: false, text: '' },
              countdown: { visible: false, seconds: 0 },
              participants: broadcast.participants.map((p: typeof broadcast.participants[number]) => ({
                id: p.id,
                name: p.name,
                streamId: p.streamId,
                isOnStage: p.isOnStage,
                audioEnabled: p.audioEnabled,
                videoEnabled: p.videoEnabled,
                borderColor: '#10b981',
              })),
            },
          });
        }

        // Notify studio that compositor is ready
        io.to(`broadcast:${broadcastId}`).emit('compositor-connected', { broadcastId });
      });

      socket.on('disconnect', () => {
        if (socket.broadcastId) {
          compositorSockets.delete(socket.broadcastId);
          io.to(`broadcast:${socket.broadcastId}`).emit('compositor-disconnected');
        }
      });

      return; // Compositor doesn't need other handlers
    }

    // =========================================================================
    // BROADCAST ROOM MANAGEMENT
    // =========================================================================

    socket.on('join-broadcast', async (broadcastId: string) => {
      try {
        let broadcast;
        if (socket.userId) {
          broadcast = await prisma.broadcast.findFirst({
            where: { id: broadcastId, userId: socket.userId },
            include: { participants: { orderBy: { position: 'asc' } } },
          });
        } else if (socket.participantId) {
          const participant = await prisma.participant.findUnique({
            where: { id: socket.participantId },
            include: { broadcast: { include: { participants: { orderBy: { position: 'asc' } } } } },
          });
          broadcast = participant?.broadcast;
        }

        if (!broadcast) {
          socket.emit('error', { message: 'Broadcast not found' });
          return;
        }

        socket.broadcastId = broadcastId;
        socket.join(`broadcast:${broadcastId}`);

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
          participants: broadcast.participants.map((p: typeof broadcast.participants[number]) => ({
            id: p.id,
            name: p.name,
            role: p.role,
            status: p.status,
            streamId: p.streamId,
            isOnStage: p.isOnStage,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          })),
          compositorConnected: compositorSockets.has(broadcastId),
        });

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
        if (socket.participantId) {
          const participant = await prisma.participant.update({
            where: { id: socket.participantId },
            data: { streamId: data.streamId },
          });

          // Notify compositor
          sendToCompositor(socket.broadcastId, 'participant-updated', {
            participant: {
              id: participant.id,
              name: participant.name,
              streamId: participant.streamId,
              isOnStage: participant.isOnStage,
              audioEnabled: participant.audioEnabled,
              videoEnabled: participant.videoEnabled,
              borderColor: '#10b981',
            },
          });
        }

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
    // HOST CONTROLS -> COMPOSITOR
    // =========================================================================

    socket.on('bring-on-stage', async (participantId: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const participant = await prisma.participant.update({
          where: { id: participantId },
          data: { isOnStage: true, status: 'ONSTAGE' },
        });

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'bring-on-stage', { participantId });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: participantId,
          isOnStage: participant.isOnStage,
          status: participant.status,
        });
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

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'remove-from-stage', { participantId });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: participantId,
          isOnStage: participant.isOnStage,
          status: participant.status,
        });
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

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'set-layout', { layout });

        io.to(`broadcast:${socket.broadcastId}`).emit('layout-changed', { layout });
      } catch (error) {
        console.error('Set layout error:', error);
      }
    });

    // =========================================================================
    // BACKGROUND CONTROLS
    // =========================================================================

    socket.on('set-background', async (data: { type: 'color' | 'image' | 'video'; value: string }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        if (data.type === 'color') {
          await prisma.broadcast.update({
            where: { id: socket.broadcastId },
            data: { backgroundColor: data.value },
          });
        }

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'set-background', {
          backgroundType: data.type,
          backgroundColor: data.type === 'color' ? data.value : undefined,
          backgroundUrl: data.type !== 'color' ? data.value : undefined,
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('background-changed', data);
      } catch (error) {
        console.error('Set background error:', error);
      }
    });

    // =========================================================================
    // OVERLAY CONTROLS
    // =========================================================================

    socket.on('set-logo', async (data: { url: string | null; visible: boolean }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        await prisma.broadcast.update({
          where: { id: socket.broadcastId },
          data: { logoUrl: data.url },
        });

        sendToCompositor(socket.broadcastId, 'set-logo', {
          logoUrl: data.url,
          visible: data.visible,
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('logo-changed', data);
      } catch (error) {
        console.error('Set logo error:', error);
      }
    });

    socket.on('set-lower-third', (data: { visible: boolean; title?: string; subtitle?: string }) => {
      if (!socket.userId || !socket.broadcastId) return;

      sendToCompositor(socket.broadcastId, 'set-lower-third', data);
      io.to(`broadcast:${socket.broadcastId}`).emit('lower-third-changed', data);
    });

    socket.on('set-ticker', (data: { visible: boolean; text?: string }) => {
      if (!socket.userId || !socket.broadcastId) return;

      sendToCompositor(socket.broadcastId, 'set-ticker', data);
      io.to(`broadcast:${socket.broadcastId}`).emit('ticker-changed', data);
    });

    socket.on('set-countdown', (data: { visible: boolean; seconds?: number }) => {
      if (!socket.userId || !socket.broadcastId) return;

      sendToCompositor(socket.broadcastId, 'set-countdown', data);
      io.to(`broadcast:${socket.broadcastId}`).emit('countdown-changed', data);
    });

    // =========================================================================
    // PARTICIPANT CONTROLS
    // =========================================================================

    socket.on('set-participant-border', (data: { participantId: string; color: string | null }) => {
      if (!socket.userId || !socket.broadcastId) return;

      sendToCompositor(socket.broadcastId, 'participant-updated', {
        participant: { id: data.participantId, borderColor: data.color },
      });
    });

    socket.on('mute-participant', async (data: { participantId: string; audio?: boolean; video?: boolean }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        const updateData: { audioEnabled?: boolean; videoEnabled?: boolean } = {};
        if (data.audio !== undefined) updateData.audioEnabled = data.audio;
        if (data.video !== undefined) updateData.videoEnabled = data.video;

        const participant = await prisma.participant.update({
          where: { id: data.participantId },
          data: updateData,
        });

        sendToCompositor(socket.broadcastId, 'participant-updated', {
          participant: {
            id: participant.id,
            audioEnabled: participant.audioEnabled,
            videoEnabled: participant.videoEnabled,
          },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: participant.id,
          audioEnabled: participant.audioEnabled,
          videoEnabled: participant.videoEnabled,
        });
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

        sendToCompositor(socket.broadcastId, 'go-live', {});

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

        sendToCompositor(socket.broadcastId, 'end-broadcast', {});

        io.to(`broadcast:${socket.broadcastId}`).emit('broadcast-ended', {
          status: 'ENDED',
          endedAt: broadcast.endedAt,
        });
      } catch (error) {
        console.error('End broadcast error:', error);
      }
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

        if (socket.participantId) {
          await prisma.participant.update({
            where: { id: socket.participantId },
            data: { status: 'LEFT', isOnStage: false, leftAt: new Date() },
          });

          sendToCompositor(socket.broadcastId, 'participant-updated', {
            participant: { id: socket.participantId, isOnStage: false },
          });
        }

        socket.to(`broadcast:${socket.broadcastId}`).emit('participant-left', {
          socketId: socket.id,
          participantId: socket.participantId,
        });
      }
    });
  });

  // Helper function to send messages to compositor
  function sendToCompositor(broadcastId: string, type: string, data: any) {
    const compositorSocket = compositorSockets.get(broadcastId);
    if (compositorSocket) {
      compositorSocket.emit(type, data);
    }
  }
}
