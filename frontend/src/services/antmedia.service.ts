import { WebRTCAdaptor } from '@antmedia/webrtc_adaptor';
import logger from '../utils/logger';

const ANT_MEDIA_REST_URL = import.meta.env.VITE_ANT_MEDIA_REST_URL || 'https://media.streamlick.com:5443/StreamLick/rest/v2';
const ANT_MEDIA_WEBSOCKET_URL = import.meta.env.VITE_ANT_MEDIA_WEBSOCKET_URL || 'wss://media.streamlick.com:5443/StreamLick/websocket';

interface BroadcastInfo {
  streamId: string;
  status: string;
  rtmpURL: string;
  name?: string;
}

type ConnectionCallback = (info: string, obj?: unknown) => void;
type ErrorCallback = (error: string, message?: string) => void;

class AntMediaService {
  private webRTCAdaptor: WebRTCAdaptor | null = null;
  private streamId: string | null = null;
  private broadcastId: string | null = null;
  private localStream: MediaStream | null = null;
  private closed: boolean = false;
  private connectionCallback: ConnectionCallback | null = null;
  private errorCallback: ErrorCallback | null = null;
  private rtmpEndpoints: Map<string, string> = new Map(); // destinationId -> endpointId

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.closed = false;
    logger.info('Ant Media service initializing for broadcast:', broadcastId);
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
    this.streamId = broadcast.streamId;
    logger.info('Broadcast created:', broadcast.streamId);
    return broadcast;
  }

  async addRtmpEndpoint(streamId: string, rtmpUrl: string, destinationId: string): Promise<string> {
    // Ant Media expects the full RTMP URL including stream key
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}/rtmp-endpoint`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rtmpUrl }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to add RTMP endpoint: ${errorText}`);
    }

    const result = await response.json();
    const endpointId = result.dataId || result.id || destinationId;
    this.rtmpEndpoints.set(destinationId, endpointId);
    logger.info('RTMP endpoint added:', { destinationId, endpointId, rtmpUrl: rtmpUrl.substring(0, 50) + '...' });
    return endpointId;
  }

  async removeRtmpEndpoint(streamId: string, destinationId: string): Promise<void> {
    const endpointId = this.rtmpEndpoints.get(destinationId);
    if (!endpointId) {
      logger.warn('No endpoint found for destination:', destinationId);
      return;
    }

    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}/rtmp-endpoint?endpointServiceId=${endpointId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to remove RTMP endpoint: ${response.statusText}`);
    }

    this.rtmpEndpoints.delete(destinationId);
    logger.info('RTMP endpoint removed:', destinationId);
  }

  async startPublishing(
    stream: MediaStream,
    streamId: string,
    onConnect?: ConnectionCallback,
    onError?: ErrorCallback
  ): Promise<void> {
    this.localStream = stream;
    this.streamId = streamId;
    this.connectionCallback = onConnect || null;
    this.errorCallback = onError || null;

    // Validate stream before publishing
    const videoTracks = stream.getVideoTracks();
    const audioTracks = stream.getAudioTracks();

    logger.info('[AntMedia] Starting publish with stream:', {
      streamId,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoTrackEnabled: videoTracks[0]?.enabled,
      videoTrackReadyState: videoTracks[0]?.readyState,
      audioTrackEnabled: audioTracks[0]?.enabled,
      audioTrackReadyState: audioTracks[0]?.readyState,
    });

    if (videoTracks.length === 0) {
      logger.error('[AntMedia] No video tracks in stream!');
    }
    if (audioTracks.length === 0) {
      logger.warn('[AntMedia] No audio tracks in stream');
    }

    return new Promise((resolve, reject) => {
      try {
        logger.info('[AntMedia] Creating WebRTCAdaptor with WebSocket URL:', ANT_MEDIA_WEBSOCKET_URL);

        this.webRTCAdaptor = new WebRTCAdaptor({
          websocket_url: ANT_MEDIA_WEBSOCKET_URL,
          mediaConstraints: {
            video: videoTracks.length > 0,
            audio: audioTracks.length > 0,
          },
          localStream: stream,
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
            logger.info('[AntMedia] Callback:', info, obj);

            if (info === 'initialized') {
              logger.info('[AntMedia] WebRTCAdaptor initialized, starting publish for:', streamId);
              this.webRTCAdaptor?.publish(streamId);
            } else if (info === 'publish_started') {
              logger.info('[AntMedia] Publish STARTED successfully for stream:', streamId);
              this.connectionCallback?.('publish_started', obj);
              resolve();
            } else if (info === 'publish_finished') {
              logger.info('[AntMedia] Publish finished for stream:', streamId);
              this.connectionCallback?.('publish_finished', obj);
            } else if (info === 'ice_connection_state_changed') {
              logger.info('[AntMedia] ICE connection state changed:', obj);
              this.connectionCallback?.(info, obj);
            } else if (info === 'updated_stats') {
              logger.debug('[AntMedia] Stats update:', obj);
            } else if (info === 'bitrateMeasurement') {
              logger.debug('[AntMedia] Bitrate measurement:', obj);
            }
          },
          callbackError: (error: string, message: string) => {
            logger.error('[AntMedia] ERROR:', error, message);
            this.errorCallback?.(error, message);

            if (error === 'no_stream_exist' || error === 'WebSocketNotConnected' || error === 'not_initialized') {
              reject(new Error(`Ant Media connection failed: ${error} - ${message}`));
            }
          },
        });

        logger.info('[AntMedia] WebRTCAdaptor created successfully');
      } catch (error) {
        logger.error('[AntMedia] Failed to create WebRTCAdaptor:', error);
        reject(error);
      }
    });
  }

  async stopPublishing(): Promise<void> {
    if (this.webRTCAdaptor && this.streamId) {
      try {
        this.webRTCAdaptor.stop(this.streamId);
        logger.info('Publishing stopped for stream:', this.streamId);
      } catch (error) {
        logger.error('Error stopping publish:', error);
      }
    }
  }

  async deleteBroadcast(streamId: string): Promise<void> {
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Failed to delete broadcast: ${response.statusText}`);
    }

    logger.info('Broadcast deleted:', streamId);
  }

  async getBroadcastInfo(streamId: string): Promise<BroadcastInfo> {
    const response = await fetch(`${ANT_MEDIA_REST_URL}/broadcasts/${streamId}`);

    if (!response.ok) {
      throw new Error(`Failed to get broadcast info: ${response.statusText}`);
    }

    return response.json();
  }

  async close(): Promise<void> {
    if (this.closed) {
      logger.debug('Ant Media service already closed');
      return;
    }

    this.closed = true;

    // Stop publishing
    await this.stopPublishing();

    // Close WebRTC adaptor
    if (this.webRTCAdaptor) {
      try {
        this.webRTCAdaptor.closeWebSocket();
      } catch (error) {
        logger.error('Error closing WebSocket:', error);
      }
      this.webRTCAdaptor = null;
    }

    // Clear state
    this.streamId = null;
    this.broadcastId = null;
    this.localStream = null;
    this.rtmpEndpoints.clear();
    this.connectionCallback = null;
    this.errorCallback = null;

    logger.info('Ant Media service closed');
  }

  getStreamId(): string | null {
    return this.streamId;
  }

  isConnected(): boolean {
    return this.webRTCAdaptor !== null && !this.closed;
  }
}

export const antMediaService = new AntMediaService();
