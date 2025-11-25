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
    const requestUrl = `${ANT_MEDIA_REST_URL}/broadcasts/${streamId}/rtmp-endpoint`;
    const requestBody = { rtmpUrl };

    console.log('[AntMedia] Adding RTMP endpoint:', {
      requestUrl,
      streamId,
      destinationId,
      rtmpUrlPreview: rtmpUrl.substring(0, 60) + '...',
      rtmpUrlLength: rtmpUrl.length,
    });

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    const responseText = await response.text();
    console.log('[AntMedia] RTMP endpoint response:', {
      status: response.status,
      statusText: response.statusText,
      ok: response.ok,
      responseBody: responseText,
    });

    if (!response.ok) {
      console.error('[AntMedia] Failed to add RTMP endpoint:', responseText);
      throw new Error(`Failed to add RTMP endpoint: ${responseText}`);
    }

    let result;
    try {
      result = JSON.parse(responseText);
    } catch {
      console.warn('[AntMedia] Response is not JSON, using destinationId as endpointId');
      result = {};
    }

    const endpointId = result.dataId || result.id || destinationId;
    this.rtmpEndpoints.set(destinationId, endpointId);
    console.log('[AntMedia] RTMP endpoint added successfully:', {
      destinationId,
      endpointId,
      resultKeys: Object.keys(result),
    });
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

    const videoSettings = videoTracks[0]?.getSettings();
    console.log('[AntMedia] Starting publish with stream:', {
      streamId,
      videoTracks: videoTracks.length,
      audioTracks: audioTracks.length,
      videoTrackEnabled: videoTracks[0]?.enabled,
      videoTrackReadyState: videoTracks[0]?.readyState,
      videoTrackLabel: videoTracks[0]?.label,
      videoWidth: videoSettings?.width,
      videoHeight: videoSettings?.height,
      videoFrameRate: videoSettings?.frameRate,
      isCanvasStream: videoTracks[0]?.label?.includes('canvas') || videoSettings?.width === 3840,
      audioTrackEnabled: audioTracks[0]?.enabled,
      audioTrackReadyState: audioTracks[0]?.readyState,
    });

    // CRITICAL: Verify this is the canvas stream, not camera
    if (videoSettings?.width !== 3840 && videoSettings?.width !== 1920) {
      console.error('[AntMedia] WARNING: Video dimensions suggest this may NOT be the canvas stream!', {
        expected: '3840x2160 or 1920x1080',
        actual: `${videoSettings?.width}x${videoSettings?.height}`,
      });
    }

    if (videoTracks.length === 0) {
      console.error('[AntMedia] No video tracks in stream!');
    }
    if (audioTracks.length === 0) {
      console.warn('[AntMedia] No audio tracks in stream');
    }

    return new Promise((resolve, reject) => {
      try {
        console.log('[AntMedia] Creating WebRTCAdaptor with WebSocket URL:', ANT_MEDIA_WEBSOCKET_URL);

        // CRITICAL: Set mediaConstraints to false to use our provided localStream
        // instead of having WebRTCAdaptor call getUserMedia() which would get camera directly
        this.webRTCAdaptor = new WebRTCAdaptor({
          websocket_url: ANT_MEDIA_WEBSOCKET_URL,
          mediaConstraints: false, // Use our localStream, don't call getUserMedia
          localStream: stream,
          localStreamId: streamId, // Associate stream with the stream ID
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
            console.log('[AntMedia] Callback:', info, obj);

            if (info === 'initialized') {
              logger.info('[AntMedia] WebRTCAdaptor initialized, starting publish for:', streamId);

              // CRITICAL: Force our canvas stream onto the adaptor before publishing
              // The WebRTCAdaptor may ignore the localStream constructor param
              try {
                const adaptor = this.webRTCAdaptor as any;

                // Method 1: Set localStream directly on adaptor
                if (adaptor.localStream !== stream) {
                  console.log('[AntMedia] FORCING localStream on adaptor - was different!');
                  adaptor.localStream = stream;
                }

                // Method 2: Store in localStreams map if available
                if (adaptor.localStreams) {
                  adaptor.localStreams[streamId] = stream;
                  console.log('[AntMedia] Set stream in localStreams map');
                }

                // Method 3: Use updateLocalStream if available
                if (typeof adaptor.updateLocalStream === 'function') {
                  console.log('[AntMedia] Using updateLocalStream()');
                  adaptor.updateLocalStream(stream, streamId);
                }

                console.log('[AntMedia] Stream setup complete, now publishing');
              } catch (err) {
                console.error('[AntMedia] Error setting stream:', err);
              }

              this.webRTCAdaptor?.publish(streamId);
            } else if (info === 'publish_started') {
              logger.info('[AntMedia] Publish STARTED successfully for stream:', streamId);

              // CRITICAL: After publish started, verify and replace tracks on peer connection
              try {
                const adaptor = this.webRTCAdaptor as any;
                const pc = adaptor.remotePeerConnection?.[streamId] || adaptor.peerConnection;

                if (pc) {
                  console.log('[AntMedia] Peer connection found, checking senders...');
                  const senders = pc.getSenders();

                  senders.forEach((sender: RTCRtpSender, index: number) => {
                    const currentTrack = sender.track;
                    console.log(`[AntMedia] Sender ${index}:`, {
                      kind: currentTrack?.kind,
                      id: currentTrack?.id,
                      label: currentTrack?.label,
                      enabled: currentTrack?.enabled,
                    });

                    // Replace video track with our canvas track
                    if (sender.track?.kind === 'video') {
                      const canvasVideoTrack = stream.getVideoTracks()[0];
                      if (canvasVideoTrack && sender.track.id !== canvasVideoTrack.id) {
                        console.log('[AntMedia] REPLACING video track with canvas track!');
                        sender.replaceTrack(canvasVideoTrack).then(() => {
                          console.log('[AntMedia] Video track replaced successfully!');
                        }).catch((err: Error) => {
                          console.error('[AntMedia] Failed to replace video track:', err);
                        });
                      }
                    }

                    // Replace audio track with our mixed audio track
                    if (sender.track?.kind === 'audio') {
                      const mixedAudioTrack = stream.getAudioTracks()[0];
                      if (mixedAudioTrack && sender.track.id !== mixedAudioTrack.id) {
                        console.log('[AntMedia] REPLACING audio track with mixed audio!');
                        sender.replaceTrack(mixedAudioTrack).then(() => {
                          console.log('[AntMedia] Audio track replaced successfully!');
                        }).catch((err: Error) => {
                          console.error('[AntMedia] Failed to replace audio track:', err);
                        });
                      }
                    }
                  });
                } else {
                  console.warn('[AntMedia] No peer connection found to verify tracks');
                }
              } catch (err) {
                console.error('[AntMedia] Error verifying/replacing tracks:', err);
              }

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
