import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor';
import logger from '../utils/logger';

const ANT_MEDIA_REST_URL = import.meta.env.VITE_ANT_MEDIA_REST_URL || 'https://media.streamlick.com:5443/StreamLick/rest/v2';
const ANT_MEDIA_WEBSOCKET_URL = import.meta.env.VITE_ANT_MEDIA_WEBSOCKET_URL || 'wss://media.streamlick.com:5443/StreamLick/websocket';

// Bitrate settings for broadcast quality
const VIDEO_BITRATE_KBPS = 3500; // 3.5 Mbps for 1080p30
const AUDIO_BITRATE_KBPS = 192;  // 192 kbps stereo audio

// Failover configuration
const MAX_FAILOVER_STREAMS = 2; // Number of backup streams
const HEALTH_CHECK_INTERVAL_MS = 2000; // Check stream health every 2 seconds
const RECONNECT_DELAY_MS = 1000; // Initial reconnect delay
const MAX_RECONNECT_DELAY_MS = 30000; // Max reconnect delay (30 seconds)
const MAX_RECONNECT_ATTEMPTS = 10; // Max reconnect attempts before giving up
const BITRATE_THRESHOLD_KBPS = 500; // Minimum acceptable bitrate
const PACKET_LOSS_THRESHOLD = 0.1; // 10% packet loss triggers failover

interface BroadcastInfo {
  streamId: string;
  status: string;
  rtmpURL: string;
  name?: string;
}

type ConnectionCallback = (info: string, obj?: unknown) => void;
type ErrorCallback = (error: string, message?: string) => void;
type FailoverCallback = (fromStream: string, toStream: string, reason: string) => void;

// Health stats for a stream
interface StreamHealth {
  streamId: string;
  isConnected: boolean;
  iceState: RTCIceConnectionState | null;
  bitrate: number;
  packetLoss: number;
  lastUpdateTime: number;
  consecutiveFailures: number;
}

// Individual WebRTC connection wrapper
interface StreamConnection {
  adaptor: WebRTCAdaptor | null;
  streamId: string;
  isActive: boolean; // True if this is the primary connection
  isReady: boolean;  // True if publish_started received
  health: StreamHealth;
  reconnectAttempts: number;
  reconnectTimer: NodeJS.Timeout | null;
}

class AntMediaService {
  // Primary and backup connections
  private connections: Map<string, StreamConnection> = new Map();
  private primaryStreamId: string | null = null;

  // Stream state
  private broadcastId: string | null = null;
  private localStream: MediaStream | null = null;
  private closed: boolean = false;

  // Callbacks
  private connectionCallback: ConnectionCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private failoverCallback: FailoverCallback | null = null;

  // RTMP endpoints
  private rtmpEndpoints: Map<string, string> = new Map();

  // Health monitoring
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private statsInterval: NodeJS.Timeout | null = null;

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.closed = false;
    logger.info('[AntMedia] Initializing for broadcast:', broadcastId);
  }

  /**
   * Set callback for failover events
   */
  onFailover(callback: FailoverCallback): void {
    this.failoverCallback = callback;
  }

  async createBroadcast(name: string): Promise<BroadcastInfo> {
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/create`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      throw new Error(`Failed to create broadcast: ${response.statusText}`);
    }

    const broadcast = await response.json();
    logger.info('[AntMedia] Broadcast created:', broadcast.streamId);
    return broadcast;
  }

  /**
   * Create multiple backup streams for failover
   */
  async createBackupStreams(baseName: string, count: number = MAX_FAILOVER_STREAMS): Promise<string[]> {
    const streamIds: string[] = [];

    for (let i = 0; i < count; i++) {
      try {
        const broadcast = await this.createBroadcast(`${baseName}_backup_${i + 1}`);
        streamIds.push(broadcast.streamId);
        logger.info(`[AntMedia] Backup stream ${i + 1} created:`, broadcast.streamId);
      } catch (error) {
        logger.error(`[AntMedia] Failed to create backup stream ${i + 1}:`, error);
      }
    }

    return streamIds;
  }

  async addRtmpEndpoint(streamId: string, rtmpUrl: string, destinationId: string): Promise<string> {
    const requestUrl = `${ANT_MEDIA_REST_URL}/broadcasts/${streamId}/rtmp-endpoint`;
    const requestBody = { rtmpUrl };

    console.log('[AntMedia] Adding RTMP endpoint:', {
      requestUrl,
      streamId,
      destinationId,
      rtmpUrlPreview: rtmpUrl.substring(0, 60) + '...',
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error('[AntMedia] Failed to add RTMP endpoint:', responseText);
      throw new Error(`Failed to add RTMP endpoint: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      result = {};
    }

    const endpointId = result.dataId || result.id || destinationId;
    this.rtmpEndpoints.set(destinationId, endpointId);
    return endpointId;
  }

  async removeRtmpEndpoint(streamId: string, destinationId: string): Promise<void> {
    const endpointId = this.rtmpEndpoints.get(destinationId);
    if (!endpointId) {
      logger.warn('[AntMedia] No endpoint found for destination:', destinationId);
      return;
    }

    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}/rtmp-endpoint?endpointServiceId=${endpointId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to remove RTMP endpoint: ${response.statusText}`);
    }

    this.rtmpEndpoints.delete(destinationId);
  }

  /**
   * Start publishing with failover support
   * Creates primary + backup connections
   */
  async startPublishing(
    stream: MediaStream,
    streamId: string,
    onConnect?: ConnectionCallback,
    onError?: ErrorCallback,
    backupStreamIds?: string[]
  ): Promise<void> {
    this.localStream = stream;
    this.primaryStreamId = streamId;
    this.connectionCallback = onConnect || null;
    this.errorCallback = onError || null;

    // Validate stream
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();
    const videoSettings = videoTracks[0]?.getSettings();

    console.log('[AntMedia] Starting publish with failover support:', {
      primaryStreamId: streamId,
      backupStreamIds: backupStreamIds || [],
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoWidth: videoSettings?.width,
      videoHeight: videoSettings?.height,
    });

    // Create primary connection
    await this.createConnection(streamId, true);

    // Create backup connections
    if (backupStreamIds) {
      for (const backupId of backupStreamIds) {
        try {
          await this.createConnection(backupId, false);
        } catch (error) {
          logger.error(`[AntMedia] Failed to create backup connection ${backupId}:`, error);
        }
      }
    }

    // Start health monitoring
    this.startHealthMonitoring();
    this.startStatsCollection();

    // Wait for primary to be ready
    return new Promise((resolve, reject) => {
      const checkReady = setInterval(() => {
        const primary = this.connections.get(streamId);
        if (primary?.isReady) {
          clearInterval(checkReady);
          resolve();
        }
      }, 100);

      // Timeout after 30 seconds
      setTimeout(() => {
        clearInterval(checkReady);
        const primary = this.connections.get(streamId);
        if (!primary?.isReady) {
          reject(new Error('Primary connection timeout'));
        }
      }, 30000);
    });
  }

  /**
   * Create a single WebRTC connection
   */
  private async createConnection(streamId: string, isActive: boolean): Promise<void> {
    const connection: StreamConnection = {
      adaptor: null,
      streamId,
      isActive,
      isReady: false,
      health: {
        streamId,
        isConnected: false,
        iceState: null,
        bitrate: 0,
        packetLoss: 0,
        lastUpdateTime: Date.now(),
        consecutiveFailures: 0,
      },
      reconnectAttempts: 0,
      reconnectTimer: null,
    };

    this.connections.set(streamId, connection);

    return new Promise((resolve, reject) => {
      try {
        console.log(`[AntMedia] Creating ${isActive ? 'PRIMARY' : 'BACKUP'} connection for:`, streamId);

        const adaptor = new WebRTCAdaptor({
          websocket_url: ANT_MEDIA_WEBSOCKET_URL,
          mediaConstraints: false,
          localStream: this.localStream!,
          localStreamId: streamId,
          peerconnection_config: {
            iceServers: [
              { urls: 'stun:stun.l.google.com:19302' },
              { urls: 'stun:stun1.l.google.com:19302' },
            ],
          },
          sdp_constraints: {
            OfferToReceiveAudio: false,
            OfferToReceiveVideo: false,
          },
          callback: (info: string, obj: unknown) => {
            this.handleCallback(streamId, info, obj, resolve);
          },
          callbackError: (error: string, message: string) => {
            this.handleError(streamId, error, message, reject);
          },
        });

        connection.adaptor = adaptor;
      } catch (error) {
        logger.error(`[AntMedia] Failed to create connection for ${streamId}:`, error);
        reject(error);
      }
    });
  }

  /**
   * Handle WebRTC adaptor callbacks
   */
  private handleCallback(streamId: string, info: string, obj: unknown, resolve?: () => void): void {
    const connection = this.connections.get(streamId);
    if (!connection) return;

    console.log(`[AntMedia] [${streamId}] Callback:`, info);

    switch (info) {
      case 'initialized':
        logger.info(`[AntMedia] [${streamId}] WebRTCAdaptor initialized, starting publish`);
        this.forceStreamOnAdaptor(connection);
        connection.adaptor?.publish(streamId);
        break;

      case 'publish_started':
        logger.info(`[AntMedia] [${streamId}] Publish STARTED`);
        connection.isReady = true;
        connection.health.isConnected = true;
        connection.health.consecutiveFailures = 0;
        connection.reconnectAttempts = 0;

        this.configureBitrates(connection);

        if (connection.isActive) {
          this.connectionCallback?.('publish_started', obj);
        }
        resolve?.();
        break;

      case 'publish_finished':
        logger.info(`[AntMedia] [${streamId}] Publish finished`);
        connection.isReady = false;
        connection.health.isConnected = false;

        if (connection.isActive) {
          this.connectionCallback?.('publish_finished', obj);
          // Try failover if primary disconnects unexpectedly
          if (!this.closed) {
            this.attemptFailover(streamId, 'publish_finished');
          }
        }
        break;

      case 'ice_connection_state_changed':
        const state = obj as RTCIceConnectionState;
        connection.health.iceState = state;
        logger.info(`[AntMedia] [${streamId}] ICE state:`, state);

        if (state === 'disconnected' || state === 'failed') {
          connection.health.consecutiveFailures++;
          if (connection.isActive && connection.health.consecutiveFailures >= 3) {
            this.attemptFailover(streamId, `ice_${state}`);
          } else if (!connection.isActive) {
            // Try to reconnect backup
            this.scheduleReconnect(streamId);
          }
        } else if (state === 'connected') {
          connection.health.consecutiveFailures = 0;
        }

        if (connection.isActive) {
          this.connectionCallback?.(info, obj);
        }
        break;

      case 'updated_stats':
        this.updateStats(streamId, obj);
        break;
    }
  }

  /**
   * Handle WebRTC adaptor errors
   */
  private handleError(streamId: string, error: string, message: string, reject?: (error: Error) => void): void {
    const connection = this.connections.get(streamId);
    logger.error(`[AntMedia] [${streamId}] ERROR:`, error, message);

    if (connection) {
      connection.health.consecutiveFailures++;
      connection.health.isConnected = false;
    }

    if (connection?.isActive) {
      this.errorCallback?.(error, message);

      // Critical errors trigger failover
      if (error === 'no_stream_exist' || error === 'WebSocketNotConnected' || error === 'not_initialized') {
        this.attemptFailover(streamId, error);
        reject?.(new Error(`Ant Media connection failed: ${error} - ${message}`));
      }
    } else {
      // Non-active connection failed, try reconnect
      this.scheduleReconnect(streamId);
    }
  }

  /**
   * Force our stream onto the adaptor
   */
  private forceStreamOnAdaptor(connection: StreamConnection): void {
    try {
      const adaptor = connection.adaptor as any;
      if (!adaptor || !this.localStream) return;

      if (adaptor.localStream !== this.localStream) {
        adaptor.localStream = this.localStream;
      }
      if (adaptor.localStreams) {
        adaptor.localStreams[connection.streamId] = this.localStream;
      }
      if (typeof adaptor.updateLocalStream === 'function') {
        adaptor.updateLocalStream(this.localStream, connection.streamId);
      }
    } catch (err) {
      logger.error('[AntMedia] Error forcing stream:', err);
    }
  }

  /**
   * Configure bitrate constraints for a connection
   */
  private async configureBitrates(connection: StreamConnection): Promise<void> {
    try {
      const adaptor = connection.adaptor as any;
      const pc = adaptor?.remotePeerConnection?.[connection.streamId] || adaptor?.peerConnection;

      if (!pc) return;

      const senders = pc.getSenders();
      for (const sender of senders) {
        if (sender.track?.kind === 'video') {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = VIDEO_BITRATE_KBPS * 1000;
          await sender.setParameters(params);
        }
        if (sender.track?.kind === 'audio') {
          const params = sender.getParameters();
          if (!params.encodings?.length) params.encodings = [{}];
          params.encodings[0].maxBitrate = AUDIO_BITRATE_KBPS * 1000;
          await sender.setParameters(params);
        }
      }
      console.log(`[AntMedia] [${connection.streamId}] Bitrates configured`);
    } catch (err) {
      logger.warn(`[AntMedia] [${connection.streamId}] Could not configure bitrates:`, err);
    }
  }

  /**
   * Update stats for a connection
   */
  private updateStats(streamId: string, stats: unknown): void {
    const connection = this.connections.get(streamId);
    if (!connection) return;

    const statsObj = stats as any;
    connection.health.lastUpdateTime = Date.now();

    if (statsObj.videoBytesSent !== undefined && statsObj.audioBytesSent !== undefined) {
      // Calculate bitrate from bytes sent (simplified)
      const totalBytes = statsObj.videoBytesSent + statsObj.audioBytesSent;
      connection.health.bitrate = (totalBytes * 8) / 1000; // Convert to kbps (rough estimate)
    }

    if (statsObj.packetsLost !== undefined && statsObj.packetsSent !== undefined) {
      connection.health.packetLoss = statsObj.packetsSent > 0
        ? statsObj.packetsLost / statsObj.packetsSent
        : 0;
    }
  }

  /**
   * Start health monitoring for all connections
   */
  private startHealthMonitoring(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.checkHealth();
    }, HEALTH_CHECK_INTERVAL_MS);
  }

  /**
   * Start stats collection
   */
  private startStatsCollection(): void {
    if (this.statsInterval) return;

    this.statsInterval = setInterval(() => {
      this.connections.forEach((connection) => {
        if (connection.adaptor && connection.isReady) {
          try {
            connection.adaptor.getStats(connection.streamId);
          } catch (e) {
            // Ignore stats errors
          }
        }
      });
    }, 1000);
  }

  /**
   * Check health of all connections and trigger failover if needed
   */
  private checkHealth(): void {
    const primary = this.primaryStreamId ? this.connections.get(this.primaryStreamId) : null;

    if (!primary || this.closed) return;

    const now = Date.now();
    const timeSinceLastUpdate = now - primary.health.lastUpdateTime;

    // Check for problems
    const problems: string[] = [];

    if (!primary.health.isConnected) {
      problems.push('disconnected');
    }
    if (primary.health.iceState === 'failed' || primary.health.iceState === 'disconnected') {
      problems.push(`ice_${primary.health.iceState}`);
    }
    if (primary.health.bitrate > 0 && primary.health.bitrate < BITRATE_THRESHOLD_KBPS) {
      problems.push('low_bitrate');
    }
    if (primary.health.packetLoss > PACKET_LOSS_THRESHOLD) {
      problems.push('high_packet_loss');
    }
    if (timeSinceLastUpdate > 10000) {
      problems.push('stale_stats');
    }

    if (problems.length > 0) {
      primary.health.consecutiveFailures++;
      console.warn(`[AntMedia] Primary health issues:`, problems, `(failures: ${primary.health.consecutiveFailures})`);

      if (primary.health.consecutiveFailures >= 3) {
        this.attemptFailover(primary.streamId, problems.join(','));
      }
    } else {
      primary.health.consecutiveFailures = 0;
    }
  }

  /**
   * Attempt failover to a backup connection
   */
  private async attemptFailover(failedStreamId: string, reason: string): Promise<void> {
    console.log(`[AntMedia] Attempting failover from ${failedStreamId}, reason: ${reason}`);

    // Find a healthy backup
    let backupConnection: StreamConnection | null = null;

    for (const [id, conn] of this.connections) {
      if (id !== failedStreamId && conn.isReady && conn.health.isConnected) {
        backupConnection = conn;
        break;
      }
    }

    if (backupConnection) {
      // Perform failover
      const oldPrimary = this.connections.get(failedStreamId);
      if (oldPrimary) {
        oldPrimary.isActive = false;
      }

      backupConnection.isActive = true;
      this.primaryStreamId = backupConnection.streamId;

      console.log(`[AntMedia] FAILOVER: ${failedStreamId} -> ${backupConnection.streamId}`);
      this.failoverCallback?.(failedStreamId, backupConnection.streamId, reason);
      this.connectionCallback?.('failover', {
        from: failedStreamId,
        to: backupConnection.streamId,
        reason
      });

      // Try to reconnect the failed stream as a backup
      this.scheduleReconnect(failedStreamId);
    } else {
      // No backup available, try to reconnect primary
      console.warn('[AntMedia] No healthy backup available, attempting reconnect');
      this.scheduleReconnect(failedStreamId);
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(streamId: string): void {
    const connection = this.connections.get(streamId);
    if (!connection || this.closed) return;

    if (connection.reconnectTimer) {
      clearTimeout(connection.reconnectTimer);
    }

    if (connection.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`[AntMedia] [${streamId}] Max reconnect attempts reached`);
      return;
    }

    const delay = Math.min(
      RECONNECT_DELAY_MS * Math.pow(2, connection.reconnectAttempts),
      MAX_RECONNECT_DELAY_MS
    );

    console.log(`[AntMedia] [${streamId}] Scheduling reconnect in ${delay}ms (attempt ${connection.reconnectAttempts + 1})`);

    connection.reconnectTimer = setTimeout(async () => {
      connection.reconnectAttempts++;
      await this.reconnectStream(streamId);
    }, delay);
  }

  /**
   * Reconnect a failed stream
   */
  private async reconnectStream(streamId: string): Promise<void> {
    const connection = this.connections.get(streamId);
    if (!connection || this.closed) return;

    console.log(`[AntMedia] [${streamId}] Reconnecting...`);

    // Close old adaptor
    if (connection.adaptor) {
      try {
        connection.adaptor.stop(streamId);
        connection.adaptor.closeWebSocket();
      } catch (e) {
        // Ignore cleanup errors
      }
      connection.adaptor = null;
    }

    connection.isReady = false;
    connection.health.isConnected = false;

    try {
      // Create new connection
      await this.createConnection(streamId, connection.isActive);
      console.log(`[AntMedia] [${streamId}] Reconnect successful`);
    } catch (error) {
      logger.error(`[AntMedia] [${streamId}] Reconnect failed:`, error);
      this.scheduleReconnect(streamId);
    }
  }

  async stopPublishing(): Promise<void> {
    // Stop all connections
    for (const [streamId, connection] of this.connections) {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      if (connection.adaptor) {
        try {
          connection.adaptor.stop(streamId);
        } catch (e) {
          // Ignore
        }
      }
    }
    logger.info('[AntMedia] Publishing stopped');
  }

  async deleteBroadcast(streamId: string): Promise<void> {
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete broadcast: ${response.statusText}`);
    }
  }

  async getBroadcastInfo(streamId: string): Promise<BroadcastInfo> {
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}`);

    if (!response.ok) {
      throw new Error(`Failed to get broadcast info: ${response.statusText}`);
    }

    return response.json();
  }

  async close(): Promise<void> {
    if (this.closed) return;

    this.closed = true;

    // Stop health monitoring
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }

    // Stop publishing
    await this.stopPublishing();

    // Close all connections
    for (const [streamId, connection] of this.connections) {
      if (connection.reconnectTimer) {
        clearTimeout(connection.reconnectTimer);
      }
      if (connection.adaptor) {
        try {
          connection.adaptor.closeWebSocket();
        } catch (e) {
          // Ignore
        }
      }
    }
    this.connections.clear();

    // Clear state
    this.primaryStreamId = null;
    this.broadcastId = null;
    this.localStream = null;
    this.rtmpEndpoints.clear();
    this.connectionCallback = null;
    this.errorCallback = null;
    this.failoverCallback = null;

    logger.info('[AntMedia] Service closed');
  }

  getStreamId(): string | null {
    return this.primaryStreamId;
  }

  isConnected(): boolean {
    const primary = this.primaryStreamId ? this.connections.get(this.primaryStreamId) : null;
    return primary?.isReady ?? false;
  }

  /**
   * Get health status of all streams
   */
  getStreamHealth(): Map<string, StreamHealth> {
    const health = new Map<string, StreamHealth>();
    this.connections.forEach((conn, id) => {
      health.set(id, { ...conn.health });
    });
    return health;
  }

  /**
   * Get the currently active stream ID
   */
  getActiveStreamId(): string | null {
    for (const [id, conn] of this.connections) {
      if (conn.isActive && conn.isReady) {
        return id;
      }
    }
    return null;
  }

  /**
   * Force switch to a specific backup stream
   */
  async forceFailover(targetStreamId: string): Promise<boolean> {
    const target = this.connections.get(targetStreamId);
    if (!target || !target.isReady) {
      console.warn(`[AntMedia] Cannot failover to ${targetStreamId} - not ready`);
      return false;
    }

    const currentPrimary = this.primaryStreamId ? this.connections.get(this.primaryStreamId) : null;
    if (currentPrimary) {
      currentPrimary.isActive = false;
    }

    target.isActive = true;
    this.primaryStreamId = targetStreamId;

    console.log(`[AntMedia] Manual failover to ${targetStreamId}`);
    this.failoverCallback?.(currentPrimary?.streamId || 'none', targetStreamId, 'manual');

    return true;
  }
}

export const antMediaService = new AntMediaService();
