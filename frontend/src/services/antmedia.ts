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

export class AntMediaClient {
  private ws: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private config: AntMediaConfig;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor(config: AntMediaConfig) {
    this.config = config;
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(ANTMEDIA_WS_URL);

      this.ws.onopen = () => {
        console.log(`[AntMedia] Connected for ${this.config.mode} ${this.config.streamId}`);
        this.reconnectAttempts = 0;
        this.startConnection();
        resolve();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(JSON.parse(event.data));
      };

      this.ws.onclose = () => {
        console.log('[AntMedia] Connection closed');
        this.config.onStateChange?.('disconnected');
        this.attemptReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('[AntMedia] WebSocket error:', error);
        this.config.onError?.('Connection failed');
        reject(new Error('WebSocket connection failed'));
      };
    });
  }

  private async startConnection() {
    // Create peer connection
    this.pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    this.pc.onicecandidate = (event) => {
      if (event.candidate && this.ws) {
        this.ws.send(JSON.stringify({
          command: 'takeCandidate',
          streamId: this.config.streamId,
          label: event.candidate.sdpMLineIndex,
          id: event.candidate.sdpMid,
          candidate: event.candidate.candidate,
        }));
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log(`[AntMedia] Connection state: ${this.pc?.connectionState}`);
      this.config.onStateChange?.(this.pc?.connectionState || 'unknown');
    };

    if (this.config.mode === 'publish') {
      // Add local tracks for publishing
      if (this.config.localStream) {
        this.config.localStream.getTracks().forEach((track) => {
          this.pc?.addTrack(track, this.config.localStream!);
        });
      }

      // Send publish request
      this.ws?.send(JSON.stringify({
        command: 'publish',
        streamId: this.config.streamId,
        token: '',
        video: true,
        audio: true,
      }));
    } else {
      // Setup for playing
      this.pc.ontrack = (event) => {
        console.log(`[AntMedia] Received track for ${this.config.streamId}`);
        this.config.onRemoteStream?.(event.streams[0]);
      };

      // Add transceiver for receiving
      this.pc.addTransceiver('video', { direction: 'recvonly' });
      this.pc.addTransceiver('audio', { direction: 'recvonly' });

      // Send play request
      this.ws?.send(JSON.stringify({
        command: 'play',
        streamId: this.config.streamId,
        token: '',
      }));
    }
  }

  private async handleMessage(message: any) {
    switch (message.command) {
      case 'start':
        // Server is ready - create and send offer for publish mode
        if (this.config.mode === 'publish') {
          try {
            const offer = await this.pc?.createOffer();
            await this.pc?.setLocalDescription(offer);

            this.ws?.send(JSON.stringify({
              command: 'takeConfiguration',
              streamId: this.config.streamId,
              type: 'offer',
              sdp: this.pc?.localDescription?.sdp,
            }));
          } catch (error) {
            console.error('[AntMedia] Offer creation error:', error);
            this.config.onError?.('Failed to create offer');
          }
        } else {
          // Play mode - server sends offer, we respond with answer
          if (!message.sdp || typeof message.sdp !== 'string' || !message.sdp.startsWith('v=')) {
            console.error('[AntMedia] Invalid SDP received:', message.sdp);
            this.config.onError?.('Invalid SDP from server');
            return;
          }

          try {
            await this.pc?.setRemoteDescription(new RTCSessionDescription({
              type: 'offer',
              sdp: message.sdp,
            }));

            const answer = await this.pc?.createAnswer();
            await this.pc?.setLocalDescription(answer);

            this.ws?.send(JSON.stringify({
              command: 'takeConfiguration',
              streamId: this.config.streamId,
              type: 'answer',
              sdp: this.pc?.localDescription?.sdp,
            }));

            this.config.onStateChange?.('connected');
          } catch (error) {
            console.error('[AntMedia] SDP handling error:', error);
            this.config.onError?.('SDP handling failed');
          }
        }
        break;

      case 'takeConfiguration':
        // Server's answer to our offer (publish mode)
        if (message.type === 'answer' && this.config.mode === 'publish') {
          if (!message.sdp || typeof message.sdp !== 'string' || !message.sdp.startsWith('v=')) {
            console.error('[AntMedia] Invalid answer SDP received:', message.sdp);
            this.config.onError?.('Invalid answer SDP from server');
            return;
          }

          try {
            await this.pc?.setRemoteDescription(new RTCSessionDescription({
              type: 'answer',
              sdp: message.sdp,
            }));
            this.config.onStateChange?.('connected');
          } catch (error) {
            console.error('[AntMedia] Answer handling error:', error);
            this.config.onError?.('Failed to set remote description');
          }
        }
        break;

      case 'takeCandidate':
        try {
          await this.pc?.addIceCandidate(new RTCIceCandidate({
            sdpMLineIndex: message.label,
            candidate: message.candidate,
          }));
        } catch (error) {
          console.error('[AntMedia] ICE candidate error:', error);
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

        // Handle specific errors
        if (message.definition === 'streamIdInUse') {
          // Stream ID already in use - try to stop and restart with new ID
          console.log('[AntMedia] Stream ID in use, attempting cleanup...');
          this.ws?.send(JSON.stringify({
            command: 'stop',
            streamId: this.config.streamId,
          }));
          // Wait a moment then retry
          setTimeout(() => {
            this.startConnection();
          }, 1000);
          return;
        }

        if (message.definition === 'noStreamNameSpecified') {
          this.config.onError?.('No stream name specified');
          return;
        }

        if (message.definition === 'notSetLocalDescription') {
          // Server couldn't set local description - retry
          console.log('[AntMedia] Server SDP issue, retrying...');
          setTimeout(() => this.startConnection(), 500);
          return;
        }

        this.config.onError?.(message.definition);
        break;
    }
  }

  private attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`[AntMedia] Attempting reconnect ${this.reconnectAttempts}/${this.maxReconnectAttempts}`);

      setTimeout(() => {
        this.connect().catch(console.error);
      }, 2000 * this.reconnectAttempts);
    }
  }

  updateStream(stream: MediaStream) {
    if (!this.pc) return;

    // Replace tracks
    const senders = this.pc.getSenders();

    stream.getTracks().forEach((track) => {
      const sender = senders.find((s) => s.track?.kind === track.kind);
      if (sender) {
        sender.replaceTrack(track);
      }
    });

    this.config.localStream = stream;
  }

  disconnect() {
    if (this.ws) {
      this.ws.send(JSON.stringify({
        command: this.config.mode === 'publish' ? 'stop' : 'stop',
        streamId: this.config.streamId,
      }));
      this.ws.close();
      this.ws = null;
    }

    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
  }
}

// Helper to generate unique stream IDs
export function generateStreamId(broadcastId: string, participantId: string): string {
  // Include timestamp to avoid collisions with stale streams
  const timestamp = Date.now().toString(36);
  return `${broadcastId}_${participantId}_${timestamp}`;
}

// Generate stream ID without timestamp (for consistent playback)
export function generateStaticStreamId(broadcastId: string, participantId: string): string {
  return `${broadcastId}_${participantId}`;
}
