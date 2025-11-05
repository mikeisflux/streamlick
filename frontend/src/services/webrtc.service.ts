import * as mediasoupClient from 'mediasoup-client';
import { Device } from 'mediasoup-client';
import { socketService } from './socket.service';

const MEDIA_SERVER_URL = import.meta.env.VITE_MEDIA_SERVER_URL || 'http://localhost:3001';

interface TransportOptions {
  id: string;
  iceParameters: any;
  iceCandidates: any;
  dtlsParameters: any;
}

class WebRTCService {
  private device: Device | null = null;
  private sendTransport: mediasoupClient.types.Transport | null = null;
  private recvTransport: mediasoupClient.types.Transport | null = null;
  private producers: Map<string, mediasoupClient.types.Producer> = new Map();
  private consumers: Map<string, mediasoupClient.types.Consumer> = new Map();
  private broadcastId: string | null = null;

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.device = new Device();

    // Get router RTP capabilities from media server
    const response = await fetch(`${MEDIA_SERVER_URL}/broadcasts/${broadcastId}/rtp-capabilities`);
    const { rtpCapabilities } = await response.json();

    // Load device with router capabilities
    await this.device.load({ routerRtpCapabilities: rtpCapabilities });

    console.log('WebRTC device initialized');
  }

  async createSendTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      socketService.emit('create-transport', { broadcastId: this.broadcastId, direction: 'send' }, (data: any) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        const transportOptions: TransportOptions = data;
        this.sendTransport = this.device!.createSendTransport(transportOptions);

        this.sendTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            socketService.emit('connect-transport', {
              transportId: this.sendTransport!.id,
              dtlsParameters,
            }, (result: any) => {
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
            socketService.emit('produce', {
              transportId: this.sendTransport!.id,
              kind,
              rtpParameters,
            }, (result: any) => {
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
          console.log('Send transport connection state:', state);
        });

        resolve();
      });
    });
  }

  async createRecvTransport(): Promise<void> {
    return new Promise((resolve, reject) => {
      socketService.emit('create-transport', { broadcastId: this.broadcastId, direction: 'recv' }, (data: any) => {
        if (data.error) {
          reject(new Error(data.error));
          return;
        }

        const transportOptions: TransportOptions = data;
        this.recvTransport = this.device!.createRecvTransport(transportOptions);

        this.recvTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
          try {
            socketService.emit('connect-transport', {
              transportId: this.recvTransport!.id,
              dtlsParameters,
            }, (result: any) => {
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
          console.log('Recv transport connection state:', state);
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

    console.log('Producer created:', producer.id, producer.kind);
    return producer.id;
  }

  async consumeMedia(producerId: string): Promise<MediaStream> {
    return new Promise((resolve, reject) => {
      if (!this.device) {
        reject(new Error('Device not initialized'));
        return;
      }

      socketService.emit('consume', {
        broadcastId: this.broadcastId,
        producerId,
        rtpCapabilities: this.device.rtpCapabilities,
      }, async (data: any) => {
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
          this.recvTransport = this.device!.createRecvTransport(recvTransportOptions);

          this.recvTransport.on('connect', ({ dtlsParameters }, callback, errback) => {
            socketService.emit('connect-transport', {
              transportId: this.recvTransport!.id,
              dtlsParameters,
            }, (result: any) => {
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
          rtpParameters: data.rtpParameters,
        });

        this.consumers.set(consumer.id, consumer);

        const stream = new MediaStream([consumer.track]);
        console.log('Consumer created:', consumer.id, consumer.kind);

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
    this.producers.forEach((producer) => producer.close());
    this.consumers.forEach((consumer) => consumer.close());
    this.producers.clear();
    this.consumers.clear();

    if (this.sendTransport) {
      this.sendTransport.close();
      this.sendTransport = null;
    }

    if (this.recvTransport) {
      this.recvTransport.close();
      this.recvTransport = null;
    }

    this.device = null;
    this.broadcastId = null;
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
