/**
 * Hetzner Cloud API Service
 * Automates server provisioning for media servers
 */

import axios from 'axios';
import logger from '../utils/logger';

export interface HetznerServer {
  id: number;
  name: string;
  status: string;
  public_net: {
    ipv4: {
      ip: string;
    };
  };
  server_type: {
    name: string;
    cores: number;
    memory: number;
    disk: number;
  };
}

export interface DeploymentProgress {
  step: string;
  status: 'pending' | 'inprogress' | 'completed' | 'failed';
  message: string;
}

class HetznerService {
  private apiKey: string | undefined;
  private baseURL = 'https://api.hetzner.cloud/v1';

  constructor() {
    this.apiKey = process.env.HETZNER_API_KEY;
  }

  /**
   * Check if Hetzner API is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Get API client with auth
   */
  private getClient() {
    if (!this.apiKey) {
      throw new Error('Hetzner API key not configured. Add HETZNER_API_KEY to Admin Settings.');
    }

    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all servers
   */
  async listServers(): Promise<HetznerServer[]> {
    try {
      const client = this.getClient();
      const response = await client.get('/servers');
      return response.data.servers;
    } catch (error: any) {
      logger.error('Failed to list Hetzner servers:', error);
      throw new Error(`Hetzner API error: ${error.message}`);
    }
  }

  /**
   * Create a new media server (automated deployment)
   */
  async deployMediaServer(options: {
    name: string;
    serverType: string; // CCX13, CCX23, CCX33
    location: string; // nbg1, fsn1, hel1, ash
    sshKeys?: number[];
  }): Promise<HetznerServer> {
    try {
      const client = this.getClient();

      logger.info(`Deploying media server: ${options.name} (${options.serverType}) in ${options.location}`);

      // Create server
      const response = await client.post('/servers', {
        name: options.name,
        server_type: options.serverType.toLowerCase(),
        location: options.location,
        image: 'ubuntu-22.04',
        ssh_keys: options.sshKeys || [],
        start_after_create: true,
        user_data: this.getCloudInitScript(),
      });

      const server: HetznerServer = response.data.server;

      logger.info(`Server created: ${server.name} (${server.public_net.ipv4.ip})`);

      return server;
    } catch (error: any) {
      logger.error('Failed to deploy media server:', error);
      throw new Error(`Deployment failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get cloud-init script for automated setup
   */
  private getCloudInitScript(): string {
    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2
npm install -g pm2

# Install Git
apt-get install -y git

# Clone repository
cd /root
git clone https://github.com/mikeisflux/streamlick.git
cd streamlick

# Install dependencies
npm install

# Build media server
npm run build --workspace=media-server

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)

# Configure media server
cat > media-server/.env <<EOF
PORT=3001
NODE_ENV=production
MEDIASOUP_ANNOUNCED_IP=$PUBLIC_IP
MEDIASOUP_LISTEN_IP=0.0.0.0
RTC_MIN_PORT=40000
RTC_MAX_PORT=40100
EOF

# Start media server
pm2 start npm --name "streamlick-media" -- run start --workspace=media-server

# Save PM2 configuration
pm2 save
pm2 startup systemd -u root --hp /root

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 3001/tcp
ufw allow 40000:40100/udp
ufw --force enable

echo "✅ Media server deployed successfully"
`;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: number): Promise<void> {
    try {
      const client = this.getClient();
      await client.delete(`/servers/${serverId}`);
      logger.info(`Server deleted: ${serverId}`);
    } catch (error: any) {
      logger.error('Failed to delete server:', error);
      throw new Error(`Delete failed: ${error.message}`);
    }
  }

  /**
   * Get server types and pricing
   */
  async getServerTypes() {
    try {
      const client = this.getClient();
      const response = await client.get('/server_types');

      // Filter to only CCX types (dedicated CPU for media servers)
      const ccxTypes = response.data.server_types.filter((type: any) =>
        type.name.startsWith('ccx')
      );

      return ccxTypes.map((type: any) => ({
        name: type.name.toUpperCase(),
        cores: type.cores,
        memory: type.memory,
        disk: type.disk,
        price: type.prices[0]?.price_monthly?.gross,
        description: type.description,
      }));
    } catch (error: any) {
      logger.error('Failed to get server types:', error);
      throw new Error(`Failed to get server types: ${error.message}`);
    }
  }

  /**
   * Get available locations
   */
  async getLocations() {
    try {
      const client = this.getClient();
      const response = await client.get('/locations');

      return response.data.locations.map((loc: any) => ({
        id: loc.name,
        name: loc.city,
        country: loc.country,
        description: loc.description,
      }));
    } catch (error: any) {
      logger.error('Failed to get locations:', error);
      throw new Error(`Failed to get locations: ${error.message}`);
    }
  }

  /**
   * Get SSH keys
   */
  async getSSHKeys() {
    try {
      const client = this.getClient();
      const response = await client.get('/ssh_keys');

      return response.data.ssh_keys.map((key: any) => ({
        id: key.id,
        name: key.name,
        fingerprint: key.fingerprint,
      }));
    } catch (error: any) {
      logger.error('Failed to get SSH keys:', error);
      return [];
    }
  }
}

export const hetznerService = new HetznerService();
