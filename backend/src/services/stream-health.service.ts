import { EventEmitter } from 'events';
import logger from '../utils/logger';

export interface StreamHealthMetrics {
  broadcastId: string;
  status: 'idle' | 'starting' | 'live' | 'ending' | 'error';
  uptime: number; // seconds
  bitrate: number; // kbps
  framerate: number; // fps
  droppedFrames: number;
  totalFrames: number;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  destinations: DestinationHealth[];
  timestamp: Date;
}

export interface DestinationHealth {
  id: string;
  platform: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  bitrate: number;
  rtt: number; // Round-trip time in ms
  packetLoss: number; // Percentage
  errorCount: number;
  lastError?: string;
}

/**
 * Stream Health Monitoring Service
 * Tracks real-time metrics for active broadcasts
 */
export class StreamHealthMonitor extends EventEmitter {
  private metrics: Map<string, StreamHealthMetrics> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private startTimes: Map<string, number> = new Map();

  /**
   * Start monitoring a broadcast
   */
  startMonitoring(broadcastId: string): void {
    if (this.monitoringIntervals.has(broadcastId)) {
      logger.warn(`Already monitoring broadcast ${broadcastId}`);
      return;
    }

    logger.info(`Starting health monitoring for broadcast ${broadcastId}`);

    this.startTimes.set(broadcastId, Date.now());

    // Initialize metrics
    const initialMetrics: StreamHealthMetrics = {
      broadcastId,
      status: 'starting',
      uptime: 0,
      bitrate: 0,
      framerate: 0,
      droppedFrames: 0,
      totalFrames: 0,
      networkQuality: 'good',
      destinations: [],
      timestamp: new Date(),
    };

    this.metrics.set(broadcastId, initialMetrics);

    // Update metrics every 2 seconds
    const interval = setInterval(() => {
      this.updateMetrics(broadcastId);
    }, 2000);

    this.monitoringIntervals.set(broadcastId, interval);
  }

  /**
   * Stop monitoring a broadcast
   */
  stopMonitoring(broadcastId: string): void {
    const interval = this.monitoringIntervals.get(broadcastId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(broadcastId);
    }

    this.metrics.delete(broadcastId);
    this.startTimes.delete(broadcastId);

    logger.info(`Stopped health monitoring for broadcast ${broadcastId}`);
  }

  /**
   * Get current metrics for a broadcast
   */
  getMetrics(broadcastId: string): StreamHealthMetrics | null {
    return this.metrics.get(broadcastId) || null;
  }

  /**
   * Update broadcast status
   */
  updateStatus(broadcastId: string, status: StreamHealthMetrics['status']): void {
    const metrics = this.metrics.get(broadcastId);
    if (metrics) {
      metrics.status = status;
      metrics.timestamp = new Date();
      this.emit('metrics-updated', metrics);
    }
  }

  /**
   * Update destination health
   */
  updateDestination(
    broadcastId: string,
    destinationId: string,
    health: Partial<DestinationHealth>
  ): void {
    const metrics = this.metrics.get(broadcastId);
    if (!metrics) return;

    let destination = metrics.destinations.find((d) => d.id === destinationId);

    if (!destination) {
      destination = {
        id: destinationId,
        platform: health.platform || 'unknown',
        status: 'connecting',
        bitrate: 0,
        rtt: 0,
        packetLoss: 0,
        errorCount: 0,
      };
      metrics.destinations.push(destination);
    }

    Object.assign(destination, health);
    metrics.timestamp = new Date();

    this.emit('metrics-updated', metrics);
  }

  /**
   * Record a dropped frame
   */
  recordDroppedFrame(broadcastId: string): void {
    const metrics = this.metrics.get(broadcastId);
    if (metrics) {
      metrics.droppedFrames++;
      metrics.totalFrames++;
    }
  }

  /**
   * Record a successful frame
   */
  recordFrame(broadcastId: string): void {
    const metrics = this.metrics.get(broadcastId);
    if (metrics) {
      metrics.totalFrames++;
    }
  }

  /**
   * Update stream bitrate
   */
  updateBitrate(broadcastId: string, bitrate: number): void {
    const metrics = this.metrics.get(broadcastId);
    if (metrics) {
      metrics.bitrate = bitrate;
      metrics.timestamp = new Date();
    }
  }

  /**
   * Update stream framerate
   */
  updateFramerate(broadcastId: string, framerate: number): void {
    const metrics = this.metrics.get(broadcastId);
    if (metrics) {
      metrics.framerate = framerate;
      metrics.timestamp = new Date();
    }
  }

  /**
   * Record destination error
   */
  recordError(broadcastId: string, destinationId: string, error: string): void {
    const metrics = this.metrics.get(broadcastId);
    if (!metrics) return;

    const destination = metrics.destinations.find((d) => d.id === destinationId);
    if (destination) {
      destination.errorCount++;
      destination.lastError = error;
      destination.status = 'error';
      metrics.timestamp = new Date();

      this.emit('metrics-updated', metrics);
    }
  }

  /**
   * Update metrics (called periodically)
   */
  private updateMetrics(broadcastId: string): void {
    const metrics = this.metrics.get(broadcastId);
    if (!metrics) return;

    // Calculate uptime
    const startTime = this.startTimes.get(broadcastId);
    if (startTime) {
      metrics.uptime = Math.floor((Date.now() - startTime) / 1000);
    }

    // Calculate network quality based on metrics
    metrics.networkQuality = this.calculateNetworkQuality(metrics);

    metrics.timestamp = new Date();

    // Emit updated metrics
    this.emit('metrics-updated', metrics);
  }

  /**
   * Calculate overall network quality
   */
  private calculateNetworkQuality(
    metrics: StreamHealthMetrics
  ): StreamHealthMetrics['networkQuality'] {
    // If no destinations, assume good
    if (metrics.destinations.length === 0) {
      return 'good';
    }

    // Calculate average packet loss
    const avgPacketLoss =
      metrics.destinations.reduce((sum, d) => sum + d.packetLoss, 0) /
      metrics.destinations.length;

    // Calculate average RTT
    const avgRtt =
      metrics.destinations.reduce((sum, d) => sum + d.rtt, 0) / metrics.destinations.length;

    // Calculate drop rate
    const dropRate =
      metrics.totalFrames > 0 ? metrics.droppedFrames / metrics.totalFrames : 0;

    // Count error destinations
    const errorCount = metrics.destinations.filter((d) => d.status === 'error').length;

    // Determine quality
    if (errorCount > 0 || avgPacketLoss > 10 || dropRate > 0.1) {
      return 'critical';
    } else if (avgPacketLoss > 5 || avgRtt > 300 || dropRate > 0.05) {
      return 'poor';
    } else if (avgPacketLoss > 2 || avgRtt > 200 || dropRate > 0.02) {
      return 'fair';
    } else if (avgPacketLoss > 0.5 || avgRtt > 100) {
      return 'good';
    } else {
      return 'excellent';
    }
  }

  /**
   * Get all active monitoring sessions
   */
  getActiveBroadcasts(): string[] {
    return Array.from(this.metrics.keys());
  }

  /**
   * Get summary of all active broadcasts
   */
  getAllMetrics(): StreamHealthMetrics[] {
    return Array.from(this.metrics.values());
  }
}

// Export singleton instance
export const streamHealthMonitor = new StreamHealthMonitor();
