/**
 * Studio Management Socket Handlers
 *
 * Handles:
 * - Join/leave studio
 * - Participant state synchronization
 * - Media state changes (mute/unmute)
 * - Layout updates
 * - Participant position tracking
 */

import { Socket, Server as SocketServer } from 'socket.io';
import prisma from '../../database/prisma';
import logger from '../../utils/logger';
import { isValidUUID, verifyBroadcastAccess } from '../utils/validation';

// Store pending disconnect timeouts to allow grace period for reconnection
const pendingDisconnects = new Map<string, { timeout: NodeJS.Timeout; broadcastId: string; socketId: string }>();

// Grace period before marking a participant as disconnected (10 seconds)
export const DISCONNECT_GRACE_PERIOD_MS = 10000;

// Export for use in disconnect handler
export { pendingDisconnects };

export function registerStudioHandlers(socket: Socket, io: SocketServer): void {
  // Join studio room
  socket.on('join-studio', async ({ broadcastId, participantId }) => {
    try {
      const userId = socket.data.userId;
      const isGuestAuth = socket.data.isGuest === true;

      if (!isValidUUID(broadcastId)) {
        logger.warn(`Join studio rejected: Invalid broadcastId format: ${broadcastId}`);
        return socket.emit('error', { message: 'Invalid broadcast ID' });
      }

      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
      });

      if (!broadcast) {
        logger.warn(`Join studio rejected: Broadcast ${broadcastId} not found`);
        return socket.emit('error', { message: 'Broadcast not found' });
      }

      const isOwner = broadcast.userId === userId;

      let participant;
      if (!isValidUUID(participantId) || participantId === 'host-id') {
        if (!isOwner) {
          logger.warn(`Join studio rejected: Non-owner ${userId} trying to use invalid participant ID`);
          return socket.emit('error', { message: 'Invalid participant ID' });
        }

        participant = await prisma.participant.findFirst({
          where: { broadcastId, userId },
        });

        if (!participant) {
          participant = await prisma.participant.create({
            data: {
              broadcastId,
              userId,
              name: socket.data.userEmail || 'Host',
              role: 'host',
            },
          });
        }
      } else {
        participant = await prisma.participant.findUnique({
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

        const isGuestWithValidToken = isGuestAuth && socket.data.participantId === participantId;
        const isParticipant = participant.userId === userId;

        if (!isOwner && !isParticipant && !isGuestWithValidToken) {
          logger.warn(`Join studio rejected: User ${userId} not authorized for participant ${participantId}`);
          return socket.emit('error', { message: 'Not authorized' });
        }
      }

      socket.data.broadcastId = broadcastId;
      socket.data.participantId = participant.id;

      // Cancel any pending disconnect for this participant
      const pendingDisconnect = pendingDisconnects.get(participant.id);
      let isReconnecting = false;
      if (pendingDisconnect) {
        clearTimeout(pendingDisconnect.timeout);
        pendingDisconnects.delete(participant.id);
        isReconnecting = true;
        logger.info(`[Reconnect] Participant ${participant.id} reconnected via join-studio within grace period`);
      }

      await socket.join(`broadcast:${broadcastId}`);

      if (!isReconnecting) {
        socket.to(`broadcast:${broadcastId}`).emit('participant-joined', {
          participantId: participant.id,
          socketId: socket.id,
        });
      }

      socket.emit('studio-joined', {
        broadcastId,
        participantId: participant.id,
      });

      // If host, clean up stale participants and send current state
      if (isOwner) {
        await socket.join(`greenroom:${broadcastId}`);

        const broadcastRoom = io.sockets.adapter.rooms.get(`broadcast:${broadcastId}`);
        const activeParticipantIds = new Set<string>();

        if (broadcastRoom) {
          for (const socketId of Array.from(broadcastRoom)) {
            const connectedSocket = io.sockets.sockets.get(socketId);
            if (connectedSocket?.data?.participantId && connectedSocket.data.participantId !== participant.id) {
              activeParticipantIds.add(connectedSocket.data.participantId);
            }
          }
        }

        const pendingDisconnectIds = Array.from(pendingDisconnects.keys());
        const staleParticipants = await prisma.participant.findMany({
          where: {
            broadcastId,
            status: 'joined',
            role: { not: 'host' },
            id: { notIn: [...Array.from(activeParticipantIds), ...pendingDisconnectIds] },
          },
          select: { id: true },
        });

        if (staleParticipants.length > 0) {
          await prisma.participant.updateMany({
            where: { id: { in: staleParticipants.map(p => p.id) } },
            data: { status: 'disconnected', leftAt: new Date() },
          });
          logger.info(`[Cleanup] Marked ${staleParticipants.length} stale participants as disconnected for broadcast ${broadcastId}`);
        }

        const participants = await prisma.participant.findMany({
          where: {
            broadcastId,
            status: 'joined',
            role: { not: 'host' },
          },
          select: { id: true, name: true, role: true },
        });

        logger.info(`[State Sync] Sending ${participants.length} participants to host for broadcast ${broadcastId}`);

        socket.emit('participants-sync', {
          participants: participants.map(p => ({
            id: p.id,
            name: p.name || 'Guest',
            role: p.role,
            audioEnabled: true,
            videoEnabled: true,
          })),
        });
      }
    } catch (error) {
      logger.error('Join studio error:', error);
      socket.emit('error', { message: 'Failed to join studio' });
    }
  });

  // Request participants sync
  socket.on('request-participants-sync', async () => {
    try {
      const { broadcastId, userId } = socket.data;

      if (!broadcastId) return;

      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
      });

      if (!broadcast || broadcast.userId !== userId) return;

      const participants = await prisma.participant.findMany({
        where: {
          broadcastId,
          status: 'joined',
          role: { not: 'host' },
        },
        select: { id: true, name: true, role: true },
      });

      logger.info(`[State Sync] Request-sync: Sending ${participants.length} participants to host for broadcast ${broadcastId}`);

      socket.emit('participants-sync', {
        participants: participants.map(p => ({
          id: p.id,
          name: p.name || 'Guest',
          role: p.role,
          audioEnabled: true,
          videoEnabled: true,
        })),
      });
    } catch (error) {
      logger.error('Request participants sync error:', error);
    }
  });

  // Leave studio room
  socket.on('leave-studio', () => {
    const { broadcastId, participantId } = socket.data;
    if (broadcastId && participantId) {
      socket.to(`broadcast:${broadcastId}`).emit('participant-left', { participantId });
      socket.leave(`broadcast:${broadcastId}`);
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

  // Broadcast status changed
  socket.on('broadcast-status-changed', ({ status }) => {
    const { broadcastId } = socket.data;
    if (broadcastId) {
      io.to(`broadcast:${broadcastId}`).emit('broadcast-status', { status });
    }
  });
}
