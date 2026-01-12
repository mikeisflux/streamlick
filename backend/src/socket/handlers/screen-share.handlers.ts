/**
 * Screen Share Socket Handlers
 *
 * Handles:
 * - Screen share permission requests
 * - Host approval/denial
 * - Screen share lifecycle (start/stop)
 */

import { Socket, Server as SocketServer } from 'socket.io';
import logger from '../../utils/logger';
import { verifyBroadcastAccess } from '../utils/validation';

export function registerScreenShareHandlers(socket: Socket, io: SocketServer): void {
  // Request screen sharing permission
  socket.on('request-screen-share', ({ participantId, participantName, hasAudio }) => {
    const { broadcastId } = socket.data;
    if (broadcastId) {
      socket.to(`broadcast:${broadcastId}`).emit('screen-share-request', {
        participantId,
        participantName,
        hasAudio,
      });
    }
  });

  // Approve screen share
  socket.on('approve-screen-share', async ({ participantId }) => {
    try {
      const { broadcastId } = socket.data;
      const userId = socket.data.userId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Approve screen share rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      io.to(`broadcast:${broadcastId}`).emit('screen-share-approved', { participantId });
    } catch (error) {
      logger.error('Approve screen share error:', error);
      socket.emit('error', { message: 'Failed to approve screen share' });
    }
  });

  // Deny screen share
  socket.on('deny-screen-share', async ({ participantId, reason }) => {
    try {
      const { broadcastId } = socket.data;
      const userId = socket.data.userId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Deny screen share rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      io.to(`broadcast:${broadcastId}`).emit('screen-share-denied', { participantId, reason });
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
    }
  });

  // Broadcaster screen share stopped
  socket.on('broadcaster-screen-share-stopped', () => {
    const { broadcastId, participantId } = socket.data;
    if (broadcastId) {
      socket.to(`broadcast:${broadcastId}`).emit('broadcaster-screen-share-stopped', { participantId });
    }
  });

  // Participant screen share started
  socket.on('participant-screen-share-started', ({ participantId, hasAudio }) => {
    const { broadcastId } = socket.data;
    if (broadcastId) {
      io.to(`broadcast:${broadcastId}`).emit('participant-screen-share-started', {
        participantId,
        hasAudio,
      });
    }
  });

  // Participant screen share stopped
  socket.on('participant-screen-share-stopped', ({ participantId }) => {
    const { broadcastId } = socket.data;
    if (broadcastId) {
      io.to(`broadcast:${broadcastId}`).emit('participant-screen-share-stopped', { participantId });
    }
  });
}
