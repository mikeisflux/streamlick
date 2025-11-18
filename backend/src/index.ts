import express from 'express';
import http from 'http';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import path from 'path';
import cookieParser from 'cookie-parser';

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
import adminRoutes from './api/admin.routes';
import adminAssetsRoutes from './api/admin-assets.routes';
import adminSettingsRoutes from './api/admin-settings.routes';
import adminTestingRoutes from './api/admin-testing.routes';
import adminLogsRoutes from './api/admin-logs.routes';
import moderationRoutes from './api/moderation.routes';
import analyticsRoutes from './api/analytics.routes';
import mediaServersRoutes from './api/media-servers.routes';
import infrastructureRoutes from './api/infrastructure.routes';
import brandingRoutes, { publicBrandingRouter } from './api/branding.routes';
import tokenWarningsRoutes from './api/token-warnings.routes';
import pageContentRoutes from './api/page-content.routes';
import emailsRoutes from './api/emails.routes';
import commentsRoutes from './api/comments.routes';

import initializeSocket from './socket';
import logger from './utils/logger';
import { validateCsrfToken } from './auth/csrf';
import { sanitizeInput } from './middleware/sanitize';

dotenv.config();

// Validate critical environment variables at startup
if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 32) {
  logger.error('ENCRYPTION_KEY must be set and at least 32 characters long');
  logger.error('Generate one with: openssl rand -hex 32');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  logger.error('DATABASE_URL must be set');
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const io = initializeSocket(server);

const PORT = process.env.API_PORT || 3000;

// CRITICAL FIX: Enhanced security headers with strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for React
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for React
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.FRONTEND_URL || 'http://localhost:3002'],
      fontSrc: ["'self'", "data:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-site" }, // Changed from cross-origin
  dnsPrefetchControl: { allow: false },
  frameguard: { action: "deny" },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true,
  },
  ieNoOpen: true,
  noSniff: true,
  originAgentCluster: true,
  permittedCrossDomainPolicies: { permittedPolicies: "none" },
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  xssFilter: true,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3002',
  credentials: true, // Allow cookies
}));
app.use(cookieParser()); // Parse cookies

// Increased limits for specific endpoints that need to handle larger payloads (MUST come before default parsers)
app.use('/api/destinations/branding/upload', express.json({ limit: '10mb' }));
app.use('/api/broadcasts/clips/upload', express.json({ limit: '50mb' }));
app.use('/api/broadcasts/clips/upload', express.urlencoded({ extended: true, limit: '50mb' }));
// Broadcasts may have large destinationSettings objects
app.use('/api/broadcasts', express.json({ limit: '500kb' }));
app.use('/api/broadcasts', express.urlencoded({ extended: true, limit: '500kb' }));

// Default request size limit - small for security (DoS prevention)
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// Debug middleware to log body after parsing
app.use('/api/broadcasts/:id/start', (req, res, next) => {
  const bodyStr = req.body ? JSON.stringify(req.body) : 'undefined';
  logger.info('[DEBUG MIDDLEWARE] After body parser:', {
    bodyDefined: !!req.body,
    bodyKeys: req.body ? Object.keys(req.body) : [],
    bodySize: bodyStr.length,
    contentType: req.headers['content-type'],
    method: req.method,
    bodyPreview: bodyStr.substring(0, 200)
  });
  next();
});

// CRITICAL FIX: Input sanitization middleware (apply AFTER parsing so req.body exists)
app.use('/api/', sanitizeInput);

// Rate limiting - configurable via environment variables
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10), // default 15 minutes (900000ms)
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '500', 10), // default 500 requests per window
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// CSRF protection for all API routes (except GET, HEAD, OPTIONS, webhooks)
app.use('/api/', validateCsrfToken);

// CRITICAL FIX: Serve uploaded media clips and branding images with restricted CORS
// Only allow requests from the configured frontend URL to prevent hotlinking and data exfiltration
app.use('/uploads', (req, res, next) => {
  const allowedOrigin = process.env.FRONTEND_URL || 'http://localhost:3002';
  const requestOrigin = req.headers.origin;

  // Only set CORS header if request is from allowed origin
  if (requestOrigin && requestOrigin === allowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-site'); // Changed from cross-origin
  res.setHeader('X-Content-Type-Options', 'nosniff'); // Prevent MIME sniffing
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin'); // Limit referrer leakage

  next();
}, express.static(path.join(__dirname, '../uploads')));

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
app.use('/api/admin/testing', adminTestingRoutes);
app.use('/api/admin/branding', brandingRoutes);
app.use('/api/admin/page-content', pageContentRoutes);
app.use('/api/admin', adminRoutes); // Admin management routes (users, broadcasts, templates, analytics)
app.use('/api/admin', adminSettingsRoutes); // Admin settings routes (system-config, storage-stats, etc)
app.use('/api/admin/logs', adminLogsRoutes); // Admin logs routes (system logs, diagnostics)
app.use('/api/moderation', moderationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/media-servers', mediaServersRoutes);
app.use('/api/infrastructure', infrastructureRoutes);
app.use('/api/branding', publicBrandingRouter); // Public branding endpoint
app.use('/api/token-warnings', tokenWarningsRoutes);
app.use('/api/page-content', pageContentRoutes); // Public endpoint for getting page content
app.use('/api/emails', emailsRoutes); // Email management routes
app.use('/api/comments', commentsRoutes); // Comment posting routes

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Sanitize error before logging to prevent exposing sensitive data
  const sanitizedError = {
    message: err.message || 'Unknown error',
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    code: err.code,
    statusCode: err.statusCode || err.status
  };

  logger.error('Unhandled error:', sanitizedError);
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
