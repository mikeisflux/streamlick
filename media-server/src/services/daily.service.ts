/**
 * Daily.co Media Server Service
 *
 * Server-side Daily integration for media server.
 * Handles joining Daily rooms and streaming RTP to Daily for RTMP output.
 *
 * Architecture:
 * MediaSoup (RTP) → This Service → Daily Room → Daily RTMP Output → Platforms
 *
 * This runs on the media server, NOT in the browser.
 */

import DailyIframe, { DailyCall } from '@daily-co/daily-js';
import axios from 'axios';
import logger from '../utils/logger';
import { Router, Producer } from 'mediasoup/node/lib/types';

interface DailyMediaServerConfig {
  apiBaseUrl: string; // Backend API URL
  broadcastId: string;
}

interface DailyDestination {
  rtmpUrl: string;
  streamKey: string;
  platform: string;
}

class DailyMediaServerService {
  private callObject: DailyCall | null = null;
  private roomName: string | null = null;
  private token: string | null = null;
  private isConnected: boolean = false;
  private videoProducer: Producer | null = null;
  private audioProducer: Producer | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  /**
   * Initialize Daily connection for a broadcast
   * Creates room via backend API and joins it
   */
  async initialize(config: DailyMediaServerConfig): Promise<void> {
    try {
      logger.info(`[Daily Media Server] Initializing for broadcast ${config.broadcastId}`);
      logger.info(`[Daily Media Server] Backend API URL: ${config.apiBaseUrl}`);

      // Step 1: Create Daily room via backend API
      const url = `${config.apiBaseUrl}/api/daily/broadcasts/${config.broadcastId}/room`;
      logger.info(`[Daily Media Server] Creating room via: ${url}`);

      // Get media server secret for authentication
      const mediaServerSecret = process.env.MEDIA_SERVER_SECRET || 'streamlick-media-server-secret';

      const response = await axios.post(
        url,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-media-server-secret': mediaServerSecret,
          },
          timeout: 30000,
        }
      );

      const { room, token } = response.data;
      this.roomName = room.name;
      this.token = token;

      logger.info(`[Daily Media Server] Room created: ${this.roomName}`);

      // Step 2: SKIP creating Daily call object
      // The media server only orchestrates via REST API, it doesn't join the room.
      // Daily's RTMP streaming works server-side without needing a WebRTC client.
      // The backend API will handle starting/stopping streams via Daily's REST API.

      logger.info('[Daily Media Server] Initialization complete (REST API mode - no WebRTC client)');
    } catch (error: any) {
      logger.error('[Daily Media Server] Failed to initialize:', {
        message: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        config: {
          url: error.config?.url,
          method: error.config?.method,
        },
      });
      throw error;
    }
  }

  /**
   * Setup Daily event listeners
   */
  private setupEventListeners(): void {
    if (!this.callObject) return;

    this.callObject
      .on('joined-meeting', () => {
        logger.info('[Daily Media Server] Successfully joined Daily room');
        this.isConnected = true;
        this.reconnectAttempts = 0;
      })
      .on('left-meeting', () => {
        logger.info('[Daily Media Server] Left Daily room');
        this.isConnected = false;
      })
      .on('error', (event) => {
        logger.error('[Daily Media Server] Call error:', event);
        if (this.isConnected) {
          this.handleDisconnection();
        }
      })
      .on('live-streaming-started', (event) => {
        logger.info('[Daily Media Server] Live streaming started:', event);
      })
      .on('live-streaming-stopped', (event) => {
        logger.info('[Daily Media Server] Live streaming stopped:', event);
      })
      .on('live-streaming-error', (event) => {
        logger.error('[Daily Media Server] Live streaming error:', event);
      });
  }

  /**
   * Handle disconnection and retry
   */
  private async handleDisconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error('[Daily Media Server] Max reconnection attempts reached');
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(2000 * Math.pow(2, this.reconnectAttempts), 30000);

    logger.warn(`[Daily Media Server] Reconnecting (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);

    setTimeout(async () => {
      try {
        if (this.roomName && this.token) {
          await this.joinRoom();
        }
      } catch (error) {
        logger.error('[Daily Media Server] Reconnection failed:', error);
        this.handleDisconnection();
      }
    }, delay);
  }

  /**
   * Join Daily room
   */
  async joinRoom(): Promise<void> {
    if (!this.callObject || !this.roomName || !this.token) {
      throw new Error('Daily not initialized. Call initialize() first.');
    }

    try {
      const url = `https://${this.roomName.split('-')[0]}.daily.co/${this.roomName}`;

      logger.info(`[Daily Media Server] Joining room: ${url}`);

      await this.callObject.join({
        url,
        token: this.token,
        userName: 'Media Server',
      });

      logger.info('[Daily Media Server] Successfully joined room');
    } catch (error: any) {
      logger.error('[Daily Media Server] Failed to join room:', error.message);
      throw error;
    }
  }

  /**
   * Set media streams from mediasoup producers
   *
   * IMPORTANT: Daily expects MediaStreamTrack objects, but mediasoup produces RTP.
   * For server-side streaming, we need to:
   * 1. Use Daily's server-side API to start streaming
   * 2. OR convert RTP to WebRTC tracks (complex)
   *
   * RECOMMENDED APPROACH:
   * Skip setting streams in Daily - instead, use backend API to start RTMP directly.
   * The compositor pipeline already handles RTP → FFmpeg → RTMP.
   * We'll modify it to optionally skip FFmpeg and use Daily's REST API instead.
   */
  async setMediaStreams(router: Router, videoProducer: Producer, audioProducer: Producer): Promise<void> {
    this.videoProducer = videoProducer;
    this.audioProducer = audioProducer;

    logger.info('[Daily Media Server] Media streams stored (will use REST API for streaming)');

    // NOTE: Server-side Daily doesn't support direct RTP input.
    // Instead, we'll use the backend REST API to start RTMP streaming.
    // The media server's role is to coordinate, not to pipe media through Daily.
  }

  /**
   * Start RTMP streaming via backend API
   *
   * This triggers Daily to start RTMP output to platforms.
   * The actual media still flows through FFmpeg pipeline for now.
   *
   * Future optimization: Replace FFmpeg with Daily's server-side streaming.
   */
  async startStreaming(
    apiBaseUrl: string,
    broadcastId: string,
    destinations: DailyDestination[]
  ): Promise<void> {
    try {
      logger.info(`[Daily Media Server] Starting RTMP streaming for ${destinations.length} destination(s)`);

      // Get media server secret for authentication
      const mediaServerSecret = process.env.MEDIA_SERVER_SECRET || 'streamlick-media-server-secret';

      // Use backend API to start Daily RTMP streaming
      await axios.post(
        `${apiBaseUrl}/api/daily/broadcasts/${broadcastId}/streaming/start`,
        {
          destinations,
          layout: {
            preset: 'single-participant', // Only show the composite stream
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-media-server-secret': mediaServerSecret,
          },
          timeout: 30000,
        }
      );

      logger.info('[Daily Media Server] RTMP streaming started via Daily');
    } catch (error: any) {
      logger.error('[Daily Media Server] Failed to start streaming:', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Stop RTMP streaming
   */
  async stopStreaming(apiBaseUrl: string, broadcastId: string): Promise<void> {
    try {
      logger.info('[Daily Media Server] Stopping RTMP streaming');

      // Get media server secret for authentication
      const mediaServerSecret = process.env.MEDIA_SERVER_SECRET || 'streamlick-media-server-secret';

      await axios.post(
        `${apiBaseUrl}/api/daily/broadcasts/${broadcastId}/streaming/stop`,
        {},
        {
          headers: {
            'Content-Type': 'application/json',
            'x-media-server-secret': mediaServerSecret,
          },
          timeout: 30000,
        }
      );

      logger.info('[Daily Media Server] RTMP streaming stopped');
    } catch (error: any) {
      logger.error('[Daily Media Server] Failed to stop streaming:', error.message);
      throw error;
    }
  }

  /**
   * Leave Daily room and cleanup
   */
  async destroy(): Promise<void> {
    try {
      if (this.callObject && this.isConnected) {
        logger.info('[Daily Media Server] Leaving room and destroying');
        await this.callObject.leave();
        this.callObject.destroy();
      }

      this.callObject = null;
      this.roomName = null;
      this.token = null;
      this.isConnected = false;
      this.videoProducer = null;
      this.audioProducer = null;
      this.reconnectAttempts = 0;

      logger.info('[Daily Media Server] Destroyed successfully');
    } catch (error: any) {
      logger.error('[Daily Media Server] Failed to destroy:', error.message);
      throw error;
    }
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isInitialized: boolean;
    isConnected: boolean;
    roomName: string | null;
  } {
    return {
      isInitialized: this.callObject !== null,
      isConnected: this.isConnected,
      roomName: this.roomName,
    };
  }
}

// Export singleton
export const dailyMediaServerService = new DailyMediaServerService();
export default dailyMediaServerService;
