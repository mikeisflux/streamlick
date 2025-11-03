import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';

import authRoutes from './api/auth.routes';
import broadcastsRoutes from './api/broadcasts.routes';
import destinationsRoutes from './api/destinations.routes';
import participantsRoutes from './api/participants.routes';
import assetsRoutes from './api/assets.routes';
import recordingsRoutes from './api/recordings.routes';
import templatesRoutes from './api/templates.routes';
import billingRoutes from './api/billing.routes';
import oauthRoutes from './api/oauth.routes';
import logsRoutes from './routes/logs.routes';
import mediaClipsRoutes from './api/media-clips.routes';
import participantControlRoutes from './routes/participant.routes';
import backgroundsRoutes from './api/backgrounds.routes';
import adminAssetsRoutes from './api/admin-assets.routes';
import adminSettingsRoutes from './api/admin-settings.routes';
import adminTestingRoutes from './api/admin-testing.routes';
import moderationRoutes from './api/moderation.routes';

import initializeSocket from './socket';
import logger from './utils/logger';

dotenv.config();

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);

const PORT = process.env.API_PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true,
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// Serve uploaded media clips
app.use('/uploads', express.static('uploads'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/broadcasts', broadcastsRoutes);
app.use('/api/destinations', destinationsRoutes);
app.use('/api/participants', participantsRoutes);
app.use('/api/assets', assetsRoutes);
app.use('/api/recordings', recordingsRoutes);
app.use('/api/templates', templatesRoutes);
app.use('/api/billing', billingRoutes);
app.use('/api/oauth', oauthRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/media-clips', mediaClipsRoutes);
app.use('/api/broadcasts', participantControlRoutes);
app.use('/api/backgrounds', backgroundsRoutes);
app.use('/api/admin/assets', adminAssetsRoutes);
app.use('/api/assets', adminAssetsRoutes); // Public endpoint for defaults
app.use('/api/admin', adminSettingsRoutes);
app.use('/api/admin/testing', adminTestingRoutes);
app.use('/api/moderation', moderationRoutes);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
server.listen(PORT, () => {
  logger.info(`🚀 Streamlick API server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

export { app, server, io };
