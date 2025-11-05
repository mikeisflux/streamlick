import * as mediasoup from 'mediasoup';
import { WorkerLogLevel, RtpCodecCapability } from 'mediasoup/node/lib/types';

export const mediasoupConfig = {
  worker: {
    logLevel: 'warn' as WorkerLogLevel,
    logTags: [
      'info',
      'ice',
      'dtls',
      'rtp',
      'srtp',
      'rtcp',
    ],
    rtcMinPort: 40000,
    rtcMaxPort: 40100,
  },
  router: {
    mediaCodecs: [
      {
        kind: 'audio',
        mimeType: 'audio/opus',
        clockRate: 48000,
        channels: 2,
        parameters: {
          useinbandfec: 1,     // Enable in-band FEC for packet loss recovery
          usedtx: 1,           // Enable discontinuous transmission
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP8',
        clockRate: 90000,
        parameters: {
          'x-google-start-bitrate': 3000,  // 3 Mbps start bitrate for HD streaming
        },
      },
      {
        kind: 'video',
        mimeType: 'video/VP9',
        clockRate: 90000,
        parameters: {
          'profile-id': 2,
          'x-google-start-bitrate': 3000,  // 3 Mbps start bitrate for HD streaming
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '4d0020',    // Main profile, Level 3.2 (better quality than baseline)
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 3000,  // 3 Mbps start bitrate for HD streaming
        },
      },
      {
        kind: 'video',
        mimeType: 'video/h264',
        clockRate: 90000,
        parameters: {
          'packetization-mode': 1,
          'profile-level-id': '42e01f',    // Baseline profile (fallback for compatibility)
          'level-asymmetry-allowed': 1,
          'x-google-start-bitrate': 2000,
        },
      },
    ] as RtpCodecCapability[],
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP || '127.0.0.1',
      },
    ],
    // Optimized for HD live streaming (supports up to 1080p @ 60fps)
    initialAvailableOutgoingBitrate: 8000000,  // 8 Mbps (supports 1080p Ultra profile)
    minimumAvailableOutgoingBitrate: 600000,   // 600 kbps (360p minimum)
    maxSctpMessageSize: 262144,
    maxIncomingBitrate: 12000000,              // 12 Mbps (allows high quality broadcaster input)
  },
};

export default mediasoupConfig;
