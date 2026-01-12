/**
 * RTMP Streaming Socket Handlers
 *
 * Handles:
 * - Start/stop RTMP streaming to destinations
 * - Destination stream status updates
 */

import { Socket, Server as SocketServer } from 'socket.io';
import logger from '../../utils/logger';
import { verifyBroadcastAccess } from '../utils/validation';

export function registerRtmpHandlers(socket: Socket, io: SocketServer): void {
  // Start RTMP streaming to destinations
  socket.on('start-rtmp', async ({ broadcastId, destinations, compositeProducers }) => {
    try {
      const userId = socket.data.userId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      // Verify user owns the broadcast
      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Start RTMP rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      // In a production environment, this would:
      // 1. Connect to the media server
      // 2. Start RTMP streams to each destination
      // 3. Monitor stream health
      // For now, we'll emit success and let the client know streaming started

      io.to(`broadcast:${broadcastId}`).emit('rtmp-started', {
        broadcastId,
        destinations: destinations.map((d: any) => d.id),
      });

      // Notify each destination started successfully
      for (const dest of destinations) {
        io.to(`broadcast:${broadcastId}`).emit('destination-stream-started', {
          destinationId: dest.id,
          platform: dest.platform,
        });
      }
    } catch (error: any) {
      logger.error('Start RTMP error:', error);
      socket.emit('error', { message: 'Failed to start RTMP streaming' });
    }
  });

  // Stop RTMP streaming
  socket.on('stop-rtmp', async ({ broadcastId }) => {
    try {
      const userId = socket.data.userId;

      if (!broadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      // Verify user owns the broadcast
      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Stop RTMP rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('error', { message: 'Not authorized' });
      }

      // In a production environment, this would stop all RTMP streams
      io.to(`broadcast:${broadcastId}`).emit('rtmp-stopped', {
        broadcastId,
      });
    } catch (error: any) {
      logger.error('Stop RTMP error:', error);
      socket.emit('error', { message: 'Failed to stop RTMP streaming' });
    }
  });
}
