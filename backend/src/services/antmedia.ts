/**
 * Ant Media Server Integration Service
 *
 * This service manages communication with Ant Media Server for:
 * - Creating/managing WebRTC streams
 * - Getting stream status
 * - Managing RTMP outputs from the compositor
 */

const ANTMEDIA_URL = process.env.ANTMEDIA_URL || 'https://media.streamlick.com:5443';
const ANTMEDIA_APP = process.env.ANTMEDIA_APP || 'LiveApp';

interface StreamInfo {
  streamId: string;
  status: string;
  webRTCViewerCount: number;
  hlsViewerCount: number;
}

interface BroadcastInfo {
  streamId: string;
  status: string;
  name: string;
  rtmpURL?: string;
}

class AntMediaService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = `${ANTMEDIA_URL}/${ANTMEDIA_APP}/rest/v2`;
  }

  /**
   * Create a new broadcast/stream in Ant Media
   */
  async createBroadcast(streamId: string, name: string): Promise<BroadcastInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/create`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          streamId,
          name,
          type: 'liveStream',
        }),
      });

      if (!response.ok) {
        console.error('Failed to create broadcast:', await response.text());
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Ant Media create broadcast error:', error);
      return null;
    }
  }

  /**
   * Get broadcast info
   */
  async getBroadcast(streamId: string): Promise<BroadcastInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Ant Media get broadcast error:', error);
      return null;
    }
  }

  /**
   * Delete a broadcast
   */
  async deleteBroadcast(streamId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.error('Ant Media delete broadcast error:', error);
      return false;
    }
  }

  /**
   * Start RTMP streaming from Ant Media to a destination
   */
  async startRtmpStream(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/rtmp?rtmpUrl=${encodeURIComponent(rtmpUrl)}`, {
        method: 'POST',
      });

      return response.ok;
    } catch (error) {
      console.error('Ant Media start RTMP error:', error);
      return false;
    }
  }

  /**
   * Stop RTMP streaming
   */
  async stopRtmpStream(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/rtmp?rtmpUrl=${encodeURIComponent(rtmpUrl)}`, {
        method: 'DELETE',
      });

      return response.ok;
    } catch (error) {
      console.error('Ant Media stop RTMP error:', error);
      return false;
    }
  }

  /**
   * Get conference room info (for SFU mode)
   */
  async getConferenceRoom(roomId: string): Promise<any> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/conference-rooms/${roomId}`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Ant Media get conference room error:', error);
      return null;
    }
  }

  /**
   * Create a conference room for multi-party streams
   */
  async createConferenceRoom(roomId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/conference-rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          roomId,
          mode: 'sfu',
        }),
      });

      return response.ok;
    } catch (error) {
      console.error('Ant Media create conference room error:', error);
      return false;
    }
  }

  /**
   * Get stream statistics
   */
  async getStreamStats(streamId: string): Promise<StreamInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/broadcast-statistics`);

      if (!response.ok) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error('Ant Media get stats error:', error);
      return null;
    }
  }

  /**
   * Generate a one-time token for stream publish/play
   */
  async generateToken(streamId: string, type: 'publish' | 'play', expireTime = 3600): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/broadcasts/${streamId}/token?type=${type}&expireDate=${Date.now() + expireTime * 1000}`,
        { method: 'GET' }
      );

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return data.tokenId;
    } catch (error) {
      console.error('Ant Media generate token error:', error);
      return null;
    }
  }
}

export const antMediaService = new AntMediaService();
