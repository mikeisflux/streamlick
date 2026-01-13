/**
 * Greenroom Socket Handlers
 *
 * Handles:
 * - Guest entrance/exit from backstage area
 * - Guest status synchronization
 * - Reconnection grace period handling
 * - Host interaction with greenroom
 */

import { Socket, Server as SocketServer } from 'socket.io';
import prisma from '../../database/prisma';
import logger from '../../utils/logger';
import { isValidUUID, verifyBroadcastAccess } from '../utils/validation';
import { pendingDisconnects } from './studio.handlers';

export function registerGreenroomHandlers(socket: Socket, io: SocketServer): void {
  // Join greenroom
  socket.on('join-greenroom', async ({ broadcastId: targetBroadcastId }) => {
    try {
      const broadcastId = targetBroadcastId || socket.data.broadcastId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      await socket.join(`greenroom:${broadcastId}`);

      const { participantId } = socket.data;
      let participantName = 'Guest';
      let isReconnecting = false;

      if (participantId && isValidUUID(participantId)) {
        // Cancel any pending disconnect
        const pendingDisconnect = pendingDisconnects.get(participantId);
        if (pendingDisconnect) {
          clearTimeout(pendingDisconnect.timeout);
          pendingDisconnects.delete(participantId);
          isReconnecting = true;
          logger.info(`[Reconnect] Participant ${participantId} reconnected within grace period`);
        }

        const participant = await prisma.participant.update({
          where: { id: participantId },
          data: { status: 'joined', joinedAt: new Date() },
        });

        if (participant?.name) {
          participantName = participant.name;
        }
      }

      if (!isReconnecting) {
        socket.to(`broadcast:${broadcastId}`).emit('greenroom-participant-joined', {
          participantId,
          name: participantName,
          socketId: socket.id,
        });
      } else {
        logger.info(`[Reconnect] Skipping greenroom-participant-joined event for reconnecting participant ${participantId}`);
      }

      socket.emit('greenroom-joined', { broadcastId });
    } catch (error) {
      logger.error('Join greenroom error:', error);
      socket.emit('error', { message: 'Failed to join greenroom' });
    }
  });

  // Leave greenroom
  socket.on('leave-greenroom', async () => {
    const { broadcastId, participantId } = socket.data;
    if (broadcastId && participantId) {
      if (isValidUUID(participantId)) {
        try {
          await prisma.participant.update({
            where: { id: participantId },
            data: { status: 'disconnected', leftAt: new Date() },
          });
        } catch (error) {
          logger.error('Error updating participant status on leave-greenroom:', error);
        }
      }

      socket.to(`broadcast:${broadcastId}`).emit('greenroom-participant-left', { participantId });
      socket.leave(`greenroom:${broadcastId}`);
    }
  });

  // Host enters greenroom
  socket.on('host-enter-greenroom', async ({ broadcastId: targetBroadcastId }) => {
    try {
      const userId = socket.data.userId;
      const broadcastId = targetBroadcastId || socket.data.broadcastId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        return socket.emit('error', { message: 'Not authorized' });
      }

      await socket.join(`greenroom:${broadcastId}`);

      socket.to(`greenroom:${broadcastId}`).emit('host-entered-greenroom', {
        hostId: userId,
      });

      // Tell existing guests to resend their stream offers (event-driven, not polling)
      // This handles the case where guests joined before the host
      logger.info(`[Greenroom] Host entered, telling guests to resend stream offers for broadcast ${broadcastId}`);
      socket.to(`greenroom:${broadcastId}`).emit('resend-stream-offer');

      socket.emit('greenroom-joined', { broadcastId, isHost: true });
    } catch (error) {
      logger.error('Host enter greenroom error:', error);
      socket.emit('error', { message: 'Failed to enter greenroom' });
    }
  });

  // Host leaves greenroom
  socket.on('host-leave-greenroom', () => {
    const { broadcastId } = socket.data;
    const userId = socket.data.userId;

    if (broadcastId) {
      socket.to(`greenroom:${broadcastId}`).emit('host-left-greenroom', { hostId: userId });
      socket.leave(`greenroom:${broadcastId}`);
    }
  });

  // Host requests a specific guest to reconnect (when connection freezes)
  socket.on('request-guest-reconnect', ({ participantId, guestSocketId }) => {
    if (!guestSocketId) {
      logger.warn('[Greenroom] request-guest-reconnect missing guestSocketId');
      return;
    }

    logger.info(`[Greenroom] Host requesting guest ${participantId} to reconnect (socket: ${guestSocketId})`);

    // Send directly to the guest's socket
    io.to(guestSocketId).emit('resend-stream-offer');
  });
}
