/**
 * Daily.co Service
 *
 * Handles Daily.co integration for RTMP streaming output.
 * Replaces FFmpeg pipeline with Daily's managed RTMP service.
 *
 * Architecture:
 * Browser Compositor → Daily Call (single participant) → Daily RTMP Output → Platforms
 *
 * Cost: Only 1 participant minute + $0.015/min RTMP output
 */

import DailyIframe, { DailyCall, DailyEventObjectLiveStreamingError } from '@daily-co/daily-js';
import logger from '../utils/logger';

interface DailyDestination {
  rtmpUrl: string;
  streamKey: string;
  platform: string;
}

interface DailyConfig {
  roomName?: string;
  token?: string;
  userName?: string;
}

class DailyService {
  private callObject: DailyCall | null = null;
  private isConnected: boolean = false;
  private isStreaming: boolean = false;
  private currentRoomName: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: NodeJS.Timeout | null = null;

  /**
   * Initialize Daily call object
   */
  async initialize(config: DailyConfig): Promise<void> {
    try {
      if (this.callObject) {
        logger.warn('[Daily] Call object already exists, destroying first');
        await this.destroy();
      }

      logger.info('[Daily] Initializing Daily call object', config);

      this.callObject = DailyIframe.createCallObject({
        // Start with null devices - we'll set custom streams later
        audioSource: false,
        videoSource: false,
      });

      // Setup event listeners
      this.setupEventListeners();

      this.currentRoomName = config.roomName || null;

      logger.info('[Daily] Call object created successfully');
    } catch (error) {
      logger.error('[Daily] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Setup Daily event listeners for monitoring connection health
   */
  private setupEventListeners(): void {
    if (!this.callObject) return;

    this.callObject
      .on('joined-meeting', () => {
        logger.info('[Daily] Successfully joined Daily room');
        this.isConnected = true;
        this.reconnectAttempts = 0; // Reset on successful connection
      })
      .on('left-meeting', () => {
        logger.info('[Daily] Left Daily room');
        this.isConnected = false;
        this.isStreaming = false;
      })
      .on('error', (event) => {
        logger.error('[Daily] Call error:', event);

        // Attempt reconnection on error
        if (this.isConnected) {
          this.handleDisconnection();
        }
      })
      .on('live-streaming-started', (event) => {
        logger.info('[Daily] Live streaming started successfully', event);
        this.isStreaming = true;
      })
      .on('live-streaming-stopped', (event) => {
        logger.info('[Daily] Live streaming stopped', event);
        this.isStreaming = false;
      })
      .on('live-streaming-error', (event: DailyEventObjectLiveStreamingError) => {
        logger.error('[Daily] Live streaming error:', event);
        // Don't auto-retry streaming errors - let user handle them
      })
      .on('participant-joined', (event) => {
        logger.info('[Daily] Participant joined:', event.participant);
      })
      .on('participant-left', (event) => {
        logger.info('[Daily] Participant left:', event.participant);
      });
  }

  /**
   * Handle disconnection and attempt reconnection
   */
  private async handleDisconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[Daily] Max reconnection attempts reached, giving up');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.warn(`[Daily] Connection lost, attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(async () => {
      try {
        if (this.currentRoomName) {
          await this.joinRoom({ roomName: this.currentRoomName });
        }
      } catch (error) {
        logger.error('[Daily] Reconnection failed:', error);
        this.handleDisconnection(); // Try again
      }
    }, delay);
  }

  /**
   * Join a Daily room
   */
  async joinRoom(config: DailyConfig): Promise<void> {
    if (!this.callObject) {
      throw new Error('Daily call object not initialized. Call initialize() first.');
    }

    try {
      const url = config.roomName
        ? `https://${config.roomName}.daily.co/${config.roomName}`
        : undefined;

      if (!url) {
        throw new Error('Room name is required');
      }

      logger.info('[Daily] Joining room:', url);

      const joinOptions: any = {
        url,
        userName: config.userName || 'Broadcaster',
      };

      if (config.token) {
        joinOptions.token = config.token;
      }

      await this.callObject.join(joinOptions);

      this.currentRoomName = config.roomName || null;

      logger.info('[Daily] Successfully joined room');
    } catch (error) {
      logger.error('[Daily] Failed to join room:', error);
      throw error;
    }
  }

  /**
   * Set custom video and audio streams from compositor
   */
  async setCompositeStream(videoTrack: MediaStreamTrack, audioTrack: MediaStreamTrack): Promise<void> {
    if (!this.callObject) {
      throw new Error('Daily call object not initialized');
    }

    if (!this.isConnected) {
      throw new Error('Must join room before setting streams');
    }

    try {
      logger.info('[Daily] Setting custom composite stream');
      logger.info('[Daily] Video track:', {
        id: videoTrack.id,
        kind: videoTrack.kind,
        enabled: videoTrack.enabled,
        readyState: videoTrack.readyState,
        settings: videoTrack.getSettings(),
      });
      logger.info('[Daily] Audio track:', {
        id: audioTrack.id,
        kind: audioTrack.kind,
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState,
        settings: audioTrack.getSettings(),
      });

      await this.callObject.setInputDevicesAsync({
        videoSource: videoTrack,
        audioSource: audioTrack,
      });

      logger.info('[Daily] Successfully set composite stream');
    } catch (error) {
      logger.error('[Daily] Failed to set composite stream:', error);
      throw error;
    }
  }

  /**
   * Start RTMP streaming to multiple destinations
   */
  async startStreaming(destinations: DailyDestination[]): Promise<void> {
    if (!this.callObject) {
      throw new Error('Daily call object not initialized');
    }

    if (!this.isConnected) {
      throw new Error('Must join room before starting streaming');
    }

    if (this.isStreaming) {
      logger.warn('[Daily] Already streaming, stopping existing stream first');
      await this.stopStreaming();
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    try {
      logger.info(`[Daily] Starting RTMP streaming to ${destinations.length} destination(s)`);

      // Format endpoints for Daily API
      const endpoints = destinations.map((dest) => ({
        // Full RTMP URL with stream key
        rtmpUrl: `${dest.rtmpUrl}/${dest.streamKey}`,
      }));

      logger.info('[Daily] RTMP endpoints:', endpoints.map((e, i) => ({
        index: i,
        platform: destinations[i].platform,
        url: e.rtmpUrl.substring(0, 50) + '...', // Log partial URL for security
      })));

      // Start live streaming via Daily's JavaScript API
      await this.callObject.startLiveStreaming({
        endpoints,
        // Optional: configure streaming layout and quality
        layout: {
          preset: 'single-participant', // Show only the broadcaster
        },
        // Video quality settings (default is 1920x1080 @ 5Mbps)
        // Can be customized if needed
      });

      logger.info('[Daily] Successfully started RTMP streaming');
    } catch (error) {
      logger.error('[Daily] Failed to start streaming:', error);
      throw error;
    }
  }

  /**
   * Add additional RTMP destinations to existing stream
   */
  async addDestinations(destinations: DailyDestination[]): Promise<void> {
    if (!this.callObject) {
      throw new Error('Daily call object not initialized');
    }

    if (!this.isStreaming) {
      throw new Error('No active stream to add destinations to');
    }

    try {
      logger.info(`[Daily] Adding ${destinations.length} additional destination(s)`);

      const endpoints = destinations.map((dest) => ({
        rtmpUrl: `${dest.rtmpUrl}/${dest.streamKey}`,
      }));

      await this.callObject.addLiveStreamingEndpoints({ endpoints });

      logger.info('[Daily] Successfully added destinations');
    } catch (error) {
      logger.error('[Daily] Failed to add destinations:', error);
      throw error;
    }
  }

  /**
   * Stop RTMP streaming
   */
  async stopStreaming(): Promise<void> {
    if (!this.callObject) {
      logger.warn('[Daily] No call object to stop streaming');
      return;
    }

    if (!this.isStreaming) {
      logger.warn('[Daily] Not currently streaming');
      return;
    }

    try {
      logger.info('[Daily] Stopping RTMP streaming');
      await this.callObject.stopLiveStreaming();
      this.isStreaming = false;
      logger.info('[Daily] Successfully stopped streaming');
    } catch (error) {
      logger.error('[Daily] Failed to stop streaming:', error);
      throw error;
    }
  }

  /**
   * Leave the Daily room
   */
  async leaveRoom(): Promise<void> {
    if (!this.callObject) {
      logger.warn('[Daily] No call object to leave');
      return;
    }

    try {
      logger.info('[Daily] Leaving Daily room');

      // Stop streaming first if active
      if (this.isStreaming) {
        await this.stopStreaming();
      }

      await this.callObject.leave();
      this.isConnected = false;
      this.currentRoomName = null;

      logger.info('[Daily] Successfully left room');
    } catch (error) {
      logger.error('[Daily] Failed to leave room:', error);
      throw error;
    }
  }

  /**
   * Destroy the Daily call object and cleanup
   */
  async destroy(): Promise<void> {
    try {
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }

      if (this.callObject) {
        logger.info('[Daily] Destroying call object');

        // Leave room first
        await this.leaveRoom();

        // Destroy the call object
        this.callObject.destroy();
        this.callObject = null;
      }

      this.isConnected = false;
      this.isStreaming = false;
      this.currentRoomName = null;
      this.reconnectAttempts = 0;

      logger.info('[Daily] Successfully destroyed');
    } catch (error) {
      logger.error('[Daily] Failed to destroy:', error);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isInitialized: boolean;
    isConnected: boolean;
    isStreaming: boolean;
    roomName: string | null;
  } {
    return {
      isInitialized: this.callObject !== null,
      isConnected: this.isConnected,
      isStreaming: this.isStreaming,
      roomName: this.currentRoomName,
    };
  }

  /**
   * Get the Daily call object (for advanced usage)
   */
  getCallObject(): DailyCall | null {
    return this.callObject;
  }
}

// Export singleton instance
export const dailyService = new DailyService();
export default dailyService;
