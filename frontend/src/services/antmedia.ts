/**
 * Ant Media WebRTC Service
 *
 * Handles WebRTC connections to Ant Media Server for publishing and playing streams
 */

const ANTMEDIA_WS_URL = import.meta.env.VITE_ANTMEDIA_WS_URL || 'wss://media.streamlick.com:5443/LiveApp/websocket';

interface AntMediaConfig {
  streamId: string;
  mode: 'publish' | 'play';
  localStream?: MediaStream;
  onRemoteStream?: (stream: MediaStream) => void;
  onStateChange?: (state: string) => void;
  onError?: (error: string) => void;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  {
    urls: import.meta.env.VITE_TURN_URL || 'turn:turn.streamlick.com:3478',
    username: import.meta.env.VITE_TURN_USERNAME || 'streamlick',
    credential: import.meta.env.VITE_TURN_PASSWORD || '',
  },
];

// Validate SDP format - must start with "v=" line
function isValidSdp(sdp: string | undefined | null): boolean {
  if (!sdp || typeof sdp !== 'string') return false;
  const trimmed = sdp.trim();
  return trimmed.startsWith('v=0') || trimmed.startsWith('v=');
}

export class AntMediaClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private config: AntMediaConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private isConnecting = false;
  private isStopped = false;
  private currentStreamId: string;
  private hasCreatedOffer = false; // Track if we've sent our offer

  constructor(config: AntMediaConfig) {
    this.config = config;
    this.currentStreamId = config.streamId;
  }

  async connect(): Promise<void> {
    // Prevent multiple simultaneous connection attempts
    if (this.isConnecting) {
      console.log('[AntMedia] Connection already in progress, skipping');
      return;
    }

    // Don't reconnect if explicitly stopped
    if (this.isStopped) {
      console.log('[AntMedia] Client stopped, not connecting');
      return;
    }

    this.isConnecting = true;

    // Clean up any existing connections first
    await this.cleanupExistingConnection();

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(ANTMEDIA_WS_URL);
      } catch (error) {
        this.isConnecting = false;
        console.error('[AntMedia] Failed to create WebSocket:', error);
        reject(new Error('WebSocket creation failed'));
        return;
      }

      const connectionTimeout = setTimeout(() => {
        this.isConnecting = false;
        if (this.ws?.readyState !== WebSocket.OPEN) {
          this.ws?.close();
          reject(new Error('Connection timeout'));
        }
      }, 10000);

      this.ws.onopen = () => {
        clearTimeout(connectionTimeout);
        console.log(`[AntMedia] Connected for ${this.config.mode} ${this.currentStreamId}`);
        this.reconnectAttempts = 0;
        this.isConnecting = false;
        this.startConnection();
        resolve();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          this.handleMessage(message);
        } catch (error) {
          console.error('[AntMedia] Failed to parse message:', error, event.data);
        }
      };

      this.ws.onclose = (event) => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.log(`[AntMedia] Connection closed (code: ${event.code}, reason: ${event.reason})`);
        this.config.onStateChange?.('disconnected');

        if (!this.isStopped) {
          this.attemptReconnect();
        }
      };

      this.ws.onerror = (error) => {
        clearTimeout(connectionTimeout);
        this.isConnecting = false;
        console.error('[AntMedia] WebSocket error:', error);
        this.config.onError?.('Connection failed');
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private async cleanupExistingConnection(): Promise<void> {
    // Reset offer tracking
    this.hasCreatedOffer = false;

    // Send stop command if websocket is still open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          command: 'stop',
          streamId: this.currentStreamId,
        }));
        // Give time for stop to process
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.warn('[AntMedia] Error sending stop during cleanup:', error);
      }
    }

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.warn('[AntMedia] Error closing WebSocket:', error);
      }
      this.ws = null;
    }

    // Close peer connection
    if (this.pc) {
      try {
        this.pc.close();
      } catch (error) {
        console.warn('[AntMedia] Error closing PeerConnection:', error);
      }
      this.pc = null;
    }
  }

  private async startConnection() {
    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          command: 'takeCandidate',
          streamId: this.currentStreamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        }));
      }
    };

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState || 'unknown';
      console.log(`[AntMedia] Connection state: ${state}`);

      // Handle failed connection state
      if (state === 'failed' || state === 'disconnected') {
        this.config.onStateChange?.(state);
        if (!this.isStopped) {
          this.attemptReconnect();
        }
      } else {
        this.config.onStateChange?.(state);
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log(`[AntMedia] ICE connection state: ${this.pc?.iceConnectionState}`);
    };

    if (this.config.mode === 'publish') {
      // Add local tracks for publishing
      if (this.config.localStream) {
        this.config.localStream.getTracks().forEach((track) => {
          this.pc?.addTrack(track, this.config.localStream!);
        });
      } else {
        console.warn('[AntMedia] No local stream provided for publishing');
      }

      // Send publish request
      this.ws?.send(JSON.stringify({
        command: 'publish',
        streamId: this.currentStreamId,
        token: '',
        video: true,
        audio: true,
      }));
    } else {
      // Setup for playing
      this.pc.ontrack = (event) => {
        console.log(`[AntMedia] Received track for ${this.currentStreamId}`);
        this.config.onRemoteStream?.(event.streams[0]);
      };

      // Add transceiver for receiving
      this.pc.addTransceiver('video', { direction: 'recvonly' });
      this.pc.addTransceiver('audio', { direction: 'recvonly' });

      // Send play request
      this.ws?.send(JSON.stringify({
        command: 'play',
        streamId: this.currentStreamId,
        token: '',
      }));
    }
  }

  private async createAndSendOffer() {
    if (!this.pc) {
      console.error('[AntMedia] No peer connection for creating offer');
      return;
    }

    try {
      console.log('[AntMedia] Creating SDP offer...');
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);

      console.log('[AntMedia] Sending SDP offer to server');
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({
          command: 'takeConfiguration',
          streamId: this.currentStreamId,
          type: 'offer',
          sdp: this.pc.localDescription?.sdp,
        }));
      }
      this.hasCreatedOffer = true;
    } catch (error) {
      console.error('[AntMedia] Error creating offer:', error);
      this.config.onError?.('Failed to create offer');
    }
  }

  private async handleMessage(message: any) {
    console.log(`[AntMedia] Received message: ${message.command || message.definition || 'unknown'}`);

    switch (message.command) {
      case 'start':
        // For publish mode: first 'start' comes without SDP - we need to send our offer
        // After we send offer, server responds with 'start' containing SDP answer
        if (!isValidSdp(message.sdp)) {
          if (this.config.mode === 'publish' && !this.hasCreatedOffer) {
            // This is expected - server is asking us to send our offer
            console.log('[AntMedia] Received start signal, creating and sending offer...');
            await this.createAndSendOffer();
            return;
          } else {
            console.error('[AntMedia] Invalid or missing SDP in start message:', {
              hasSdp: !!message.sdp,
              sdpType: typeof message.sdp,
              sdpPreview: message.sdp ? message.sdp.substring(0, 50) : 'null',
              hasCreatedOffer: this.hasCreatedOffer,
            });
            this.config.onError?.('Invalid SDP received from server');

            // Attempt reconnect with new stream ID to avoid conflict
            if (!this.isStopped && this.reconnectAttempts < this.maxReconnectAttempts) {
              this.regenerateStreamId();
              this.attemptReconnect();
            }
            return;
          }
        }

        try {
          const sdpType = this.config.mode === 'publish' ? 'answer' : 'offer';
          console.log(`[AntMedia] Setting remote description (${sdpType})`);

          await this.pc?.setRemoteDescription(new RTCSessionDescription({
            type: sdpType,
            sdp: message.sdp,
          }));

          if (this.config.mode === 'play') {
            const answer = await this.pc?.createAnswer();
            await this.pc?.setLocalDescription(answer);

            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
              this.ws.send(JSON.stringify({
                command: 'takeConfiguration',
                streamId: this.currentStreamId,
                type: 'answer',
                sdp: this.pc?.localDescription?.sdp,
              }));
            }
          }

          this.config.onStateChange?.('connected');
        } catch (error) {
          console.error('[AntMedia] SDP handling error:', error);
          this.config.onError?.('SDP handling failed');

          // Attempt reconnect with new stream ID
          if (!this.isStopped && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.regenerateStreamId();
            this.attemptReconnect();
          }
        }
        break;

      case 'takeConfiguration':
        // Server sent SDP configuration (answer for our offer)
        if (isValidSdp(message.sdp)) {
          try {
            const sdpType = message.type || 'answer';
            console.log(`[AntMedia] Received takeConfiguration with SDP type: ${sdpType}`);

            await this.pc?.setRemoteDescription(new RTCSessionDescription({
              type: sdpType,
              sdp: message.sdp,
            }));

            this.config.onStateChange?.('connected');
          } catch (error) {
            console.error('[AntMedia] takeConfiguration SDP error:', error);
            this.config.onError?.('SDP configuration failed');
          }
        }
        break;

      case 'takeCandidate':
        if (message.candidate) {
          try {
            await this.pc?.addIceCandidate(new RTCIceCandidate({
              sdpMLineIndex: message.label,
              candidate: message.candidate,
            }));
          } catch (error) {
            console.error('[AntMedia] ICE candidate error:', error);
          }
        }
        break;

      case 'notification':
        console.log('[AntMedia] Notification:', message.definition);
        if (message.definition === 'publish_started') {
          this.config.onStateChange?.('publishing');
        } else if (message.definition === 'play_started') {
          this.config.onStateChange?.('playing');
        } else if (message.definition === 'publish_finished' || message.definition === 'play_finished') {
          this.config.onStateChange?.('finished');
        }
        break;

      case 'error':
        console.error('[AntMedia] Error:', message.definition);
        this.handleServerError(message.definition);
        break;

      default:
        console.log('[AntMedia] Unhandled message:', message);
    }
  }

  private handleServerError(errorDefinition: string) {
    this.config.onError?.(errorDefinition);

    // Handle specific errors
    switch (errorDefinition) {
      case 'streamIdInUse':
        // Stream ID is already in use - regenerate and retry
        console.log('[AntMedia] Stream ID in use, regenerating...');
        if (!this.isStopped && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.regenerateStreamId();
          this.attemptReconnect();
        }
        break;

      case 'publishTimeoutError':
        // Publish timed out - retry with same ID after cleanup
        console.log('[AntMedia] Publish timeout, retrying...');
        if (!this.isStopped && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.attemptReconnect();
        }
        break;

      case 'no_stream_exist':
      case 'noStreamNameSpecified':
        // Stream doesn't exist - this is fatal for play mode
        console.log('[AntMedia] Stream not found');
        break;

      case 'unauthorized_access':
        // Auth error - don't retry
        console.log('[AntMedia] Unauthorized access');
        this.isStopped = true;
        break;

      default:
        console.log('[AntMedia] Unknown error:', errorDefinition);
    }
  }

  private regenerateStreamId() {
    // Generate a new unique stream ID by appending timestamp
    const baseId = this.config.streamId;
    this.currentStreamId = `${baseId}_${Date.now()}`;
    console.log(`[AntMedia] Regenerated stream ID: ${this.currentStreamId}`);
  }

  private attemptReconnect() {
    if (this.isStopped || this.isConnecting) {
      return;
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.min(2000 * this.reconnectAttempts, 10000); // Max 10 second delay

      console.log(`[AntMedia] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

      setTimeout(() => {
        if (!this.isStopped) {
          this.connect().catch((error) => {
            console.error('[AntMedia] Reconnect failed:', error);
          });
        }
      }, delay);
    } else {
      console.log('[AntMedia] Max reconnect attempts reached');
      this.config.onError?.('Max reconnect attempts reached');
    }
  }

  updateStream(stream: MediaStream) {
    if (!this.pc) {
      console.warn('[AntMedia] Cannot update stream - no peer connection');
      return;
    }

    // Replace tracks
    const senders = this.pc.getSenders();

    stream.getTracks().forEach((track) => {
      const sender = senders.find((s) => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track).catch((error) => {
          console.error('[AntMedia] Error replacing track:', error);
        });
      } else {
        console.log(`[AntMedia] No sender found for track kind: ${track.kind}`);
      }
    });

    this.config.localStream = stream;
  }

  disconnect() {
    console.log('[AntMedia] Disconnecting...');
    this.isStopped = true;

    // Send stop command if websocket is open
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({
          command: 'stop',
          streamId: this.currentStreamId,
        }));
      } catch (error) {
        console.warn('[AntMedia] Error sending stop command:', error);
      }
    }

    // Close WebSocket
    if (this.ws) {
      try {
        this.ws.close();
      } catch (error) {
        console.warn('[AntMedia] Error closing WebSocket:', error);
      }
      this.ws = null;
    }

    // Close peer connection
    if (this.pc) {
      try {
        this.pc.close();
      } catch (error) {
        console.warn('[AntMedia] Error closing PeerConnection:', error);
      }
      this.pc = null;
    }

    this.config.onStateChange?.('disconnected');
  }

  // Get current stream ID (may differ from original if regenerated)
  getStreamId(): string {
    return this.currentStreamId;
  }

  // Check if client is stopped
  isStopping(): boolean {
    return this.isStopped;
  }

  // Reset stopped state for reuse
  reset() {
    this.isStopped = false;
    this.reconnectAttempts = 0;
    this.currentStreamId = this.config.streamId;
    this.hasCreatedOffer = false;
  }
}

// Helper to generate unique stream IDs
export function generateStreamId(broadcastId: string, participantId: string): string {
  return `${broadcastId}_${participantId}`;
}
