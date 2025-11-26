/**
 * Daily.co Backend Service
 *
 * Handles Daily.co REST API operations:
 * - Create/delete rooms
 * - Generate meeting tokens
 * - Start/stop live streaming via REST API
 * - Manage room configuration
 */

import axios, { AxiosInstance } from 'axios';
import logger from '../utils/logger';
import prisma from '../database/prisma';
import { decrypt } from '../utils/crypto';

interface DailyRoomConfig {
  name?: string;
  privacy?: 'public' | 'private';
  properties?: {
    enable_screenshare?: boolean;
    enable_chat?: boolean;
    start_video_off?: boolean;
    start_audio_off?: boolean;
    max_participants?: number;
  };
}

interface DailyRoom {
  id: string;
  name: string;
  api_created: boolean;
  privacy: string;
  url: string;
  created_at: string;
  config: any;
}

interface LiveStreamingOutput {
  url: string;
  streamKey: string;
}

interface StartLiveStreamingParams {
  outputs: LiveStreamingOutput[];
  layout?: {
    preset?: 'default' | 'single-participant' | 'active-participant' | 'gallery';
  };
  instanceId?: string;
}

class DailyServiceBackend {
  private apiKey: string | null = null;
  private apiClient: AxiosInstance;
  private readonly baseUrl = 'https://api.daily.co/v1';

  constructor() {
    // Initialize axios client with base config
    this.apiClient = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Initialize the service with API key from database
   */
  async initialize(): Promise<void> {
    try {
      // Fetch Daily API key from system settings
      const setting = await prisma.systemSetting.findUnique({
        where: {
          category_key: {
            category: 'system',
            key: 'daily_api_key',
          },
        },
      });

      if (!setting || !setting.value) {
        logger.warn('[Daily Backend] API key not configured in system settings');
        return;
      }

      // Decrypt if encrypted
      this.apiKey = setting.isEncrypted ? decrypt(setting.value) : setting.value;

      // Update axios client with authorization header
      this.apiClient.defaults.headers.common['Authorization'] = `Bearer ${this.apiKey}`;

    } catch (error) {
      logger.error('[Daily Backend] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Ensure API key is loaded
   */
  private ensureInitialized(): void {
    if (!this.apiKey) {
      throw new Error('Daily service not initialized. Call initialize() first.');
    }
  }

  /**
   * Create a new Daily room
   */
  async createRoom(config: DailyRoomConfig = {}): Promise<DailyRoom> {
    this.ensureInitialized();

    try {

      const response = await this.apiClient.post('/rooms', {
        name: config.name,
        privacy: config.privacy || 'private',
        properties: {
          enable_screenshare: false, // Broadcaster only
          enable_chat: false,
          start_video_off: false,
          start_audio_off: false,
          max_participants: 1, // Only broadcaster
          ...config.properties,
        },
      });

      const room: DailyRoom = response.data;

      return room;
    } catch (error: any) {
      logger.error('[Daily Backend] Failed to create room:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Get room information
   */
  async getRoom(roomName: string): Promise<DailyRoom | null> {
    this.ensureInitialized();

    try {
      const response = await this.apiClient.get(`/rooms/${roomName}`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return null;
      }
      logger.error('[Daily Backend] Failed to get room:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Delete a Daily room
   */
  async deleteRoom(roomName: string): Promise<void> {
    this.ensureInitialized();

    try {
      await this.apiClient.delete(`/rooms/${roomName}`);
    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`[Daily Backend] Room ${roomName} not found, already deleted`);
        return;
      }
      logger.error('[Daily Backend] Failed to delete room:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Create a meeting token for a room
   * Tokens provide access control and can set permissions
   */
  async createMeetingToken(roomName: string, properties: any = {}): Promise<string> {
    this.ensureInitialized();

    try {

      const response = await this.apiClient.post('/meeting-tokens', {
        properties: {
          room_name: roomName,
          is_owner: true, // Broadcaster is owner
          enable_screenshare: true,
          ...properties,
        },
      });

      const token: string = response.data.token;


      return token;
    } catch (error: any) {
      logger.error('[Daily Backend] Failed to create meeting token:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Start live streaming via REST API
   * Alternative to using JavaScript API from frontend
   */
  async startLiveStreaming(roomName: string, params: StartLiveStreamingParams): Promise<void> {
    this.ensureInitialized();

    try {

      // Use correct Daily API format: /start-live-streaming with 'outputs' array
      const response = await this.apiClient.post(`/rooms/${roomName}/start-live-streaming`, {
        outputs: params.outputs,
        layout: params.layout,
        instanceId: params.instanceId,
      });

    } catch (error: any) {
      logger.error('[Daily Backend] Failed to start live streaming:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        roomName,
        outputCount: params.outputs.length,
      });
      throw error;
    }
  }

  /**
   * Stop live streaming via REST API
   */
  async stopLiveStreaming(roomName: string, instanceId?: string): Promise<void> {
    this.ensureInitialized();

    try {

      const body: any = {};
      if (instanceId) {
        body.instanceId = instanceId;
      }

      await this.apiClient.post(`/rooms/${roomName}/live-streaming/stop`, body);

    } catch (error: any) {
      if (error.response?.status === 404) {
        logger.warn(`[Daily Backend] No active stream found for room ${roomName}`);
        return;
      }
      logger.error('[Daily Backend] Failed to stop live streaming:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Update live streaming endpoints (add new destinations)
   */
  async updateLiveStreamingEndpoints(roomName: string, outputs: LiveStreamingOutput[], instanceId?: string): Promise<void> {
    this.ensureInitialized();

    try {

      const body: any = { outputs };
      if (instanceId) {
        body.instanceId = instanceId;
      }

      // Note: Update endpoint might use different path - verify with Daily.co docs if needed
      await this.apiClient.post(`/rooms/${roomName}/live-streaming/update`, body);

    } catch (error: any) {
      logger.error('[Daily Backend] Failed to update outputs:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Get live streaming status for a room
   */
  async getLiveStreamingStatus(roomName: string): Promise<any> {
    this.ensureInitialized();

    try {
      const response = await this.apiClient.get(`/rooms/${roomName}/live-streaming`);
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 404) {
        return { is_streaming: false };
      }
      logger.error('[Daily Backend] Failed to get streaming status:', error.response?.data || error);
      throw error;
    }
  }

  /**
   * Get or create a room for a broadcast
   * Room name format: streamlick-broadcast-{broadcastId}
   */
  async getOrCreateBroadcastRoom(broadcastId: string): Promise<DailyRoom> {
    const roomName = `streamlick-broadcast-${broadcastId}`;

    try {
      // Try to get existing room
      const existingRoom = await this.getRoom(roomName);
      if (existingRoom) {
        return existingRoom;
      }

      // Create new room
      return await this.createRoom({
        name: roomName,
        privacy: 'private',
        properties: {
          max_participants: 1, // Only broadcaster
          enable_screenshare: false,
          enable_chat: false,
        },
      });
    } catch (error) {
      logger.error(`[Daily Backend] Failed to get/create broadcast room:`, error);
      throw error;
    }
  }
}

// Export singleton instance
export const dailyServiceBackend = new DailyServiceBackend();
export default dailyServiceBackend;
