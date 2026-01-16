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
        // SDP received
        try {
          await this.pc?.setRemoteDescription(new RTCSessionDescription({
            type: this.config.mode === 'publish' ? 'answer' : 'offer',
            sdp: message.sdp,
          }));

          if (this.config.mode === 'play') {
            const answer = await this.pc?.createAnswer();
            await this.pc?.setLocalDescription(answer);

            this.ws?.send(JSON.stringify({
              command: 'takeConfiguration',
              streamId: this.config.streamId,
              type: 'answer',
              sdp: this.pc?.localDescription?.sdp,
            }));
          }

          this.config.onStateChange?.('connected');
        } catch (error) {
          console.error('[AntMedia] SDP handling error:', error);
          this.config.onError?.('SDP handling failed');
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
  return `${broadcastId}_${participantId}`;
}
