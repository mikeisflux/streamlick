/**
 * Ant Media Server Integration Service
 *
 * Manages communication with Ant Media Server REST API v2 for:
 * - Creating/managing live streams
 * - RTMP restreaming to YouTube, Facebook, Twitch, etc.
 * - Stream status queries
 *
 * The composite stream from the server compositor is published to AMS via WebRTC,
 * then AMS restreams it to all RTMP destinations. This means the broadcast is
 * fully server-side and independent of any host browser connection.
 */

const ANTMEDIA_URL = process.env.ANTMEDIA_URL || 'https://media.streamlick.com:5443';
const ANTMEDIA_APP = process.env.ANTMEDIA_APP || 'LiveApp';
// AMS REST API credentials (set in AMS management panel)
const ANTMEDIA_REST_USER = process.env.ANTMEDIA_REST_USER || '';
const ANTMEDIA_REST_PASS = process.env.ANTMEDIA_REST_PASS || '';

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

  private authHeaders(): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (ANTMEDIA_REST_USER && ANTMEDIA_REST_PASS) {
      const creds = Buffer.from(`${ANTMEDIA_REST_USER}:${ANTMEDIA_REST_PASS}`).toString('base64');
      headers['Authorization'] = `Basic ${creds}`;
    }
    return headers;
  }

  /** Create a new live stream entry in Ant Media */
  async createBroadcast(streamId: string, name: string): Promise<BroadcastInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/create`, {
        method: 'POST',
        headers: this.authHeaders(),
        body: JSON.stringify({ streamId, name, type: 'liveStream' }),
      });
      if (!response.ok) {
        console.error('[AMS] Failed to create broadcast:', await response.text());
        return null;
      }
      return await response.json();
    } catch (error) {
      console.error('[AMS] createBroadcast error:', error);
      return null;
    }
  }

  /** Get broadcast info */
  async getBroadcast(streamId: string): Promise<BroadcastInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('[AMS] getBroadcast error:', error);
      return null;
    }
  }

  /** Delete a stream from AMS */
  async deleteBroadcast(streamId: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}`, {
        method: 'DELETE',
        headers: this.authHeaders(),
      });
      return response.ok;
    } catch (error) {
      console.error('[AMS] deleteBroadcast error:', error);
      return false;
    }
  }

  /**
   * Start RTMP restreaming from an AMS stream to an external RTMP destination.
   * Uses the correct AMS v2 REST API: PUT /rest/v2/broadcasts/{streamId}/rtmp-endpoint
   * The stream (compositeStreamId) must already be publishing on AMS before calling this.
   */
  async startRtmpStream(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      console.log(`[AMS] Starting RTMP restream: ${streamId} -> ${rtmpUrl}`);
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/rtmp-endpoint`, {
        method: 'PUT',
        headers: this.authHeaders(),
        body: JSON.stringify({ rtmpUrl }),
      });
      if (!response.ok) {
        const body = await response.text();
        console.error(`[AMS] startRtmpStream failed (${response.status}):`, body);
        return false;
      }
      console.log(`[AMS] RTMP restream started successfully for ${streamId}`);
      return true;
    } catch (error) {
      console.error('[AMS] startRtmpStream error:', error);
      return false;
    }
  }

  /**
   * Stop RTMP restreaming.
   * Uses: DELETE /rest/v2/broadcasts/{streamId}/rtmp-endpoint
   */
  async stopRtmpStream(streamId: string, rtmpUrl: string): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/rtmp-endpoint`, {
        method: 'DELETE',
        headers: this.authHeaders(),
        body: JSON.stringify({ rtmpUrl }),
      });
      return response.ok;
    } catch (error) {
      console.error('[AMS] stopRtmpStream error:', error);
      return false;
    }
  }

  /** Get stream statistics */
  async getStreamStats(streamId: string): Promise<StreamInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/broadcasts/${streamId}/broadcast-statistics`, {
        headers: this.authHeaders(),
      });
      if (!response.ok) return null;
      return await response.json();
    } catch (error) {
      console.error('[AMS] getStreamStats error:', error);
      return null;
    }
  }

  /** Generate a one-time token for stream publish/play */
  async generateToken(streamId: string, type: 'publish' | 'play', expireTime = 3600): Promise<string | null> {
    try {
      const response = await fetch(
        `${this.baseUrl}/broadcasts/${streamId}/token?type=${type}&expireDate=${Date.now() + expireTime * 1000}`,
        { method: 'GET', headers: this.authHeaders() }
      );
      if (!response.ok) return null;
      const data = await response.json();
      return data.tokenId;
    } catch (error) {
      console.error('[AMS] generateToken error:', error);
      return null;
    }
  }
}

export const antMediaService = new AntMediaService();
