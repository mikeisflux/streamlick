/**
 * WebRTC Service - LiveKit SFU Mode for Multi-Guest
 *
 * This service handles WebRTC connections for multi-guest scenarios using LiveKit.
 * LiveKit provides a production-ready SFU with room/conference support.
 *
 * IMPORTANT: This is NOT used for streaming output!
 * Streaming is handled by broadcast-output.service.ts using WHIP/RTMP-relay.
 *
 * Architecture:
 * - Each participant publishes their camera/mic to LiveKit
 * - LiveKit distributes all tracks to all participants
 * - Each browser composites locally using StudioCanvas
 * - Canvas output goes directly to platforms via WHIP or RTMP relay
 */
import {
  Room,
  RoomEvent,
  RemoteParticipant,
  RemoteTrackPublication,
  RemoteTrack,
  Track,
  LocalParticipant,
  LocalTrackPublication,
  ConnectionState as LKConnectionState,
  VideoPresets,
  RoomOptions,
} from 'livekit-client';
import logger from '../utils/logger';

// API configuration
const API_URL = import.meta.env.VITE_API_URL || 'https://api.streamlick.com';

// LiveKit server configuration
const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL || 'wss://media.streamlick.com';
const LIVEKIT_API_KEY = import.meta.env.VITE_LIVEKIT_API_KEY || 'devkey';
const LIVEKIT_API_SECRET = import.meta.env.VITE_LIVEKIT_API_SECRET || 'secret';

// External TURN server configuration
// IMPORTANT: Set these in your .env file for production
// VITE_TURN_URL=turn:turn.streamlick.com:3478
// VITE_TURN_USERNAME=streamlick
// VITE_TURN_PASSWORD=your-secure-password
const TURN_URL = import.meta.env.VITE_TURN_URL || 'turn:turn.streamlick.com:3478';
const TURN_TLS_URL = import.meta.env.VITE_TURN_TLS_URL; // Only use if TLS is configured on TURN server
const TURN_USERNAME = import.meta.env.VITE_TURN_USERNAME || 'streamlick';
const TURN_PASSWORD = import.meta.env.VITE_TURN_PASSWORD || '';

interface ConnectionState {
  state: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed';
  lastCheck: number;
}

type ConnectionCallback = (state: ConnectionState) => void;
type RemoteStreamCallback = (participantId: string, stream: MediaStream) => void;
type ParticipantLeftCallback = (participantId: string) => void;

class WebRTCService {
  private room: Room | null = null;
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

  /**
   * Initialize WebRTC for a broadcast room
   * @param broadcastId - The broadcast/room ID
   * @param participantId - Optional StreamLick participant ID (uses timestamp-based ID if not provided)
   */
  async initialize(broadcastId: string, participantId?: string): Promise<void> {
    this.roomId = broadcastId;
    // Use provided StreamLick participant ID or generate a fallback
    this.participantId = participantId || `participant_${Date.now()}`;
    this.closed = false;

    // Create LiveKit room instance
    this.room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        resolution: VideoPresets.h720.resolution,
      },
    });

    this.setupRoomEventHandlers();

    logger.info('[WebRTC-LiveKit] Initialized for room:', broadcastId);
  }

  /**
   * Set up LiveKit room event handlers
   */
  private setupRoomEventHandlers(): void {
    if (!this.room) return;

    // Connection state changes
    this.room.on(RoomEvent.ConnectionStateChanged, (state: LKConnectionState) => {
      logger.info('[WebRTC-LiveKit] Connection state:', state);

      switch (state) {
        case LKConnectionState.Connecting:
          this.connectionState = { state: 'connecting', lastCheck: Date.now() };
          break;
        case LKConnectionState.Connected:
          this.connectionState = { state: 'connected', lastCheck: Date.now() };
          break;
        case LKConnectionState.Disconnected:
          this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
          break;
        case LKConnectionState.Reconnecting:
          this.connectionState = { state: 'connecting', lastCheck: Date.now() };
          break;
      }

      this.onConnectionChange?.(this.connectionState);
    });

    // Remote participant connected
    this.room.on(RoomEvent.ParticipantConnected, (participant: RemoteParticipant) => {
      logger.info('[WebRTC-LiveKit] Participant connected:', participant.identity);
      this.handleParticipantConnected(participant);
    });

    // Remote participant disconnected
    this.room.on(RoomEvent.ParticipantDisconnected, (participant: RemoteParticipant) => {
      logger.info('[WebRTC-LiveKit] Participant disconnected:', participant.identity);
      this.remoteStreams.delete(participant.identity);
      this.onParticipantLeft?.(participant.identity);
    });

    // Track subscribed - when we receive a remote track
    this.room.on(
      RoomEvent.TrackSubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        logger.info('[WebRTC-LiveKit] Track subscribed:', track.kind, 'from', participant.identity);
        this.handleTrackSubscribed(track, participant);
      }
    );

    // Track unsubscribed
    this.room.on(
      RoomEvent.TrackUnsubscribed,
      (track: RemoteTrack, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
        logger.info('[WebRTC-LiveKit] Track unsubscribed:', track.kind, 'from', participant.identity);
      }
    );

    // Disconnected
    this.room.on(RoomEvent.Disconnected, () => {
      logger.warn('[WebRTC-LiveKit] Disconnected from room');
      this.connectionState = { state: 'disconnected', lastCheck: Date.now() };
      this.onConnectionChange?.(this.connectionState);
    });
  }

  /**
   * Handle when a participant connects - subscribe to their tracks
   */
  private handleParticipantConnected(participant: RemoteParticipant): void {
    // Handle existing tracks
    participant.trackPublications.forEach((publication: RemoteTrackPublication) => {
      if (publication.track && publication.isSubscribed) {
        this.handleTrackSubscribed(publication.track as RemoteTrack, participant);
      }
    });
  }

  /**
   * Handle when we subscribe to a remote track
   */
  private handleTrackSubscribed(track: RemoteTrack, participant: RemoteParticipant): void {
    const mediaTrack = track.mediaStreamTrack;
    if (!mediaTrack) return;

    // Get existing stream to preserve other tracks
    const existingStream = this.remoteStreams.get(participant.identity);

    // Collect all current tracks (excluding any of the same kind we're replacing)
    const existingTracks: MediaStreamTrack[] = [];
    if (existingStream) {
      existingStream.getTracks().forEach((t) => {
        if (t.kind !== mediaTrack.kind) {
          existingTracks.push(t);
        }
      });
    }

    // Create a NEW MediaStream with all tracks - this ensures React sees a new object
    // This is critical because React compares object references to detect changes
    const stream = new MediaStream([...existingTracks, mediaTrack]);
    this.remoteStreams.set(participant.identity, stream);

    // Log video track settings for debugging
    if (mediaTrack.kind === 'video') {
      try {
        const settings = mediaTrack.getSettings();
        logger.info('[WebRTC-LiveKit] Video track settings:', {
          participantId: participant.identity,
          trackId: mediaTrack.id,
          width: settings.width,
          height: settings.height,
          frameRate: settings.frameRate,
          deviceId: settings.deviceId,
        });
      } catch (e) {
        logger.warn('[WebRTC-LiveKit] Could not get track settings:', e);
      }
    }

    logger.info('[WebRTC-LiveKit] Created new stream with track:', {
      participantId: participant.identity,
      streamId: stream.id,
      trackKind: mediaTrack.kind,
      trackId: mediaTrack.id,
      trackMuted: mediaTrack.muted,
      trackReadyState: mediaTrack.readyState,
      totalTracks: stream.getTracks().length,
    });

    // Monitor for track ending unexpectedly
    mediaTrack.addEventListener('ended', () => {
      logger.warn('[WebRTC-LiveKit] Track ended unexpectedly:', {
        participantId: participant.identity,
        trackKind: mediaTrack.kind,
        trackId: mediaTrack.id,
      });
    });

    // If track is muted (no data flowing yet), wait for it to unmute before notifying
    // This handles the race condition where ICE negotiation is still in progress
    if (mediaTrack.muted) {
      logger.info('[WebRTC-LiveKit] Track is muted, waiting for unmute:', {
        participantId: participant.identity,
        trackKind: mediaTrack.kind,
      });

      let notified = false;
      const notifyOnce = () => {
        if (notified) return;
        notified = true;
        mediaTrack.removeEventListener('unmute', handleUnmute);
        // Get the latest stream in case it was updated while waiting
        const latestStream = this.remoteStreams.get(participant.identity);
        if (latestStream) {
          this.onRemoteStream?.(participant.identity, latestStream);
        }
      };

      const handleUnmute = () => {
        logger.info('[WebRTC-LiveKit] Track unmuted, notifying callback:', {
          participantId: participant.identity,
          trackKind: mediaTrack.kind,
        });
        notifyOnce();
      };

      mediaTrack.addEventListener('unmute', handleUnmute);

      // Also set a timeout fallback in case unmute never fires
      setTimeout(() => {
        if (!notified) {
          logger.warn('[WebRTC-LiveKit] Track still muted after timeout, notifying anyway:', {
            participantId: participant.identity,
            trackKind: mediaTrack.kind,
          });
          notifyOnce();
        }
      }, 2000);
    } else {
      // Track already has data, notify immediately with the new stream
      this.onRemoteStream?.(participant.identity, stream);
    }
  }

  /**
   * Join room and publish local stream
   */
  async joinRoom(localStream: MediaStream): Promise<void> {
    this.localStream = localStream;

    if (!this.room) {
      throw new Error('Room not initialized');
    }

    // Generate a token for this participant
    // In production, this should come from your backend
    const token = await this.getToken(this.roomId!, this.participantId!);

    // Build TURN URLs array - only include TLS if configured
    const turnUrls = [TURN_URL];
    if (TURN_TLS_URL) {
      turnUrls.push(TURN_TLS_URL);
    }

    // Build ICE servers config
    const iceServers: RTCIceServer[] = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ];

    // Only add TURN server if credentials are configured
    if (TURN_PASSWORD) {
      iceServers.push({
        urls: turnUrls,
        username: TURN_USERNAME,
        credential: TURN_PASSWORD,
      });
      logger.info('[WebRTC-LiveKit] TURN server configured:', { urls: turnUrls, username: TURN_USERNAME });
    } else {
      logger.warn('[WebRTC-LiveKit] TURN server NOT configured - set VITE_TURN_PASSWORD in .env');
    }

    // Connect to LiveKit with external TURN server
    await this.room.connect(LIVEKIT_URL, token, {
      rtcConfig: {
        iceServers,
        iceTransportPolicy: 'all',
      },
    });

    logger.info('[WebRTC-LiveKit] Connected to room:', this.roomId);

    // Publish local tracks
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];

      if (videoTrack) {
        await this.room.localParticipant.publishTrack(videoTrack, {
          name: 'camera',
          simulcast: true,
          videoEncoding: {
            maxBitrate: 1_500_000,
            maxFramerate: 30,
          },
        });
        logger.info('[WebRTC-LiveKit] Published video track');
      }

      if (audioTrack) {
        await this.room.localParticipant.publishTrack(audioTrack, {
          name: 'microphone',
        });
        logger.info('[WebRTC-LiveKit] Published audio track');
      }
    }

    // Handle existing participants
    this.room.remoteParticipants.forEach((participant: RemoteParticipant) => {
      this.handleParticipantConnected(participant);
    });

    this.connectionState = { state: 'connected', lastCheck: Date.now() };
    this.onConnectionChange?.(this.connectionState);
  }

  /**
   * Get LiveKit token
   * In production, this should call your backend API
   * For now, we'll generate it client-side (NOT secure for production)
   */
  private async getToken(roomName: string, participantName: string): Promise<string> {
    // Try to get token from backend first
    try {
      const response = await fetch(`${API_URL}/api/livekit/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomName, participantName }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        logger.info('[WebRTC-LiveKit] Got token from backend');
        return data.token;
      } else {
        const errorText = await response.text();
        logger.warn('[WebRTC-LiveKit] Backend token request failed:', response.status, errorText);
      }
    } catch (error) {
      logger.warn('[WebRTC-LiveKit] Could not get token from backend, using fallback:', error);
    }

    // Fallback: Generate token client-side (for development only)
    // This requires the livekit-server-sdk which we'll need to add
    // For now, we'll use a simple JWT approach
    return this.generateDevToken(roomName, participantName);
  }

  /**
   * Generate a development token (NOT for production!)
   */
  private generateDevToken(roomName: string, participantName: string): string {
    // This is a simplified token for development
    // In production, tokens should be generated server-side
    const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const now = Math.floor(Date.now() / 1000);
    const payload = btoa(
      JSON.stringify({
        exp: now + 86400, // 24 hours
        iss: LIVEKIT_API_KEY,
        nbf: now,
        sub: participantName,
        video: {
          roomJoin: true,
          room: roomName,
          canPublish: true,
          canSubscribe: true,
          canPublishData: true,
        },
        metadata: '',
        name: participantName,
      })
    );

    // Note: This signature won't be valid without proper HMAC-SHA256
    // The backend endpoint should handle proper token generation
    const signature = btoa('dev-signature');

    return `${header}.${payload}.${signature}`;
  }

  /**
   * Leave room
   */
  async leaveRoom(): Promise<void> {
    if (this.room) {
      await this.room.disconnect();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;

    await this.leaveRoom();

    if (this.room) {
      this.room = null;
    }

    this.localStream = null;
    this.remoteStreams.clear();
    this.roomId = null;
    this.participantId = null;

    this.connectionState = { state: 'new', lastCheck: Date.now() };
    logger.info('[WebRTC-LiveKit] Closed');
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
    // TODO: Implement stats monitoring with LiveKit
  }

  stopStatsMonitoring(): void {
    // No-op
  }

  closeProducer(producerId: string): void {
    logger.info('[WebRTC-LiveKit] closeProducer called:', producerId);
  }

  /**
   * Replace video track
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    if (!this.room) {
      logger.warn('[WebRTC-LiveKit] No room to replace track');
      return;
    }

    const localParticipant = this.room.localParticipant;

    // Find existing video publication
    const videoPub = Array.from(localParticipant.trackPublications.values()).find(
      (pub: LocalTrackPublication) => pub.track?.kind === Track.Kind.Video
    ) as LocalTrackPublication | undefined;

    if (videoPub?.track) {
      // Unpublish old track and publish new one
      await localParticipant.unpublishTrack(videoPub.track);
      await localParticipant.publishTrack(newTrack, {
        name: 'camera',
        simulcast: true,
      });
      logger.info('[WebRTC-LiveKit] Video track replaced');
    } else {
      // Just publish the new track
      await localParticipant.publishTrack(newTrack, {
        name: 'camera',
        simulcast: true,
      });
      logger.info('[WebRTC-LiveKit] Video track published');
    }
  }
}

export const webrtcService = new WebRTCService();
