import express from 'express';
import http from 'http';
import { Server as SocketServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import os from 'os';
import { createWorkers, createRouter, getRouter } from './mediasoup/worker';
import { createWebRtcTransport, connectTransport, createProducer, createConsumer } from './mediasoup/transport';
import { startRTMPStream, stopRTMPStream } from './rtmp/streamer';
import { createCompositorPipeline, stopCompositorPipeline } from './rtmp/compositor-pipeline';
import logger from './utils/logger';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3002',
    credentials: true,
  },
});

const PORT = process.env.MEDIA_SERVER_PORT || 3001;

app.use(cors());
app.use(express.json());

// Store active rooms and their transports/producers/consumers
const broadcasts = new Map<string, any>();

// Health check with server stats
app.get('/health', (req, res) => {
  try {
    // Get active streams count
    const activeStreams = broadcasts.size;

    // Get memory usage
    const memUsage = process.memoryUsage();
    const totalMemory = os.totalmem();
    const usedMemory = totalMemory - os.freemem();
    const memoryUsage = Math.round((usedMemory / totalMemory) * 100);

    // Get CPU usage (average load over 1 minute)
    const cpus = os.cpus();
    const loadAvg = os.loadavg()[0]; // 1-minute load average
    const cpuUsage = Math.min(Math.round((loadAvg / cpus.length) * 100), 100);

    // Get uptime
    const uptime = Math.round(process.uptime());

    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      activeStreams,
      cpuUsage,
      memoryUsage,
      uptime,
      memory: {
        used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
        total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
        external: Math.round(memUsage.external / 1024 / 1024), // MB
      },
      system: {
        platform: os.platform(),
        cpuCount: cpus.length,
        totalMemory: Math.round(totalMemory / 1024 / 1024 / 1024), // GB
        freeMemory: Math.round(os.freemem() / 1024 / 1024 / 1024), // GB
      },
    });
  } catch (error) {
    logger.error('Health check error:', error);
    res.status(500).json({ status: 'error', error: 'Failed to get server stats' });
  }
});

// Get router RTP capabilities
app.get('/broadcasts/:broadcastId/rtp-capabilities', async (req, res) => {
  try {
    const { broadcastId } = req.params;

    let router = getRouter(broadcastId);
    if (!router) {
      router = await createRouter(broadcastId);
    }

    res.json({ rtpCapabilities: router.rtpCapabilities });
  } catch (error) {
    logger.error('Get RTP capabilities error:', error);
    res.status(500).json({ error: 'Failed to get RTP capabilities' });
  }
});

// Socket.io handlers
io.on('connection', (socket) => {
  logger.info(`Media socket connected: ${socket.id}`);

  // Create transport
  socket.on('create-transport', async ({ broadcastId, direction }, callback) => {
    try {
      const router = getRouter(broadcastId);
      if (!router) {
        throw new Error('Router not found');
      }

      const transport = await createWebRtcTransport(router);

      if (!broadcasts.has(broadcastId)) {
        broadcasts.set(broadcastId, {
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
        });
      }

      const broadcast = broadcasts.get(broadcastId);
      broadcast.transports.set(transport.id, transport);

      callback({
        id: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      logger.error('Create transport error:', error);
      callback({ error: 'Failed to create transport' });
    }
  });

  // Connect transport
  socket.on('connect-transport', async ({ transportId, dtlsParameters }, callback) => {
    try {
      let transport;

      broadcasts.forEach((broadcast) => {
        if (broadcast.transports.has(transportId)) {
          transport = broadcast.transports.get(transportId);
        }
      });

      if (!transport) {
        throw new Error('Transport not found');
      }

      await connectTransport(transport, dtlsParameters);
      callback({ connected: true });
    } catch (error) {
      logger.error('Connect transport error:', error);
      callback({ error: 'Failed to connect transport' });
    }
  });

  // Produce media
  socket.on('produce', async ({ transportId, kind, rtpParameters }, callback) => {
    try {
      let transport;
      let broadcastId;

      broadcasts.forEach((broadcast, bId) => {
        if (broadcast.transports.has(transportId)) {
          transport = broadcast.transports.get(transportId);
          broadcastId = bId;
        }
      });

      if (!transport || !broadcastId) {
        throw new Error('Transport not found');
      }

      const producer = await createProducer(transport, kind, rtpParameters);

      const broadcast = broadcasts.get(broadcastId);
      broadcast.producers.set(producer.id, producer);

      // Notify other participants
      socket.to(broadcastId).emit('new-producer', { producerId: producer.id, kind });

      callback({ producerId: producer.id });
    } catch (error) {
      logger.error('Produce error:', error);
      callback({ error: 'Failed to produce' });
    }
  });

  // Consume media
  socket.on('consume', async ({ broadcastId, producerId, rtpCapabilities }, callback) => {
    try {
      const broadcast = broadcasts.get(broadcastId);
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }

      const producer = broadcast.producers.get(producerId);
      if (!producer) {
        throw new Error('Producer not found');
      }

      const router = getRouter(broadcastId);
      if (!router) {
        throw new Error('Router not found');
      }

      if (!router.canConsume({ producerId, rtpCapabilities })) {
        callback({ error: 'Cannot consume' });
        return;
      }

      // Create consumer transport
      const transport = await createWebRtcTransport(router);
      broadcast.transports.set(transport.id, transport);

      const consumer = await createConsumer(transport, producer, rtpCapabilities);
      broadcast.consumers.set(consumer.id, consumer);

      callback({
        consumerId: consumer.id,
        producerId: producer.id,
        kind: consumer.kind,
        rtpParameters: consumer.rtpParameters,
        transportId: transport.id,
        iceParameters: transport.iceParameters,
        iceCandidates: transport.iceCandidates,
        dtlsParameters: transport.dtlsParameters,
      });
    } catch (error) {
      logger.error('Consume error:', error);
      callback({ error: 'Failed to consume' });
    }
  });

  // Start RTMP streaming with compositor pipeline
  socket.on('start-rtmp', async ({ broadcastId, destinations, compositeProducers }) => {
    try {
      logger.info(`Starting RTMP stream for broadcast ${broadcastId}`);

      const broadcast = broadcasts.get(broadcastId);
      if (!broadcast) {
        throw new Error('Broadcast not found');
      }

      const router = getRouter(broadcastId);
      if (!router) {
        throw new Error('Router not found');
      }

      // If composite producers are specified, use compositor pipeline
      if (compositeProducers?.videoProducerId && compositeProducers?.audioProducerId) {
        const videoProducer = broadcast.producers.get(compositeProducers.videoProducerId);
        const audioProducer = broadcast.producers.get(compositeProducers.audioProducerId);

        if (videoProducer && audioProducer) {
          await createCompositorPipeline(router, broadcastId, videoProducer, audioProducer, destinations);
          socket.emit('rtmp-started', { broadcastId, method: 'compositor-pipeline' });
          logger.info('RTMP started with compositor pipeline');
        } else {
          logger.warn('Composite producers not found, falling back to legacy RTMP');
          startRTMPStream(broadcastId, destinations);
          socket.emit('rtmp-started', { broadcastId, method: 'legacy' });
        }
      } else {
        // Fallback to legacy RTMP (for backwards compatibility)
        logger.info('Using legacy RTMP streaming');
        startRTMPStream(broadcastId, destinations);
        socket.emit('rtmp-started', { broadcastId, method: 'legacy' });
      }
    } catch (error) {
      logger.error('Start RTMP error:', error);
      socket.emit('rtmp-error', { error: 'Failed to start RTMP stream' });
    }
  });

  // Stop RTMP streaming
  socket.on('stop-rtmp', async ({ broadcastId }) => {
    try {
      // Stop compositor pipeline (if active)
      await stopCompositorPipeline(broadcastId);

      // Stop legacy RTMP (if active)
      stopRTMPStream(broadcastId);

      socket.emit('rtmp-stopped', { broadcastId });
      logger.info(`RTMP streaming stopped for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Stop RTMP error:', error);
      socket.emit('rtmp-error', { error: 'Failed to stop RTMP stream' });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`Media socket disconnected: ${socket.id}`);
  });
});

// Initialize and start server
async function start() {
  try {
    // Create mediasoup workers
    await createWorkers(1);

    server.listen(PORT, () => {
      logger.info(`🎥 Streamlick Media Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    logger.error('Failed to start media server:', error);
    process.exit(1);
  }
}

start();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server, io };
