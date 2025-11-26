// # WEBCAM-ISSUE - producer cleanup and event listener management
/**
 * WebRTC Service - Ant Media Server Implementation
 *
 * This service wraps the Ant Media service to provide a compatible interface
 * for the rest of the application while using Ant Media Server for WebRTC.
 */
import { antMediaService } from './antmedia.service';
import logger from '../utils/logger';

interface WebRTCStats {
  packetsLost: number;
  jitter: number;
  bitrate: number;
  framesDecoded?: number;
  timestamp: number;
}

interface ConnectionState {
  send: string;
  recv: string;
  lastCheck: number;
}

class WebRTCService {
  private streamId: string | null = null;
  private localStream: MediaStream | null = null;
  private closed: boolean = false;

  // Connection state
  private connectionState: ConnectionState = { send: 'new', recv: 'new', lastCheck: Date.now() };
  private onConnectionStateChange?: (state: ConnectionState) => void;
  private onStatsUpdate?: (stats: WebRTCStats) => void;

  /**
   * Initialize WebRTC connection for a broadcast
   * @param broadcastId - The broadcast/stream ID
   */
  async initialize(broadcastId: string): Promise<void> {
    this.streamId = broadcastId;
    this.closed = false;

    // Initialize Ant Media service
    await antMediaService.initialize(broadcastId);

    // Set up callbacks
    antMediaService.setCallbacks({
      onConnectionStateChange: (state) => {
        this.connectionState.send = state.publishing;
        this.connectionState.recv = state.playing;
        this.connectionState.lastCheck = Date.now();
        this.onConnectionStateChange?.(this.connectionState);
      },
      onStatsUpdate: (stats) => {
        this.onStatsUpdate?.(stats);
      },
      onError: (error) => {
        logger.error('[WebRTC] Ant Media error:', error);
      },
      onStreamStarted: (streamId) => {
        logger.info('[WebRTC] Stream started:', streamId);
      },
      onStreamEnded: (streamId) => {
        logger.info('[WebRTC] Stream ended:', streamId);
      },
    });

    logger.info('[WebRTC] Initialized with Ant Media for stream:', broadcastId);
  }

  /**
   * Create send transport (no-op for Ant Media - handled in publish)
   */
  async createSendTransport(): Promise<void> {
    // Ant Media handles transport creation internally during publish
    logger.debug('[WebRTC] Send transport will be created during publish');
  }

  /**
   * Create receive transport (no-op for Ant Media - handled in play)
   */
  async createRecvTransport(): Promise<void> {
    // Ant Media handles transport creation internally during play
    logger.debug('[WebRTC] Recv transport will be created during play');
  }

  /**
   * Produce media (publish stream to Ant Media)
   * @param track - MediaStreamTrack to publish
   * @returns Producer ID (stream ID for Ant Media)
   */
  async produceMedia(track: MediaStreamTrack): Promise<string> {
    if (!this.streamId) {
      throw new Error('WebRTC not initialized');
    }

    // Build or update local stream
    if (!this.localStream) {
      this.localStream = new MediaStream();
    }

    // Add track to local stream
    this.localStream.addTrack(track);

    // If we have both audio and video, or if this is a video track, start publishing
    const hasVideo = this.localStream.getVideoTracks().length > 0;
    const hasAudio = this.localStream.getAudioTracks().length > 0;

    if (hasVideo) {
      // Publish to Ant Media
      await antMediaService.publish(this.localStream, this.streamId);
      logger.info('[WebRTC] Published stream to Ant Media:', this.streamId);
    }

    return this.streamId;
  }

  /**
   * Consume media (play stream from Ant Media)
   * @param producerId - Stream ID to play
   * @returns MediaStream
   */
  async consumeMedia(producerId: string): Promise<MediaStream> {
    const stream = await antMediaService.play(producerId);
    logger.info('[WebRTC] Consuming stream from Ant Media:', producerId);
    return stream;
  }

  /**
   * Pause producer (not directly supported in Ant Media, use track.enabled)
   */
  pauseProducer(producerId: string): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.enabled = false;
      });
    }
    logger.info('[WebRTC] Producer paused (tracks disabled)');
  }

  /**
   * Resume producer
   */
  resumeProducer(producerId: string): void {
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => {
        track.enabled = true;
      });
    }
    logger.info('[WebRTC] Producer resumed (tracks enabled)');
  }

  /**
   * Close producer (stop publishing)
   */
  closeProducer(producerId: string): void {
    antMediaService.stopPublishing();
    logger.info('[WebRTC] Producer closed');
  }

  /**
   * Close consumer (stop playing)
   */
  closeConsumer(consumerId: string): void {
    antMediaService.stopPlaying();
    logger.info('[WebRTC] Consumer closed');
  }

  /**
   * Replace video track
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    await antMediaService.replaceVideoTrack(newTrack);

    // Update local stream
    if (this.localStream) {
      const oldTracks = this.localStream.getVideoTracks();
      oldTracks.forEach(track => {
        this.localStream!.removeTrack(track);
      });
      this.localStream.addTrack(newTrack);
    }

    logger.info('[WebRTC] Video track replaced');
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    if (this.closed) {
      logger.debug('[WebRTC] Already closed');
      return;
    }

    this.closed = true;

    // Close Ant Media connection
    await antMediaService.close();

    // Clean up local stream
    if (this.localStream) {
      this.localStream.getTracks().forEach(track => track.stop());
      this.localStream = null;
    }

    this.streamId = null;
    this.connectionState = { send: 'new', recv: 'new', lastCheck: Date.now() };

    logger.info('[WebRTC] Service closed');
  }

  /**
   * Get connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Set connection state callback
   */
  setConnectionStateCallback(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  /**
   * Set stats callback
   */
  setStatsCallback(callback: (stats: WebRTCStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Start stats monitoring
   */
  startStatsMonitoring(intervalMs: number = 3000): void {
    antMediaService.startStatsMonitoring(intervalMs);
  }

  /**
   * Stop stats monitoring
   */
  stopStatsMonitoring(): void {
    antMediaService.stopStatsMonitoring();
  }

  /**
   * Get stats
   */
  async getStats(): Promise<WebRTCStats> {
    return antMediaService.getStats();
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return antMediaService.isConnected();
  }

  /**
   * Get device (not applicable for Ant Media)
   */
  getDevice(): null {
    return null;
  }

  /**
   * Get producers (returns map with stream ID)
   */
  getProducers(): Map<string, any> {
    const producers = new Map();
    if (this.streamId && this.localStream) {
      producers.set(this.streamId, { id: this.streamId, kind: 'video' });
    }
    return producers;
  }

  /**
   * Get consumers (returns map with stream ID)
   */
  getConsumers(): Map<string, any> {
    return new Map();
  }
}

export const webrtcService = new WebRTCService();
