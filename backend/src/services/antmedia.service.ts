/**
 * Ant Media Server REST API Service
 *
 * Handles communication with Ant Media Server for:
 * - Broadcast management
 * - RTMP endpoint management
 * - Stream health monitoring
 */
import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';

const ANT_MEDIA_SERVER_URL = process.env.ANT_MEDIA_SERVER_URL || 'https://media.streamlick.com:5443';
const ANT_MEDIA_APP_NAME = process.env.ANT_MEDIA_APP_NAME || 'StreamLick';

interface AntMediaBroadcast {
  streamId: string;
  name?: string;
  description?: string;
  status?: string;
  type?: string;
  publishType?: string;
  hlsViewerCount?: number;
  webRTCViewerCount?: number;
  rtmpViewerCount?: number;
  startTime?: number;
  duration?: number;
  bitrate?: number;
  speed?: number;
}

interface RtmpEndpoint {
  rtmpUrl: string;
  endpointServiceId?: string;
}

interface AntMediaStats {
  broadcastCount: number;
  totalViewers: number;
  cpuUsage?: number;
  memoryUsage?: number;
}

class AntMediaService {
  private client: AxiosInstance;
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${ANT_MEDIA_SERVER_URL}/${ANT_MEDIA_APP_NAME}/rest/v2`;

    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        logger.error('[AntMedia] API Error:', error.response?.data || error.message);
        throw error;
      }
    );
  }

  /**
   * Create a new broadcast
   */
  async createBroadcast(streamId: string, name?: string, description?: string): Promise<AntMediaBroadcast> {
    try {
      const response = await this.client.post('/broadcasts/create', {
        streamId,
        name: name || streamId,
        description: description || '',
        type: 'liveStream',
      });

      logger.info('[AntMedia] Broadcast created:', response.data.streamId);
      return response.data;
    } catch (error) {
      logger.error('[AntMedia] Failed to create broadcast:', error);
      throw error;
    }
  }

  /**
   * Get broadcast by stream ID
   */
  async getBroadcast(streamId: string): Promise<AntMediaBroadcast | null> {
    try {
      const response = await this.client.get(`/broadcasts/${streamId}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('[AntMedia] Failed to get broadcast:', error);
      throw error;
    }
  }

  /**
   * Delete a broadcast
   */
  async deleteBroadcast(streamId: string): Promise<boolean> {
    try {
      await this.client.delete(`/broadcasts/${streamId}`);
      logger.info('[AntMedia] Broadcast deleted:', streamId);
      return true;
    } catch (error) {
      logger.error('[AntMedia] Failed to delete broadcast:', error);
      return false;
    }
  }

  /**
   * Add a single RTMP endpoint to a broadcast
   */
  async addRtmpEndpoint(streamId: string, rtmpUrl: string): Promise<RtmpEndpoint> {
    try {
      const response = await this.client.post(`/broadcasts/${streamId}/rtmp-endpoint`, {
        rtmpUrl,
      });

      logger.info('[AntMedia] RTMP endpoint added:', rtmpUrl);
      return response.data;
    } catch (error) {
      logger.error('[AntMedia] Failed to add RTMP endpoint:', error);
      throw error;
    }
  }

  /**
   * Add multiple RTMP endpoints to a broadcast (batch)
   * Uses the custom endpoint created for StreamLick
   */
  async addRtmpEndpointsBatch(streamId: string, endpoints: RtmpEndpoint[]): Promise<RtmpEndpoint[]> {
    try {
      const response = await this.client.post(
        `/broadcasts/${streamId}/rtmp-endpoints-batch`,
        endpoints.map(e => ({ rtmpUrl: e.rtmpUrl }))
      );

      logger.info('[AntMedia] RTMP endpoints batch added:', endpoints.length);
      return response.data;
    } catch (error) {
      logger.error('[AntMedia] Failed to add RTMP endpoints batch:', error);
      throw error;
    }
  }

  /**
   * Remove an RTMP endpoint from a broadcast
   */
  async removeRtmpEndpoint(streamId: string, endpointServiceId: string): Promise<boolean> {
    try {
      await this.client.delete(
        `/broadcasts/${streamId}/rtmp-endpoint?endpointServiceId=${endpointServiceId}`
      );
      logger.info('[AntMedia] RTMP endpoint removed:', endpointServiceId);
      return true;
    } catch (error) {
      logger.error('[AntMedia] Failed to remove RTMP endpoint:', error);
      return false;
    }
  }

  /**
   * Start RTMP streaming to all configured endpoints
   * Called after WebRTC stream is established
   */
  async startRtmpStreaming(streamId: string, destinations: { platform: string; rtmpUrl: string; streamKey: string }[]): Promise<boolean> {
    try {
      // Add all RTMP endpoints
      const endpoints = destinations.map(d => ({
        rtmpUrl: d.rtmpUrl.includes('?')
          ? `${d.rtmpUrl}&key=${d.streamKey}`
          : d.streamKey
            ? `${d.rtmpUrl}/${d.streamKey}`
            : d.rtmpUrl,
      }));

      await this.addRtmpEndpointsBatch(streamId, endpoints);

      logger.info('[AntMedia] RTMP streaming started for:', streamId, 'to', destinations.length, 'destinations');
      return true;
    } catch (error) {
      logger.error('[AntMedia] Failed to start RTMP streaming:', error);
      return false;
    }
  }

  /**
   * Stop RTMP streaming
   */
  async stopRtmpStreaming(streamId: string): Promise<boolean> {
    try {
      // Get current broadcast to find endpoints
      const broadcast = await this.getBroadcast(streamId);
      if (!broadcast) {
        logger.warn('[AntMedia] Broadcast not found for stop:', streamId);
        return true;
      }

      // Delete the broadcast which stops all streaming
      await this.deleteBroadcast(streamId);
      logger.info('[AntMedia] RTMP streaming stopped for:', streamId);
      return true;
    } catch (error) {
      logger.error('[AntMedia] Failed to stop RTMP streaming:', error);
      return false;
    }
  }

  /**
   * Get list of all broadcasts
   */
  async listBroadcasts(offset: number = 0, size: number = 50): Promise<AntMediaBroadcast[]> {
    try {
      const response = await this.client.get(`/broadcasts/list/${offset}/${size}`);
      return response.data;
    } catch (error) {
      logger.error('[AntMedia] Failed to list broadcasts:', error);
      return [];
    }
  }

  /**
   * Get broadcast statistics
   */
  async getBroadcastStats(streamId: string): Promise<any> {
    try {
      const response = await this.client.get(`/broadcasts/${streamId}/broadcast-statistics`);
      return response.data;
    } catch (error) {
      logger.error('[AntMedia] Failed to get broadcast stats:', error);
      return null;
    }
  }

  /**
   * Get server statistics
   */
  async getServerStats(): Promise<AntMediaStats> {
    try {
      const broadcasts = await this.listBroadcasts();
      const activeBroadcasts = broadcasts.filter(b => b.status === 'broadcasting');

      let totalViewers = 0;
      for (const broadcast of activeBroadcasts) {
        totalViewers += (broadcast.hlsViewerCount || 0) +
                        (broadcast.webRTCViewerCount || 0) +
                        (broadcast.rtmpViewerCount || 0);
      }

      return {
        broadcastCount: activeBroadcasts.length,
        totalViewers,
      };
    } catch (error) {
      logger.error('[AntMedia] Failed to get server stats:', error);
      return { broadcastCount: 0, totalViewers: 0 };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.client.get('/version');
      logger.debug('[AntMedia] Health check passed:', response.data);
      return true;
    } catch (error) {
      logger.error('[AntMedia] Health check failed:', error);
      return false;
    }
  }

  /**
   * Get or create broadcast
   */
  async getOrCreateBroadcast(streamId: string, name?: string): Promise<AntMediaBroadcast> {
    let broadcast = await this.getBroadcast(streamId);

    if (!broadcast) {
      broadcast = await this.createBroadcast(streamId, name);
    }

    return broadcast;
  }

  /**
   * Generate publish token (if token authentication is enabled)
   */
  async generatePublishToken(streamId: string, expireSeconds: number = 3600): Promise<string> {
    try {
      const response = await this.client.get(
        `/broadcasts/${streamId}/token?expireDate=${Date.now() + expireSeconds * 1000}&type=publish`
      );
      return response.data.tokenId;
    } catch (error) {
      logger.error('[AntMedia] Failed to generate publish token:', error);
      throw error;
    }
  }

  /**
   * Generate play token (if token authentication is enabled)
   */
  async generatePlayToken(streamId: string, expireSeconds: number = 3600): Promise<string> {
    try {
      const response = await this.client.get(
        `/broadcasts/${streamId}/token?expireDate=${Date.now() + expireSeconds * 1000}&type=play`
      );
      return response.data.tokenId;
    } catch (error) {
      logger.error('[AntMedia] Failed to generate play token:', error);
      throw error;
    }
  }
}

export const antMediaService = new AntMediaService();
