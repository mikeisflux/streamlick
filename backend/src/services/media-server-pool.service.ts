/**
 * Media Server Pool Service
 * Manages multiple media servers for horizontal scaling
 *
 * Usage:
 * - Automatically selects best server for new streams
 * - Health checks all servers
 * - Removes failed servers from pool
 * - Supports round-robin or load-based selection
 */

import axios from 'axios';
import logger from '../utils/logger';

export interface MediaServer {
  id: string;
  url: string;
  ip: string;
  isHealthy: boolean;
  activeStreams: number;
  cpuUsage: number;
  memoryUsage: number;
  lastHealthCheck: Date;
}

export interface MediaServerStats {
  activeStreams: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number;
}

class MediaServerPool {
  private servers: Map<string, MediaServer> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private currentIndex = 0;

  constructor() {
    this.initializeFromEnv();
    this.startHealthChecks();
  }

  /**
   * Initialize servers from environment variable
   * MEDIA_SERVERS=http://server1:3001,http://server2:3001,http://server3:3001
   */
  private initializeFromEnv() {
    const serversEnv = process.env.MEDIA_SERVERS || '';

    // If no servers configured, start with empty pool
    if (!serversEnv || serversEnv.trim() === '') {
      logger.warn('No media servers configured in MEDIA_SERVERS environment variable. Pool starting empty. Add servers via admin panel or set MEDIA_SERVERS environment variable.');
      return;
    }

    const serverUrls = serversEnv.split(',').map(s => s.trim()).filter(s => s);

    serverUrls.forEach((url, index) => {
      const serverId = `media-server-${index + 1}`;
      const ip = new URL(url).hostname;

      this.servers.set(serverId, {
        id: serverId,
        url,
        ip,
        isHealthy: true,
        activeStreams: 0,
        cpuUsage: 0,
        memoryUsage: 0,
        lastHealthCheck: new Date(),
      });

    });

  }

  /**
   * Add a new media server to the pool (hot-add, no restart needed)
   */
  addServer(url: string): string {
    const serverId = `media-server-${this.servers.size + 1}`;
    const ip = new URL(url).hostname;

    this.servers.set(serverId, {
      id: serverId,
      url,
      ip,
      isHealthy: true,
      activeStreams: 0,
      cpuUsage: 0,
      memoryUsage: 0,
      lastHealthCheck: new Date(),
    });

    return serverId;
  }

  /**
   * Remove a media server from the pool
   */
  removeServer(serverId: string): boolean {
    const removed = this.servers.delete(serverId);
    if (removed) {
    }
    return removed;
  }

  /**
   * Select best server for new stream
   * Strategy: Least connections (server with fewest active streams)
   */
  selectServer(): MediaServer | null {
    const healthyServers = Array.from(this.servers.values()).filter(
      s => s.isHealthy
    );

    if (healthyServers.length === 0) {
      logger.error('No healthy media servers available!');
      return null;
    }

    // Sort by active streams (ascending)
    healthyServers.sort((a, b) => a.activeStreams - b.activeStreams);

    const selected = healthyServers[0];

    return selected;
  }

  /**
   * Round-robin server selection (simpler, but less optimal)
   */
  selectServerRoundRobin(): MediaServer | null {
    const healthyServers = Array.from(this.servers.values()).filter(
      s => s.isHealthy
    );

    if (healthyServers.length === 0) {
      return null;
    }

    const selected = healthyServers[this.currentIndex % healthyServers.length];
    this.currentIndex++;

    return selected;
  }

  /**
   * Get all servers in pool
   */
  getAllServers(): MediaServer[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get healthy servers only
   */
  getHealthyServers(): MediaServer[] {
    return Array.from(this.servers.values()).filter(s => s.isHealthy);
  }

  /**
   * Get specific server by ID
   */
  getServer(serverId: string): MediaServer | undefined {
    return this.servers.get(serverId);
  }

  /**
   * Start periodic health checks (every 10 seconds)
   */
  private startHealthChecks() {
    this.healthCheckInterval = setInterval(async () => {
      await this.checkAllServers();
    }, 10000); // 10 seconds

  }

  /**
   * Stop health checks
   */
  stopHealthChecks() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
  }

  /**
   * Check health of all servers
   */
  private async checkAllServers() {
    const checks = Array.from(this.servers.values()).map(server =>
      this.checkServerHealth(server)
    );

    await Promise.all(checks);
  }

  /**
   * Check health of individual server
   */
  private async checkServerHealth(server: MediaServer) {
    // Create abort controller for proper timeout cleanup
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => abortController.abort(), 5000);

    try {
      const response = await axios.get(`${server.url}/health`, {
        timeout: 5000,
        signal: abortController.signal,
      });

      clearTimeout(timeoutId);

      if (response.status === 200) {
        const stats: MediaServerStats = response.data;

        // Update server stats
        server.isHealthy = true;
        server.activeStreams = stats.activeStreams || 0;
        server.cpuUsage = stats.cpuUsage || 0;
        server.memoryUsage = stats.memoryUsage || 0;
        server.lastHealthCheck = new Date();

        // Log if server is overloaded
        if (stats.activeStreams > 20) {
          logger.warn(
            `${server.id} is overloaded: ${stats.activeStreams} streams, ${stats.cpuUsage}% CPU`
          );
        }
      }
    } catch (error: any) {
      // Clear timeout on error
      clearTimeout(timeoutId);

      // Mark server as unhealthy
      if (server.isHealthy) {
        logger.error(`${server.id} health check failed: ${error.message}`);
      }
      server.isHealthy = false;
      server.lastHealthCheck = new Date();
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    const allServers = Array.from(this.servers.values());
    const healthyServers = allServers.filter(s => s.isHealthy);

    return {
      totalServers: allServers.length,
      healthyServers: healthyServers.length,
      unhealthyServers: allServers.length - healthyServers.length,
      totalActiveStreams: healthyServers.reduce(
        (sum, s) => sum + s.activeStreams,
        0
      ),
      averageCpuUsage:
        healthyServers.reduce((sum, s) => sum + s.cpuUsage, 0) /
          healthyServers.length || 0,
      averageMemoryUsage:
        healthyServers.reduce((sum, s) => sum + s.memoryUsage, 0) /
          healthyServers.length || 0,
      servers: allServers,
    };
  }

  /**
   * Check if pool has capacity for new stream
   */
  hasCapacity(): boolean {
    const bestServer = this.selectServer();
    if (!bestServer) return false;

    // Each server can handle ~25 streams max
    return bestServer.activeStreams < 25;
  }

  /**
   * Get recommended action based on current load
   */
  getScalingRecommendation(): {
    action: 'none' | 'warning' | 'scale_up';
    message: string;
  } {
    const stats = this.getPoolStats();

    if (stats.healthyServers === 0) {
      return {
        action: 'scale_up',
        message: 'CRITICAL: No healthy servers available!',
      };
    }

    const avgStreamsPerServer = stats.totalActiveStreams / stats.healthyServers;
    const avgCpu = stats.averageCpuUsage;

    if (avgStreamsPerServer > 20 || avgCpu > 80) {
      return {
        action: 'scale_up',
        message: `HIGH LOAD: Add media server (${avgStreamsPerServer.toFixed(1)} streams/server, ${avgCpu.toFixed(1)}% CPU)`,
      };
    }

    if (avgStreamsPerServer > 15 || avgCpu > 70) {
      return {
        action: 'warning',
        message: `MODERATE LOAD: Consider adding server soon (${avgStreamsPerServer.toFixed(1)} streams/server, ${avgCpu.toFixed(1)}% CPU)`,
      };
    }

    return {
      action: 'none',
      message: `Capacity OK (${avgStreamsPerServer.toFixed(1)} streams/server, ${avgCpu.toFixed(1)}% CPU)`,
    };
  }
}

// Export singleton instance
export const mediaServerPool = new MediaServerPool();

// Graceful shutdown
process.on('SIGTERM', () => {
  mediaServerPool.stopHealthChecks();
});
