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
  // CRITICAL FIX: Queue listeners registered before socket connects
  private pendingListeners = new Map<string, Set<(...args: any[]) => void>>();

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
      this.reconnectAttempts = 0; // Reset on successful connection
    });

    // CRITICAL FIX: Register any pending listeners that were queued before socket was created
    this.pendingListeners.forEach((listeners, event) => {
      listeners.forEach(callback => {
        console.log(`[SocketService] Registering pending listener for event: ${event}`);
        this.socket?.on(event, callback);
        // Track in eventListeners for cleanup
        if (!this.eventListeners.has(event)) {
          this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(callback);
      });
    });
    this.pendingListeners.clear();

    this.socket.on('disconnect', (reason: string) => {
    });

    this.socket.on('reconnect_attempt', (attempt: number) => {
      this.reconnectAttempts = attempt;
      const delay = Math.min(
        this.baseReconnectDelay * Math.pow(2, attempt - 1),
        this.maxReconnectDelay
      );
    });

    this.socket.on('reconnect_failed', () => {
      console.error('Socket reconnection failed after maximum attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect', (attempt: number) => {
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
    // Clear pending listeners queue
    this.pendingListeners.clear();

    if (!this.socket) {
      this.eventListeners.clear();
      return;
    }

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
    // CRITICAL FIX: Queue listeners if socket not yet created
    if (!this.socket) {
      console.log(`[SocketService] Queuing listener for event: ${event} (socket not yet created)`);
      if (!this.pendingListeners.has(event)) {
        this.pendingListeners.set(event, new Set());
      }
      this.pendingListeners.get(event)!.add(callback as (...args: any[]) => void);
      return;
    }

    // CRITICAL FIX: Track listeners for cleanup
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);

    this.socket.on(event, callback);
  }

  off<T = unknown>(event: string, callback?: (data: T) => void): void {
    // CRITICAL FIX: Also remove from pending listeners queue
    if (callback) {
      this.pendingListeners.get(event)?.delete(callback as (...args: any[]) => void);
      if (this.pendingListeners.get(event)?.size === 0) {
        this.pendingListeners.delete(event);
      }
      this.eventListeners.get(event)?.delete(callback);
      if (this.eventListeners.get(event)?.size === 0) {
        this.eventListeners.delete(event);
      }
    } else {
      // Remove all listeners for this event
      this.pendingListeners.delete(event);
      this.eventListeners.delete(event);
    }

    // Only call socket.off if socket exists
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
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
