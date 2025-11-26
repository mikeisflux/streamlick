/**
 * RTMP Relay Service
 *
 * For platforms that don't support WHIP (Facebook, LinkedIn, TikTok, X, etc.),
 * this service sends the canvas stream to a lightweight relay server that
 * converts WebRTC to RTMP.
 *
 * The relay is minimal - it receives WebRTC and outputs RTMP with no processing.
 * All compositing is still done in the browser.
 */
import logger from '../utils/logger';

const RTMP_RELAY_URL = import.meta.env.VITE_RTMP_RELAY_URL || 'wss://media.streamlick.com:5443';

interface RTMPDestination {
  id: string;
  platform: string;
  rtmpUrl: string;
  streamKey: string;
}

interface RelaySession {
  id: string;
  platform: string;
  peerConnection: RTCPeerConnection;
  webSocket: WebSocket;
  rtmpUrl: string;
}

class RTMPRelayService {
  private sessions: Map<string, RelaySession> = new Map();
  private canvasStream: MediaStream | null = null;

  // ICE servers
  private iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ];

  /**
   * Set the canvas stream to relay
   */
  setCanvasStream(stream: MediaStream): void {
    this.canvasStream = stream;
    logger.info('[RTMP-Relay] Canvas stream set');
  }

  /**
   * Start relaying to an RTMP destination
   * Connects via WebRTC to the relay server which outputs RTMP
   */
  async startRelay(destination: RTMPDestination): Promise<boolean> {
    if (!this.canvasStream) {
      logger.error('[RTMP-Relay] No canvas stream set');
      return false;
    }

    try {
      logger.info(`[RTMP-Relay] Starting relay to ${destination.platform}`);

      // Build full RTMP URL
      const fullRtmpUrl = destination.streamKey
        ? `${destination.rtmpUrl}/${destination.streamKey}`
        : destination.rtmpUrl;

      // Connect to relay server via WebSocket for signaling
      const wsUrl = `${RTMP_RELAY_URL}/relay?rtmpUrl=${encodeURIComponent(fullRtmpUrl)}`;
      const ws = new WebSocket(wsUrl);

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          ws.close();
          reject(new Error('Connection timeout'));
        }, 15000);

        ws.onopen = async () => {
          try {
            // Create peer connection
            const pc = new RTCPeerConnection({
              iceServers: this.iceServers,
              bundlePolicy: 'max-bundle',
            });

            // Add tracks
            this.canvasStream!.getTracks().forEach(track => {
              pc.addTrack(track, this.canvasStream!);
            });

            // Handle ICE candidates
            pc.onicecandidate = (event) => {
              if (event.candidate) {
                ws.send(JSON.stringify({
                  type: 'candidate',
                  candidate: event.candidate.candidate,
                  sdpMLineIndex: event.candidate.sdpMLineIndex,
                  sdpMid: event.candidate.sdpMid,
                }));
              }
            };

            // Create and send offer
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);

            ws.send(JSON.stringify({
              type: 'offer',
              sdp: offer.sdp,
            }));

            // Handle messages from relay server
            ws.onmessage = async (event) => {
              const message = JSON.parse(event.data);

              if (message.type === 'answer') {
                await pc.setRemoteDescription({
                  type: 'answer',
                  sdp: message.sdp,
                });
              } else if (message.type === 'candidate' && message.candidate) {
                await pc.addIceCandidate(new RTCIceCandidate({
                  candidate: message.candidate,
                  sdpMLineIndex: message.sdpMLineIndex,
                  sdpMid: message.sdpMid,
                }));
              } else if (message.type === 'connected') {
                clearTimeout(timeout);
                logger.info(`[RTMP-Relay] Connected to ${destination.platform}`);

                // Store session
                this.sessions.set(destination.id, {
                  id: destination.id,
                  platform: destination.platform,
                  peerConnection: pc,
                  webSocket: ws,
                  rtmpUrl: fullRtmpUrl,
                });

                resolve(true);
              } else if (message.type === 'error') {
                clearTimeout(timeout);
                logger.error(`[RTMP-Relay] Error:`, message.error);
                pc.close();
                ws.close();
                reject(new Error(message.error));
              }
            };

            // Monitor connection state
            pc.onconnectionstatechange = () => {
              logger.info(`[RTMP-Relay] ${destination.platform} connection: ${pc.connectionState}`);
              if (pc.connectionState === 'connected') {
                clearTimeout(timeout);
                resolve(true);
              } else if (pc.connectionState === 'failed') {
                clearTimeout(timeout);
                this.stopRelay(destination.id);
                reject(new Error('Connection failed'));
              }
            };

          } catch (error) {
            clearTimeout(timeout);
            ws.close();
            reject(error);
          }
        };

        ws.onerror = (error) => {
          clearTimeout(timeout);
          logger.error('[RTMP-Relay] WebSocket error:', error);
          reject(new Error('WebSocket connection failed'));
        };

        ws.onclose = () => {
          clearTimeout(timeout);
        };
      });
    } catch (error) {
      logger.error(`[RTMP-Relay] Failed to start relay to ${destination.platform}:`, error);
      return false;
    }
  }

  /**
   * Stop relaying to a destination
   */
  async stopRelay(destinationId: string): Promise<boolean> {
    const session = this.sessions.get(destinationId);
    if (!session) {
      return true;
    }

    try {
      // Send stop command
      if (session.webSocket.readyState === WebSocket.OPEN) {
        session.webSocket.send(JSON.stringify({ type: 'stop' }));
        session.webSocket.close();
      }

      // Close peer connection
      session.peerConnection.close();
      this.sessions.delete(destinationId);

      logger.info(`[RTMP-Relay] Stopped relay to ${session.platform}`);
      return true;
    } catch (error) {
      logger.error(`[RTMP-Relay] Error stopping relay:`, error);
      return false;
    }
  }

  /**
   * Stop all relay sessions
   */
  async stopAll(): Promise<void> {
    const ids = Array.from(this.sessions.keys());
    for (const id of ids) {
      await this.stopRelay(id);
    }
    this.canvasStream = null;
    logger.info('[RTMP-Relay] All relay sessions stopped');
  }

  /**
   * Check if destination needs relay (doesn't support WHIP)
   */
  needsRelay(platform: string): boolean {
    const whipPlatforms = ['youtube', 'twitch', 'custom'];
    return !whipPlatforms.includes(platform.toLowerCase());
  }

  /**
   * Get active sessions
   */
  getActiveSessions(): string[] {
    return Array.from(this.sessions.keys());
  }

  /**
   * Check if relaying to a destination
   */
  isRelaying(destinationId: string): boolean {
    const session = this.sessions.get(destinationId);
    return session?.peerConnection.connectionState === 'connected';
  }
}

export const rtmpRelayService = new RTMPRelayService();
