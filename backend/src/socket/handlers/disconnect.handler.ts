/**
 * Disconnect Socket Handler
 *
 * Handles:
 * - Socket disconnection cleanup
 * - Grace period for guest reconnection
 * - Resource cleanup (health monitoring, chat managers)
 * - Participant status updates
 */

import { Socket, Server as SocketServer } from 'socket.io';
import prisma from '../../database/prisma';
import { streamHealthMonitor } from '../../services/stream-health.service';
import logger from '../../utils/logger';
import { isValidUUID } from '../utils/validation';
import { pendingDisconnects, DISCONNECT_GRACE_PERIOD_MS } from './studio.handlers';
import { activeChatManagers } from './chat.handlers';

export function registerDisconnectHandler(socket: Socket, io: SocketServer): void {
  socket.on('disconnect', async () => {
    const { broadcastId, participantId } = socket.data;
    const isGuest = socket.data.isGuest === true;

    if (!broadcastId) {
      return;
    }

    // For guests, use grace period to allow reconnection after brief network hiccups
    if (isGuest && participantId && isValidUUID(participantId)) {
      logger.info(`[Disconnect] Guest ${participantId} disconnected, starting ${DISCONNECT_GRACE_PERIOD_MS / 1000}s grace period...`);

      // Cancel any existing pending disconnect for this participant
      const existing = pendingDisconnects.get(participantId);
      if (existing) {
        clearTimeout(existing.timeout);
      }

      // Set up grace period timeout
      const timeout = setTimeout(async () => {
        // Check if this participant has reconnected with a new socket
        const broadcastRoom = io.sockets.adapter.rooms.get(`broadcast:${broadcastId}`);
        let hasReconnected = false;

        if (broadcastRoom) {
          for (const socketId of Array.from(broadcastRoom)) {
            const connectedSocket = io.sockets.sockets.get(socketId);
            if (connectedSocket?.data?.participantId === participantId) {
              hasReconnected = true;
              break;
            }
          }
        }

        if (hasReconnected) {
          logger.info(`[Disconnect] Participant ${participantId} reconnected during grace period, not marking as disconnected`);
          pendingDisconnects.delete(participantId);
          return;
        }

        // Grace period expired and no reconnection - mark as disconnected
        logger.info(`[Disconnect] Grace period expired for participant ${participantId}, marking as disconnected`);

        try {
          await prisma.participant.update({
            where: { id: participantId },
            data: {
              status: 'disconnected',
              leftAt: new Date(),
            },
          });
          logger.info(`[Disconnect] Participant ${participantId} marked as disconnected`);
        } catch (error) {
          logger.error('Error updating participant status on disconnect:', error);
        }

        // Notify others in the room about disconnection
        io.to(`broadcast:${broadcastId}`).emit('participant-disconnected', {
          participantId,
        });
        io.to(`greenroom:${broadcastId}`).emit('greenroom-participant-left', {
          participantId,
        });

        pendingDisconnects.delete(participantId);
      }, DISCONNECT_GRACE_PERIOD_MS);

      pendingDisconnects.set(participantId, { timeout, broadcastId, socketId: socket.id });
      return; // Don't process further for guests - wait for grace period
    }

    // For hosts/non-guests, process disconnect immediately
    if (participantId && isValidUUID(participantId)) {
      try {
        await prisma.participant.update({
          where: { id: participantId },
          data: {
            status: 'disconnected',
            leftAt: new Date(),
          },
        });
        logger.info(`[Disconnect] Participant ${participantId} marked as disconnected`);
      } catch (error) {
        logger.error('Error updating participant status on disconnect:', error);
      }
    }

    // Stop health monitoring for this broadcast
    try {
      streamHealthMonitor.stopMonitoring(broadcastId);
    } catch (error) {
      logger.error('Error stopping health monitoring on disconnect:', error);
    }

    // Check if we should stop chat manager (if no other sockets in broadcast room)
    const roomSize = io.sockets.adapter.rooms.get(`broadcast:${broadcastId}`)?.size || 0;
    if (roomSize <= 1) {
      const chatManager = activeChatManagers.get(broadcastId);
      if (chatManager) {
        try {
          chatManager.stopAll();
          activeChatManagers.delete(broadcastId);
        } catch (error) {
          logger.error('Error stopping chat manager on disconnect:', error);
        }
      }
    }

    // Notify others in the room about disconnection (for non-guests only)
    if (participantId && !isGuest) {
      socket.to(`broadcast:${broadcastId}`).emit('participant-disconnected', {
        participantId,
      });
      socket.to(`greenroom:${broadcastId}`).emit('greenroom-participant-left', {
        participantId,
      });
    }
  });
}
