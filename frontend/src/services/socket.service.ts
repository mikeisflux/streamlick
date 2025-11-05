import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;

  connect(token: string): void {
    if (this.socket?.connected) return;

    this.socket = io(API_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
    });

    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit(event: string, data?: any): void {
    this.socket?.emit(event, data);
  }

  on(event: string, callback: (...args: any[]) => void): void {
    this.socket?.on(event, callback);
  }

  off(event: string, callback?: (...args: any[]) => void): void {
    this.socket?.off(event, callback);
  }

  joinStudio(broadcastId: string, participantId: string): void {
    this.emit('join-studio', { broadcastId, participantId });
  }

  leaveStudio(): void {
    this.emit('leave-studio');
  }

  updateMediaState(audio: boolean, video: boolean): void {
    this.emit('media-state-changed', { audio, video });
  }

  updateLayout(layout: any): void {
    this.emit('layout-updated', layout);
  }
}

export const socketService = new SocketService();
