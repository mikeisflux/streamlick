/**
 * WebRTC Signaling Socket Handlers
 *
 * Handles both preview stream (host -> guest) and guest stream (guest -> host) signaling:
 * - Preview stream requests and offers
 * - Guest stream offers and answers
 * - ICE candidate exchange
 */

import { Socket, Server as SocketServer } from 'socket.io';
import logger from '../../utils/logger';

export function registerWebRTCSignalingHandlers(socket: Socket, io: SocketServer): void {
  // ============================================
  // Preview Stream WebRTC Signaling
  // Allows guests to see the host's canvas output
  // ============================================

  // Guest requests preview stream from host
  socket.on('request-preview-stream', ({ broadcastId: targetBroadcastId }) => {
    const { participantId } = socket.data;
    const broadcastId = targetBroadcastId || socket.data.broadcastId;

    if (!broadcastId || !participantId) {
      return socket.emit('error', { message: 'Missing broadcast or participant ID' });
    }

    logger.info(`[Preview] Guest ${participantId} requesting preview stream for broadcast ${broadcastId}`);

    socket.to(`broadcast:${broadcastId}`).emit('preview-stream-requested', {
      guestId: participantId,
      guestSocketId: socket.id,
    });
  });

  // Host sends WebRTC offer for preview stream
  socket.on('preview-offer', ({ guestSocketId, offer }) => {
    const { broadcastId } = socket.data;

    if (!broadcastId || !guestSocketId) {
      return socket.emit('error', { message: 'Missing broadcast ID or guest socket ID' });
    }

    logger.info(`[Preview] Host sending offer to guest ${guestSocketId}`);

    io.to(guestSocketId).emit('preview-offer', {
      offer,
      hostSocketId: socket.id,
    });
  });

  // Guest sends WebRTC answer for preview stream
  socket.on('preview-answer', ({ hostSocketId, answer }) => {
    if (!hostSocketId) {
      return socket.emit('error', { message: 'Missing host socket ID' });
    }

    logger.info(`[Preview] Guest sending answer to host ${hostSocketId}`);

    io.to(hostSocketId).emit('preview-answer', {
      answer,
      guestSocketId: socket.id,
    });
  });

  // Exchange ICE candidates for preview stream
  socket.on('preview-ice-candidate', ({ targetSocketId, candidate }) => {
    if (!targetSocketId || !candidate) {
      return;
    }

    io.to(targetSocketId).emit('preview-ice-candidate', {
      candidate,
      fromSocketId: socket.id,
    });
  });

  // ============================================
  // Guest Stream WebRTC Signaling (P2P)
  // Allows host to receive guest camera/mic streams
  // ============================================

  // Guest sends WebRTC offer to host (guest is sending their camera)
  socket.on('guest-stream-offer', ({ offer }) => {
    const { broadcastId, participantId } = socket.data;

    if (!broadcastId || !participantId) {
      return socket.emit('error', { message: 'Missing broadcast or participant ID' });
    }

    logger.info(`[GuestStream] Guest ${participantId} sending stream offer for broadcast ${broadcastId}`);

    socket.to(`broadcast:${broadcastId}`).emit('guest-stream-offer', {
      participantId,
      guestSocketId: socket.id,
      offer,
    });
  });

  // Host sends WebRTC answer back to guest
  socket.on('guest-stream-answer', ({ guestSocketId, participantId, answer }) => {
    if (!guestSocketId) {
      return socket.emit('error', { message: 'Missing guest socket ID' });
    }

    logger.info(`[GuestStream] Host sending answer to guest ${participantId}`);

    io.to(guestSocketId).emit('guest-stream-answer', {
      answer,
      hostSocketId: socket.id,
    });
  });

  // Exchange ICE candidates for guest stream
  socket.on('guest-stream-ice-candidate', ({ targetSocketId, candidate }) => {
    if (!targetSocketId || !candidate) {
      return;
    }

    const { participantId } = socket.data;

    io.to(targetSocketId).emit('guest-stream-ice-candidate', {
      participantId,
      candidate,
      fromSocketId: socket.id,
    });
  });

  // Host requests all guests to resend their stream offers
  socket.on('request-guest-streams', () => {
    const { broadcastId } = socket.data;

    if (!broadcastId) {
      return socket.emit('error', { message: 'Missing broadcast ID' });
    }

    logger.info(`[GuestStream] Host requesting all guests to resend stream offers for broadcast ${broadcastId}`);

    socket.to(`broadcast:${broadcastId}`).emit('resend-stream-offer');
  });

  // ============================================
  // Generic WebRTC Signaling (fallback)
  // ============================================

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
}
