// STARTUP LOGGING - Log immediately before any imports fail
console.log('========================================');
console.log('MEDIA SERVER STARTING...');
console.log('Time:', new Date().toISOString());
console.log('Node version:', process.version);
console.log('CWD:', process.cwd());
console.log('========================================');

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
import { diagnosticLogger } from './services/diagnostic-logger.service';
import { adaptiveBitrateService } from './services/adaptive-bitrate.service';
import logger from './utils/logger';

console.log('[Startup] Loading .env configuration...');
dotenv.config();
console.log('[Startup] .env loaded successfully');

// Validate critical environment variables at startup
function validateEnvironment() {
  console.log('[Startup] Validating environment variables...');
  const errors: string[] = [];

  console.log('[Startup] Checking MEDIASOUP_ANNOUNCED_IP:', process.env.MEDIASOUP_ANNOUNCED_IP || 'NOT SET');
  if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
    errors.push('MEDIASOUP_ANNOUNCED_IP must be set (your server\'s public IP address)');
  }

  console.log('[Startup] Checking FRONTEND_URL:', process.env.FRONTEND_URL || 'NOT SET');
  if (!process.env.FRONTEND_URL) {
    errors.push('FRONTEND_URL must be set (e.g., https://streamlick.com)');
  }

  // Warn about localhost/127.0.0.1 in production
  if (process.env.NODE_ENV === 'production') {
    if (process.env.MEDIASOUP_ANNOUNCED_IP === '127.0.0.1' || process.env.MEDIASOUP_ANNOUNCED_IP === 'localhost') {
      errors.push('MEDIASOUP_ANNOUNCED_IP cannot be localhost/127.0.0.1 in production - use your server\'s public IP');
    }
    if (process.env.FRONTEND_URL?.includes('localhost')) {
      errors.push('FRONTEND_URL cannot contain localhost in production');
    }
  }

  if (errors.length > 0) {
    console.error('[Startup] ❌ Environment validation FAILED:');
    errors.forEach(error => console.error(`  - ${error}`));
    logger.error('Environment validation failed:');
    errors.forEach(error => logger.error(`  - ${error}`));
    process.exit(1);
  }

  console.log('[Startup] ✓ Environment validation passed');
  logger.info('Environment validation passed');
  logger.info(`  MEDIASOUP_ANNOUNCED_IP: ${process.env.MEDIASOUP_ANNOUNCED_IP}`);
  logger.info(`  FRONTEND_URL: ${process.env.FRONTEND_URL}`);
  logger.info(`  NODE_ENV: ${process.env.NODE_ENV || 'development'}`);
}

console.log('[Startup] Running environment validation...');
validateEnvironment();

console.log('[Startup] Creating Express app...');
const app = express();
console.log('[Startup] Creating HTTP server...');
const server = http.createServer(app);
console.log('[Startup] Creating Socket.IO server with CORS:', process.env.FRONTEND_URL || 'http://localhost:3002');
const io = new SocketServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3002',
    credentials: true,
  },
});
console.log('[Startup] ✓ Socket.IO server created');

const PORT = process.env.MEDIA_SERVER_PORT || 3001;

app.use(cors());
app.use(express.json());

// Define broadcast data structure
interface BroadcastData {
  transports: Map<string, any>;
  producers: Map<string, any>;
  consumers: Map<string, any>;
  sockets: Set<string>; // Track connected sockets
  createdAt: Date;
  lastActivity: Date;
}

// Store active rooms and their transports/producers/consumers
const broadcasts = new Map<string, BroadcastData>();

// Track which broadcast each socket belongs to
const socketToBroadcast = new Map<string, Set<string>>();

// Mutex for broadcast cleanup to prevent race conditions
const cleanupLocks = new Map<string, Promise<void>>();

// Helper function to acquire cleanup lock
async function withCleanupLock<T>(
  broadcastId: string,
  operation: () => Promise<T>
): Promise<T> {
  // Wait for any existing cleanup to complete
  while (cleanupLocks.has(broadcastId)) {
    await cleanupLocks.get(broadcastId);
  }

  // Create new lock
  let releaseLock: () => void;
  const lockPromise = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  cleanupLocks.set(broadcastId, lockPromise);

  try {
    return await operation();
  } finally {
    // Release lock
    cleanupLocks.delete(broadcastId);
    releaseLock!();
  }
}

// Helper function to clean up a broadcast
async function cleanupBroadcast(broadcastId: string): Promise<void> {
  const broadcast = broadcasts.get(broadcastId);
  if (!broadcast) return;

  logger.info(`Cleaning up broadcast ${broadcastId}...`);

  let cleanupErrors: Error[] = [];

  try {
    // Close all transports
    try {
      for (const [transportId, transport] of broadcast.transports) {
        try {
          if (!transport.closed) {
            transport.close();
            logger.debug(`Closed transport ${transportId}`);
          }
        } catch (error) {
          logger.error(`Error closing transport ${transportId}:`, error);
          cleanupErrors.push(error as Error);
        }
      }
    } catch (error) {
      logger.error(`Error iterating transports for ${broadcastId}:`, error);
      cleanupErrors.push(error as Error);
    }

    // Close all producers
    try {
      for (const [producerId, producer] of broadcast.producers) {
        try {
          if (!producer.closed) {
            producer.close();
            logger.debug(`Closed producer ${producerId}`);
          }
        } catch (error) {
          logger.error(`Error closing producer ${producerId}:`, error);
          cleanupErrors.push(error as Error);
        }
      }
    } catch (error) {
      logger.error(`Error iterating producers for ${broadcastId}:`, error);
      cleanupErrors.push(error as Error);
    }

    // Close all consumers
    try {
      for (const [consumerId, consumer] of broadcast.consumers) {
        try {
          if (!consumer.closed) {
            consumer.close();
            logger.debug(`Closed consumer ${consumerId}`);
          }
        } catch (error) {
          logger.error(`Error closing consumer ${consumerId}:`, error);
          cleanupErrors.push(error as Error);
        }
      }
    } catch (error) {
      logger.error(`Error iterating consumers for ${broadcastId}:`, error);
      cleanupErrors.push(error as Error);
    }

    // Stop any RTMP streams
    try {
      await stopCompositorPipeline(broadcastId);
    } catch (error) {
      logger.debug(`No compositor pipeline to stop for ${broadcastId}`);
    }

    try {
      stopRTMPStream(broadcastId);
    } catch (error) {
      logger.debug(`No RTMP stream to stop for ${broadcastId}`);
    }
  } catch (error) {
    logger.error(`Unexpected error during broadcast cleanup for ${broadcastId}:`, error);
    cleanupErrors.push(error as Error);
  } finally {
    // Always remove from broadcasts map, even if errors occurred
    try {
      broadcasts.delete(broadcastId);
      if (cleanupErrors.length > 0) {
        logger.warn(`Broadcast ${broadcastId} cleaned up with ${cleanupErrors.length} error(s)`);
      } else {
        logger.info(`Broadcast ${broadcastId} cleaned up successfully`);
      }
    } catch (error) {
      logger.error(`Error removing broadcast ${broadcastId} from map:`, error);
    }
  }
}

// Helper function to track socket connection to broadcast
function trackSocketBroadcast(socketId: string, broadcastId: string): void {
  // Track broadcast for this socket
  if (!socketToBroadcast.has(socketId)) {
    socketToBroadcast.set(socketId, new Set());
  }
  socketToBroadcast.get(socketId)!.add(broadcastId);

  // Add socket to broadcast
  const broadcast = broadcasts.get(broadcastId);
  if (broadcast) {
    broadcast.sockets.add(socketId);
    broadcast.lastActivity = new Date();
  }
}

// Helper function to remove socket from broadcast tracking
async function untrackSocketBroadcast(socketId: string): Promise<void> {
  const broadcastIds = socketToBroadcast.get(socketId);
  if (!broadcastIds) return;

  for (const broadcastId of broadcastIds) {
    // Use mutex to prevent race condition when multiple sockets disconnect simultaneously
    await withCleanupLock(broadcastId, async () => {
      const broadcast = broadcasts.get(broadcastId);
      if (broadcast) {
        broadcast.sockets.delete(socketId);

        // If no more sockets connected, clean up the broadcast
        if (broadcast.sockets.size === 0) {
          logger.info(`Last socket disconnected from broadcast ${broadcastId}, cleaning up...`);
          await cleanupBroadcast(broadcastId);
        } else {
          logger.debug(`${broadcast.sockets.size} socket(s) still connected to broadcast ${broadcastId}`);
        }
      }
    });
  }

  socketToBroadcast.delete(socketId);
}

// Health check with server stats
app.get('/health', (req: express.Request, res: express.Response) => {
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
app.get('/broadcasts/:broadcastId/rtp-capabilities', async (req: express.Request, res: express.Response) => {
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
console.log('[Startup] Setting up Socket.IO connection handler...');
io.on('connection', (socket) => {
  console.log(`[Socket.IO] ========== NEW CONNECTION ==========`);
  console.log(`[Socket.IO] Client connected: ${socket.id}`);
  console.log(`[Socket.IO] Client address: ${socket.handshake.address}`);
  console.log(`[Socket.IO] Client headers:`, JSON.stringify(socket.handshake.headers, null, 2));
  logger.info(`Media socket connected: ${socket.id}`);

  // Create transport
  socket.on('create-transport', async ({ broadcastId, direction }, callback) => {
    try {
      // Get or create router for this broadcast
      let router = getRouter(broadcastId);
      if (!router) {
        logger.debug(`Router not found for ${broadcastId}, creating...`);
        router = await createRouter(broadcastId);
      }

      const transport = await createWebRtcTransport(router);

      if (!broadcasts.has(broadcastId)) {
        broadcasts.set(broadcastId, {
          transports: new Map(),
          producers: new Map(),
          consumers: new Map(),
          sockets: new Set(),
          createdAt: new Date(),
          lastActivity: new Date(),
        });
      }

      // Track this socket for this broadcast
      trackSocketBroadcast(socket.id, broadcastId);

      const broadcast = broadcasts.get(broadcastId)!;
      broadcast.transports.set(transport.id, transport);

      if (callback && typeof callback === 'function') {
        callback({
          id: transport.id,
          iceParameters: transport.iceParameters,
          iceCandidates: transport.iceCandidates,
          dtlsParameters: transport.dtlsParameters,
        });
      }
    } catch (error) {
      logger.error('Create transport error:', error);
      if (callback && typeof callback === 'function') {
        callback({ error: 'Failed to create transport' });
      }
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
      if (callback && typeof callback === 'function') {
        callback({ connected: true });
      }
    } catch (error) {
      logger.error('Connect transport error:', error);
      if (callback && typeof callback === 'function') {
        callback({ error: 'Failed to connect transport' });
      }
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
      if (!broadcast) {
        throw new Error(`Broadcast ${broadcastId} not found`);
      }
      broadcast.producers.set(producer.id, producer);

      // Notify other participants
      socket.to(broadcastId).emit('new-producer', { producerId: producer.id, kind });

      if (callback && typeof callback === 'function') {
        callback({ producerId: producer.id });
      }
    } catch (error) {
      logger.error('Produce error:', error);
      if (callback && typeof callback === 'function') {
        callback({ error: 'Failed to produce' });
      }
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
        if (callback && typeof callback === 'function') {
          callback({ error: 'Cannot consume' });
        }
        return;
      }

      // Create consumer transport
      const transport = await createWebRtcTransport(router);
      broadcast.transports.set(transport.id, transport);

      const consumer = await createConsumer(transport, producer, rtpCapabilities);
      broadcast.consumers.set(consumer.id, consumer);

      if (callback && typeof callback === 'function') {
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
      }
    } catch (error) {
      logger.error('Consume error:', error);
      if (callback && typeof callback === 'function') {
        callback({ error: 'Failed to consume' });
      }
    }
  });

  // Start RTMP streaming with compositor pipeline
  socket.on('start-rtmp', async ({ broadcastId, destinations, compositeProducers }) => {
    try {
      logger.info(`[RTMP] ========== START-RTMP EVENT RECEIVED ==========`);
      logger.info(`[RTMP] Broadcast ID: ${broadcastId}`);
      logger.info(`[RTMP] Destinations count: ${destinations?.length || 0}`);
      logger.info(`[RTMP] Destinations:`, JSON.stringify(destinations, null, 2));
      logger.info(`[RTMP] Composite producers:`, JSON.stringify(compositeProducers, null, 2));

      const broadcast = broadcasts.get(broadcastId);
      if (!broadcast) {
        logger.error(`[RTMP] ❌ Broadcast ${broadcastId} not found in broadcasts map`);
        throw new Error('Broadcast not found');
      }
      logger.info(`[RTMP] ✓ Broadcast found`);

      const router = getRouter(broadcastId);
      if (!router) {
        logger.error(`[RTMP] ❌ Router not found for broadcast ${broadcastId}`);
        throw new Error('Router not found');
      }
      logger.info(`[RTMP] ✓ Router found`);

      // If composite producers are specified, use compositor pipeline
      if (compositeProducers?.videoProducerId && compositeProducers?.audioProducerId) {
        logger.info(`[RTMP] Using compositor pipeline mode`);
        const videoProducer = broadcast.producers.get(compositeProducers.videoProducerId);
        const audioProducer = broadcast.producers.get(compositeProducers.audioProducerId);

        logger.info(`[RTMP] Video producer: ${videoProducer ? 'found' : 'NOT FOUND'}`);
        logger.info(`[RTMP] Audio producer: ${audioProducer ? 'found' : 'NOT FOUND'}`);

        if (videoProducer && audioProducer) {
          logger.info(`[RTMP] 🚀 Starting compositor pipeline...`);
          await createCompositorPipeline(router, broadcastId, videoProducer, audioProducer, destinations);
          if (socket.connected) {
            socket.emit('rtmp-started', { broadcastId, method: 'compositor-pipeline' });
          }
          logger.info('[RTMP] ✅ RTMP started with compositor pipeline');
        } else {
          logger.warn('[RTMP] ⚠️ Composite producers not found, falling back to legacy RTMP');
          startRTMPStream(broadcastId, destinations);
          if (socket.connected) {
            socket.emit('rtmp-started', { broadcastId, method: 'legacy' });
          }
        }
      } else {
        // Fallback to legacy RTMP (for backwards compatibility)
        logger.info('[RTMP] Using legacy RTMP streaming mode');
        startRTMPStream(broadcastId, destinations);
        if (socket.connected) {
          socket.emit('rtmp-started', { broadcastId, method: 'legacy' });
        }
      }
    } catch (error) {
      logger.error('Start RTMP error:', error);
      if (socket.connected) {
        socket.emit('rtmp-error', { error: 'Failed to start RTMP stream' });
      }
    }
  });

  // Stop RTMP streaming
  socket.on('stop-rtmp', async ({ broadcastId }) => {
    try {
      // Stop compositor pipeline (if active)
      await stopCompositorPipeline(broadcastId);

      // Stop legacy RTMP (if active)
      stopRTMPStream(broadcastId);

      if (socket.connected) {
        socket.emit('rtmp-stopped', { broadcastId });
      }
      logger.info(`RTMP streaming stopped for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Stop RTMP error:', error);
      if (socket.connected) {
        socket.emit('rtmp-error', { error: 'Failed to stop RTMP stream' });
      }
    }
  });

  socket.on('disconnect', async () => {
    logger.info(`Media socket disconnected: ${socket.id}`);

    // Clean up broadcasts if this was the last socket
    await untrackSocketBroadcast(socket.id);

    logger.debug(`Socket ${socket.id} cleanup completed`);
  });
});

// Initialize and start server
async function start() {
  try {
    console.log('[Startup] ========== STARTING MEDIA SERVER ==========');
    // Create mediasoup workers (at least 2 for redundancy)
    const numWorkers = parseInt(process.env.MEDIASOUP_WORKERS || '2');
    console.log(`[Startup] Creating ${numWorkers} mediasoup workers...`);
    await createWorkers(numWorkers);
    console.log('[Startup] ✓ Mediasoup workers created');

    console.log(`[Startup] Starting HTTP server on port ${PORT}...`);
    server.listen(PORT, () => {
      console.log(`[Startup] ========== ✅ SERVER LISTENING ON PORT ${PORT} ==========`);
      console.log(`[Startup] Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`[Startup] FRONTEND_URL: ${process.env.FRONTEND_URL}`);
      console.log(`[Startup] Time: ${new Date().toISOString()}`);
      logger.info(`🎥 Streamlick Media Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('[Startup] ❌ FAILED TO START MEDIA SERVER:');
    console.error(error);
    logger.error('Failed to start media server:', error);
    process.exit(1);
  }
}

console.log('[Startup] Calling start() function...');
start();

// Force exit after timeout if graceful shutdown hangs (configurable, default 30 seconds)
const SHUTDOWN_TIMEOUT_MS = parseInt(process.env.SHUTDOWN_TIMEOUT_MS || '30000', 10);
let shutdownTimeout: NodeJS.Timeout | null = null;

// Graceful shutdown handler
async function gracefulShutdown(signal: string) {
  logger.info(`${signal} received, initiating graceful shutdown...`);

  // Start shutdown timeout
  shutdownTimeout = setTimeout(() => {
    logger.error(`Graceful shutdown timeout (${SHUTDOWN_TIMEOUT_MS}ms), forcing exit`);
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // 1. Stop accepting new connections
    logger.info('Closing server to prevent new connections...');
    server.close();

    // 2. Disconnect all active socket.io connections
    logger.info('Disconnecting all active socket connections...');
    io.disconnectSockets();

    // 3. Clean up all broadcasts
    logger.info(`Cleaning up ${broadcasts.size} active broadcast(s)...`);
    const cleanupPromises = Array.from(broadcasts.keys()).map(broadcastId =>
      cleanupBroadcast(broadcastId)
    );
    await Promise.all(cleanupPromises);
    logger.info('All broadcasts cleaned up');

    // 4. Stop all adaptive bitrate monitoring
    try {
      adaptiveBitrateService.stopAll();
      logger.info('Adaptive bitrate monitoring stopped');
    } catch (error) {
      logger.error('Error stopping adaptive bitrate service:', error);
    }

    // 5. Close diagnostic logger
    try {
      diagnosticLogger.destroy();
      logger.info('Diagnostic logger closed');
    } catch (error) {
      logger.error('Error closing diagnostic logger:', error);
    }

    // 6. Close all mediasoup workers
    try {
      const { closeWorkers } = await import('./mediasoup/worker');
      await closeWorkers();
      logger.info('Mediasoup workers closed');
    } catch (error) {
      logger.error('Error closing workers:', error);
    }

    // Clear shutdown timeout on successful cleanup
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
    }

    logger.info('Graceful shutdown completed successfully');
    process.exit(0);
  } catch (error) {
    logger.error('Error during graceful shutdown:', error);

    // Clear shutdown timeout on error (we're about to exit anyway)
    if (shutdownTimeout) {
      clearTimeout(shutdownTimeout);
      shutdownTimeout = null;
    }

    process.exit(1);
  }
}

// Graceful shutdown on SIGTERM (Docker, Kubernetes)
process.on('SIGTERM', () => {
  gracefulShutdown('SIGTERM');
});

// Graceful shutdown on SIGINT (Ctrl+C)
process.on('SIGINT', () => {
  gracefulShutdown('SIGINT');
});

// Exit handler
process.on('exit', () => {
  if (shutdownTimeout) {
    clearTimeout(shutdownTimeout);
  }
});

export { app, server, io };
