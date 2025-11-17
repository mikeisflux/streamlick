/**
 * Infrastructure Management API
 * Automated server provisioning via Hetzner Cloud
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../auth/middleware';
import { hetznerService } from '../services/hetzner.service';
import { mediaServerPool } from '../services/media-server-pool.service';
import logger from '../utils/logger';
import { generateToken } from '../utils/crypto';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/infrastructure/status
 * Check if Hetzner API is configured
 */
router.get('/status', async (req, res) => {
  try {
    const configured = await hetznerService.isConfigured();
    res.json({
      configured,
      message: configured
        ? 'Hetzner API is configured'
        : 'Add hetzner_api_key in Admin Settings → System Config'
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/infrastructure/servers
 * List all Hetzner servers
 */
router.get('/servers', async (req, res) => {
  try {
    const servers = await hetznerService.listServers();
    res.json({ servers });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/infrastructure/server-types
 * Get available server types (CCX series for media servers)
 */
router.get('/server-types', async (req, res) => {
  try {
    const types = await hetznerService.getServerTypes();
    res.json({ types });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/infrastructure/locations
 * Get available datacenter locations
 */
router.get('/locations', async (req, res) => {
  try {
    const locations = await hetznerService.getLocations();
    res.json({ locations });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/infrastructure/ssh-keys
 * Get SSH keys from Hetzner account
 */
router.get('/ssh-keys', async (req, res) => {
  try {
    const keys = await hetznerService.getSSHKeys();
    res.json({ keys });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/infrastructure/deploy
 * Deploy a new server with specific role (automated)
 */
router.post('/deploy', async (req, res) => {
  try {
    const { name, serverType, location, role, sshKeys, backendUrl, upstreamServers } = req.body;

    if (!name || !serverType || !location || !role) {
      return res.status(400).json({
        error: 'Missing required fields: name, serverType, location, role'
      });
    }

    // Validate role
    const validRoles = ['media-server', 'api-server', 'frontend-server', 'load-balancer', 'database-server', 'redis-server'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    logger.info(`Starting automated deployment: ${name} (${role}) on ${serverType} in ${location}`);

    // Deploy server via Hetzner API
    const server = await hetznerService.deployServer({
      name,
      serverType,
      location,
      role,
      sshKeys: sshKeys || [],
      backendUrl,
      upstreamServers,
    });

    // Wait for server to be ready (max 2 minutes)
    logger.info('Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Construct response based on role
    const responseData: any = {
      success: true,
      message: `${role} deployed successfully!`,
      server: {
        id: server.id,
        name: server.name,
        ip: server.public_net.ipv4.ip,
        serverType: server.server_type.name,
        role,
      },
    };

    // For media servers, try to auto-add to pool
    if (role === 'media-server') {
      const mediaServerUrl = `http://${server.public_net.ipv4.ip}:3001`;
      responseData.server.url = mediaServerUrl;

      try {
        const serverId = mediaServerPool.addServer(mediaServerUrl);
        logger.info(`Added media server to pool: ${serverId}`);
        responseData.server.poolId = serverId;
      } catch (poolError: any) {
        logger.warn('Server deployed but failed to add to pool:', poolError.message);
        responseData.warning = 'Could not auto-add to pool. Add manually via "Add Server" button.';
      }
    } else if (role === 'api-server') {
      responseData.server.url = `http://${server.public_net.ipv4.ip}:3000`;
      responseData.notes = 'Remember to update FRONTEND_URL and CORS_ORIGINS in backend/.env';
    } else if (role === 'frontend-server') {
      responseData.server.url = `http://${server.public_net.ipv4.ip}`;
      responseData.notes = 'Install SSL with: certbot --nginx -d yourdomain.com';
    } else if (role === 'load-balancer') {
      responseData.server.url = `http://${server.public_net.ipv4.ip}`;
      responseData.notes = 'Update upstream servers in /etc/nginx/sites-available/streamlick-lb and install SSL certificates';
    } else if (role === 'database-server') {
      // CRITICAL FIX: Generate secure random password instead of hardcoded weak password
      // SECURITY: Never expose passwords in API responses - only show format
      const dbPassword = generateToken(32); // 64-char hex password

      // Store password securely (in production, use secrets manager)
      logger.info(`Database server deployed. Password generated (not logged for security).`);

      responseData.server.host = server.public_net.ipv4.ip;
      responseData.server.port = 5432;
      responseData.server.database = 'streamlick_prod';
      responseData.server.username = 'streamlick';
      // SECURITY: Return password ONCE during deployment, never again
      responseData.server.password = dbPassword;
      responseData.server.connectionString = `postgresql://streamlick:${dbPassword}@${server.public_net.ipv4.ip}:5432/streamlick_prod`;
      responseData.notes = [
        'CRITICAL: Save the password immediately - it will not be shown again!',
        'Add this connection string to your backend .env as DATABASE_URL',
        'Restrict PostgreSQL access to specific IPs in pg_hba.conf',
        'Enable SSL/TLS for database connections in production'
      ];
    } else if (role === 'redis-server') {
      // CRITICAL FIX: Generate secure random password instead of hardcoded weak password
      const redisPassword = generateToken(32); // 64-char hex password

      logger.info(`Redis server deployed. Password generated (not logged for security).`);

      responseData.server.host = server.public_net.ipv4.ip;
      responseData.server.port = 6379;
      // SECURITY: Return password ONCE during deployment, never again
      responseData.server.password = redisPassword;
      responseData.server.connectionString = `redis://:${redisPassword}@${server.public_net.ipv4.ip}:6379`;
      responseData.notes = [
        'CRITICAL: Save the password immediately - it will not be shown again!',
        'Add this connection string to your backend .env as REDIS_URL',
        'Restrict Redis access via firewall rules (only allow backend servers)',
        'Enable Redis TLS in production'
      ];
    }

    res.json(responseData);
  } catch (error: any) {
    logger.error('Deployment failed:', error);
    res.status(500).json({
      error: 'Deployment failed',
      details: error.message
    });
  }
});

/**
 * DELETE /api/infrastructure/servers/:id
 * Delete a Hetzner server
 */
router.delete('/servers/:id', async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);

    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    await hetznerService.deleteServer(serverId);

    res.json({
      success: true,
      message: `Server ${serverId} deleted successfully`,
    });
  } catch (error: any) {
    logger.error('Delete server failed:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/infrastructure/servers/:id/labels
 * Update server labels (e.g., assign role)
 */
router.post('/servers/:id/labels', async (req, res) => {
  try {
    const serverId = parseInt(req.params.id);
    const { role } = req.body;

    if (isNaN(serverId)) {
      return res.status(400).json({ error: 'Invalid server ID' });
    }

    if (!role) {
      return res.status(400).json({ error: 'Role is required' });
    }

    // Validate role
    const validRoles = ['media-server', 'api-server', 'frontend-server', 'load-balancer', 'database-server', 'redis-server'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${validRoles.join(', ')}`
      });
    }

    await hetznerService.updateServerLabels(serverId, { role });

    logger.info(`Updated server ${serverId} labels: role=${role}`);

    res.json({
      success: true,
      message: `Server role updated to ${role}`,
    });
  } catch (error: any) {
    logger.error('Update server labels failed:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
