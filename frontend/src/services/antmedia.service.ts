/**
 * Ant Media Server WebRTC Service
 *
 * Handles WebRTC publishing and playback via Ant Media Server's WebSocket protocol.
 * Replaces the mediasoup-based webrtc.service.ts
 */
import logger from '../utils/logger';

const ANT_MEDIA_SERVER_URL = import.meta.env.VITE_ANT_MEDIA_SERVER_URL || 'https://media.streamlick.com:5443';
const ANT_MEDIA_APP_NAME = import.meta.env.VITE_ANT_MEDIA_APP_NAME || 'StreamLick';

interface WebRTCStats {
  packetsLost: number;
  jitter: number;
  bitrate: number;
  framesDecoded?: number;
  timestamp: number;
}

interface ConnectionState {
  publishing: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  playing: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastCheck: number;
}

interface AntMediaCallbacks {
  onConnectionStateChange?: (state: ConnectionState) => void;
  onStatsUpdate?: (stats: WebRTCStats) => void;
  onError?: (error: string) => void;
  onStreamStarted?: (streamId: string) => void;
  onStreamEnded?: (streamId: string) => void;
  onRemoteStream?: (streamId: string, stream: MediaStream) => void;
}

class AntMediaService {
  private webSocket: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private streamId: string | null = null;
  private token: string | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private closed: boolean = false;

  // Connection state
  private connectionState: ConnectionState = {
    publishing: 'new',
    playing: 'new',
    lastCheck: Date.now()
  };

  // Stats monitoring
  private statsInterval: NodeJS.Timeout | null = null;

  // Callbacks
  private callbacks: AntMediaCallbacks = {};

  // Reconnection
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnecting: boolean = false;

  // ICE servers configuration
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /**
   * Initialize connection to Ant Media Server
   */
  async initialize(streamId: string, token?: string): Promise<void> {
    this.streamId = streamId;
    this.token = token || null;
    this.closed = false;

    await this.connectWebSocket();
    logger.info('[AntMedia] Initialized for stream:', streamId);
  }

  /**
   * Connect to Ant Media WebSocket
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${ANT_MEDIA_SERVER_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/${ANT_MEDIA_APP_NAME}/websocket`;

      logger.info('[AntMedia] Connecting to WebSocket:', wsUrl);

      this.webSocket = new WebSocket(wsUrl);

      const connectionTimeout = setTimeout(() => {
        if (this.webSocket?.readyState !== WebSocket.OPEN) {
          this.webSocket?.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);

      this.webSocket.onopen = () => {
        clearTimeout(connectionTimeout);
        logger.info('[AntMedia] WebSocket connected');
        this.reconnectAttempts = 0;
        resolve();
      };

      this.webSocket.onclose = (event) => {
        logger.warn('[AntMedia] WebSocket closed:', event.code, event.reason);
        this.handleDisconnection();
      };

      this.webSocket.onerror = (error) => {
        clearTimeout(connectionTimeout);
        logger.error('[AntMedia] WebSocket error:', error);
        this.callbacks.onError?.('WebSocket connection error');
        reject(error);
      };

      this.webSocket.onmessage = (event) => {
        this.handleWebSocketMessage(event);
      };
    });
  }

  /**
   * Handle incoming WebSocket messages from Ant Media
   */
  private async handleWebSocketMessage(event: MessageEvent): Promise<void> {
    try {
      const message = JSON.parse(event.data);
      logger.debug('[AntMedia] Received message:', message.command);

      switch (message.command) {
        case 'start':
          // Server is ready to receive our stream
          await this.handleStart(message);
          break;

        case 'takeConfiguration':
          // SDP offer/answer from server
          await this.handleTakeConfiguration(message);
          break;

        case 'takeCandidate':
          // ICE candidate from server
          await this.handleTakeCandidate(message);
          break;

        case 'publish_started':
          logger.info('[AntMedia] Publish started for stream:', message.streamId);
          this.connectionState.publishing = 'connected';
          this.callbacks.onStreamStarted?.(message.streamId);
          this.callbacks.onConnectionStateChange?.(this.connectionState);
          break;

        case 'publish_finished':
          logger.info('[AntMedia] Publish finished for stream:', message.streamId);
          this.connectionState.publishing = 'disconnected';
          this.callbacks.onStreamEnded?.(message.streamId);
          this.callbacks.onConnectionStateChange?.(this.connectionState);
          break;

        case 'play_started':
          logger.info('[AntMedia] Play started for stream:', message.streamId);
          this.connectionState.playing = 'connected';
          this.callbacks.onConnectionStateChange?.(this.connectionState);
          break;

        case 'play_finished':
          logger.info('[AntMedia] Play finished for stream:', message.streamId);
          this.connectionState.playing = 'disconnected';
          this.callbacks.onConnectionStateChange?.(this.connectionState);
          break;

        case 'error':
          logger.error('[AntMedia] Server error:', message.definition);
          this.callbacks.onError?.(message.definition || 'Unknown error');
          break;

        case 'notification':
          this.handleNotification(message);
          break;

        case 'pong':
          // Heartbeat response - ignore
          break;

        default:
          logger.debug('[AntMedia] Unhandled command:', message.command);
      }
    } catch (error) {
      logger.error('[AntMedia] Error parsing message:', error);
    }
  }

  /**
   * Handle start command - create peer connection
   */
  private async handleStart(message: any): Promise<void> {
    logger.info('[AntMedia] Handling start command');

    // Create peer connection if not exists
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    // Add local tracks if publishing
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
        logger.info('[AntMedia] Added local track:', track.kind, track.id);
      });
    }

    // Create and send offer
    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection!.setLocalDescription(offer);

    this.sendMessage({
      command: 'takeConfiguration',
      streamId: this.streamId,
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  /**
   * Handle SDP configuration from server
   */
  private async handleTakeConfiguration(message: any): Promise<void> {
    logger.info('[AntMedia] Handling take configuration:', message.type);

    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (message.type === 'offer') {
      // Server sent an offer (for play mode)
      await this.peerConnection!.setRemoteDescription(
        new RTCSessionDescription({ type: 'offer', sdp: message.sdp })
      );

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.sendMessage({
        command: 'takeConfiguration',
        streamId: this.streamId,
        type: 'answer',
        sdp: answer.sdp,
      });
    } else if (message.type === 'answer') {
      // Server sent an answer (for publish mode)
      await this.peerConnection!.setRemoteDescription(
        new RTCSessionDescription({ type: 'answer', sdp: message.sdp })
      );
    }
  }

  /**
   * Handle ICE candidate from server
   */
  private async handleTakeCandidate(message: any): Promise<void> {
    if (!this.peerConnection) {
      logger.warn('[AntMedia] Received ICE candidate but no peer connection');
      return;
    }

    try {
      const candidate = new RTCIceCandidate({
        candidate: message.candidate,
        sdpMLineIndex: message.label,
        sdpMid: message.id,
      });

      await this.peerConnection.addIceCandidate(candidate);
      logger.debug('[AntMedia] Added ICE candidate');
    } catch (error) {
      logger.error('[AntMedia] Error adding ICE candidate:', error);
    }
  }

  /**
   * Handle notification messages
   */
  private handleNotification(message: any): void {
    logger.info('[AntMedia] Notification:', message.definition);

    switch (message.definition) {
      case 'joinedTheRoom':
        logger.info('[AntMedia] Joined room:', message.room);
        break;
      case 'leavedTheRoom':
        logger.info('[AntMedia] Left room:', message.room);
        break;
      case 'streamJoined':
        logger.info('[AntMedia] Stream joined:', message.streamId);
        break;
      case 'streamLeaved':
        logger.info('[AntMedia] Stream left:', message.streamId);
        break;
    }
  }

  /**
   * Create RTCPeerConnection
   */
  private createPeerConnection(): void {
    const config: RTCConfiguration = {
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    };

    this.peerConnection = new RTCPeerConnection(config);

    // Handle ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          command: 'takeCandidate',
          streamId: this.streamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      }
    };

    // Handle connection state changes
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.info('[AntMedia] Connection state:', state);

      if (state === 'connected') {
        this.connectionState.publishing = 'connected';
        this.callbacks.onConnectionStateChange?.(this.connectionState);
      } else if (state === 'disconnected' || state === 'failed') {
        this.connectionState.publishing = state as any;
        this.callbacks.onConnectionStateChange?.(this.connectionState);
        this.handleDisconnection();
      }
    };

    // Handle ICE connection state changes
    this.peerConnection.oniceconnectionstatechange = () => {
      logger.info('[AntMedia] ICE connection state:', this.peerConnection?.iceConnectionState);
    };

    // Handle incoming tracks (for playing)
    this.peerConnection.ontrack = (event) => {
      logger.info('[AntMedia] Received remote track:', event.track.kind);

      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        this.remoteStreams.set(stream.id, stream);
        this.callbacks.onRemoteStream?.(this.streamId!, stream);
      }
    };

    logger.info('[AntMedia] Peer connection created');
  }

  /**
   * Start publishing a stream
   */
  async publish(stream: MediaStream, streamId?: string): Promise<void> {
    if (streamId) {
      this.streamId = streamId;
    }

    if (!this.streamId) {
      throw new Error('Stream ID is required');
    }

    this.localStream = stream;
    this.connectionState.publishing = 'connecting';
    this.callbacks.onConnectionStateChange?.(this.connectionState);

    // Ensure WebSocket is connected
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      await this.connectWebSocket();
    }

    // Send publish command
    const publishCommand: any = {
      command: 'publish',
      streamId: this.streamId,
      video: stream.getVideoTracks().length > 0,
      audio: stream.getAudioTracks().length > 0,
    };

    if (this.token) {
      publishCommand.token = this.token;
    }

    this.sendMessage(publishCommand);
    logger.info('[AntMedia] Publish command sent for stream:', this.streamId);
  }

  /**
   * Start playing a stream
   */
  async play(streamId: string, token?: string): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      this.streamId = streamId;
      this.token = token || null;
      this.connectionState.playing = 'connecting';
      this.callbacks.onConnectionStateChange?.(this.connectionState);

      // Set up callback to resolve when stream is received
      const originalCallback = this.callbacks.onRemoteStream;
      this.callbacks.onRemoteStream = (id, stream) => {
        originalCallback?.(id, stream);
        resolve(stream);
      };

      // Send play command
      const playCommand: any = {
        command: 'play',
        streamId: streamId,
      };

      if (token) {
        playCommand.token = token;
      }

      this.sendMessage(playCommand);
      logger.info('[AntMedia] Play command sent for stream:', streamId);

      // Timeout after 10 seconds
      setTimeout(() => {
        reject(new Error('Play timeout - no stream received'));
      }, 10000);
    });
  }

  /**
   * Stop publishing
   */
  async stopPublishing(): Promise<void> {
    if (!this.streamId) return;

    this.sendMessage({
      command: 'stop',
      streamId: this.streamId,
    });

    this.connectionState.publishing = 'disconnected';
    this.callbacks.onConnectionStateChange?.(this.connectionState);
    logger.info('[AntMedia] Stop publishing command sent');
  }

  /**
   * Stop playing
   */
  async stopPlaying(): Promise<void> {
    if (!this.streamId) return;

    this.sendMessage({
      command: 'stop',
      streamId: this.streamId,
    });

    this.connectionState.playing = 'disconnected';
    this.callbacks.onConnectionStateChange?.(this.connectionState);
    logger.info('[AntMedia] Stop playing command sent');
  }

  /**
   * Replace video track (e.g., when switching cameras)
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.peerConnection) {
      logger.warn('[AntMedia] No peer connection to replace track');
      return;
    }

    const senders = this.peerConnection.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');

    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
      logger.info('[AntMedia] Video track replaced');
    } else {
      logger.warn('[AntMedia] No video sender found');
    }
  }

  /**
   * Replace audio track
   */
  async replaceAudioTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.peerConnection) {
      logger.warn('[AntMedia] No peer connection to replace track');
      return;
    }

    const senders = this.peerConnection.getSenders();
    const audioSender = senders.find(s => s.track?.kind === 'audio');

    if (audioSender) {
      await audioSender.replaceTrack(newTrack);
      logger.info('[AntMedia] Audio track replaced');
    } else {
      logger.warn('[AntMedia] No audio sender found');
    }
  }

  /**
   * Send message to Ant Media via WebSocket
   */
  private sendMessage(message: any): void {
    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      logger.error('[AntMedia] WebSocket not connected, cannot send message');
      return;
    }

    this.webSocket.send(JSON.stringify(message));
    logger.debug('[AntMedia] Sent message:', message.command);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(): void {
    if (this.closed || this.reconnecting) return;

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.attemptReconnection();
    } else {
      logger.error('[AntMedia] Max reconnection attempts reached');
      this.callbacks.onError?.('Connection lost - max reconnection attempts reached');
    }
  }

  /**
   * Attempt to reconnect
   */
  private async attemptReconnection(): Promise<void> {
    if (this.reconnecting || this.closed) return;

    this.reconnecting = true;
    this.reconnectAttempts++;

    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    logger.info(`[AntMedia] Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms`);

    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    try {
      await this.connectWebSocket();

      // Re-publish if we were publishing
      if (this.localStream && this.streamId) {
        await this.publish(this.localStream);
      }

      this.reconnecting = false;
      logger.info('[AntMedia] Reconnection successful');
    } catch (error) {
      this.reconnecting = false;
      logger.error('[AntMedia] Reconnection failed:', error);
      this.handleDisconnection();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.closed) {
      logger.debug('[AntMedia] Already closed');
      return;
    }

    this.closed = true;
    this.stopStatsMonitoring();

    // Stop publishing if active
    if (this.connectionState.publishing === 'connected') {
      await this.stopPublishing();
    }

    // Close peer connection
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    // Close WebSocket
    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    // Clear streams
    this.localStream = null;
    this.remoteStreams.clear();
    this.streamId = null;
    this.token = null;

    this.connectionState = { publishing: 'new', playing: 'new', lastCheck: Date.now() };

    logger.info('[AntMedia] Service closed');
  }

  /**
   * Start stats monitoring
   */
  startStatsMonitoring(intervalMs: number = 3000): void {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(async () => {
      await this.collectAndReportStats();
    }, intervalMs);

    logger.info('[AntMedia] Stats monitoring started');
  }

  /**
   * Stop stats monitoring
   */
  stopStatsMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  /**
   * Collect and report stats
   */
  private async collectAndReportStats(): Promise<void> {
    if (!this.peerConnection) return;

    try {
      const stats = await this.peerConnection.getStats();
      const webrtcStats: WebRTCStats = {
        packetsLost: 0,
        jitter: 0,
        bitrate: 0,
        timestamp: Date.now(),
      };

      stats.forEach((report: any) => {
        if (report.type === 'outbound-rtp') {
          webrtcStats.bitrate += report.bytesSent || 0;
          webrtcStats.packetsLost += report.packetsLost || 0;
        } else if (report.type === 'inbound-rtp') {
          webrtcStats.packetsLost += report.packetsLost || 0;
          webrtcStats.jitter = Math.max(webrtcStats.jitter, report.jitter || 0);
          webrtcStats.framesDecoded = report.framesDecoded;
        }
      });

      this.callbacks.onStatsUpdate?.(webrtcStats);

      if (webrtcStats.packetsLost > 100) {
        logger.warn('[AntMedia] High packet loss:', webrtcStats.packetsLost);
      }
    } catch (error) {
      logger.error('[AntMedia] Error collecting stats:', error);
    }
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Set callbacks
   */
  setCallbacks(callbacks: AntMediaCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Get stats
   */
  async getStats(): Promise<WebRTCStats> {
    const webrtcStats: WebRTCStats = {
      packetsLost: 0,
      jitter: 0,
      bitrate: 0,
      timestamp: Date.now(),
    };

    if (!this.peerConnection) return webrtcStats;

    const stats = await this.peerConnection.getStats();
    stats.forEach((report: any) => {
      if (report.type === 'outbound-rtp') {
        webrtcStats.bitrate += report.bytesSent || 0;
        webrtcStats.packetsLost += report.packetsLost || 0;
      } else if (report.type === 'inbound-rtp') {
        webrtcStats.packetsLost += report.packetsLost || 0;
        webrtcStats.jitter = Math.max(webrtcStats.jitter, report.jitter || 0);
        webrtcStats.framesDecoded = report.framesDecoded;
      }
    });

    return webrtcStats;
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.webSocket?.readyState === WebSocket.OPEN &&
           this.peerConnection?.connectionState === 'connected';
  }

  /**
   * Get stream ID
   */
  getStreamId(): string | null {
    return this.streamId;
  }
}

export const antMediaService = new AntMediaService();
