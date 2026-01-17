/**
 * Broadcast Output Manager
 *
 * Coordinates streaming to multiple platforms using the appropriate method:
 * - WHIP for platforms that support it (YouTube, Twitch)
 * - RTMP relay for platforms that don't (Facebook, LinkedIn, TikTok, X)
 *
 * This is the main interface for the broadcast system. It takes the canvas
 * output stream and sends it to all configured destinations.
 */
import { whipStreamingService } from './whip-streaming.service';
import { rtmpRelayService } from './rtmp-relay.service';
import { canvasStreamService } from './canvas-stream.service';
import logger from '../utils/logger';

export interface BroadcastDestination {
  id: string;
  platform: string;
  rtmpUrl: string;
  streamKey: string;
  whipUrl?: string;
  bearerToken?: string;
}

interface DestinationStatus {
  id: string;
  platform: string;
  status: 'pending' | 'connecting' | 'connected' | 'failed' | 'stopped';
  method: 'whip' | 'rtmp-relay';
  error?: string;
}

type StatusCallback = (statuses: DestinationStatus[]) => void;

class BroadcastOutputService {
  private destinations: Map<string, BroadcastDestination> = new Map();
  private statuses: Map<string, DestinationStatus> = new Map();
  private statusCallback: StatusCallback | null = null;
  private canvasStream: MediaStream | null = null;
  private isStreaming: boolean = false;

  /**
   * Initialize with canvas stream
   */
  initialize(stream: MediaStream): void {
    this.canvasStream = stream;
    whipStreamingService.setCanvasStream(stream);
    rtmpRelayService.setCanvasStream(stream);
    logger.info('[BroadcastOutput] Initialized with canvas stream');
  }

  /**
   * Set callback for status updates
   */
  onStatusChange(callback: StatusCallback): void {
    this.statusCallback = callback;
  }

  /**
   * Add a destination to broadcast to
   */
  addDestination(destination: BroadcastDestination): void {
    this.destinations.set(destination.id, destination);

    // Initialize status
    const method = whipStreamingService.supportsWHIP(destination.platform) ? 'whip' : 'rtmp-relay';
    this.statuses.set(destination.id, {
      id: destination.id,
      platform: destination.platform,
      status: 'pending',
      method,
    });

    this.notifyStatusChange();
    logger.info(`[BroadcastOutput] Added destination: ${destination.platform} (${method})`);
  }

  /**
   * Remove a destination
   */
  async removeDestination(destinationId: string): Promise<void> {
    const destination = this.destinations.get(destinationId);
    if (!destination) return;

    // Stop streaming if active
    const status = this.statuses.get(destinationId);
    if (status?.status === 'connected') {
      if (status.method === 'whip') {
        await whipStreamingService.stopStreaming(destination.platform);
      } else {
        await rtmpRelayService.stopRelay(destinationId);
      }
    }

    this.destinations.delete(destinationId);
    this.statuses.delete(destinationId);
    this.notifyStatusChange();

    logger.info(`[BroadcastOutput] Removed destination: ${destination.platform}`);
  }

  /**
   * Start broadcasting to all destinations
   */
  async startAll(): Promise<{ success: boolean; failed: string[] }> {
    if (!this.canvasStream) {
      // Try to get stream from canvas stream service
      const stream = canvasStreamService.getOutputStream();
      if (stream) {
        this.initialize(stream);
      } else {
        logger.error('[BroadcastOutput] No canvas stream available');
        return { success: false, failed: Array.from(this.destinations.keys()) };
      }
    }

    const failed: string[] = [];
    this.isStreaming = true;

    for (const [id, destination] of this.destinations) {
      const status = this.statuses.get(id)!;
      status.status = 'connecting';
      this.notifyStatusChange();

      try {
        let success = false;

        if (status.method === 'whip') {
          // Use WHIP for supported platforms
          const whipUrl = destination.whipUrl ||
            whipStreamingService.getWHIPUrl(destination.platform, destination.streamKey);

          if (whipUrl) {
            success = await whipStreamingService.startStreaming({
              platform: destination.platform,
              whipUrl,
              bearerToken: destination.bearerToken,
            });
          }
        } else {
          // Use RTMP relay for other platforms
          success = await rtmpRelayService.startRelay({
            id: destination.id,
            platform: destination.platform,
            rtmpUrl: destination.rtmpUrl,
            streamKey: destination.streamKey,
          });
        }

        if (success) {
          status.status = 'connected';
          logger.info(`[BroadcastOutput] Connected to ${destination.platform}`);
        } else {
          status.status = 'failed';
          status.error = 'Connection failed';
          failed.push(id);
          logger.error(`[BroadcastOutput] Failed to connect to ${destination.platform}`);
        }
      } catch (error: any) {
        status.status = 'failed';
        status.error = error.message;
        failed.push(id);
        logger.error(`[BroadcastOutput] Error connecting to ${destination.platform}:`, error);
      }

      this.notifyStatusChange();
    }

    return {
      success: failed.length === 0,
      failed,
    };
  }

  /**
   * Stop broadcasting to all destinations
   */
  async stopAll(): Promise<void> {
    this.isStreaming = false;

    // Stop all WHIP sessions
    await whipStreamingService.stopAll();

    // Stop all RTMP relay sessions
    await rtmpRelayService.stopAll();

    // Update all statuses
    for (const [id, status] of this.statuses) {
      status.status = 'stopped';
    }

    this.notifyStatusChange();
    logger.info('[BroadcastOutput] All broadcasts stopped');
  }

  /**
   * Stop a specific destination
   */
  async stopDestination(destinationId: string): Promise<void> {
    const destination = this.destinations.get(destinationId);
    const status = this.statuses.get(destinationId);

    if (!destination || !status) return;

    if (status.method === 'whip') {
      await whipStreamingService.stopStreaming(destination.platform);
    } else {
      await rtmpRelayService.stopRelay(destinationId);
    }

    status.status = 'stopped';
    this.notifyStatusChange();

    logger.info(`[BroadcastOutput] Stopped streaming to ${destination.platform}`);
  }

  /**
   * Get all destination statuses
   */
  getStatuses(): DestinationStatus[] {
    return Array.from(this.statuses.values());
  }

  /**
   * Get specific destination status
   */
  getStatus(destinationId: string): DestinationStatus | undefined {
    return this.statuses.get(destinationId);
  }

  /**
   * Check if currently streaming
   */
  getIsStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Check if a specific destination is connected
   */
  isConnected(destinationId: string): boolean {
    return this.statuses.get(destinationId)?.status === 'connected';
  }

  /**
   * Get count of connected destinations
   */
  getConnectedCount(): number {
    return Array.from(this.statuses.values()).filter(s => s.status === 'connected').length;
  }

  /**
   * Notify status change callback
   */
  private notifyStatusChange(): void {
    if (this.statusCallback) {
      this.statusCallback(this.getStatuses());
    }
  }

  /**
   * Clean up
   */
  cleanup(): void {
    this.destinations.clear();
    this.statuses.clear();
    this.canvasStream = null;
    this.isStreaming = false;
    this.statusCallback = null;
  }
}

export const broadcastOutputService = new BroadcastOutputService();
