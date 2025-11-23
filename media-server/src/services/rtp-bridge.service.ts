/**
 * RTP Bridge Service
 *
 * Bridges mediasoup RTP streams to WebRTC MediaStreamTracks using full WebRTC signaling
 * with DTLS/SRTP support.
 *
 * Architecture:
 * 1. Create wrtc RTCPeerConnection
 * 2. Create mediasoup WebRTC Transport (not Plain)
 * 3. Exchange offer/answer with proper DTLS parameters
 * 4. Create consumers and extract MediaStreamTracks
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
  webRtcTransport: mediasoupTypes.WebRtcTransport; // Need to track for cleanup
  videoConsumer: mediasoupTypes.Consumer;
  audioConsumer: mediasoupTypes.Consumer;
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
      logger.info('[RTP Bridge] Creating MediaStreamTracks with full WebRTC signaling...');

      // STEP 1: Create wrtc peer connection
      const peerConnection = new wrtc.RTCPeerConnection({
        iceServers: [],
      });

      logger.info('[RTP Bridge] Created RTCPeerConnection');

      // STEP 2: Add transceivers to receive video and audio
      peerConnection.addTransceiver('video', { direction: 'recvonly' });
      peerConnection.addTransceiver('audio', { direction: 'recvonly' });

      // STEP 3: Create offer from peer connection
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);

      logger.info('[RTP Bridge] Created offer from peer connection');

      // STEP 4: Extract DTLS parameters from offer
      const dtlsParameters = this.extractDtlsParameters(offer.sdp!);

      logger.info('[RTP Bridge] Extracted DTLS parameters:', dtlsParameters);

      // STEP 5: Create mediasoup WebRTC Transport
      const webRtcTransport = await router.createWebRtcTransport({
        listenIps: [{ ip: '127.0.0.1', announcedIp: undefined }],
        enableUdp: true,
        enableTcp: false,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 1000000,
      });

      logger.info('[RTP Bridge] Created mediasoup WebRTC transport');

      // STEP 6: Connect mediasoup transport with peer connection's DTLS params
      await webRtcTransport.connect({ dtlsParameters });

      logger.info('[RTP Bridge] Connected WebRTC transport');

      // STEP 7: Get RTP capabilities that wrtc supports
      const rtpCapabilities = this.getWrtcRtpCapabilities(router);

      // STEP 8: Create consumers on WebRTC transport
      const videoConsumer = await webRtcTransport.consume({
        producerId: videoProducer.id,
        rtpCapabilities,
        paused: false,
      });

      const audioConsumer = await webRtcTransport.consume({
        producerId: audioProducer.id,
        rtpCapabilities,
        paused: false,
      });

      logger.info('[RTP Bridge] Created consumers on WebRTC transport');

      // STEP 9: Build SDP answer from mediasoup transport and consumers
      const answerSdp = this.buildAnswerSdp(
        webRtcTransport,
        videoConsumer,
        audioConsumer
      );

      logger.info('[RTP Bridge] Built answer SDP');

      // STEP 10: Set answer on peer connection
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp,
      });

      logger.info('[RTP Bridge] Set answer on peer connection');

      // STEP 11: Wait for tracks to arrive
      const tracks = await this.waitForTracks(peerConnection);

      logger.info('[RTP Bridge] ✅ Tracks received:', {
        videoTrack: tracks.videoTrack?.id,
        audioTrack: tracks.audioTrack?.id,
      });

      return {
        videoTrack: tracks.videoTrack,
        audioTrack: tracks.audioTrack,
        peerConnection,
        webRtcTransport,
        videoConsumer,
        audioConsumer,
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
   * Extract DTLS parameters from SDP offer
   */
  private extractDtlsParameters(sdp: string): mediasoupTypes.DtlsParameters {
    // Extract fingerprint
    const fingerprintMatch = sdp.match(/a=fingerprint:(\S+)\s+(\S+)/);
    if (!fingerprintMatch) {
      throw new Error('No DTLS fingerprint found in offer SDP');
    }

    // Extract setup attribute (active/passive/actpass)
    const setupMatch = sdp.match(/a=setup:(\S+)/);
    let role: mediasoupTypes.DtlsRole = 'auto';

    if (setupMatch) {
      const setup = setupMatch[1];
      // If peer is active, we must be passive (server)
      // If peer is passive, we must be active (client)
      // If peer is actpass, we choose to be active (client)
      if (setup === 'active') {
        role = 'server';
      } else if (setup === 'passive') {
        role = 'client';
      } else {
        role = 'client'; // Default to client when peer offers actpass
      }
    }

    return {
      role,
      fingerprints: [
        {
          algorithm: fingerprintMatch[1] as mediasoupTypes.FingerprintAlgorithm,
          value: fingerprintMatch[2],
        },
      ],
    };
  }

  /**
   * Get RTP capabilities that wrtc peer connection supports
   */
  private getWrtcRtpCapabilities(router: mediasoupTypes.Router): mediasoupTypes.RtpCapabilities {
    // Use router's capabilities but filter to what wrtc commonly supports
    const routerCaps = router.rtpCapabilities;

    return {
      codecs: (routerCaps.codecs || []).filter((codec) => {
        // wrtc supports VP8, H264, and Opus
        const mimeType = codec.mimeType.toLowerCase();
        return (
          mimeType === 'video/vp8' ||
          mimeType === 'video/h264' ||
          mimeType === 'audio/opus'
        );
      }),
      headerExtensions: routerCaps.headerExtensions || [],
    };
  }

  /**
   * Build SDP answer from mediasoup WebRTC transport and consumers
   */
  private buildAnswerSdp(
    transport: mediasoupTypes.WebRtcTransport,
    videoConsumer: mediasoupTypes.Consumer,
    audioConsumer: mediasoupTypes.Consumer
  ): string {
    const dtlsParams = transport.dtlsParameters;
    const iceParams = transport.iceParameters;
    const iceCandidates = transport.iceCandidates;

    // Get first ICE candidate
    const candidate = iceCandidates[0];

    // Get RTP parameters
    const videoRtp = videoConsumer.rtpParameters;
    const audioRtp = audioConsumer.rtpParameters;

    const videoCodec = videoRtp.codecs[0];
    const audioCodec = audioRtp.codecs[0];

    // Get SSRCs from RTP parameters
    const videoSsrc = videoRtp.encodings?.[0]?.ssrc || Math.floor(Math.random() * 0xffffffff);
    const audioSsrc = audioRtp.encodings?.[0]?.ssrc || Math.floor(Math.random() * 0xffffffff);

    // Build SDP answer
    const sdp = `v=0
o=- 0 0 IN IP4 127.0.0.1
s=mediasoup
t=0 0
a=group:BUNDLE 0 1
a=msid-semantic:WMS *
a=ice-ufrag:${iceParams.usernameFragment}
a=ice-pwd:${iceParams.password}
a=ice-options:trickle
a=fingerprint:${dtlsParams.fingerprints[0].algorithm} ${dtlsParams.fingerprints[0].value}
a=setup:${dtlsParams.role === 'server' ? 'active' : 'passive'}
m=video ${candidate.port} UDP/TLS/RTP/SAVPF ${videoCodec.payloadType}
c=IN IP4 ${candidate.ip}
a=rtcp:${candidate.port} IN IP4 ${candidate.ip}
a=rtcp-mux
a=sendonly
a=mid:0
a=rtpmap:${videoCodec.payloadType} ${videoCodec.mimeType.split('/')[1]}/${videoCodec.clockRate}
a=ssrc:${videoSsrc} cname:mediasoup
a=ssrc:${videoSsrc} msid:mediasoup video
a=candidate:${candidate.foundation} 1 udp ${candidate.priority} ${candidate.ip} ${candidate.port} typ ${candidate.type}
m=audio ${candidate.port} UDP/TLS/RTP/SAVPF ${audioCodec.payloadType}
c=IN IP4 ${candidate.ip}
a=rtcp:${candidate.port} IN IP4 ${candidate.ip}
a=rtcp-mux
a=sendonly
a=mid:1
a=rtpmap:${audioCodec.payloadType} ${audioCodec.mimeType.split('/')[1]}/${audioCodec.clockRate}${audioCodec.channels ? `/${audioCodec.channels}` : ''}
a=ssrc:${audioSsrc} cname:mediasoup
a=ssrc:${audioSsrc} msid:mediasoup audio
a=candidate:${candidate.foundation} 1 udp ${candidate.priority} ${candidate.ip} ${candidate.port} typ ${candidate.type}
`;

    return sdp;
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
