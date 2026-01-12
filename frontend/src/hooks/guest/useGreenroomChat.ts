/**
 * useGreenroomChat Hook
 *
 * Handles greenroom participant list and chat messages.
 * - Tracks greenroom participants joining/leaving
 * - Handles participant stream updates
 * - Manages private and public chat messages
 */

import { useEffect, useState } from 'react';
import { socketService } from '../../services/socket.service';

export interface GreenroomParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

interface UseGreenroomChatOptions {
  hasJoined: boolean;
}

interface UseGreenroomChatResult {
  greenroomParticipants: Map<string, GreenroomParticipant>;
  privateChatMessages: ChatMessage[];
  publicChatMessages: ChatMessage[];
  sendPrivateChat: (message: string, author: string, broadcastId: string) => void;
}

export function useGreenroomChat({
  hasJoined,
}: UseGreenroomChatOptions): UseGreenroomChatResult {
  const [greenroomParticipants, setGreenroomParticipants] = useState<
    Map<string, GreenroomParticipant>
  >(new Map());
  const [privateChatMessages, setPrivateChatMessages] = useState<ChatMessage[]>([]);
  const [publicChatMessages, setPublicChatMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    if (!hasJoined) return;

    // Handle participant joined
    const handleGreenroomParticipantJoined = ({
      participantId,
      name,
    }: {
      participantId: string;
      name: string;
    }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(participantId, {
          id: participantId,
          name: name || 'Guest',
          stream: null,
          audioEnabled: true,
          videoEnabled: true,
        });
        return updated;
      });
    };

    // Handle participant left
    const handleGreenroomParticipantLeft = ({ participantId }: { participantId: string }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    // Handle participant stream update
    const handleGreenroomStream = ({
      participantId,
      stream,
    }: {
      participantId: string;
      stream: MediaStream;
    }) => {
      setGreenroomParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          updated.set(participantId, { ...participant, stream });
        }
        return updated;
      });
    };

    // Handle chat messages
    const handlePrivateChatMessage = (message: ChatMessage) => {
      setPrivateChatMessages((prev) => [...prev, message]);
    };

    const handlePublicChatMessage = (message: ChatMessage) => {
      setPublicChatMessages((prev) => [...prev, message]);
    };

    socketService.on('greenroom-participant-joined', handleGreenroomParticipantJoined);
    socketService.on('greenroom-participant-left', handleGreenroomParticipantLeft);
    socketService.on('greenroom-stream', handleGreenroomStream);
    socketService.on('private-chat-message', handlePrivateChatMessage);
    socketService.on('public-chat-message', handlePublicChatMessage);

    return () => {
      socketService.off('greenroom-participant-joined', handleGreenroomParticipantJoined);
      socketService.off('greenroom-participant-left', handleGreenroomParticipantLeft);
      socketService.off('greenroom-stream', handleGreenroomStream);
      socketService.off('private-chat-message', handlePrivateChatMessage);
      socketService.off('public-chat-message', handlePublicChatMessage);
    };
  }, [hasJoined]);

  // Send private chat message
  const sendPrivateChat = (message: string, author: string, broadcastId: string) => {
    if (!message.trim()) return;

    socketService.emit('send-private-chat', {
      broadcastId,
      message,
      author,
    });

    // Add to local messages immediately
    setPrivateChatMessages((prev) => [
      ...prev,
      { author, message, timestamp: Date.now() },
    ]);
  };

  return {
    greenroomParticipants,
    privateChatMessages,
    publicChatMessages,
    sendPrivateChat,
  };
}
