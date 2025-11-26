// # WEBCAM-ISSUE - producer cleanup and event listener management
import * as mediasoupClient from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import { mediaServerSocketService } from './media-server-socket.service';
import type { TransportData, ProduceResponse, ConsumeResponse, ConnectTransportResponse } from '../types';
import logger from '../utils/logger';

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:3001';

interface TransportOptions {
  id: string;
  iceParameters: unknown; // mediasoup IceParameters
  iceCandidates: unknown[]; // mediasoup IceCandidate[]
  dtlsParameters: unknown; // mediasoup DtlsParameters
}

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
  private device: Device | null = null;
  private sendTransport: mediasoupClient.types.Transport | null = null;
  private recvTransport: mediasoupClient.types.Transport | null = null;
  private producers: Map<string, mediasoupClient.types.Producer> = new Map();
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private broadcastId: string | null = null;
  private closed: boolean = false;

  // Enhanced monitoring
  private connectionState: ConnectionState = { send: 'new', recv: 'new', lastCheck: Date.now() };
  private statsInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnecting: boolean = false;
  private onConnectionStateChange?: (state: ConnectionState) => void;
  private onStatsUpdate?: (stats: WebRTCStats) => void;

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.device = new Device();
    this.closed = false; // Reset closed flag when initializing

    // Connect to media server socket
    if (!mediaServerSocketService.connected) {
      mediaServerSocketService.connect();

      // Wait for connection with timeout and max retry count
      await new Promise<void>((resolve, reject) => {
        let checkCount = 0;
        const maxChecks = 100; // 100 checks * 100ms = 10 seconds max

        const timeout = setTimeout(() => {
          clearInterval(checkConnection);
          reject(new Error('Media server connection timeout after 10 seconds'));
        }, 10000);

        const checkConnection = setInterval(() => {
          checkCount++;

          if (mediaServerSocketService.connected) {
            clearTimeout(timeout);
            clearInterval(checkConnection);
            resolve();
          } else if (checkCount >= maxChecks) {
            clearTimeout(timeout);
            clearInterval(checkConnection);
            reject(new Error('Media server connection failed after maximum retry attempts'));
          }
        }, 100);
      });
    }

    // Get router RTP capabilities from media server
    const response = await fetch(`${MEDIA_SERVER_URL}/broadcasts/${broadcastId}/rtp-capabilities`);
    const { rtpCapabilities } = await response.json();

    // Load device with router capabilities
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });

    logger.info('WebRTC device initialized');
  }

  async createSendTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      mediaServerSocketService.emit('create-transport', { broadcastId: this.broadcastId, direction: 'send' }, (data: TransportData) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        const transportOptions: TransportOptions = data;
        this.sendTransport = this.device!.createSendTransport(transportOptions as any);

        this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            mediaServerSocketService.emit('connect-transport', {
              transportId: this.sendTransport!.id,
              dtlsParameters,
            }, (result: ConnectTransportResponse) => {
              if (result.error) {
                errback(new Error(result.error));
              } else {
                callback();
              }
            });
          } catch (error) {
            errback(error as Error);
          }
        });

        this.sendTransport.on('produce', async ({ kind, rtpParameters }, callback, errback) => {
          try {
            mediaServerSocketService.emit('produce', {
              transportId: this.sendTransport!.id,
              kind,
              rtpParameters,
            }, (result: ProduceResponse) => {
              if (result.error) {
                errback(new Error(result.error));
              } else {
                callback({ id: result.producerId });
              }
            });
          } catch (error) {
            errback(error as Error);
          }
        });

        // Enhanced connection state monitoring with reconnection logic
        this.sendTransport.on('connectionstatechange', (state) => {
          this.connectionState.send = state;
          this.connectionState.lastCheck = Date.now();

          logger.info(`🔌 Send transport connection state: ${state}`);

          // Notify callback if registered
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange(this.connectionState);
          }

          // Handle disconnected/failed states
          if (state === 'disconnected' || state === 'failed') {
            logger.warn(`❌ Send transport ${state} - attempting reconnection...`);
            this.attemptReconnection('send');
          } else if (state === 'connected') {
            logger.info('✅ Send transport connected successfully');
            this.reconnectAttempts = 0; // Reset counter on successful connection
          }
        });

        resolve();
      });
    });
  }

  async createRecvTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      mediaServerSocketService.emit('create-transport', { broadcastId: this.broadcastId, direction: 'recv' }, (data: TransportData) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        const transportOptions: TransportOptions = data;
        this.recvTransport = this.device!.createRecvTransport(transportOptions as any);

        this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            mediaServerSocketService.emit('connect-transport', {
              transportId: this.recvTransport!.id,
              dtlsParameters,
            }, (result: ConnectTransportResponse) => {
              if (result.error) {
                errback(new Error(result.error));
              } else {
                callback();
              }
            });
          } catch (error) {
            errback(error as Error);
          }
        });

        // Enhanced connection state monitoring with reconnection logic
        this.recvTransport.on('connectionstatechange', (state) => {
          this.connectionState.recv = state;
          this.connectionState.lastCheck = Date.now();

          logger.info(`🔌 Recv transport connection state: ${state}`);

          // Notify callback if registered
          if (this.onConnectionStateChange) {
            this.onConnectionStateChange(this.connectionState);
          }

          // Handle disconnected/failed states
          if (state === 'disconnected' || state === 'failed') {
            logger.warn(`❌ Recv transport ${state} - attempting reconnection...`);
            this.attemptReconnection('recv');
          } else if (state === 'connected') {
            logger.info('✅ Recv transport connected successfully');
            this.reconnectAttempts = 0;
          }
        });

        resolve();
      });
    });
  }

  async produceMedia(track: MediaStreamTrack): Promise<string> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    if (!this.device) {
      throw new Error('Device not initialized');
    }

    // Force H.264 codec for video to avoid transcoding on media server
    // H.264 is natively supported by RTMP, so FFmpeg can use -vcodec copy
    let codecOptions: any = { track };

    if (track.kind === 'video') {
      // Find H.264 codec in device capabilities
      const h264Codec = this.device.rtpCapabilities.codecs?.find(
        codec => codec.mimeType.toLowerCase() === 'video/h264'
      );

      if (h264Codec) {
        codecOptions.codec = h264Codec;
        logger.info('Using H.264 codec for video (avoids transcoding)');
      } else {
        logger.warn('H.264 codec not available, falling back to default (VP8)');
      }
    }

    const producer = await this.sendTransport.produce(codecOptions);
    this.producers.set(producer.id, producer);

    logger.info('Producer created:', producer.id, producer.kind, producer.rtpParameters.codecs[0]?.mimeType);

    // DIAGNOSTIC: Monitor producer track for video
    if (track.kind === 'video') {
      logger.info('[WebRTC Producer] Video track initial state:', {
        producerId: producer.id,
        trackId: track.id,
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });

      // Monitor track events
      track.addEventListener('ended', () => {
        logger.error('[WebRTC Producer] Video track ENDED!', {
          producerId: producer.id,
          trackId: track.id,
          readyState: track.readyState,
        });
      });

      track.addEventListener('mute', () => {
        logger.warn('[WebRTC Producer] Video track MUTED!', {
          producerId: producer.id,
          trackId: track.id,
        });
      });

      track.addEventListener('unmute', () => {
        logger.info('[WebRTC Producer] Video track UNMUTED!', {
          producerId: producer.id,
          trackId: track.id,
        });
      });

      // Monitor producer events
      producer.on('transportclose', () => {
        logger.warn('[WebRTC Producer] Transport closed for producer', producer.id);
      });

      producer.on('trackended', () => {
        logger.error('[WebRTC Producer] Track ended for producer', producer.id);
      });
    }

    return producer.id;
  }

  async consumeMedia(producerId: string): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      if (!this.device) {
        reject(new Error('Device not initialized'));
        return;
      }

      mediaServerSocketService.emit('consume', {
        broadcastId: this.broadcastId,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      }, async (data: ConsumeResponse) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        // Create recv transport if not exists
        if (!this.recvTransport) {
          const recvTransportOptions: TransportOptions = {
            id: data.transportId,
            iceParameters: data.iceParameters,
            iceCandidates: data.iceCandidates,
            dtlsParameters: data.dtlsParameters,
          };
          this.recvTransport = this.device!.createRecvTransport(recvTransportOptions as any);

          this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            mediaServerSocketService.emit('connect-transport', {
              transportId: this.recvTransport!.id,
              dtlsParameters,
            }, (result: ConnectTransportResponse) => {
              if (result.error) {
                errback(new Error(result.error));
              } else {
                callback();
              }
            });
          });
        }

        const consumer = await this.recvTransport!.consume({
          id: data.consumerId,
          producerId: data.producerId,
          kind: data.kind,
          rtpParameters: data.rtpParameters as any,
        });

        this.consumers.set(consumer.id, consumer);

        const stream = new MediaStream([consumer.track]);
        logger.info('Consumer created:', consumer.id, consumer.kind);

        resolve(stream);
      });
    });
  }

  pauseProducer(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.pause();
    }
  }

  resumeProducer(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.resume();
    }
  }

  closeProducer(producerId: string): void {
    const producer = this.producers.get(producerId);
    if (producer) {
      producer.close();
      this.producers.delete(producerId);
    }
  }

  closeConsumer(consumerId: string): void {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.close();
      this.consumers.delete(consumerId);
    }
  }

  async close(): Promise<void> {
    // Make close() idempotent - safe to call multiple times
    if (this.closed) {
      logger.debug('WebRTC service already closed, skipping');
      return;
    }

    this.closed = true;

    // Stop stats monitoring
    this.stopStatsMonitoring();

    // Close all producers and consumers with error handling
    try {
      this.producers.forEach((producer) => {
        try {
          if (!producer.closed) {
            producer.close();
          }
        } catch (error) {
          logger.error('Error closing producer:', error);
        }
      });
      this.producers.clear();
    } catch (error) {
      logger.error('Error closing producers:', error);
    }

    try {
      this.consumers.forEach((consumer) => {
        try {
          if (!consumer.closed) {
            consumer.close();
          }
        } catch (error) {
          logger.error('Error closing consumer:', error);
        }
      });
      this.consumers.clear();
    } catch (error) {
      logger.error('Error closing consumers:', error);
    }

    // Remove event listeners and close send transport
    if (this.sendTransport) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.sendTransport.removeAllListeners();
        if (!this.sendTransport.closed) {
          this.sendTransport.close();
        }
      } catch (error) {
        logger.error('Error closing send transport:', error);
      }
      this.sendTransport = null;
    }

    // Remove event listeners and close recv transport
    if (this.recvTransport) {
      try {
        // Remove all event listeners to prevent memory leaks
        this.recvTransport.removeAllListeners();
        if (!this.recvTransport.closed) {
          this.recvTransport.close();
        }
      } catch (error) {
        logger.error('Error closing recv transport:', error);
      }
      this.recvTransport = null;
    }

    this.device = null;
    this.broadcastId = null;

    // Disconnect from media server
    try {
      mediaServerSocketService.disconnect();
    } catch (error) {
      logger.error('Error disconnecting from media server:', error);
    }

    logger.info('WebRTC service closed and cleaned up');
  }

  /**
   * Replace the track in a video producer (e.g., after canvas track gets muted)
   * This is critical for handling browser-initiated track muting
   */
  async replaceVideoTrack(newTrack: MediaStreamTrack): Promise<void> {
    // Find the video producer
    let videoProducer: mediasoupClient.types.Producer | null = null;

    for (const [_, producer] of this.producers) {
      if (producer.kind === 'video' && !producer.closed) {
        videoProducer = producer;
        break;
      }
    }

    if (!videoProducer) {
      logger.error('[WebRTC] No active video producer found to replace track');
      return;
    }

    try {
      logger.info('[WebRTC] Replacing video track in producer:', {
        producerId: videoProducer.id,
        oldTrackId: videoProducer.track?.id,
        newTrackId: newTrack.id,
      });

      await videoProducer.replaceTrack({ track: newTrack });

      logger.info('[WebRTC] Video track successfully replaced', {
        producerId: videoProducer.id,
        newTrackId: newTrack.id,
      });
    } catch (error) {
      logger.error('[WebRTC] Failed to replace video track:', error);
      throw error;
    }
  }

  getDevice(): Device | null {
    return this.device;
  }

  getProducers(): Map<string, mediasoupClient.types.Producer> {
    return this.producers;
  }

  getConsumers(): Map<string, mediasoupClient.types.Consumer> {
    return this.consumers;
  }

  /**
   * Attempt to reconnect transport on failure
   * Implements exponential backoff strategy
   */
  private async attemptReconnection(direction: 'send' | 'recv'): Promise<void> {
    if (this.reconnecting || this.closed) {
      logger.warn('Already reconnecting or closed, skipping');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      logger.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached - giving up`);
      return;
    }

    this.reconnecting = true;
    this.reconnectAttempts++;

    // Exponential backoff: 1s, 2s, 4s, 8s, 16s
    const backoffDelay = Math.min(1000 * Math.pow(2, this.reconnectAttempts - 1), 16000);
    logger.info(`Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${backoffDelay}ms...`);

    await new Promise(resolve => setTimeout(resolve, backoffDelay));

    try {
      if (direction === 'send') {
        logger.info('Recreating send transport...');
        await this.createSendTransport();
        logger.info('✅ Send transport reconnected successfully');
      } else {
        logger.info('Recreating recv transport...');
        await this.createRecvTransport();
        logger.info('✅ Recv transport reconnected successfully');
      }

      this.reconnectAttempts = 0;
      this.reconnecting = false;
    } catch (error) {
      logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
      this.reconnecting = false;
      // Will retry on next connection state change
    }
  }

  /**
   * Start monitoring WebRTC stats (packet loss, jitter, bitrate)
   * Runs every 3 seconds
   */
  startStatsMonitoring(intervalMs: number = 3000): void {
    if (this.statsInterval) {
      logger.warn('Stats monitoring already running');
      return;
    }

    logger.info(`Starting WebRTC stats monitoring (interval: ${intervalMs}ms)`);

    this.statsInterval = setInterval(async () => {
      await this.collectAndReportStats();
    }, intervalMs);
  }

  /**
   * Stop stats monitoring
   */
  stopStatsMonitoring(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
      logger.info('Stats monitoring stopped');
    }
  }

  /**
   * Collect stats from all transports and consumers
   */
  private async collectAndReportStats(): Promise<void> {
    if (!this.sendTransport && !this.recvTransport) {
      return;
    }

    try {
      const stats: WebRTCStats = {
        packetsLost: 0,
        jitter: 0,
        bitrate: 0,
        timestamp: Date.now(),
      };

      // Get stats from send transport
      if (this.sendTransport) {
        const sendStats = await this.sendTransport.getStats();
        sendStats.forEach((report: any) => {
          if (report.type === 'outbound-rtp') {
            stats.packetsLost += report.packetsLost || 0;
            stats.bitrate += report.bytesSent || 0;
          }
        });
      }

      // Get stats from recv transport
      if (this.recvTransport) {
        const recvStats = await this.recvTransport.getStats();
        recvStats.forEach((report: any) => {
          if (report.type === 'inbound-rtp') {
            stats.packetsLost += report.packetsLost || 0;
            stats.jitter = Math.max(stats.jitter, report.jitter || 0);
            stats.framesDecoded = report.framesDecoded;
          }
        });
      }

      // Log warnings for poor connection quality
      if (stats.packetsLost > 100) {
        logger.warn(`⚠️ High packet loss detected: ${stats.packetsLost} packets`);
      }

      if (stats.jitter > 30) {
        logger.warn(`⚠️ High jitter detected: ${stats.jitter}ms`);
      }

      // Notify callback if registered
      if (this.onStatsUpdate) {
        this.onStatsUpdate(stats);
      }

      logger.debug('WebRTC Stats:', stats);
    } catch (error) {
      logger.error('Failed to collect stats:', error);
    }
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return { ...this.connectionState };
  }

  /**
   * Register callback for connection state changes
   */
  setConnectionStateCallback(callback: (state: ConnectionState) => void): void {
    this.onConnectionStateChange = callback;
  }

  /**
   * Register callback for stats updates
   */
  setStatsCallback(callback: (stats: WebRTCStats) => void): void {
    this.onStatsUpdate = callback;
  }

  /**
   * Get manual stats snapshot (for debugging)
   */
  async getStats(): Promise<WebRTCStats> {
    const stats: WebRTCStats = {
      packetsLost: 0,
      jitter: 0,
      bitrate: 0,
      timestamp: Date.now(),
    };

    if (this.sendTransport) {
      const sendStats = await this.sendTransport.getStats();
      sendStats.forEach((report: any) => {
        if (report.type === 'outbound-rtp') {
          stats.packetsLost += report.packetsLost || 0;
          stats.bitrate += report.bytesSent || 0;
        }
      });
    }

    if (this.recvTransport) {
      const recvStats = await this.recvTransport.getStats();
      recvStats.forEach((report: any) => {
        if (report.type === 'inbound-rtp') {
          stats.packetsLost += report.packetsLost || 0;
          stats.jitter = Math.max(stats.jitter, report.jitter || 0);
          stats.framesDecoded = report.framesDecoded;
        }
      });
    }

    return stats;
  }
}

export const webrtcService = new WebRTCService();
