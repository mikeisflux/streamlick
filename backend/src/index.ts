import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import cookieParser from 'cookie-parser';

import { prisma } from './services/prisma.js';
import { setupSocketHandlers } from './socket/index.js';
import authRoutes from './api/auth.routes.js';
import broadcastRoutes from './api/broadcast.routes.js';
import participantRoutes from './api/participant.routes.js';
import destinationRoutes from './api/destination.routes.js';
import compositorRoutes from './api/compositor.routes.js';

const app = express();
const httpServer = createServer(app);

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
};

// Socket.io with CORS
const io = new Server(httpServer, {
  cors: corsOptions,
  transports: ['websocket', 'polling'],
});

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/broadcasts', broadcastRoutes);
app.use('/api/participants', participantRoutes);
app.use('/api/destinations', destinationRoutes);
app.use('/api/compositor', compositorRoutes);

// Setup Socket.io handlers
setupSocketHandlers(io);

// Error handler
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
const PORT = process.env.API_PORT || 3000;

httpServer.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║                    STREAMLICK SERVER                       ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP Server:     http://localhost:${PORT}                    ║
║  WebSocket:       ws://localhost:${PORT}                      ║
║  Environment:     ${process.env.NODE_ENV || 'development'}                          ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down...');
  await prisma.$disconnect();
  httpServer.close();
  process.exit(0);
});
