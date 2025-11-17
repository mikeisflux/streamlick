import * as mediasoup from 'mediasoup';
import { WorkerLogLevel, RtpCodecCapability } from 'mediasoup/node/lib/types';

// CRITICAL FIX: Require MEDIASOUP_ANNOUNCED_IP to be set
// WebRTC will fail for remote clients if this defaults to localhost
if (!process.env.MEDIASOUP_ANNOUNCED_IP) {
  throw new Error(
    'CRITICAL: MEDIASOUP_ANNOUNCED_IP environment variable must be set.\n' +
    'This should be the public IP address or domain of your media server.\n' +
    'Example: MEDIASOUP_ANNOUNCED_IP=123.45.67.89 or MEDIASOUP_ANNOUNCED_IP=media.yourdomain.com'
  );
}

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
    ] as any,
    // CRITICAL FIX: Expanded port range from 100 to 10,000 ports
    // Supports ~5,000 concurrent broadcasts (2 ports per participant)
    rtcMinPort: 40000,
    rtcMaxPort: 49999,
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
          usedtx: 0,           // Disable discontinuous transmission for better quality
          maxaveragebitrate: 128000,  // 128 kbps for high-quality stereo audio
          maxplaybackrate: 48000,     // Maximum playback rate
          stereo: 1,                   // Enable stereo
          'sprop-stereo': 1,          // Signal stereo support
          cbr: 1,                      // Constant bitrate for consistent quality
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
    ] as any,
  },
  webRtcTransport: {
    listenIps: [
      {
        ip: '0.0.0.0',
        // CRITICAL FIX: No fallback to localhost - already validated above
        announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP!,
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
