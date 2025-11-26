/**
 * WebRTC Service - SFU Mode for Multi-Guest
 *
 * This service handles WebRTC connections for multi-guest scenarios ONLY.
 * It connects to an SFU (Ant Media Server in conference mode) to distribute
 * participant tracks to all guests.
 *
 * IMPORTANT: This is NOT used for streaming output!
 * Streaming is handled by broadcast-output.service.ts using WHIP/RTMP-relay.
 *
 * Architecture:
 * - Each participant publishes their camera/mic to the SFU
 * - SFU distributes all tracks to all participants
 * - Each browser composites locally using StudioCanvas
 * - Canvas output goes directly to platforms via WHIP or RTMP relay
 */
import logger from '../utils/logger';

const ANT_MEDIA_SERVER_URL = import.meta.env.VITE_ANT_MEDIA_SERVER_URL || 'https://media.streamlick.com:5443';
const ANT_MEDIA_APP_NAME = import.meta.env.VITE_ANT_MEDIA_APP_NAME || 'StreamLick';

interface ConnectionState {
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastCheck: number;
}

interface RemoteParticipant {
  odId: string;
  streamId: string;
  stream: MediaStream;
}

type ConnectionCallback = (state: ConnectionState) => void;
type RemoteStreamCallback = (participantId: string, stream: MediaStream) => void;
type ParticipantLeftCallback = (participantId: string) => void;

class WebRTCService {
  private webSocket: WebSocket | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private roomId: string | null = null;
  private participantId: string | null = null;
  private localStream: MediaStream | null = null;
  private remoteStreams: Map<string, MediaStream> = new Map();
  private closed: boolean = false;

  // Connection state
  private connectionState: ConnectionState = { state: 'new', lastCheck: Date.now() };

  // Callbacks
  private onConnectionChange: ConnectionCallback | null = null;
  private onRemoteStream: RemoteStreamCallback | null = null;
  private onParticipantLeft: ParticipantLeftCallback | null = null;

  // ICE servers
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /**
   * Initialize WebRTC for a broadcast room
   */
  async initialize(broadcastId: string): Promise<void> {
    this.roomId = broadcastId;
    this.participantId = `participant_${Date.now()}`;
    this.closed = false;

    await this.connectWebSocket();
    logger.info('[WebRTC-SFU] Initialized for room:', broadcastId);
  }

  /**
   * Connect to Ant Media WebSocket for conference mode
   */
  private connectWebSocket(): Promise<void> {
    return new Promise((resolve, reject) => {
      const wsUrl = `${ANT_MEDIA_SERVER_URL.replace('https://', 'wss://').replace('http://', 'ws://')}/${ANT_MEDIA_APP_NAME}/websocket`;

      logger.info('[WebRTC-SFU] Connecting to:', wsUrl);

      this.webSocket = new WebSocket(wsUrl);

      const timeout = setTimeout(() => {
        if (this.webSocket?.readyState !== WebSocket.OPEN) {
          this.webSocket?.close();
          reject(new Error('WebSocket connection timeout'));
        }
      }, 10000);

      this.webSocket.onopen = () => {
        clearTimeout(timeout);
        this.connectionState = { state: 'connecting', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
        logger.info('[WebRTC-SFU] WebSocket connected');
        resolve();
      };

      this.webSocket.onclose = () => {
        logger.warn('[WebRTC-SFU] WebSocket closed');
        this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
        this.onConnectionChange?.(this.connectionState);
      };

      this.webSocket.onerror = (error) => {
        clearTimeout(timeout);
        logger.error('[WebRTC-SFU] WebSocket error:', error);
        reject(error);
      };

      this.webSocket.onmessage = (event) => this.handleMessage(event);
    });
  }

  /**
   * Handle WebSocket messages
   */
  private async handleMessage(event: MessageEvent): Promise<void> {
    try {
      const message = JSON.parse(event.data);
      logger.debug('[WebRTC-SFU] Received:', message.command);

      switch (message.command) {
        case 'start':
          await this.handleStart();
          break;

        case 'takeConfiguration':
          await this.handleConfiguration(message);
          break;

        case 'takeCandidate':
          await this.handleCandidate(message);
          break;

        case 'notification':
          this.handleNotification(message);
          break;

        case 'streamJoined':
          logger.info('[WebRTC-SFU] Stream joined:', message.streamId);
          break;

        case 'streamLeaved':
          this.handleStreamLeft(message.streamId);
          break;

        case 'joinedTheRoom':
          logger.info('[WebRTC-SFU] Joined room:', message.room);
          this.connectionState = { state: 'connected', lastCheck: Date.now() };
          this.onConnectionChange?.(this.connectionState);
          break;

        case 'error':
          logger.error('[WebRTC-SFU] Server error:', message.definition);
          break;
      }
    } catch (error) {
      logger.error('[WebRTC-SFU] Error handling message:', error);
    }
  }

  /**
   * Join room and publish local stream
   */
  async joinRoom(localStream: MediaStream): Promise<void> {
    this.localStream = localStream;

    if (!this.webSocket || this.webSocket.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    // Join the conference room
    this.sendMessage({
      command: 'joinRoom',
      room: this.roomId,
      streamId: this.participantId,
    });
  }

  /**
   * Handle start - create peer connection and add tracks
   */
  private async handleStart(): Promise<void> {
    this.createPeerConnection();

    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        this.peerConnection!.addTrack(track, this.localStream!);
      });
    }

    // Create offer
    const offer = await this.peerConnection!.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await this.peerConnection!.setLocalDescription(offer);

    this.sendMessage({
      command: 'takeConfiguration',
      streamId: this.participantId,
      type: 'offer',
      sdp: offer.sdp,
    });
  }

  /**
   * Handle SDP configuration
   */
  private async handleConfiguration(message: any): Promise<void> {
    if (!this.peerConnection) {
      this.createPeerConnection();
    }

    if (message.type === 'offer') {
      await this.peerConnection!.setRemoteDescription({
        type: 'offer',
        sdp: message.sdp,
      });

      const answer = await this.peerConnection!.createAnswer();
      await this.peerConnection!.setLocalDescription(answer);

      this.sendMessage({
        command: 'takeConfiguration',
        streamId: this.participantId,
        type: 'answer',
        sdp: answer.sdp,
      });
    } else if (message.type === 'answer') {
      await this.peerConnection!.setRemoteDescription({
        type: 'answer',
        sdp: message.sdp,
      });
    }
  }

  /**
   * Handle ICE candidate
   */
  private async handleCandidate(message: any): Promise<void> {
    if (!this.peerConnection) return;

    try {
      await this.peerConnection.addIceCandidate(new RTCIceCandidate({
        candidate: message.candidate,
        sdpMLineIndex: message.label,
        sdpMid: message.id,
      }));
    } catch (error) {
      logger.error('[WebRTC-SFU] Error adding ICE candidate:', error);
    }
  }

  /**
   * Handle notifications
   */
  private handleNotification(message: any): void {
    logger.info('[WebRTC-SFU] Notification:', message.definition);
  }

  /**
   * Handle stream left
   */
  private handleStreamLeft(streamId: string): void {
    this.remoteStreams.delete(streamId);
    this.onParticipantLeft?.(streamId);
    logger.info('[WebRTC-SFU] Stream left:', streamId);
  }

  /**
   * Create peer connection
   */
  private createPeerConnection(): void {
    this.peerConnection = new RTCPeerConnection({
      iceServers: this.iceServers,
      iceCandidatePoolSize: 10,
    });

    // ICE candidates
    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendMessage({
          command: 'takeCandidate',
          streamId: this.participantId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        });
      }
    };

    // Connection state
    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      logger.info('[WebRTC-SFU] Connection state:', state);

      if (state === 'connected') {
        this.connectionState = { state: 'connected', lastCheck: Date.now() };
      } else if (state === 'disconnected' || state === 'failed') {
        this.connectionState = { state: state as any, lastCheck: Date.now() };
      }

      this.onConnectionChange?.(this.connectionState);
    };

    // Remote tracks
    this.peerConnection.ontrack = (event) => {
      logger.info('[WebRTC-SFU] Received remote track:', event.track.kind);

      if (event.streams && event.streams[0]) {
        const stream = event.streams[0];
        this.remoteStreams.set(stream.id, stream);
        this.onRemoteStream?.(stream.id, stream);
      }
    };
  }

  /**
   * Send message via WebSocket
   */
  private sendMessage(message: any): void {
    if (this.webSocket?.readyState === WebSocket.OPEN) {
      this.webSocket.send(JSON.stringify(message));
    }
  }

  /**
   * Leave room
   */
  async leaveRoom(): Promise<void> {
    if (this.roomId) {
      this.sendMessage({
        command: 'leaveFromRoom',
        room: this.roomId,
      });
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    await this.leaveRoom();

    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }

    if (this.webSocket) {
      this.webSocket.close();
      this.webSocket = null;
    }

    this.localStream = null;
    this.remoteStreams.clear();
    this.roomId = null;
    this.participantId = null;

    this.connectionState = { state: 'new', lastCheck: Date.now() };
    logger.info('[WebRTC-SFU] Closed');
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

  // Legacy compatibility methods (for existing code)
  async createSendTransport(): Promise<void> {
    // No-op - handled in joinRoom
  }

  async createRecvTransport(): Promise<void> {
    // No-op - handled automatically
  }

  async produceMedia(track: MediaStreamTrack): Promise<string> {
    // For compatibility - actual publishing happens in joinRoom
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
    // TODO: Implement stats monitoring
  }

  stopStatsMonitoring(): void {
    // No-op
  }

  /**
   * Close a producer (legacy compatibility)
   */
  closeProducer(producerId: string): void {
    // In SFU mode, we don't have individual producers to close
    // The track will be removed when we leave the room
    logger.info('[WebRTC-SFU] closeProducer called (no-op in SFU mode):', producerId);
  }

  /**
   * Replace video track (legacy compatibility)
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.peerConnection) {
      logger.warn('[WebRTC-SFU] No peer connection to replace track');
      return;
    }

    const senders = this.peerConnection.getSenders();
    const videoSender = senders.find(s => s.track?.kind === 'video');

    if (videoSender) {
      await videoSender.replaceTrack(newTrack);
      logger.info('[WebRTC-SFU] Video track replaced');
    } else {
      logger.warn('[WebRTC-SFU] No video sender found to replace track');
    }
  }
}

export const webrtcService = new WebRTCService();
