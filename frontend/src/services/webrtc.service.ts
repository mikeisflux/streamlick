/**
 * WebRTC Service - Ant Media Server SFU Mode for Multi-Guest
 *
 * This service handles WebRTC connections for multi-guest scenarios using Ant Media Server.
 * Ant Media provides a production-ready SFU with conference room support.
 *
 * IMPORTANT: This is NOT used for streaming output!
 * Streaming is handled by broadcast-output.service.ts using WHIP/RTMP-relay.
 *
 * Architecture:
 * - Each participant publishes their camera/mic to Ant Media
 * - Ant Media distributes all tracks to all participants via conference room
 * - Each browser composites locally using StudioCanvas
 * - Canvas output goes directly to platforms via WHIP or RTMP relay
 */
import logger from '../utils/logger';

// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api.streamlick.com';

// Ant Media Server configuration
const ANTMEDIA_URL = import.meta.env.VITE_ANTMEDIA_URL || 'https://media.streamlick.com';
const ANTMEDIA_WS_URL = import.meta.env.VITE_ANTMEDIA_WS_URL || 'wss://media.streamlick.com:5443/LiveApp/websocket';
const ANTMEDIA_APP = import.meta.env.VITE_ANTMEDIA_APP || 'LiveApp';

// External TURN server configuration
const TURN_URL = import.meta.env.VITE_TURN_URL || 'turn:turn.streamlick.com:3478';
const TURN_TLS_URL = import.meta.env.VITE_TURN_TLS_URL;
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || 'streamlick';
const TURN_PASSWORD = import.meta.env.VITE_TURN_PASSWORD || '';

interface ConnectionState {
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastCheck: number;
}

type ConnectionCallback = (state: ConnectionState) => void;
type RemoteStreamCallback = (participantId: string, stream: MediaStream) => void;
type ParticipantLeftCallback = (participantId: string) => void;

// Ant Media WebRTC Adaptor interface
interface WebRTCAdaptorCallbacks {
  initialized?: () => void;
  publish_started?: (streamId: string) => void;
  publish_finished?: (streamId: string) => void;
  play_started?: (streamId: string) => void;
  play_finished?: (streamId: string) => void;
  newStreamAvailable?: (obj: { streamId: string; stream: MediaStream; track?: MediaStreamTrack }) => void;
  streamInformation?: (obj: { streamId: string; streamInfo: any[] }) => void;
  roomInformation?: (obj: { room: string; streams: string[] }) => void;
  data_received?: (obj: { streamId: string; data: string }) => void;
  joined?: (obj: { streamId: string; room: string; streams?: string[] }) => void;
  leaved?: (obj: { room: string }) => void;
  peerConnectionStateChange?: (obj: { state: string; streamId: string }) => void;
  error?: (error: string, message: string) => void;
}

interface WebRTCAdaptorConfig {
  websocket_url: string;
  mediaConstraints: MediaStreamConstraints;
  peerconnection_config: RTCConfiguration;
  sdp_constraints: RTCOfferOptions;
  localVideoId?: string;
  isPlayMode?: boolean;
  debug?: boolean;
  callback: (info: string, obj?: any) => void;
  callbackError: (error: string, message?: string) => void;
}

// Dynamic import of WebRTCAdaptor from Ant Media
let WebRTCAdaptor: any = null;

async function loadWebRTCAdaptor(): Promise<any> {
  if (WebRTCAdaptor) return WebRTCAdaptor;

  try {
    // Try to import from npm package first
    const module = await import('@AntMedia/webrtc_adaptor');
    WebRTCAdaptor = module.WebRTCAdaptor || module.default;
    logger.info('[WebRTC-AntMedia] Loaded WebRTCAdaptor from npm');
    return WebRTCAdaptor;
  } catch (e) {
    logger.info('[WebRTC-AntMedia] npm package not found, loading from server');
  }

  // Fallback: Load from Ant Media server directly
  return new Promise((resolve, reject) => {
    // Check if already loaded globally
    if ((window as any).WebRTCAdaptor) {
      WebRTCAdaptor = (window as any).WebRTCAdaptor;
      resolve(WebRTCAdaptor);
      return;
    }

    const script = document.createElement('script');
    script.src = `${ANTMEDIA_URL}:5443/${ANTMEDIA_APP}/js/webrtc_adaptor.js`;
    script.async = true;
    script.onload = () => {
      WebRTCAdaptor = (window as any).WebRTCAdaptor;
      if (WebRTCAdaptor) {
        logger.info('[WebRTC-AntMedia] Loaded WebRTCAdaptor from server');
        resolve(WebRTCAdaptor);
      } else {
        reject(new Error('WebRTCAdaptor not found after script load'));
      }
    };
    script.onerror = () => reject(new Error('Failed to load WebRTCAdaptor script'));
    document.head.appendChild(script);
  });
}

class WebRTCService {
  private adaptor: any = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private streamId: string | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private subscribedStreams: Set<string> = new Set();
  private closed: boolean = false;
  private isHost: boolean = false;

  // Connection state
  private connectionState: ConnectionState = { state: 'new', lastCheck: Date.now() };

  // Callbacks
  private onConnectionChange: ConnectionCallback | null = null;
  private onRemoteStream: RemoteStreamCallback | null = null;
  private onParticipantLeft: ParticipantLeftCallback | null = null;

  /**
   * Initialize WebRTC for a broadcast room
   * @param broadcastId - The broadcast/room ID
   * @param participantId - Optional StreamLick participant ID
   * @param isHost - Whether this is the host (for permissions)
   */
  async initialize(broadcastId: string, participantId?: string, isHost: boolean = false): Promise<void> {
    this.roomId = broadcastId;
    this.participantId = participantId || `participant_${Date.now()}`;
    this.streamId = `${this.roomId}_${this.participantId}`;
    this.isHost = isHost;
    this.closed = false;

    logger.info('[WebRTC-AntMedia] Initializing for room:', broadcastId, 'participant:', this.participantId);

    // Load WebRTCAdaptor
    await loadWebRTCAdaptor();

    this.connectionState = { state: 'new', lastCheck: Date.now() };
    logger.info('[WebRTC-AntMedia] Initialized for room:', broadcastId);
  }

  /**
   * Build ICE servers configuration
   */
  private buildIceServers(): RTCIceServer[] {
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Add TURN server if credentials are configured
    if (TURN_PASSWORD) {
      const turnUrls = [TURN_URL];
      if (TURN_TLS_URL) {
        turnUrls.push(TURN_TLS_URL);
      }
      iceServers.push({
        urls: turnUrls,
        username: TURN_USERNAME,
        credential: TURN_PASSWORD,
      });
      logger.info('[WebRTC-AntMedia] TURN server configured:', { urls: turnUrls, username: TURN_USERNAME });
    } else {
      logger.warn('[WebRTC-AntMedia] TURN server NOT configured - set VITE_TURN_PASSWORD in .env');
    }

    return iceServers;
  }

  /**
   * Create the WebRTC adaptor with callbacks
   */
  private createAdaptor(localStream?: MediaStream): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!WebRTCAdaptor) {
        reject(new Error('WebRTCAdaptor not loaded'));
        return;
      }

      const iceServers = this.buildIceServers();

      this.adaptor = new WebRTCAdaptor({
        websocket_url: ANTMEDIA_WS_URL,
        mediaConstraints: {
          video: true,
          audio: true,
        },
        peerconnection_config: {
          iceServers,
          iceTransportPolicy: 'all',
        },
        sdp_constraints: {
          OfferToReceiveAudio: true,
          OfferToReceiveVideo: true,
        },
        localStream: localStream,
        debug: true,
        callback: (info: string, obj?: any) => {
          this.handleCallback(info, obj, resolve);
        },
        callbackError: (error: string, message?: string) => {
          this.handleError(error, message, reject);
        },
      });
    });
  }

  /**
   * Handle Ant Media callbacks
   */
  private handleCallback(info: string, obj: any, resolveInit?: () => void): void {
    logger.info('[WebRTC-AntMedia] Callback:', info, obj);

    switch (info) {
      case 'initialized':
        this.connectionState = { state: 'connecting', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
        resolveInit?.();
        break;

      case 'joinedTheRoom':
        logger.info('[WebRTC-AntMedia] Joined room:', obj);
        this.connectionState = { state: 'connected', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);

        // Subscribe to existing streams in the room
        if (obj.streams && Array.isArray(obj.streams)) {
          obj.streams.forEach((streamId: string) => {
            if (streamId !== this.streamId) {
              this.subscribeToStream(streamId);
            }
          });
        }

        // Start publishing our stream
        if (this.localStream && this.streamId) {
          this.adaptor.publish(this.streamId, null, null, null, this.streamId, this.roomId);
        }
        break;

      case 'publish_started':
        logger.info('[WebRTC-AntMedia] Publish started:', obj);
        break;

      case 'publish_finished':
        logger.info('[WebRTC-AntMedia] Publish finished:', obj);
        break;

      case 'streamJoined':
        // New stream joined the room
        logger.info('[WebRTC-AntMedia] Stream joined:', obj);
        if (obj.streamId && obj.streamId !== this.streamId) {
          this.subscribeToStream(obj.streamId);
        }
        break;

      case 'streamLeaved':
        // Stream left the room
        logger.info('[WebRTC-AntMedia] Stream left:', obj);
        if (obj.streamId) {
          this.handleStreamLeft(obj.streamId);
        }
        break;

      case 'newStreamAvailable':
        // Remote stream is available
        logger.info('[WebRTC-AntMedia] New stream available:', obj);
        if (obj.streamId && obj.stream) {
          this.handleNewStream(obj.streamId, obj.stream);
        }
        break;

      case 'play_started':
        logger.info('[WebRTC-AntMedia] Play started:', obj);
        break;

      case 'play_finished':
        logger.info('[WebRTC-AntMedia] Play finished:', obj);
        if (obj.streamId) {
          this.handleStreamLeft(obj.streamId);
        }
        break;

      case 'roomInformation':
        // Room info with current streams
        logger.info('[WebRTC-AntMedia] Room information:', obj);
        if (obj.streams && Array.isArray(obj.streams)) {
          // Subscribe to any streams we're not already subscribed to
          obj.streams.forEach((streamId: string) => {
            if (streamId !== this.streamId && !this.subscribedStreams.has(streamId)) {
              this.subscribeToStream(streamId);
            }
          });

          // Remove streams that are no longer in the room
          this.subscribedStreams.forEach((streamId) => {
            if (!obj.streams.includes(streamId)) {
              this.handleStreamLeft(streamId);
            }
          });
        }
        break;

      case 'leavedFromRoom':
        logger.info('[WebRTC-AntMedia] Left room');
        this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
        break;

      case 'peerConnectionStateChange':
        logger.info('[WebRTC-AntMedia] Peer connection state:', obj);
        if (obj.state === 'connected') {
          this.connectionState = { state: 'connected', lastCheck: Date.now() };
        } else if (obj.state === 'disconnected' || obj.state === 'failed') {
          this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
        }
        this.onConnectionChange?.(this.connectionState);
        break;

      case 'data_received':
        logger.info('[WebRTC-AntMedia] Data received:', obj);
        break;
    }
  }

  /**
   * Handle Ant Media errors
   */
  private handleError(error: string, message?: string, rejectInit?: (err: Error) => void): void {
    logger.error('[WebRTC-AntMedia] Error:', error, message);

    switch (error) {
      case 'no_stream_exist':
        // Stream doesn't exist anymore
        logger.warn('[WebRTC-AntMedia] Stream does not exist');
        break;

      case 'WebSocketNotConnected':
        this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
        break;

      case 'not_initialized_yet':
        logger.warn('[WebRTC-AntMedia] Not initialized yet');
        break;

      case 'data_channel_error':
        logger.warn('[WebRTC-AntMedia] Data channel error:', message);
        break;

      default:
        this.connectionState = { state: 'failed', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
    }

    if (rejectInit) {
      rejectInit(new Error(`${error}: ${message}`));
    }
  }

  /**
   * Subscribe to a remote stream
   */
  private subscribeToStream(streamId: string): void {
    if (this.subscribedStreams.has(streamId) || streamId === this.streamId) {
      return;
    }

    logger.info('[WebRTC-AntMedia] Subscribing to stream:', streamId);
    this.subscribedStreams.add(streamId);

    // Play the remote stream
    this.adaptor?.play(streamId, null, this.roomId);
  }

  /**
   * Handle new remote stream
   */
  private handleNewStream(streamId: string, stream: MediaStream): void {
    // Extract participant ID from stream ID (format: roomId_participantId)
    const participantId = this.extractParticipantId(streamId);

    logger.info('[WebRTC-AntMedia] New stream from participant:', {
      streamId,
      participantId,
      tracks: stream.getTracks().map(t => ({ kind: t.kind, id: t.id, readyState: t.readyState })),
    });

    // Store the stream
    this.remoteStreams.set(participantId, stream);

    // Notify callback
    this.onRemoteStream?.(participantId, stream);
  }

  /**
   * Handle stream leaving
   */
  private handleStreamLeft(streamId: string): void {
    const participantId = this.extractParticipantId(streamId);

    logger.info('[WebRTC-AntMedia] Stream left:', { streamId, participantId });

    this.subscribedStreams.delete(streamId);
    this.remoteStreams.delete(participantId);
    this.onParticipantLeft?.(participantId);
  }

  /**
   * Extract participant ID from stream ID
   */
  private extractParticipantId(streamId: string): string {
    // Stream ID format: roomId_participantId
    const parts = streamId.split('_');
    if (parts.length >= 2) {
      return parts.slice(1).join('_'); // Handle participant IDs that might contain underscores
    }
    return streamId;
  }

  /**
   * Join room and publish local stream
   */
  async joinRoom(localStream: MediaStream): Promise<void> {
    this.localStream = localStream;

    if (!this.roomId || !this.participantId) {
      throw new Error('Service not initialized');
    }

    logger.info('[WebRTC-AntMedia] Joining room:', this.roomId, 'as:', this.participantId);

    // Create adaptor with local stream
    await this.createAdaptor(localStream);

    // Join the conference room
    this.adaptor?.joinRoom(this.roomId, this.streamId);

    this.connectionState = { state: 'connecting', lastCheck: Date.now() };
    this.onConnectionChange?.(this.connectionState);
  }

  /**
   * Join room and publish - convenience method
   */
  async joinAndPublish(
    broadcastId: string,
    participantId: string,
    localStream: MediaStream,
    isHost: boolean = false
  ): Promise<void> {
    await this.initialize(broadcastId, participantId, isHost);
    await this.joinRoom(localStream);
  }

  /**
   * Leave room
   */
  async leaveRoom(): Promise<void> {
    if (this.adaptor && this.roomId) {
      // Stop publishing
      if (this.streamId) {
        this.adaptor.stop(this.streamId);
      }

      // Leave the room
      this.adaptor.leaveFromRoom(this.roomId);
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    await this.leaveRoom();

    if (this.adaptor) {
      this.adaptor.closeWebSocket();
      this.adaptor = null;
    }

    this.localStream = null;
    this.remoteStreams.clear();
    this.subscribedStreams.clear();
    this.roomId = null;
    this.participantId = null;
    this.streamId = null;

    this.connectionState = { state: 'new', lastCheck: Date.now() };
    logger.info('[WebRTC-AntMedia] Closed');
  }

  /**
   * Set callbacks
   */
  setConnectionCallback(callback: ConnectionCallback): void {
    this.onConnectionChange = callback;
  }

  setRemoteStreamCallback(callback: RemoteStreamCallback): void {
    this.onRemoteStream = callback;
  }

  setParticipantLeftCallback(callback: ParticipantLeftCallback): void {
    this.onParticipantLeft = callback;
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Get remote streams
   */
  getRemoteStreams(): Map<string, MediaStream> {
    return new Map(this.remoteStreams);
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.connectionState.state === 'connected';
  }

  /**
   * Get participant ID
   */
  getParticipantId(): string | null {
    return this.participantId;
  }

  /**
   * Get stream ID
   */
  getStreamId(): string | null {
    return this.streamId;
  }

  // Legacy compatibility methods
  async createSendTransport(): Promise<void> {
    // No-op - handled in joinRoom
  }

  async createRecvTransport(): Promise<void> {
    // No-op - handled automatically
  }

  async produceMedia(track: MediaStreamTrack): Promise<string> {
    return this.participantId || 'unknown';
  }

  getDevice(): null {
    return null;
  }

  getProducers(): Map<string, any> {
    return new Map();
  }

  getConsumers(): Map<string, any> {
    return new Map();
  }

  startStatsMonitoring(): void {
    // TODO: Implement stats monitoring with Ant Media
  }

  stopStatsMonitoring(): void {
    // No-op
  }

  closeProducer(producerId: string): void {
    logger.info('[WebRTC-AntMedia] closeProducer called:', producerId);
  }

  /**
   * Replace video track
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.adaptor || !this.streamId) {
      logger.warn('[WebRTC-AntMedia] No adaptor to replace track');
      return;
    }

    try {
      // Update local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getVideoTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newTrack);
      }

      // Replace track in adaptor
      this.adaptor.updateVideoTrack(this.streamId, newTrack);
      logger.info('[WebRTC-AntMedia] Video track replaced');
    } catch (error) {
      logger.error('[WebRTC-AntMedia] Error replacing video track:', error);
    }
  }

  /**
   * Replace audio track
   */
  async replaceAudioTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.adaptor || !this.streamId) {
      logger.warn('[WebRTC-AntMedia] No adaptor to replace track');
      return;
    }

    try {
      // Update local stream
      if (this.localStream) {
        const oldTrack = this.localStream.getAudioTracks()[0];
        if (oldTrack) {
          this.localStream.removeTrack(oldTrack);
          oldTrack.stop();
        }
        this.localStream.addTrack(newTrack);
      }

      // Replace track in adaptor
      this.adaptor.updateAudioTrack(this.streamId, newTrack);
      logger.info('[WebRTC-AntMedia] Audio track replaced');
    } catch (error) {
      logger.error('[WebRTC-AntMedia] Error replacing audio track:', error);
    }
  }

  /**
   * Mute/unmute video
   */
  muteVideo(muted: boolean): void {
    if (this.adaptor && this.streamId) {
      if (muted) {
        this.adaptor.turnOffLocalCamera(this.streamId);
      } else {
        this.adaptor.turnOnLocalCamera(this.streamId);
      }
    }
  }

  /**
   * Mute/unmute audio
   */
  muteAudio(muted: boolean): void {
    if (this.adaptor && this.streamId) {
      if (muted) {
        this.adaptor.muteLocalMic();
      } else {
        this.adaptor.unmuteLocalMic();
      }
    }
  }

  /**
   * Send data to all participants
   */
  sendData(data: string): void {
    if (this.adaptor && this.streamId) {
      this.adaptor.sendData(this.streamId, data);
    }
  }

  /**
   * Get Ant Media REST API URL
   */
  static getRestApiUrl(): string {
    return `${ANTMEDIA_URL}:5443/${ANTMEDIA_APP}/rest/v2`;
  }

  /**
   * Get WebSocket URL
   */
  static getWebSocketUrl(): string {
    return ANTMEDIA_WS_URL;
  }
}

export const webrtcService = new WebRTCService();
