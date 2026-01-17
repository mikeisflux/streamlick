import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { prisma } from '../services/prisma.js';
import { AuthenticatedSocket } from '../types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'development-secret';

// Track connected participants per broadcast
const broadcastRooms = new Map<string, Set<string>>();

// Track compositor sockets per broadcast
const compositorSockets = new Map<string, Socket>();

// In-memory participant state (for ephemeral data not in DB)
interface ParticipantState {
  streamId?: string;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isOnStage: boolean;
  position: number;
  borderColor?: string;
}

const participantStates = new Map<string, ParticipantState>();

// Helper to get or create participant state
function getParticipantState(participantId: string): ParticipantState {
  if (!participantStates.has(participantId)) {
    participantStates.set(participantId, {
      audioEnabled: true,
      videoEnabled: true,
      isOnStage: false,
      position: 0,
    });
  }
  return participantStates.get(participantId)!;
}

// Helper to get studioConfig as object
function getStudioConfig(studioConfig: unknown): Record<string, unknown> {
  return (studioConfig as Record<string, unknown>) || {};
}

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
        // Guest with invite token - use joinLinkToken
        const participant = await prisma.participant.findUnique({
          where: { joinLinkToken: inviteToken },
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
          include: { participants: true },
        });

        if (broadcast) {
          const config = getStudioConfig(broadcast.studioConfig);

          socket.emit('full-state', {
            state: {
              isLive: broadcast.status === 'LIVE',
              layout: config.layout || 'grid',
              backgroundColor: config.backgroundColor || '#1a1a2e',
              backgroundType: 'color',
              backgroundUrl: null,
              logoUrl: config.logoUrl || null,
              logoVisible: !!config.logoUrl,
              lowerThird: { visible: false, title: '', subtitle: '' },
              ticker: { visible: false, text: '' },
              countdown: { visible: false, seconds: 0 },
              participants: broadcast.participants.map((p: { id: string; name: string | null; status: string | null }, index: number) => {
                const state = getParticipantState(p.id);
                // Sync isOnStage from DB status
                state.isOnStage = p.status === 'ONSTAGE';
                state.position = index;
                return {
                  id: p.id,
                  name: p.name,
                  streamId: state.streamId,
                  isOnStage: state.isOnStage,
                  audioEnabled: state.audioEnabled,
                  videoEnabled: state.videoEnabled,
                  borderColor: state.borderColor || '#10b981',
                };
              }),
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

        socket.broadcastId = broadcastId;
        socket.join(`broadcast:${broadcastId}`);

        if (!broadcastRooms.has(broadcastId)) {
          broadcastRooms.set(broadcastId, new Set());
        }
        broadcastRooms.get(broadcastId)?.add(socket.id);

        const config = getStudioConfig(broadcast.studioConfig);

        // Send current state
        socket.emit('broadcast-state', {
          broadcast: {
            id: broadcast.id,
            title: broadcast.title,
            status: broadcast.status,
            layout: config.layout || 'grid',
            backgroundColor: config.backgroundColor || '#1a1a2e',
            logoUrl: config.logoUrl || null,
          },
          participants: broadcast.participants.map((p: { id: string; name: string | null; role: string | null; status: string | null }, index: number) => {
            const state = getParticipantState(p.id);
            state.isOnStage = p.status === 'ONSTAGE';
            state.position = index;
            return {
              id: p.id,
              name: p.name,
              role: p.role,
              status: p.status,
              streamId: state.streamId,
              isOnStage: state.isOnStage,
              audioEnabled: state.audioEnabled,
              videoEnabled: state.videoEnabled,
            };
          }),
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
          // Update in-memory state
          const state = getParticipantState(socket.participantId);
          state.streamId = data.streamId;

          // Get participant from DB for name
          const participant = await prisma.participant.findUnique({
            where: { id: socket.participantId },
          });

          // Notify compositor
          sendToCompositor(socket.broadcastId, 'participant-updated', {
            participant: {
              id: socket.participantId,
              name: participant?.name,
              streamId: state.streamId,
              isOnStage: state.isOnStage,
              audioEnabled: state.audioEnabled,
              videoEnabled: state.videoEnabled,
              borderColor: state.borderColor || '#10b981',
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
        // Update in-memory state
        const state = getParticipantState(socket.participantId);
        state.streamId = undefined;
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
        // Update DB status
        await prisma.participant.update({
          where: { id: participantId },
          data: { status: 'ONSTAGE' },
        });

        // Update in-memory state
        const state = getParticipantState(participantId);
        state.isOnStage = true;

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'bring-on-stage', { participantId });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: participantId,
          status: 'ONSTAGE',
          isOnStage: true,
        });
      } catch (error) {
        console.error('Bring on stage error:', error);
      }
    });

    socket.on('remove-from-stage', async (participantId: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        // Update DB status
        await prisma.participant.update({
          where: { id: participantId },
          data: { status: 'GREENROOM' },
        });

        // Update in-memory state
        const state = getParticipantState(participantId);
        state.isOnStage = false;

        // Notify compositor
        sendToCompositor(socket.broadcastId, 'remove-from-stage', { participantId });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: participantId,
          status: 'GREENROOM',
          isOnStage: false,
        });
      } catch (error) {
        console.error('Remove from stage error:', error);
      }
    });

    socket.on('set-layout', async (layout: string) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        // Get current config and update layout
        const broadcast = await prisma.broadcast.findUnique({
          where: { id: socket.broadcastId },
        });

        if (broadcast) {
          const config = getStudioConfig(broadcast.studioConfig);
          const updatedConfig = { ...config, layout };

          await prisma.broadcast.update({
            where: { id: socket.broadcastId },
            data: { studioConfig: updatedConfig },
          });
        }

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
          // Get current config and update background color
          const broadcast = await prisma.broadcast.findUnique({
            where: { id: socket.broadcastId },
          });

          if (broadcast) {
            const config = getStudioConfig(broadcast.studioConfig);
            const updatedConfig = { ...config, backgroundColor: data.value };

            await prisma.broadcast.update({
              where: { id: socket.broadcastId },
              data: { studioConfig: updatedConfig },
            });
          }
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
        // Get current config and update logo
        const broadcast = await prisma.broadcast.findUnique({
          where: { id: socket.broadcastId },
        });

        if (broadcast) {
          const config = getStudioConfig(broadcast.studioConfig);
          const updatedConfig = { ...config, logoUrl: data.url };

          await prisma.broadcast.update({
            where: { id: socket.broadcastId },
            data: { studioConfig: updatedConfig },
          });
        }

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

      // Update in-memory state
      const state = getParticipantState(data.participantId);
      state.borderColor = data.color || undefined;

      sendToCompositor(socket.broadcastId, 'participant-updated', {
        participant: { id: data.participantId, borderColor: data.color },
      });
    });

    socket.on('mute-participant', async (data: { participantId: string; audio?: boolean; video?: boolean }) => {
      if (!socket.userId || !socket.broadcastId) return;

      try {
        // Update in-memory state only
        const state = getParticipantState(data.participantId);
        if (data.audio !== undefined) state.audioEnabled = data.audio;
        if (data.video !== undefined) state.videoEnabled = data.video;

        sendToCompositor(socket.broadcastId, 'participant-updated', {
          participant: {
            id: data.participantId,
            audioEnabled: state.audioEnabled,
            videoEnabled: state.videoEnabled,
          },
        });

        io.to(`broadcast:${socket.broadcastId}`).emit('participant-updated', {
          id: data.participantId,
          audioEnabled: state.audioEnabled,
          videoEnabled: state.videoEnabled,
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
          // Update DB status
          await prisma.participant.update({
            where: { id: socket.participantId },
            data: { status: 'LEFT', leftAt: new Date() },
          });

          // Update in-memory state
          const state = getParticipantState(socket.participantId);
          state.isOnStage = false;
          state.streamId = undefined;

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
