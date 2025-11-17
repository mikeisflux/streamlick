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

class WebRTCService {
  private device: Device | null = null;
  private sendTransport: mediasoupClient.types.Transport | null = null;
  private recvTransport: mediasoupClient.types.Transport | null = null;
  private producers: Map<string, mediasoupClient.types.Producer> = new Map();
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private broadcastId: string | null = null;
  private closed: boolean = false;

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

        this.sendTransport.on('connectionstatechange', (state) => {
          logger.debug('Send transport connection state:', state);
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

        this.recvTransport.on('connectionstatechange', (state) => {
          logger.debug('Recv transport connection state:', state);
        });

        resolve();
      });
    });
  }

  async produceMedia(track: MediaStreamTrack): Promise<string> {
    if (!this.sendTransport) {
      throw new Error('Send transport not created');
    }

    const producer = await this.sendTransport.produce({ track });
    this.producers.set(producer.id, producer);

    logger.info('Producer created:', producer.id, producer.kind);
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

  getDevice(): Device | null {
    return this.device;
  }

  getProducers(): Map<string, mediasoupClient.types.Producer> {
    return this.producers;
  }

  getConsumers(): Map<string, mediasoupClient.types.Consumer> {
    return this.consumers;
  }
}

export const webrtcService = new WebRTCService();
