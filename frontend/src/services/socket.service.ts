import io from 'socket.io-client';
import type { LayoutConfig } from '../types';

type Socket = ReturnType<typeof io>;

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000; // 1 second
  private readonly maxReconnectDelay = 30000; // 30 seconds
  // CRITICAL FIX: Track event listeners for cleanup
  private eventListeners = new Map<string, Set<(...args: any[]) => void>>();

  connect(token?: string): void {
    if (this.socket?.connected) return;

    const options: any = {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      randomizationFactor: 0.5, // Randomize delay to prevent thundering herd
      timeout: 20000, // Connection timeout
      withCredentials: true, // Send cookies with socket connection
    };

    // Only include auth token if explicitly provided (backward compatibility)
    // Otherwise, authentication will use httpOnly cookies
    if (token) {
      options.auth = { token };
    }

    this.socket = io(API_URL, options);

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.reconnectAttempts = 0; // Reset on successful connection
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('Socket disconnected:', reason);
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, attempt - 1),
        this.maxReconnectDelay
      );
      console.log(`Reconnection attempt ${attempt}/${this.maxReconnectAttempts} (delay: ${delay}ms)`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after maximum attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect', (attempt: number) => {
      console.log(`Socket reconnected after ${attempt} attempts`);
      this.reconnectAttempts = 0;
    });

    this.socket.on('error', (error: Error) => {
      console.error('Socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      // CRITICAL FIX: Remove all event listeners before disconnecting
      this.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
  }

  // CRITICAL FIX: New method to remove all custom event listeners
  removeAllListeners(): void {
    if (!this.socket) return;

    // Remove all tracked custom listeners
    this.eventListeners.forEach((listeners, event) => {
      listeners.forEach(listener => {
        this.socket?.off(event, listener);
      });
    });
    this.eventListeners.clear();

    // Remove all Socket.IO internal listeners
    this.socket.removeAllListeners();
  }

  emit<T = unknown>(event: string, data?: unknown, callback?: (response: T) => void): void {
    if (callback) {
      this.socket?.emit(event, data, callback);
    } else {
      this.socket?.emit(event, data);
    }
  }

  on<T = unknown>(event: string, callback: (data: T) => void): void {
    if (!this.socket) return;

    // CRITICAL FIX: Track listeners for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    this.socket.on(event, callback);
  }

  off<T = unknown>(event: string, callback?: (data: T) => void): void {
    if (!this.socket) return;

    // CRITICAL FIX: Remove from tracking
    if (callback) {
      this.eventListeners.get(event)?.delete(callback);
      if (this.eventListeners.get(event)?.size === 0) {
        this.eventListeners.delete(event);
      }
      this.socket.off(event, callback);
    } else {
      // Remove all listeners for this event
      this.eventListeners.delete(event);
      this.socket.off(event);
    }
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

  updateLayout(layout: LayoutConfig): void {
    this.emit('layout-updated', layout);
  }

  getConnectionStatus(): {
    connected: boolean;
    reconnecting: boolean;
    reconnectAttempts: number;
    maxReconnectAttempts: number;
  } {
    return {
      connected: this.socket?.connected || false,
      reconnecting: this.reconnectAttempts > 0,
      reconnectAttempts: this.reconnectAttempts,
      maxReconnectAttempts: this.maxReconnectAttempts,
    };
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
