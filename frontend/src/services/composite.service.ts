/**
 * Composite Service
 *
 * Controls the server-side composite stream via Ant Media's Media Push Plugin.
 * This makes the broadcast independent of the host's browser - the composite
 * runs on the server and continues even if the host disconnects.
 */

import api from './api';
import logger from '../utils/logger';

interface CompositeState {
  compositeStreamId: string | null;
  broadcastId: string | null;
  isRunning: boolean;
  layout: number;
  backgroundUrl: string | null;
}

class CompositeService {
  private state: CompositeState = {
    compositeStreamId: null,
    broadcastId: null,
    isRunning: false,
    layout: 3,
    backgroundUrl: null,
  };

  /**
   * Start the server-side composite for a broadcast
   */
  async start(broadcastId: string, layout: number = 3, backgroundUrl?: string): Promise<string> {
    if (this.state.isRunning && this.state.broadcastId === broadcastId) {
      logger.info('[CompositeService] Composite already running for broadcast:', broadcastId);
      return this.state.compositeStreamId!;
    }

    try {
      logger.info('[CompositeService] Starting composite for broadcast:', broadcastId);

      const response = await api.post('/antmedia/composite/start', {
        broadcastId,
        layout,
        backgroundUrl,
      });

      const { compositeStreamId } = response.data;

      this.state = {
        compositeStreamId,
        broadcastId,
        isRunning: true,
        layout,
        backgroundUrl: backgroundUrl || null,
      };

      logger.info('[CompositeService] Composite started:', compositeStreamId);
      return compositeStreamId;
    } catch (error: any) {
      logger.error('[CompositeService] Failed to start composite:', error);
      throw new Error(`Failed to start composite: ${error.message}`);
    }
  }

  /**
   * Stop the server-side composite
   */
  async stop(): Promise<void> {
    if (!this.state.isRunning || !this.state.compositeStreamId) {
      logger.info('[CompositeService] No composite running to stop');
      return;
    }

    try {
      logger.info('[CompositeService] Stopping composite:', this.state.compositeStreamId);

      await api.post(`/antmedia/composite/stop/${this.state.compositeStreamId}`);

      this.state = {
        compositeStreamId: null,
        broadcastId: null,
        isRunning: false,
        layout: 3,
        backgroundUrl: null,
      };

      logger.info('[CompositeService] Composite stopped');
    } catch (error: any) {
      logger.error('[CompositeService] Failed to stop composite:', error);
      // Reset state anyway
      this.state.isRunning = false;
      throw new Error(`Failed to stop composite: ${error.message}`);
    }
  }

  /**
   * Change the layout of the running composite
   */
  async setLayout(layoutId: number): Promise<void> {
    if (!this.state.isRunning || !this.state.compositeStreamId) {
      logger.warn('[CompositeService] Cannot set layout - composite not running');
      return;
    }

    try {
      logger.info('[CompositeService] Setting layout:', layoutId);

      await api.post(`/antmedia/composite/${this.state.compositeStreamId}/layout`, {
        layoutId,
      });

      this.state.layout = layoutId;
      logger.info('[CompositeService] Layout updated');
    } catch (error: any) {
      logger.error('[CompositeService] Failed to set layout:', error);
      throw new Error(`Failed to set layout: ${error.message}`);
    }
  }

  /**
   * Change the background of the running composite
   */
  async setBackground(backgroundUrl: string | null): Promise<void> {
    if (!this.state.isRunning || !this.state.compositeStreamId) {
      logger.warn('[CompositeService] Cannot set background - composite not running');
      return;
    }

    try {
      logger.info('[CompositeService] Setting background:', backgroundUrl);

      await api.post(`/antmedia/composite/${this.state.compositeStreamId}/background`, {
        backgroundUrl,
      });

      this.state.backgroundUrl = backgroundUrl;
      logger.info('[CompositeService] Background updated');
    } catch (error: any) {
      logger.error('[CompositeService] Failed to set background:', error);
      throw new Error(`Failed to set background: ${error.message}`);
    }
  }

  /**
   * Send a custom command to the composite
   */
  async sendCommand(command: string): Promise<void> {
    if (!this.state.isRunning || !this.state.compositeStreamId) {
      logger.warn('[CompositeService] Cannot send command - composite not running');
      return;
    }

    try {
      logger.info('[CompositeService] Sending command:', command);

      await api.post(`/antmedia/composite/${this.state.compositeStreamId}/command`, {
        command,
      });

      logger.info('[CompositeService] Command sent');
    } catch (error: any) {
      logger.error('[CompositeService] Failed to send command:', error);
      throw new Error(`Failed to send command: ${error.message}`);
    }
  }

  /**
   * Get the current composite state
   */
  getState(): CompositeState {
    return { ...this.state };
  }

  /**
   * Check if composite is running
   */
  isRunning(): boolean {
    return this.state.isRunning;
  }

  /**
   * Get the composite stream ID (for use with Ant Media RTMP forwarding)
   */
  getCompositeStreamId(): string | null {
    return this.state.compositeStreamId;
  }

  /**
   * Get the WebRTC play URL for the composite stream
   * Host can use this to preview exactly what viewers see
   */
  getCompositePlayUrl(): string | null {
    if (!this.state.compositeStreamId) return null;
    // Ant Media WebRTC play URL format
    return `wss://media.streamlick.com:5443/LiveApp/websocket?streamId=${this.state.compositeStreamId}`;
  }

  /**
   * Get the HLS play URL for the composite stream (fallback)
   */
  getCompositeHlsUrl(): string | null {
    if (!this.state.compositeStreamId) return null;
    return `https://media.streamlick.com:5443/LiveApp/streams/${this.state.compositeStreamId}.m3u8`;
  }

  /**
   * Subscribe to the composite stream and return a MediaStream
   * This allows the host to preview the exact output that goes to YouTube
   */
  async subscribeToComposite(): Promise<MediaStream | null> {
    const streamId = this.state.compositeStreamId;
    if (!streamId) {
      logger.warn('[CompositeService] No composite stream to subscribe to');
      return null;
    }

    try {
      // Import WebRTCAdaptor dynamically
      const { WebRTCAdaptor } = await import('@antmedia/webrtc_adaptor');

      return new Promise((resolve, reject) => {
        const adaptor = new WebRTCAdaptor({
          websocket_url: 'wss://media.streamlick.com:5443/LiveApp/websocket',
          mediaConstraints: { video: false, audio: false },
          peerconnection_config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          },
          sdp_constraints: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
          },
          callback: (info: string, obj: any) => {
            if (info === 'initialized') {
              adaptor.play(streamId);
            } else if (info === 'newStreamAvailable') {
              logger.info('[CompositeService] Received composite stream');
              resolve(obj.stream);
            }
          },
          callbackError: (error: string, message: string) => {
            logger.error('[CompositeService] Error subscribing to composite:', error, message);
            reject(new Error(`${error}: ${message}`));
          }
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          reject(new Error('Timeout waiting for composite stream'));
        }, 10000);
      });
    } catch (error: any) {
      logger.error('[CompositeService] Failed to subscribe to composite:', error);
      return null;
    }
  }
}

export const compositeService = new CompositeService();
