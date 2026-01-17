// WebRTC Service - Uses Ant Media Server WebRTC (not mediasoup)
import logger from '../utils/logger';

class WebRTCService {
  private peerConnection: RTCPeerConnection | null = null;
  private localStream: MediaStream | null = null;
  private broadcastId: string | null = null;
  private closed: boolean = false;
  private device: object | null = null;
  private producers: Map<string, MediaStreamTrack> = new Map();

  async initialize(broadcastId: string): Promise<void> {
    this.broadcastId = broadcastId;
    this.closed = false;
    this.device = {}; // Mark as initialized
    logger.info(`[WebRTCService] Initialized for broadcast ${broadcastId}`);
  }

  getDevice(): object | null {
    return this.device;
  }

  async createSendTransport(): Promise<void> {
    logger.info('[WebRTCService] Creating send transport');
    // Transport creation handled by Ant Media WebRTC adaptor
  }

  async produceMedia(track: MediaStreamTrack): Promise<string> {
    const producerId = `producer-${track.kind}-${Date.now()}`;
    this.producers.set(producerId, track);
    logger.info(`[WebRTCService] Producing ${track.kind} track: ${producerId}`);
    // Actual media production handled by Ant Media
    return producerId;
  }

  async closeProducer(producerId: string): Promise<void> {
    logger.info(`[WebRTCService] Closing producer: ${producerId}`);
    this.producers.delete(producerId);
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
    this.device = null;
    this.producers.clear();
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
