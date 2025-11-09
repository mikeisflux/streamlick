/**
 * Infrastructure Management API
 * Automated server provisioning via Hetzner Cloud
 */

import { Router } from 'express';
import { authenticateToken, requireAdmin } from '../auth/middleware';
import { hetznerService } from '../services/hetzner.service';
import { mediaServerPool } from '../services/media-server-pool.service';
import logger from '../utils/logger';

const router = Router();

// All routes require admin authentication
router.use(authenticateToken, requireAdmin);

/**
 * GET /api/infrastructure/status
 * Check if Hetzner API is configured
 */
router.get('/status', async (req, res) => {
  try {
    const configured = hetznerService.isConfigured();
    res.json({
      configured,
      message: configured
        ? 'Hetzner API is configured'
        : 'Add HETZNER_API_KEY in Admin Settings → System Config'
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
 * Deploy a new media server (automated)
 */
router.post('/deploy', async (req, res) => {
  try {
    const { name, serverType, location, sshKeys } = req.body;

    if (!name || !serverType || !location) {
      return res.status(400).json({
        error: 'Missing required fields: name, serverType, location'
      });
    }

    logger.info(`Starting automated deployment: ${name} (${serverType}) in ${location}`);

    // Deploy server via Hetzner API
    const server = await hetznerService.deployMediaServer({
      name,
      serverType,
      location,
      sshKeys: sshKeys || [],
    });

    // Wait for server to be ready (max 2 minutes)
    logger.info('Waiting for server to initialize...');
    await new Promise(resolve => setTimeout(resolve, 120000));

    // Construct media server URL
    const mediaServerUrl = `http://${server.public_net.ipv4.ip}:3001`;

    // Add to media server pool
    try {
      const serverId = mediaServerPool.addServer(mediaServerUrl);
      logger.info(`Added server to pool: ${serverId}`);

      res.json({
        success: true,
        message: 'Media server deployed successfully!',
        server: {
          id: server.id,
          name: server.name,
          ip: server.public_net.ipv4.ip,
          url: mediaServerUrl,
          serverType: server.server_type.name,
          poolId: serverId,
        },
      });
    } catch (poolError: any) {
      logger.warn('Server deployed but failed to add to pool:', poolError.message);
      res.json({
        success: true,
        message: 'Server deployed! Add manually to pool via "Add Server" button.',
        server: {
          id: server.id,
          name: server.name,
          ip: server.public_net.ipv4.ip,
          url: mediaServerUrl,
          serverType: server.server_type.name,
        },
        warning: 'Could not auto-add to pool. Add manually.',
      });
    }
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

export default router;
