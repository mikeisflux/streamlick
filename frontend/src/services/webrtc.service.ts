// WebRTC Service - Uses Ant Media Server WebRTC (not mediasoup)
import logger from '../utils/logger';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private broadcastId: string | null = null;
  private closed: boolean = false;

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.closed = false;
    logger.info(`[WebRTCService] Initialized for broadcast ${broadcastId}`);
  }

  async publishStream(stream: MediaStream): Promise<string> {
    this.localStream = stream;
    logger.info('[WebRTCService] Publishing stream');
    // Return a mock producer ID - actual publishing handled by Ant Media
    return `producer-${Date.now()}`;
  }

  async unpublishStream(): Promise<void> {
    logger.info('[WebRTCService] Unpublishing stream');
    this.localStream = null;
  }

  async subscribeToStream(producerId: string): Promise<MediaStream> {
    logger.info(`[WebRTCService] Subscribing to stream ${producerId}`);
    // Return empty stream - actual subscription handled by Ant Media
    return new MediaStream();
  }

  async unsubscribeFromStream(producerId: string): Promise<void> {
    logger.info(`[WebRTCService] Unsubscribing from stream ${producerId}`);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.peerConnection) {
      this.peerConnection.close();
      this.peerConnection = null;
    }
    this.localStream = null;
    logger.info('[WebRTCService] Closed');
  }

  get isConnected(): boolean {
    return !this.closed;
  }
}

export const webrtcService = new WebRTCService();
