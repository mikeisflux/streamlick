/**
 * RTP Bridge Service
 *
 * Bridges mediasoup RTP streams to WebRTC MediaStreamTracks
 * that can be used with Daily.co
 *
 * This creates a WebRTC peer connection using wrtc (Node.js WebRTC)
 * and feeds it RTP from mediasoup, then extracts MediaStreamTracks.
 */

import { types as mediasoupTypes } from 'mediasoup';
import logger from '../utils/logger';

// Dynamic import of wrtc to handle environments where it's not available
let wrtc: any;
try {
  wrtc = require('wrtc');
  logger.info('[RTP Bridge] wrtc module loaded successfully');
} catch (error) {
  logger.warn('[RTP Bridge] wrtc module not available - Daily bot will not work');
  logger.warn('[RTP Bridge] Install with: npm install wrtc');
}

interface BridgeResult {
  videoTrack: any; // MediaStreamTrack
  audioTrack: any; // MediaStreamTrack
  peerConnection: any; // RTCPeerConnection
}

class RTPBridgeService {
  /**
   * Create MediaStreamTracks from mediasoup producers
   *
   * Strategy: Create a WebRTC peer connection, create consumers from producers,
   * send RTP from mediasoup to the peer connection, and extract MediaStreamTracks.
   */
  async createTracksFromProducers(
    videoProducer: mediasoupTypes.Producer,
    audioProducer: mediasoupTypes.Producer,
    router: mediasoupTypes.Router
  ): Promise<BridgeResult> {
    if (!wrtc) {
      throw new Error('wrtc module not available - cannot create RTP bridge');
    }

    try {
      logger.info('[RTP Bridge] Creating MediaStreamTracks from mediasoup consumers...');

      // Create WebRTC peer connection
      const peerConnection = new wrtc.RTCPeerConnection({
        iceServers: [],
      });

      logger.info('[RTP Bridge] Created RTCPeerConnection');

      // Create a Plain RTP transport for the peer connection to receive from mediasoup
      const plainTransport = await router.createPlainTransport({
        listenIp: { ip: '127.0.0.1', announcedIp: undefined },
        rtcpMux: true,
        comedia: true, // Accept connections from any IP
      });

      logger.info('[RTP Bridge] Created Plain RTP transport:', {
        transportId: plainTransport.id,
        tuple: plainTransport.tuple,
      });

      // Create consumers on the plain transport from the producers
      const plainVideoConsumer = await plainTransport.consume({
        producerId: videoProducer.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: false,
      });

      const plainAudioConsumer = await plainTransport.consume({
        producerId: audioProducer.id,
        rtpCapabilities: router.rtpCapabilities,
        paused: false,
      });

      logger.info('[RTP Bridge] Created consumers on plain transport');

      // Get RTP parameters from the consumers
      const videoRtpParameters = plainVideoConsumer.rtpParameters;
      const audioRtpParameters = plainAudioConsumer.rtpParameters;

      // Create an SDP offer that describes the RTP streams from mediasoup
      const sdp = this.createSDPFromRTPParameters(
        plainTransport.tuple.localPort,
        videoRtpParameters,
        audioRtpParameters
      );

      logger.info('[RTP Bridge] Generated SDP offer');

      // Set remote description (what we're receiving from mediasoup)
      await peerConnection.setRemoteDescription({
        type: 'offer',
        sdp,
      });

      // Create answer
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);

      logger.info('[RTP Bridge] Created and set local description');

      // Connect the plain transport to send to the peer connection
      const answerSdp = answer.sdp || '';
      const remoteRtpPort = this.extractPortFromSDP(answerSdp);

      await plainTransport.connect({
        ip: '127.0.0.1',
        port: remoteRtpPort,
      });

      logger.info('[RTP Bridge] Connected plain transport to peer connection');

      // Wait for tracks to be available on the peer connection
      const tracks = await this.waitForTracks(peerConnection);

      logger.info('[RTP Bridge] ✅ Tracks received from peer connection:', {
        videoTrack: tracks.videoTrack?.id,
        audioTrack: tracks.audioTrack?.id,
      });

      return {
        videoTrack: tracks.videoTrack,
        audioTrack: tracks.audioTrack,
        peerConnection,
      };
    } catch (error: any) {
      logger.error('[RTP Bridge] Failed to create tracks:', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Create SDP offer from RTP parameters
   */
  private createSDPFromRTPParameters(
    port: number,
    videoRtpParameters: mediasoupTypes.RtpParameters,
    audioRtpParameters: mediasoupTypes.RtpParameters
  ): string {
    const videoCodec = videoRtpParameters.codecs[0];
    const audioCodec = audioRtpParameters.codecs[0];

    const sdp = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=mediasoup-bridge
t=0 0
a=group:BUNDLE 0 1
a=msid-semantic: WMS *

m=video ${port} RTP/AVP ${videoCodec.payloadType}
c=IN IP4 127.0.0.1
a=rtcp:${port} IN IP4 127.0.0.1
a=rtpmap:${videoCodec.payloadType} ${videoCodec.mimeType.split('/')[1]}/${videoCodec.clockRate}
a=sendonly
a=mid:0

m=audio ${port} RTP/AVP ${audioCodec.payloadType}
c=IN IP4 127.0.0.1
a=rtcp:${port} IN IP4 127.0.0.1
a=rtpmap:${audioCodec.payloadType} ${audioCodec.mimeType.split('/')[1]}/${audioCodec.clockRate}
a=sendonly
a=mid:1
`;

    return sdp;
  }

  /**
   * Extract port from SDP
   */
  private extractPortFromSDP(sdp: string): number {
    const match = sdp.match(/m=(?:video|audio) (\d+)/);
    if (!match) {
      throw new Error('Could not extract port from SDP');
    }
    return parseInt(match[1], 10);
  }

  /**
   * Wait for tracks to become available on the peer connection
   */
  private async waitForTracks(peerConnection: any): Promise<{
    videoTrack: any;
    audioTrack: any;
  }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Timeout waiting for tracks'));
      }, 10000);

      const tracks: any = { videoTrack: null, audioTrack: null };

      peerConnection.ontrack = (event: any) => {
        logger.info('[RTP Bridge] Track received:', {
          kind: event.track.kind,
          id: event.track.id,
        });

        if (event.track.kind === 'video') {
          tracks.videoTrack = event.track;
        } else if (event.track.kind === 'audio') {
          tracks.audioTrack = event.track;
        }

        // Check if we have both tracks
        if (tracks.videoTrack && tracks.audioTrack) {
          clearTimeout(timeout);
          resolve(tracks);
        }
      };

      // Also check existing tracks in case they're already there
      const receivers = peerConnection.getReceivers();
      for (const receiver of receivers) {
        if (receiver.track) {
          if (receiver.track.kind === 'video') {
            tracks.videoTrack = receiver.track;
          } else if (receiver.track.kind === 'audio') {
            tracks.audioTrack = receiver.track;
          }
        }
      }

      if (tracks.videoTrack && tracks.audioTrack) {
        clearTimeout(timeout);
        resolve(tracks);
      }
    });
  }

  /**
   * Cleanup bridge resources
   */
  async cleanup(peerConnection: any): Promise<void> {
    try {
      if (peerConnection) {
        peerConnection.close();
        logger.info('[RTP Bridge] Peer connection closed');
      }
    } catch (error: any) {
      logger.error('[RTP Bridge] Cleanup error:', error);
    }
  }
}

// Export singleton
export const rtpBridgeService = new RTPBridgeService();
