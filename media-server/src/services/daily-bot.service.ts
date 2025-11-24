/**
 * Daily Bot Service
 *
 * Creates a "bot" participant that joins a Daily room from the media server
 * and streams the mediasoup composite to Daily for RTMP encoding.
 *
 * This bridges mediasoup → Daily → RTMP
 */

// Inject wrtc and browser APIs into global scope for Daily.co SDK
import wrtc from 'wrtc';
(global as any).RTCPeerConnection = wrtc.RTCPeerConnection;
(global as any).RTCSessionDescription = wrtc.RTCSessionDescription;
(global as any).RTCIceCandidate = wrtc.RTCIceCandidate;
(global as any).MediaStream = wrtc.MediaStream;
(global as any).MediaStreamTrack = wrtc.MediaStreamTrack;

// Create minimal browser-like environment
if (typeof window === 'undefined') {
  (global as any).window = global;
}
if (typeof document === 'undefined') {
  (global as any).document = {
    createElement: () => ({ addEventListener: () => {}, removeEventListener: () => {} }),
    addEventListener: () => {},
    removeEventListener: () => {},
    readyState: 'complete',
  };
}
if (typeof navigator === 'undefined') {
  (global as any).navigator = {
    userAgent: 'Node.js Daily Bot',
    mediaDevices: {
      getUserMedia: () => Promise.reject(new Error('Not available')),
      enumerateDevices: () => Promise.resolve([]),
    },
  };
}

import DailyIframe from '@daily-co/daily-js';
import logger from '../utils/logger';
import axios from 'axios';

interface DailyBotConfig {
  roomUrl: string;
  token: string;
  backendApiUrl: string;
  broadcastId: string;
}

interface RTMPDestination {
  rtmpUrl: string;
  streamKey: string;
}

class DailyBotService {
  private callObject: any = null;
  private broadcastId: string | null = null;

  /**
   * Join a Daily room as a bot participant
   */
  async joinRoom(config: DailyBotConfig): Promise<void> {
    try {
        hasWindow: typeof window !== 'undefined',
        hasDocument: typeof document !== 'undefined',
        hasNavigator: typeof navigator !== 'undefined',
        hasRTCPeerConnection: typeof RTCPeerConnection !== 'undefined',
        hasMediaStream: typeof MediaStream !== 'undefined',
      });

      // Create Daily call object with strictMode disabled
      this.callObject = DailyIframe.createCallObject({
        audioSource: false, // We'll set custom audio source
        videoSource: false, // We'll set custom video source
        strictMode: false, // Allow non-browser environments
      });

      this.broadcastId = config.broadcastId;

      // Set up event listeners
      this.setupEventListeners();

      // Join the room
      await this.callObject.join({
        url: config.roomUrl,
        token: config.token,
      });

    } catch (error: any) {
      logger.error('[Daily Bot] Failed to join room:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Set up Daily event listeners
   */
  private setupEventListeners(): void {
    this.callObject.on('joined-meeting', (event: any) => {
    });

    this.callObject.on('participant-joined', (event: any) => {
    });

    this.callObject.on('participant-left', (event: any) => {
    });

    this.callObject.on('live-streaming-started', (event: any) => {
    });

    this.callObject.on('live-streaming-stopped', (event: any) => {
    });

    this.callObject.on('live-streaming-error', (event: any) => {
      logger.error('[Daily Bot] Event: live-streaming-error', event);
    });

    this.callObject.on('error', (event: any) => {
      logger.error('[Daily Bot] Event: error', event);
    });

    this.callObject.on('left-meeting', (event: any) => {
    });
  }

  /**
   * Set custom video and audio tracks for the bot
   *
   * These tracks should be created by the RTP bridge service
   * which converts mediasoup RTP streams to MediaStreamTracks.
   */
  async setCustomTracks(videoTrack: any, audioTrack: any): Promise<void> {
    try {
        videoTrackId: videoTrack?.id,
        audioTrackId: audioTrack?.id,
      });

      if (!videoTrack || !audioTrack) {
        throw new Error('Both videoTrack and audioTrack are required');
      }

      await this.callObject.setInputDevicesAsync({
        videoSource: videoTrack,
        audioSource: audioTrack,
      });

    } catch (error: any) {
      logger.error('[Daily Bot] Failed to set custom tracks:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Start RTMP live streaming
   */
  async startLiveStreaming(destinations: RTMPDestination[]): Promise<void> {
    try {
      if (!this.callObject) {
        throw new Error('Call object not initialized - must join room first');
      }


      // Format endpoints for Daily API
      const rtmpUrls = destinations.map(dest => `${dest.rtmpUrl}/${dest.streamKey}`);

      // Start streaming using Daily client SDK (NOT REST API)
      await this.callObject.startLiveStreaming({
        rtmpUrl: rtmpUrls[0], // Primary destination
        layout: {
          preset: 'single-participant', // Show only the bot (composite)
        },
      });

      // If multiple destinations, add them
      if (rtmpUrls.length > 1) {
        for (let i = 1; i < rtmpUrls.length; i++) {
          await this.callObject.updateLiveStreaming({
            rtmpUrl: rtmpUrls[i],
          });
        }
      }

    } catch (error: any) {
      logger.error('[Daily Bot] Failed to start live streaming:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Stop RTMP live streaming
   */
  async stopLiveStreaming(): Promise<void> {
    try {
      if (!this.callObject) {
        logger.warn('[Daily Bot] No call object to stop streaming');
        return;
      }

      await this.callObject.stopLiveStreaming();
    } catch (error: any) {
      logger.error('[Daily Bot] Failed to stop live streaming:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Leave the Daily room and clean up
   */
  async leaveRoom(): Promise<void> {
    try {
      if (!this.callObject) {
        logger.warn('[Daily Bot] No call object to leave');
        return;
      }

      await this.callObject.leave();
      await this.callObject.destroy();

      this.callObject = null;
      this.broadcastId = null;

    } catch (error: any) {
      logger.error('[Daily Bot] Failed to leave room:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Get the current call object
   */
  getCallObject(): any {
    return this.callObject;
  }

  /**
   * Check if bot is in a meeting
   */
  isInMeeting(): boolean {
    return this.callObject?.meetingState() === 'joined-meeting';
  }
}

// Export singleton instance
export const dailyBotService = new DailyBotService();
