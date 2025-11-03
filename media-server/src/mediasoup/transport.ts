import { Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';
import { mediasoupConfig } from '../config/mediasoup';
import logger from '../utils/logger';

export async function createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
  const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

  logger.info(`WebRTC transport created [id:${transport.id}]`);

  transport.on('dtlsstatechange', (dtlsState) => {
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('close', () => {
    logger.info(`WebRTC transport closed [id:${transport.id}]`);
  });

  return transport;
}

export async function connectTransport(
  transport: WebRtcTransport,
  dtlsParameters: any
): Promise<void> {
  await transport.connect({ dtlsParameters });
  logger.info(`Transport connected [id:${transport.id}]`);
}

export async function createProducer(
  transport: WebRtcTransport,
  kind: 'audio' | 'video',
  rtpParameters: any
): Promise<Producer> {
  const producer = await transport.produce({ kind, rtpParameters });

  logger.info(`Producer created [id:${producer.id}, kind:${kind}]`);

  producer.on('transportclose', () => {
    producer.close();
  });

  return producer;
}

export async function createConsumer(
  transport: WebRtcTransport,
  producer: Producer,
  rtpCapabilities: any
): Promise<Consumer> {
  const consumer = await transport.consume({
    producerId: producer.id,
    rtpCapabilities,
    paused: true,
  });

  logger.info(`Consumer created [id:${consumer.id}]`);

  consumer.on('transportclose', () => {
    consumer.close();
  });

  consumer.on('producerclose', () => {
    consumer.close();
  });

  return consumer;
}
