import { Router, WebRtcTransport, Producer, Consumer } from 'mediasoup/node/lib/types';
import { mediasoupConfig } from '../config/mediasoup';
import logger from '../utils/logger';
import { diagnosticLogger } from '../services/diagnostic-logger.service';

export async function createWebRtcTransport(router: Router): Promise<WebRtcTransport> {
  const transport = await router.createWebRtcTransport(mediasoupConfig.webRtcTransport);

  diagnosticLogger.logRTPPipeline(
    'WebRtcTransport',
    'WebRTC transport created',
    'info',
    {
      transportId: transport.id,
      iceParameters: transport.iceParameters,
      dtlsParameters: transport.dtlsParameters,
    }
  );

  transport.on('dtlsstatechange', (dtlsState) => {
    diagnosticLogger.logRTPPipeline(
      'WebRtcTransport',
      `DTLS state changed to ${dtlsState}`,
      dtlsState === 'failed' ? 'error' : 'debug',
      { transportId: transport.id, dtlsState }
    );
    if (dtlsState === 'closed') {
      transport.close();
    }
  });

  transport.on('@close', () => {
    diagnosticLogger.logRTPPipeline(
      'WebRtcTransport',
      'WebRTC transport closed',
      'info',
      { transportId: transport.id }
    );
  });

  return transport;
}

export async function connectTransport(
  transport: WebRtcTransport,
  dtlsParameters: any
): Promise<void> {
  await transport.connect({ dtlsParameters });
  diagnosticLogger.logRTPPipeline(
    'WebRtcTransport',
    'Transport connected',
    'info',
    { transportId: transport.id }
  );
}

export async function createProducer(
  transport: WebRtcTransport,
  kind: 'audio' | 'video',
  rtpParameters: any
): Promise<Producer> {
  const producer = await transport.produce({ kind, rtpParameters });

  diagnosticLogger.logRTPPipeline(
    'Producer',
    `Producer created for ${kind}`,
    'info',
    {
      producerId: producer.id,
      kind,
      codec: rtpParameters.codecs?.[0]?.mimeType,
    }
  );

  producer.on('transportclose', () => {
    if (!producer.closed) {
      producer.close();
    }
  });

  // DIAGNOSTIC: Monitor producer stats to see if it's receiving RTP packets
  if (kind === 'video') {
    const statsInterval = setInterval(async () => {
      if (producer.closed) {
        clearInterval(statsInterval);
        return;
      }

      try {
        const stats = await producer.getStats();
        // stats is an array of objects, get the first one
        const producerStats = Array.from(stats)[0];

        if (producerStats) {
          logger.info(`📊 VIDEO PRODUCER STATS [${producer.id.substring(0, 8)}]: ${JSON.stringify(producerStats, null, 2)}`);
        }
      } catch (err: any) {
        logger.error('Failed to get producer stats:', err.message);
      }
    }, 5000); // Check every 5 seconds
  }

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

  diagnosticLogger.logRTPPipeline(
    'Consumer',
    'Consumer created',
    'info',
    {
      consumerId: consumer.id,
      producerId: producer.id,
      kind: producer.kind,
    }
  );

  consumer.on('transportclose', () => {
    if (!consumer.closed) {
      consumer.close();
    }
  });

  consumer.on('producerclose', () => {
    if (!consumer.closed) {
      consumer.close();
    }
  });

  return consumer;
}
