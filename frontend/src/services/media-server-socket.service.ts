import io from 'socket.io-client';

type Socket = ReturnType<typeof io>;

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:3001';

class MediaServerSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private readonly maxReconnectAttempts = 10;
  private readonly baseReconnectDelay = 1000; // 1 second
  private readonly maxReconnectDelay = 30000; // 30 seconds

  connect(): void {
    if (this.socket?.connected) return;


    this.socket = io(MEDIA_SERVER_URL, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.baseReconnectDelay,
      reconnectionDelayMax: this.maxReconnectDelay,
      randomizationFactor: 0.5,
      timeout: 20000,
    });

    this.socket.on('connect', () => {
      this.reconnectAttempts = 0;
    });

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
      console.error('Media server socket reconnection failed after maximum attempts');
      this.reconnectAttempts = 0;
    });

    this.socket.on('reconnect', (attempt: number) => {
      this.reconnectAttempts = 0;
    });

    this.socket.on('error', (error: Error) => {
      console.error('Media server socket error:', error);
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  emit<T = unknown>(event: string, data?: unknown, callback?: (response: T) => void): void {
    if (!this.socket) {
      console.error('Media server socket not connected');
      return;
    }

    if (callback) {
      this.socket.emit(event, data, callback);
    } else {
      this.socket.emit(event, data);
    }
  }

  on<T = unknown>(event: string, callback: (data: T) => void): void {
    this.socket?.on(event, callback);
  }

  off<T = unknown>(event: string, callback?: (data: T) => void): void {
    this.socket?.off(event, callback);
  }

  get connected(): boolean {
    return this.socket?.connected || false;
  }
}

export const mediaServerSocketService = new MediaServerSocketService();
