import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = import.meta.env.VITE_API_URL || '';

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    const token = useAuthStore.getState().token;

    socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: false,
    });

    socket.on('connect', () => {
      console.log('Socket connected');
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  return socket;
}

export function connectWithInviteToken(inviteToken: string): Socket {
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    auth: { inviteToken },
    transports: ['websocket', 'polling'],
  });

  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

// Socket event helpers
export function joinBroadcast(broadcastId: string) {
  const s = getSocket();
  s.emit('join-broadcast', broadcastId);
}

export function leaveBroadcast() {
  const s = getSocket();
  s.emit('leave-broadcast');
}

export function publishStream(streamId: string) {
  const s = getSocket();
  s.emit('publish-stream', { streamId });
}

export function unpublishStream() {
  const s = getSocket();
  s.emit('unpublish-stream');
}

export function bringOnStage(participantId: string) {
  const s = getSocket();
  s.emit('bring-on-stage', participantId);
}

export function removeFromStage(participantId: string) {
  const s = getSocket();
  s.emit('remove-from-stage', participantId);
}

export function setLayout(layout: string) {
  const s = getSocket();
  s.emit('set-layout', layout);
}

export function updateBranding(branding: { backgroundColor?: string; logoUrl?: string; overlayText?: string }) {
  const s = getSocket();
  s.emit('update-branding', branding);
}

export function muteParticipant(participantId: string, audio?: boolean, video?: boolean) {
  const s = getSocket();
  s.emit('mute-participant', { participantId, audio, video });
}

export function goLive() {
  const s = getSocket();
  s.emit('go-live');
}

export function endBroadcast() {
  const s = getSocket();
  s.emit('end-broadcast');
}

export function sendChatMessage(message: string) {
  const s = getSocket();
  s.emit('chat-message', { message });
}
