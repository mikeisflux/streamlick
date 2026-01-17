/**
 * WHIP Streaming Service
 *
 * Handles direct browser-to-platform streaming via WHIP (WebRTC-HTTP Ingest Protocol)
 * This enables zero-server media processing - canvas stream goes directly to platforms.
 *
 * Supported platforms:
 * - YouTube (native WHIP support)
 * - Twitch (WHIP beta)
 * - Custom WHIP endpoints
 *
 * For platforms without WHIP support (Facebook, etc.), we fall back to
 * a lightweight RTMP relay service.
 */
import logger from '../utils/logger';

interface WHIPEndpoint {
  platform: string;
  whipUrl: string;
  bearerToken?: string;
}

interface StreamingSession {
  platform: string;
  peerConnection: RTCPeerConnection;
  whipUrl: string;
  resourceUrl?: string;
}

class WHIPStreamingService {
  private sessions: Map<string, StreamingSession> = new Map();
  private canvasStream: MediaStream | null = null;

  // ICE servers for NAT traversal
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /**
   * Set the canvas stream to broadcast
   */
  setCanvasStream(stream: MediaStream): void {
    this.canvasStream = stream;
    logger.info('[WHIP] Canvas stream set:', {
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
    });
  }

  /**
   * Start streaming to a WHIP endpoint
   */
  async startStreaming(endpoint: WHIPEndpoint): Promise<boolean> {
    if (!this.canvasStream) {
      logger.error('[WHIP] No canvas stream set');
      return false;
    }

    try {
      logger.info(`[WHIP] Starting stream to ${endpoint.platform}`);

      // Create peer connection
      const pc = new RTCPeerConnection({
        iceServers: this.iceServers,
        bundlePolicy: 'max-bundle',
      });

      // Add tracks from canvas stream
      this.canvasStream.getTracks().forEach(track => {
        pc.addTrack(track, this.canvasStream!);
        logger.info(`[WHIP] Added ${track.kind} track to peer connection`);
      });

      // Create offer
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      // Wait for ICE gathering to complete
      await this.waitForIceGathering(pc);

      // Send offer to WHIP endpoint
      const headers: HeadersInit = {
        'Content-Type': 'application/sdp',
      };

      if (endpoint.bearerToken) {
        headers['Authorization'] = `Bearer ${endpoint.bearerToken}`;
      }

      const response = await fetch(endpoint.whipUrl, {
        method: 'POST',
        headers,
        body: pc.localDescription!.sdp,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WHIP request failed: ${response.status} - ${errorText}`);
      }

      // Get answer SDP
      const answerSdp = await response.text();
      await pc.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      // Store resource URL for later deletion
      const resourceUrl = response.headers.get('Location') || undefined;

      // Store session
      const session: StreamingSession = {
        platform: endpoint.platform,
        peerConnection: pc,
        whipUrl: endpoint.whipUrl,
        resourceUrl,
      };
      this.sessions.set(endpoint.platform, session);

      // Monitor connection state
      pc.onconnectionstatechange = () => {
        logger.info(`[WHIP] ${endpoint.platform} connection state: ${pc.connectionState}`);
        if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          this.handleDisconnection(endpoint.platform);
        }
      };

      logger.info(`[WHIP] Successfully started streaming to ${endpoint.platform}`);
      return true;
    } catch (error) {
      logger.error(`[WHIP] Failed to start streaming to ${endpoint.platform}:`, error);
      return false;
    }
  }

  /**
   * Stop streaming to a specific platform
   */
  async stopStreaming(platform: string): Promise<boolean> {
    const session = this.sessions.get(platform);
    if (!session) {
      logger.warn(`[WHIP] No active session for ${platform}`);
      return true;
    }

    try {
      // Send DELETE to resource URL if available
      if (session.resourceUrl) {
        try {
          await fetch(session.resourceUrl, { method: 'DELETE' });
        } catch (e) {
          logger.warn(`[WHIP] Failed to send DELETE to resource URL:`, e);
        }
      }

      // Close peer connection
      session.peerConnection.close();
      this.sessions.delete(platform);

      logger.info(`[WHIP] Stopped streaming to ${platform}`);
      return true;
    } catch (error) {
      logger.error(`[WHIP] Error stopping stream to ${platform}:`, error);
      return false;
    }
  }

  /**
   * Stop all streaming sessions
   */
  async stopAll(): Promise<void> {
    const platforms = Array.from(this.sessions.keys());
    for (const platform of platforms) {
      await this.stopStreaming(platform);
    }
    this.canvasStream = null;
    logger.info('[WHIP] All streaming sessions stopped');
  }

  /**
   * Get WHIP URL for a platform
   * Returns the WHIP ingest URL based on platform and stream key
   */
  getWHIPUrl(platform: string, streamKey: string): string | null {
    switch (platform.toLowerCase()) {
      case 'youtube':
        // YouTube WHIP endpoint
        return `https://upload.youtube.com/webrtc/publish?streamKey=${streamKey}`;

      case 'twitch':
        // Twitch WHIP endpoint (beta)
        return `https://ingest.twitch.tv/webrtc/publish?stream_key=${streamKey}`;

      case 'custom':
        // Custom WHIP endpoint - streamKey contains the full URL
        return streamKey;

      default:
        logger.warn(`[WHIP] Platform ${platform} does not support WHIP`);
        return null;
    }
  }

  /**
   * Check if a platform supports WHIP
   */
  supportsWHIP(platform: string): boolean {
    const whipPlatforms = ['youtube', 'twitch', 'custom'];
    return whipPlatforms.includes(platform.toLowerCase());
  }

  /**
   * Wait for ICE gathering to complete
   */
  private waitForIceGathering(pc: RTCPeerConnection): Promise<void> {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === 'complete') {
        resolve();
        return;
      }

      const checkState = () => {
        if (pc.iceGatheringState === 'complete') {
          pc.removeEventListener('icegatheringstatechange', checkState);
          resolve();
        }
      };

      pc.addEventListener('icegatheringstatechange', checkState);

      // Timeout after 10 seconds
      setTimeout(() => {
        pc.removeEventListener('icegatheringstatechange', checkState);
        resolve();
      }, 10000);
    });
  }

  /**
   * Handle disconnection
   */
  private handleDisconnection(platform: string): void {
    logger.warn(`[WHIP] ${platform} disconnected`);
    this.sessions.delete(platform);
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Check if streaming to a platform
   */
  isStreaming(platform: string): boolean {
    const session = this.sessions.get(platform);
    return session?.peerConnection.connectionState === 'connected';
  }
}

export const whipStreamingService = new WHIPStreamingService();
