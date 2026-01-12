/**
 * Chat Socket Handlers
 *
 * Handles:
 * - Feature/pin chat messages
 * - Private chat in greenroom
 * - Start/stop chat polling from external services
 */

import { Socket, Server as SocketServer } from 'socket.io';
import { ChatManager, ChatMessage } from '../../services/chat.service';
import logger from '../../utils/logger';
import { verifyBroadcastAccess } from '../utils/validation';

// Store active chat managers
const activeChatManagers = new Map<string, ChatManager>();

// Export for use in disconnect handler
export { activeChatManagers };

export function registerChatHandlers(socket: Socket, io: SocketServer): void {
  // Feature chat message
  socket.on('feature-message', ({ messageId }) => {
    const { broadcastId } = socket.data;
    if (broadcastId) {
      io.to(`broadcast:${broadcastId}`).emit('message-featured', { messageId });
    }
  });

  // Private chat in greenroom
  socket.on('send-private-chat', ({ broadcastId: chatBroadcastId, message, author }) => {
    try {
      const { broadcastId } = socket.data;
      const targetBroadcastId = chatBroadcastId || broadcastId;

      if (!targetBroadcastId) {
        return socket.emit('error', { message: 'No broadcast ID' });
      }

      socket.to(`broadcast:${targetBroadcastId}`).emit('private-chat-message', {
        author,
        message,
        timestamp: Date.now(),
      });
    } catch (error) {
      logger.error('Send private chat error:', error);
      socket.emit('error', { message: 'Failed to send message' });
    }
  });

  // Start chat polling
  socket.on('start-chat', async ({ broadcastId }) => {
    try {
      const userId = socket.data.userId;
      if (!userId) {
        logger.error('No userId found for start-chat');
        return socket.emit('chat-error', { error: 'Not authenticated' });
      }

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Start chat rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('chat-error', { error: 'Not authorized' });
      }

      // Stop existing chat manager if any
      if (activeChatManagers.has(broadcastId)) {
        activeChatManagers.get(broadcastId)?.stopAll();
        activeChatManagers.delete(broadcastId);
      }

      // Create new chat manager
      const chatManager = new ChatManager(broadcastId, userId, (message: ChatMessage) => {
        io.to(`broadcast:${broadcastId}`).emit('chat-message', message);
      });

      await chatManager.startAll();
      activeChatManagers.set(broadcastId, chatManager);

      socket.emit('chat-started', { broadcastId });
    } catch (error: any) {
      logger.error('Start chat error:', error);
      socket.emit('chat-error', { error: error.message });
    }
  });

  // Stop chat polling
  socket.on('stop-chat', async ({ broadcastId }) => {
    try {
      const userId = socket.data.userId;

      const hasAccess = await verifyBroadcastAccess(userId, broadcastId);
      if (!hasAccess) {
        logger.warn(`Stop chat rejected: User ${userId} not authorized for broadcast ${broadcastId}`);
        return socket.emit('chat-error', { error: 'Not authorized' });
      }

      const chatManager = activeChatManagers.get(broadcastId);
      if (chatManager) {
        chatManager.stopAll();
        activeChatManagers.delete(broadcastId);
      }
      socket.emit('chat-stopped', { broadcastId });
    } catch (error: any) {
      logger.error('Stop chat error:', error);
      socket.emit('chat-error', { error: error.message });
    }
  });
}
