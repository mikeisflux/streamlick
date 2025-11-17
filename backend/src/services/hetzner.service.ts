/**
 * Hetzner Cloud API Service
 * Automates server provisioning for media servers
 */

import axios from 'axios';
import logger from '../utils/logger';
import prisma from '../database/prisma';
import { decrypt } from '../utils/crypto';

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
  private baseURL = 'https://api.hetzner.cloud/v1';

  /**
   * Get API key from database or environment variable
   */
  private async getApiKey(): Promise<string> {
    // First, try to load from database (Admin Settings)
    try {
      const setting = await prisma.systemSetting.findUnique({
        where: {
          category_key: {
            category: 'system',
            key: 'hetzner_api_key',
          },
        },
      });

      if (setting) {
        const apiKey = setting.isEncrypted ? decrypt(setting.value) : setting.value;
        if (apiKey) {
          logger.debug('Loaded Hetzner API key from database');
          return apiKey;
        }
      }
    } catch (error) {
      logger.warn('Failed to load Hetzner API key from database:', error);
    }

    // Fall back to environment variable
    if (process.env.HETZNER_API_KEY) {
      logger.debug('Loaded Hetzner API key from environment variable');
      return process.env.HETZNER_API_KEY;
    }

    throw new Error('Hetzner API key not configured. Add hetzner_api_key in Admin Settings → System Config.');
  }

  /**
   * Check if Hetzner API is configured
   */
  async isConfigured(): Promise<boolean> {
    try {
      const apiKey = await this.getApiKey();
      return !!apiKey;
    } catch {
      return false;
    }
  }

  /**
   * Get API client with auth
   */
  private async getClient() {
    const apiKey = await this.getApiKey();

    if (!apiKey) {
      logger.error('Hetzner API key not configured.');
      throw new Error('Hetzner API key not configured. Add HETZNER_API_KEY to Admin Settings.');
    }

    logger.debug('Creating Hetzner API client', {
      baseURL: this.baseURL,
      keyPrefix: apiKey.substring(0, 20) + '...',
    });

    return axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * List all servers
   */
  async listServers(): Promise<HetznerServer[]> {
    try {
      const client = await this.getClient();
      const response = await client.get('/servers');
      return response.data.servers;
    } catch (error: any) {
      logger.error('Failed to list Hetzner servers:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      // Provide more specific error messages
      if (error.response?.status === 401) {
        throw new Error('Hetzner API authentication failed. Please check your API key.');
      } else if (error.response?.status === 403) {
        throw new Error('Hetzner API access forbidden. Your API key may not have the required permissions.');
      } else if (error.response?.data?.error) {
        throw new Error(`Hetzner API error: ${error.response.data.error.message || error.response.data.error}`);
      }

      throw new Error(`Failed to connect to Hetzner API: ${error.message}`);
    }
  }

  /**
   * Deploy a server with specific role (automated deployment)
   */
  async deployServer(options: {
    name: string;
    serverType: string; // CCX13, CCX23, CCX33, CPX32, etc.
    location: string; // nbg1, fsn1, hel1, ash
    role: 'media-server' | 'api-server' | 'frontend-server' | 'load-balancer' | 'database-server' | 'redis-server';
    sshKeys?: number[];
    // Configuration options
    backendUrl?: string; // For media/frontend servers to connect to API
    apiUrl?: string; // Frontend API URL
    mediaServerUrl?: string; // Frontend media server URL
    frontendUrl?: string; // API server CORS/frontend URL
    databaseUrl?: string; // For API servers connecting to shared DB
    redisUrl?: string; // For API servers connecting to shared Redis
    upstreamServers?: string[]; // For load balancer configuration
    domain?: string; // Domain name for SSL/Nginx config
  }): Promise<HetznerServer> {
    try {
      const client = await this.getClient();

      logger.info(`Deploying ${options.role}: ${options.name} (${options.serverType}) in ${options.location}`);

      // Get role-specific cloud-init script
      const cloudInitScript = this.getCloudInitScript(options.role, options);

      // Create server
      const response = await client.post('/servers', {
        name: options.name,
        server_type: options.serverType.toLowerCase(),
        location: options.location,
        image: 'ubuntu-22.04',
        ssh_keys: options.sshKeys || [],
        start_after_create: true,
        user_data: cloudInitScript,
      });

      const server: HetznerServer = response.data.server;

      logger.info(`Server created: ${server.name} (${server.public_net.ipv4.ip})`);

      return server;
    } catch (error: any) {
      logger.error(`Failed to deploy ${options.role}:`, error);
      throw new Error(`Deployment failed: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Legacy method for backward compatibility
   */
  async deployMediaServer(options: {
    name: string;
    serverType: string;
    location: string;
    sshKeys?: number[];
  }): Promise<HetznerServer> {
    return this.deployServer({
      ...options,
      role: 'media-server',
    });
  }

  /**
   * Get cloud-init script for automated setup based on role
   */
  private getCloudInitScript(
    role: 'media-server' | 'api-server' | 'frontend-server' | 'load-balancer' | 'database-server' | 'redis-server',
    options: any
  ): string {
    switch (role) {
      case 'media-server':
        return this.getMediaServerScript();
      case 'api-server':
        return this.getApiServerScript({
          databaseUrl: options.databaseUrl,
          redisUrl: options.redisUrl,
          frontendUrl: options.frontendUrl,
        });
      case 'frontend-server':
        return this.getFrontendServerScript({
          apiUrl: options.apiUrl,
          mediaServerUrl: options.mediaServerUrl,
          domain: options.domain,
        });
      case 'load-balancer':
        return this.getLoadBalancerScript({
          upstreamServers: options.upstreamServers || [],
          domain: options.domain,
        });
      case 'database-server':
        return this.getDatabaseServerScript();
      case 'redis-server':
        return this.getRedisServerScript();
      default:
        throw new Error(`Unknown server role: ${role}`);
    }
  }

  /**
   * Media Server cloud-init script
   */
  private getMediaServerScript(): string {
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

# Install dependencies (root only)
npm install

# Build ONLY media-server workspace
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
   * API Server cloud-init script
   */
  private getApiServerScript(options: {
    databaseUrl?: string;
    redisUrl?: string;
    frontendUrl?: string;
  }): string {
    // Use provided URLs or default to localhost (will create local DB/Redis)
    const dbUrl = options.databaseUrl || 'postgresql://streamlick:streamlick_prod_password@localhost:5432/streamlick_prod';
    const redisUrl = options.redisUrl || 'redis://localhost:6379';
    const frontendUrl = options.frontendUrl || 'https://streamlick.yourdomain.com';

    // Determine if we need to install DB/Redis locally
    const needsLocalDB = !options.databaseUrl || options.databaseUrl.includes('localhost');
    const needsLocalRedis = !options.redisUrl || options.redisUrl.includes('localhost');

    let dbInstall = '';
    if (needsLocalDB) {
      dbInstall = `
# Install PostgreSQL 16
apt-get install -y wget
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-16

# Configure PostgreSQL
sudo -u postgres psql -c "CREATE USER streamlick WITH PASSWORD 'streamlick_prod_password';"
sudo -u postgres psql -c "CREATE DATABASE streamlick_prod OWNER streamlick;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE streamlick_prod TO streamlick;"
`;
    }

    let redisInstall = '';
    if (needsLocalRedis) {
      redisInstall = `
# Install Redis
apt-get install -y redis-server
systemctl enable redis-server
systemctl start redis-server
`;
    }

    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2 and Git
npm install -g pm2
apt-get install -y git
${dbInstall}${redisInstall}
# Clone repository
cd /root
git clone https://github.com/mikeisflux/streamlick.git
cd streamlick

# Install dependencies
npm install

# Build ONLY backend workspace
npm run build --workspace=backend

# Get public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/hetzner/v1/metadata/public-ipv4)

# Configure backend
cat > backend/.env <<EOF
DATABASE_URL="${dbUrl}"
REDIS_URL="${redisUrl}"
JWT_SECRET="$(openssl rand -hex 32)"
ENCRYPTION_KEY="$(openssl rand -base64 32)"
PORT=3000
NODE_ENV=production
FRONTEND_URL=${frontendUrl}
CORS_ORIGINS="${frontendUrl}"
EOF

# Run database migrations (only if using local DB)
cd backend
${needsLocalDB ? 'npx prisma migrate deploy' : '# Using shared database, migrations should be run centrally'}
npx prisma generate

# Start backend
cd ..
pm2 start npm --name "streamlick-backend" -- run start:prod --workspace=backend

# Save PM2 configuration
pm2 save
pm2 startup systemd -u root --hp /root

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 3000/tcp
${needsLocalDB ? 'ufw allow 5432/tcp' : ''}
ufw --force enable

echo "✅ API server deployed successfully on $PUBLIC_IP"
echo "   Database: ${dbUrl}"
echo "   Redis: ${redisUrl}"
echo "   Frontend: ${frontendUrl}"
`;
  }

  /**
   * Frontend Server cloud-init script
   */
  private getFrontendServerScript(options: {
    apiUrl?: string;
    mediaServerUrl?: string;
    domain?: string;
  }): string {
    const apiUrl = options.apiUrl || 'https://api.yourdomain.com';
    const mediaServerUrl = options.mediaServerUrl || 'https://media.yourdomain.com';
    const domain = options.domain || '_';

    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PM2, Git, and Nginx
npm install -g pm2
apt-get install -y git nginx

# Clone repository
cd /root
git clone https://github.com/mikeisflux/streamlick.git
cd streamlick

# Install dependencies
npm install

# Configure frontend
cat > frontend/.env <<EOF
VITE_API_URL=${apiUrl}
VITE_MEDIA_SERVER_URL=${mediaServerUrl}
VITE_SOCKET_URL=${apiUrl}
VITE_NODE_ENV=production
EOF

# Build ONLY frontend workspace
npm run build --workspace=frontend

# Configure Nginx to serve built frontend
cat > /etc/nginx/sites-available/streamlick <<NGINX_EOF
server {
    listen 80;
    server_name ${domain};

    root /root/streamlick/frontend/dist;
    index index.html;

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    # Gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/streamlick /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl enable nginx
systemctl restart nginx

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✅ Frontend server deployed successfully"
`;
  }

  /**
   * Load Balancer cloud-init script
   */
  private getLoadBalancerScript(options: {
    upstreamServers?: string[];
    domain?: string;
  }): string {
    const upstreamServers = options.upstreamServers || [];
    const apiDomain = options.domain ? `api.${options.domain}` : 'api.yourdomain.com';
    const mediaDomain = options.domain ? `media.${options.domain}` : 'media.yourdomain.com';

    // Generate upstream server list for Nginx
    const upstreamConfig = upstreamServers.length > 0
      ? upstreamServers.map(server => `        server ${server};`).join('\n')
      : '        server 127.0.0.1:3000;  # Replace with actual backend servers';

    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Nginx
apt-get install -y nginx

# Configure Nginx as load balancer
cat > /etc/nginx/sites-available/streamlick-lb <<NGINX_EOF
# Upstream backend API servers
upstream backend_servers {
    least_conn;  # Use least connections load balancing
${upstreamConfig}

    # Health checks
    keepalive 32;
}

# Upstream media servers
upstream media_servers {
    least_conn;
    # Add media servers here manually or via API
    # server media1.yourdomain.com:3001;
    # server media2.yourdomain.com:3001;

    keepalive 32;
}

# Main API load balancer
server {
    listen 80;
    server_name ${apiDomain};

    location / {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # WebSocket support
    location /socket.io {
        proxy_pass http://backend_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host \$host;
    }
}

# Media server load balancer
server {
    listen 80;
    server_name ${mediaDomain};

    location / {
        proxy_pass http://media_servers;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
    }
}
NGINX_EOF

ln -sf /etc/nginx/sites-available/streamlick-lb /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test and reload Nginx
nginx -t
systemctl enable nginx
systemctl restart nginx

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

echo "✅ Load balancer deployed successfully"
echo "   API Domain: ${apiDomain}"
echo "   Media Domain: ${mediaDomain}"
echo "⚠️  Remember to:"
echo "   1. Update upstream server IPs in /etc/nginx/sites-available/streamlick-lb"
echo "   2. Install SSL certificates with: certbot --nginx -d ${apiDomain} -d ${mediaDomain}"
`;
  }

  /**
   * Database Server cloud-init script
   */
  private getDatabaseServerScript(): string {
    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install PostgreSQL 16
apt-get install -y wget
wget --quiet -O - https://www.postgresql.org/media/keys/ACCC4CF8.asc | apt-key add -
echo "deb http://apt.postgresql.org/pub/repos/apt jammy-pgdg main" > /etc/apt/sources.list.d/pgdg.list
apt-get update
apt-get install -y postgresql-16

# Configure PostgreSQL for remote connections
sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/" /etc/postgresql/16/main/postgresql.conf

# Allow connections from any IP (update this for production!)
echo "host    all             all             0.0.0.0/0               md5" >> /etc/postgresql/16/main/pg_hba.conf

# Restart PostgreSQL
systemctl restart postgresql

# Create database and user
sudo -u postgres psql -c "CREATE USER streamlick WITH PASSWORD 'streamlick_prod_password';"
sudo -u postgres psql -c "CREATE DATABASE streamlick_prod OWNER streamlick;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE streamlick_prod TO streamlick;"

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 5432/tcp
ufw --force enable

echo "✅ Database server deployed successfully"
echo "⚠️  Remember to change the default password and restrict IP access!"
`;
  }

  /**
   * Redis Server cloud-init script
   */
  private getRedisServerScript(): string {
    return `#!/bin/bash
set -e

# Update system
apt-get update
apt-get upgrade -y

# Install Redis
apt-get install -y redis-server

# Configure Redis for remote connections
sed -i 's/bind 127.0.0.1 ::1/bind 0.0.0.0/' /etc/redis/redis.conf
sed -i 's/protected-mode yes/protected-mode no/' /etc/redis/redis.conf

# Set password (update this for production!)
echo "requirepass streamlick_redis_password" >> /etc/redis/redis.conf

# Restart Redis
systemctl enable redis-server
systemctl restart redis-server

# Configure UFW firewall
ufw allow 22/tcp
ufw allow 6379/tcp
ufw --force enable

echo "✅ Redis server deployed successfully"
echo "⚠️  Remember to change the default password!"
`;
  }

  /**
   * Delete a server
   */
  async deleteServer(serverId: number): Promise<void> {
    try {
      const client = await this.getClient();
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
      const client = await this.getClient();
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
      const client = await this.getClient();
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
      const client = await this.getClient();
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

  /**
   * Update server labels (e.g., to assign role)
   */
  async updateServerLabels(serverId: number, labels: Record<string, string>): Promise<void> {
    try {
      const client = await this.getClient();
      await client.put(`/servers/${serverId}`, {
        labels,
      });
      logger.info(`Updated server ${serverId} labels:`, labels);
    } catch (error: any) {
      logger.error('Failed to update server labels:', error);
      throw new Error(`Failed to update labels: ${error.response?.data?.error?.message || error.message}`);
    }
  }
}

export const hetznerService = new HetznerService();
