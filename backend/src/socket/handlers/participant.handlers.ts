/**
 * Participant Management Socket Handlers
 *
 * Handles:
 * - Promote/demote participants between stage roles
 * - Volume control for individual participants
 * - Mute/unmute remote participants
 * - Kick participant from broadcast
 * - Ban participant from broadcast
 */

import { Socket, Server as SocketServer } from 'socket.io';
import prisma from '../../database/prisma';
import logger from '../../utils/logger';
import { isValidUUID, verifyBroadcastAccess } from '../utils/validation';

export function registerParticipantHandlers(socket: Socket, io: SocketServer): void {
  // Promote participant to live
  socket.on('promote-to-live', async ({ participantId }) => {
    try {
      const { broadcastId } = socket.data;
      const userId = socket.data.userId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      if (!isValidUUID(participantId)) {
        logger.warn(`Promote rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Promote rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      await prisma.participant.update({
        where: { id: participantId },
        data: { role: 'guest' },
      });

      io.to(`broadcast:${broadcastId}`).emit('participant-promoted', {
        participantId,
        role: 'guest',
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Demote rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Demote rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      await prisma.participant.update({
        where: { id: participantId },
        data: { role: 'backstage' },
      });

      io.to(`broadcast:${broadcastId}`).emit('participant-demoted', {
        participantId,
        role: 'backstage',
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Set volume rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Set volume rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      io.to(`broadcast:${broadcastId}`).emit('participant-volume-changed', {
        participantId,
        volume,
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Mute rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Mute rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      io.to(`broadcast:${broadcastId}`).emit('participant-muted', {
        participantId,
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Unmute rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Unmute rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      io.to(`broadcast:${broadcastId}`).emit('participant-unmuted', {
        participantId,
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Kick rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Kick rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      await prisma.participant.update({
        where: { id: participantId },
        data: {
          status: 'kicked',
          leftAt: new Date(),
        },
      });
      logger.info(`[Kick] Participant ${participantId} marked as kicked`);

      io.to(`broadcast:${broadcastId}`).emit('participant-kicked', {
        participantId,
      });

      io.to(`greenroom:${broadcastId}`).emit('greenroom-participant-left', {
        participantId,
      });
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

      if (!isValidUUID(participantId)) {
        logger.warn(`Ban rejected: Invalid participantId format: ${participantId}`);
        return socket.emit('error', { message: 'Invalid participant ID' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Ban rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      await prisma.participant.update({
        where: { id: participantId },
        data: {
          status: 'banned',
          leftAt: new Date(),
        },
      });
      logger.info(`[Ban] Participant ${participantId} marked as banned`);

      io.to(`broadcast:${broadcastId}`).emit('participant-banned', {
        participantId,
      });

      io.to(`greenroom:${broadcastId}`).emit('greenroom-participant-left', {
        participantId,
      });
    } catch (error) {
      logger.error('Ban participant error:', error);
      socket.emit('error', { message: 'Failed to ban participant' });
    }
  });
}
