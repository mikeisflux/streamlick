/**
 * Compositor Pipeline
 *
 * Handles the pipeline from mediasoup to FFmpeg for RTMP streaming
 * Creates Plain RTP transports to pipe media from mediasoup to FFmpeg
 */

import { Router, PlainTransport, Producer } from 'mediasoup/node/lib/types';
import ffmpeg from 'fluent-ffmpeg';
import { RTMPDestination } from './streamer';
import logger from '../utils/logger';

interface Pipeline {
  videoPlainTransport: PlainTransport | null;
  audioPlainTransport: PlainTransport | null;
  videoConsumer: any | null;
  audioConsumer: any | null;
  ffmpegProcesses: Map<string, any>;
}

const activePipelines = new Map<string, Pipeline>();

/**
 * Create a compositor pipeline for a broadcast
 * This sets up Plain RTP transports that FFmpeg can consume from
 */
export async function createCompositorPipeline(
  router: Router,
  broadcastId: string,
  videoProducer: Producer,
  audioProducer: Producer,
  destinations: RTMPDestination[]
): Promise<void> {
  try {
    logger.info(`Creating compositor pipeline for broadcast ${broadcastId}`);

    // Create separate Plain RTP transports for video and audio
    // This is required because FFmpeg cannot bind to the same port twice
    const useExternalFFmpeg = process.env.EXTERNAL_FFMPEG === 'true';

    const videoTransport = await router.createPlainTransport({
      listenIp: useExternalFFmpeg
        ? { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }
        : { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: false, // MediaSoup will send to FFmpeg's listening address
    });

    const audioTransport = await router.createPlainTransport({
      listenIp: useExternalFFmpeg
        ? { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }
        : { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: false, // MediaSoup will send to FFmpeg's listening address
    });

    logger.info(
      `Plain transports created - Video: ${videoTransport.tuple.localPort}, Audio: ${audioTransport.tuple.localPort}`
    );
    logger.info(
      `FFmpeg deployment mode: ${useExternalFFmpeg ? 'EXTERNAL (multi-server)' : 'LOCAL (same server)'}`
    );

    // Create consumers on their respective transports
    const videoConsumer = await videoTransport.consume({
      producerId: videoProducer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    const audioConsumer = await audioTransport.consume({
      producerId: audioProducer.id,
      rtpCapabilities: router.rtpCapabilities,
      paused: false,
    });

    logger.info('Video and audio consumers created on separate plain transports');

    // DEBUG: Log producer and consumer stats to verify video is flowing
    const videoProducerStats = await videoProducer.getStats();
    const audioProducerStats = await audioProducer.getStats();
    const videoConsumerStats = await videoConsumer.getStats();
    const audioConsumerStats = await audioConsumer.getStats();

    logger.info('========== PRODUCER/CONSUMER STATS ==========');
    logger.info(`Video Producer Stats: ${JSON.stringify(Array.from(videoProducerStats.values()), null, 2)}`);
    logger.info(`Audio Producer Stats: ${JSON.stringify(Array.from(audioProducerStats.values()), null, 2)}`);
    logger.info(`Video Consumer Stats: ${JSON.stringify(Array.from(videoConsumerStats.values()), null, 2)}`);
    logger.info(`Audio Consumer Stats: ${JSON.stringify(Array.from(audioConsumerStats.values()), null, 2)}`);
    logger.info('================================================');

    // Verify video producer is actually producing
    if (videoProducer.paused) {
      logger.error(`❌ VIDEO PRODUCER IS PAUSED! This will cause no video packets to be sent.`);
    } else {
      logger.info(`✅ Video producer is active (not paused)`);
    }

    // Verify video consumer is actually consuming
    if (videoConsumer.paused) {
      logger.error(`❌ VIDEO CONSUMER IS PAUSED! This will cause no video packets to be received.`);
    } else {
      logger.info(`✅ Video consumer is active (not paused)`);
    }

    // Get RTP parameters from consumers
    const videoPayloadType = videoConsumer.rtpParameters.codecs[0].payloadType;
    const audioPayloadType = audioConsumer.rtpParameters.codecs[0].payloadType;

    // Get H.264 parameters including SPS/PPS
    const videoCodecParameters = videoConsumer.rtpParameters.codecs[0].parameters || {};
    const profileLevelId = videoCodecParameters['profile-level-id'] || '4d001f';
    const packetizationMode = videoCodecParameters['packetization-mode'] || '1';
    const levelAsymmetryAllowed = videoCodecParameters['level-asymmetry-allowed'] || '1';

    // CRITICAL: Extract sprop-parameter-sets for H.264 SPS/PPS
    // These are required for FFmpeg to decode the video stream
    const spropParameterSets = videoCodecParameters['sprop-parameter-sets'] || '';

    // Get SSRC values for proper stream identification
    const videoSsrc = videoConsumer.rtpParameters.encodings?.[0]?.ssrc || 0;
    const audioSsrc = audioConsumer.rtpParameters.encodings?.[0]?.ssrc || 0;

    // Use appropriate IP based on deployment mode
    const mediaServerIp = useExternalFFmpeg
      ? (process.env.MEDIASOUP_ANNOUNCED_IP || 'localhost')
      : '127.0.0.1';

    logger.info(`========== FFMPEG SEPARATE TRANSPORT SETUP ==========`);
    logger.info(`Total destinations: ${destinations.length}`);
    logger.info(`Media Server IP: ${mediaServerIp}`);
    logger.info(`Video SSRC: ${videoSsrc}, Audio SSRC: ${audioSsrc}`);
    logger.info(`Video codec parameters:`, JSON.stringify(videoCodecParameters));
    logger.info(`Has sprop-parameter-sets: ${!!spropParameterSets}`);
    logger.info(`Destinations:`);
    destinations.forEach((dest, index) => {
      logger.info(`  [${index + 1}] ${dest.platform}: ${dest.rtmpUrl}/${dest.streamKey?.substring(0, 20)}...`);
    });

    // FFmpeg will listen on separate ports for video and audio
    // MediaSoup uses ports 40000-40100 for WebRTC, FFmpeg uses 40200-40203
    const ffmpegVideoPort = 40200;      // Video RTP
    const ffmpegVideoRtcpPort = 40201;  // Video RTCP
    const ffmpegAudioPort = 40202;      // Audio RTP
    const ffmpegAudioRtcpPort = 40203;  // Audio RTCP
    const ffmpegIp = '127.0.0.1';

    // Connect both plain transports to their respective FFmpeg ports
    await videoTransport.connect({
      ip: ffmpegIp,
      port: ffmpegVideoPort,
      rtcpPort: ffmpegVideoRtcpPort,
    });
    logger.info(`Video transport connected - MediaSoup will send RTP to ${ffmpegIp}:${ffmpegVideoPort}, RTCP to ${ffmpegIp}:${ffmpegVideoRtcpPort}`);

    await audioTransport.connect({
      ip: ffmpegIp,
      port: ffmpegAudioPort,
      rtcpPort: ffmpegAudioRtcpPort,
    });
    logger.info(`Audio transport connected - MediaSoup will send RTP to ${ffmpegIp}:${ffmpegAudioPort}, RTCP to ${ffmpegIp}:${ffmpegAudioRtcpPort}`);

    // Request keyframes from the video producer to ensure FFmpeg gets SPS/PPS immediately
    // This is critical for H.264 streams as FFmpeg needs these to decode the video
    // Request multiple times to ensure the browser responds
    try {
      logger.info('Requesting keyframes from video producer (3 attempts)...');

      // First request
      await videoConsumer.requestKeyFrame();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Second request
      await videoConsumer.requestKeyFrame();
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Third request
      await videoConsumer.requestKeyFrame();
      await new Promise(resolve => setTimeout(resolve, 1000));

      logger.info('Keyframe requests completed, waited 3 seconds for keyframes to arrive');
    } catch (error) {
      logger.warn('Could not request keyframe:', error);
    }

    // Create unified SDP file with separate ports for video and audio
    // CRITICAL: Include sprop-parameter-sets for H.264 SPS/PPS so FFmpeg can decode the stream
    // Added media IDs (mid) and LS group for explicit audio/video synchronization

    // Build fmtp line with all H.264 parameters
    let fmtpParams = `level-asymmetry-allowed=${levelAsymmetryAllowed};packetization-mode=${packetizationMode};profile-level-id=${profileLevelId}`;
    if (spropParameterSets) {
      // Include SPS/PPS if available - critical for FFmpeg to know video dimensions/profile
      fmtpParams += `;sprop-parameter-sets=${spropParameterSets}`;
    }

    const unifiedSdp = `v=0
o=- 0 0 IN IP4 ${ffmpegIp}
s=Combined Stream
c=IN IP4 ${ffmpegIp}
t=0 0
a=group:LS video audio
m=video ${ffmpegVideoPort} RTP/AVP ${videoPayloadType}
a=mid:video
a=rtpmap:${videoPayloadType} H264/90000
a=fmtp:${videoPayloadType} ${fmtpParams}
a=ssrc:${videoSsrc} cname:video
a=recvonly
m=audio ${ffmpegAudioPort} RTP/AVP ${audioPayloadType}
a=mid:audio
a=rtpmap:${audioPayloadType} opus/48000/2
a=ssrc:${audioSsrc} cname:audio
a=recvonly`;

    // Write unified SDP file to /tmp
    const fs = require('fs');
    const path = require('path');
    const sdpPath = path.join('/tmp', `unified_${broadcastId}.sdp`);

    fs.writeFileSync(sdpPath, unifiedSdp);

    logger.info(`Unified SDP file created for FFmpeg:`);
    logger.info(`  SDP: ${sdpPath} (video port: ${ffmpegVideoPort}, audio port: ${ffmpegAudioPort})`);
    logger.info(`========== SDP CONTENT (VERIFY VIDEO STREAM) ==========`);
    logger.info(unifiedSdp);
    logger.info(`========== END SDP CONTENT ==========`);

    // Start FFmpeg for destinations
    const ffmpegProcesses = new Map<string, any>();

    // Determine video codec strategy based on SPS/PPS availability
    // If SPS/PPS is missing, we MUST transcode to avoid "non-existing PPS" errors
    const useVideoCopy = !!spropParameterSets;
    const videoCodecName = useVideoCopy ? 'copy' : 'libx264';

    if (!useVideoCopy) {
      logger.warn('⚠️  WARNING: SPS/PPS not available in stream - using VIDEO TRANSCODING instead of copy');
      logger.warn('⚠️  This will increase CPU usage and latency, but is required to avoid decode errors');
    } else {
      logger.info('✅ SPS/PPS available - using video copy mode (no transcoding)');
    }

    // Build output based on number of destinations
    let command: any;

    if (destinations.length === 1) {
      // SINGLE DESTINATION: Output directly to RTMP (no tee muxer)
      const dest = destinations[0];
      const rtmpUrl = `${dest.rtmpUrl}/${dest.streamKey}`;

      logger.info(`========== STARTING SINGLE FFMPEG PROCESS (UNIFIED INPUT, DIRECT OUTPUT) ==========`);
      logger.info(`Destination: ${dest.platform} - ${dest.rtmpUrl}`);
      logger.info(`Video codec: ${videoCodecName}`);

      command = ffmpeg()
        // Global options - debug logging with detailed reports
        .addOptions([
          '-loglevel', 'debug',           // More detailed logging than verbose
          '-report',                      // Generate detailed log file (ffmpeg-YYYYMMDD-HHMMSS.log)
          '-fflags', '+genpts+discardcorrupt', // Generate timestamps + discard corrupted packets
          '-max_delay', '5000000',        // Increase max delay tolerance to 5 seconds (helps with RTP jitter)
          '-use_wallclock_as_timestamps', '1', // Use system clock for timestamps (helps with RTP jitter)
        ])
        // UNIFIED INPUT: ONE SDP file with both video and audio streams
        .input(sdpPath)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'sdp',
          '-rtbufsize', '100M',           // Increase RTP receive buffer to 100MB to prevent packet loss
          '-analyzeduration', '5000000',  // 5s analysis to wait for keyframe with SPS/PPS
          '-probesize', '10000000',       // 10MB probe size to buffer enough packets (increased from 5MB)
          '-reorder_queue_size', '5000',  // Large queue for packet reordering (handles network jitter)
          '-thread_queue_size', '4096',   // Large thread queue to prevent blocking
        ])
        // Video encoding - copy if SPS/PPS available, transcode otherwise
        .videoCodec(videoCodecName)
        // Audio encoding - transcode Opus to AAC for RTMP
        .audioCodec('aac');

      // Add video encoding options if transcoding
      if (!useVideoCopy) {
        command.outputOptions([
          '-preset', 'ultrafast',         // Ultra fast encoding for minimal latency
          '-tune', 'zerolatency',         // Optimize for streaming/low latency
          '-b:v', '5000k',                // Target bitrate 5 Mbps (match input roughly)
          '-maxrate', '6000k',            // Max bitrate 6 Mbps
          '-bufsize', '12000k',           // 2x maxrate buffer (12MB) - large buffer for transcoding
          '-g', '60',                     // Keyframe interval: 60 frames (2 seconds at 30fps)
          '-profile:v', 'high',           // H.264 High Profile as recommended by YouTube
          '-level', '4.1',                // H.264 Level 4.1 (supports 1080p30)
          '-x264-params', 'nal-hrd=cbr',  // Constant bitrate for stable streaming
        ]);
      }

      command
        .outputOptions([
          '-b:a', '160k',
          '-ar', '48000',
          '-ac', '2',
        ])
        // Output directly to single RTMP destination
        .format('flv')
        .output(rtmpUrl);

      // Add video-specific output options
      const videoOutputOpts = [
        '-map', '0:v',    // Video from unified input
        '-map', '0:a',    // Audio from unified input
        '-flvflags', 'no_duration_filesize',
        '-max_muxing_queue_size', '4096',  // Large muxing queue (4096 packets) to handle transcoding latency
        '-async', '1',                     // Audio sync method (stretch/squeeze)
        '-vsync', 'cfr',                   // Constant frame rate - important for live streaming
      ];

      // Only use dump_extra bitstream filter if we're copying video
      // (not needed when transcoding as encoder will generate new SPS/PPS)
      if (useVideoCopy) {
        videoOutputOpts.splice(2, 0, '-bsf:v', 'dump_extra');  // Insert after map commands
      }

      command.outputOptions(videoOutputOpts);
    } else {
      // MULTIPLE DESTINATIONS: Use tee muxer
      // Format: [f=flv:flvflags=no_duration_filesize]rtmp://url1|[f=flv:flvflags=no_duration_filesize]rtmp://url2
      const teeOutputs = destinations.map(dest => {
        const rtmpUrl = `${dest.rtmpUrl}/${dest.streamKey}`;
        return `[f=flv:flvflags=no_duration_filesize]${rtmpUrl}`;
      }).join('|');

      logger.info(`========== STARTING SINGLE FFMPEG PROCESS (UNIFIED INPUT, TEE MUXER) ==========`);
      logger.info(`Using tee muxer for ${destinations.length} destinations`);
      logger.info(`Video codec: ${videoCodecName}`);

      command = ffmpeg()
        // Global options - debug logging with detailed reports
        .addOptions([
          '-loglevel', 'debug',           // More detailed logging than verbose
          '-report',                      // Generate detailed log file (ffmpeg-YYYYMMDD-HHMMSS.log)
          '-fflags', '+genpts+discardcorrupt', // Generate timestamps + discard corrupted packets
          '-max_delay', '5000000',        // Increase max delay tolerance to 5 seconds (helps with RTP jitter)
          '-use_wallclock_as_timestamps', '1', // Use system clock for timestamps (helps with RTP jitter)
        ])
        // UNIFIED INPUT: ONE SDP file with both video and audio streams
        .input(sdpPath)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'sdp',
          '-rtbufsize', '100M',           // Increase RTP receive buffer to 100MB to prevent packet loss
          '-analyzeduration', '5000000',  // 5s analysis to wait for keyframe with SPS/PPS
          '-probesize', '10000000',       // 10MB probe size to buffer enough packets (increased from 5MB)
          '-reorder_queue_size', '5000',  // Large queue for packet reordering (handles network jitter)
          '-thread_queue_size', '4096',   // Large thread queue to prevent blocking
        ])
        // Video encoding - copy if SPS/PPS available, transcode otherwise
        .videoCodec(videoCodecName)
        // Audio encoding - transcode Opus to AAC for RTMP
        .audioCodec('aac');

      // Add video encoding options if transcoding
      if (!useVideoCopy) {
        command.outputOptions([
          '-preset', 'ultrafast',         // Ultra fast encoding for minimal latency
          '-tune', 'zerolatency',         // Optimize for streaming/low latency
          '-b:v', '5000k',                // Target bitrate 5 Mbps (match input roughly)
          '-maxrate', '6000k',            // Max bitrate 6 Mbps
          '-bufsize', '12000k',           // 2x maxrate buffer (12MB) - large buffer for transcoding
          '-g', '60',                     // Keyframe interval: 60 frames (2 seconds at 30fps)
          '-profile:v', 'high',           // H.264 High Profile as recommended by YouTube
          '-level', '4.1',                // H.264 Level 4.1 (supports 1080p30)
          '-x264-params', 'nal-hrd=cbr',  // Constant bitrate for stable streaming
        ]);
      }

      command
        .outputOptions([
          '-b:a', '160k',
          '-ar', '48000',
          '-ac', '2',
        ])
        // Use tee muxer to output to multiple destinations
        .format('tee')
        .output(teeOutputs);

      // Add video-specific output options
      const teeOutputOpts = [
        '-map', '0:v',    // Video from unified input
        '-map', '0:a',    // Audio from unified input
        '-max_muxing_queue_size', '4096',  // Large muxing queue (4096 packets) to handle transcoding latency
        '-async', '1',                     // Audio sync method (stretch/squeeze)
        '-vsync', 'cfr',                   // Constant frame rate - important for live streaming
      ];

      // Only use dump_extra bitstream filter if we're copying video
      if (useVideoCopy) {
        teeOutputOpts.splice(2, 0, '-bsf:v', 'dump_extra');  // Insert after map commands
      }

      command.outputOptions(teeOutputOpts);
    }

    command
      .on('start', (commandLine: string) => {
        logger.info(`========== FFMPEG MULTI-STREAM PROCESS STARTED ==========`);
        logger.info(`🚀 FFmpeg started for ${destinations.length} destination(s)`);
        logger.info(`⚙️  Command: ${commandLine}`);
        destinations.forEach((dest, index) => {
          logger.info(`  📺 [${index + 1}] ${dest.platform}: ${dest.rtmpUrl}`);
        });
      })
      .on('error', (err: Error, stdout: string | null, stderr: string | null) => {
        logger.error(`========== FFMPEG MULTI-STREAM ERROR ==========`);
        logger.error(`Error Message: ${err.message}`);
        logger.error(`Error Name: ${err.name}`);
        logger.error(`Error Stack:`, err.stack);
        logger.error(`Destinations: ${destinations.length} streams`);

        if (stdout) {
          logger.error(`========== FFMPEG STDOUT ==========`);
          logger.error(stdout);
        } else {
          logger.error(`STDOUT: (empty)`);
        }

        if (stderr) {
          logger.error(`========== FFMPEG STDERR ==========`);
          logger.error(stderr);
        } else {
          logger.error(`STDERR: (empty)`);
        }

        logger.error(`========== END FFMPEG ERROR ==========`);
      })
      .on('end', () => {
        logger.info(`FFmpeg multi-stream process ended for ${destinations.length} destination(s)`);
      })
      .on('stderr', (stderrLine: string) => {
        // Log ALL FFmpeg stderr output to visible logs for debugging
        // With -loglevel debug, we want to see EVERYTHING in the media server logs

        // CRITICAL: Highlight when video stream is detected (or missing!)
        if (stderrLine.includes('Stream #0:0') && stderrLine.includes('Video')) {
          logger.info(`[FFmpeg] ✅ VIDEO STREAM DETECTED: ${stderrLine}`);
        } else if (stderrLine.includes('Stream #0:1') && stderrLine.includes('Audio')) {
          logger.info(`[FFmpeg] ✅ AUDIO STREAM DETECTED: ${stderrLine}`);
        } else if (stderrLine.includes('Input #0') && stderrLine.includes('sdp')) {
          logger.info(`[FFmpeg] 📥 SDP INPUT OPENED: ${stderrLine}`);
        } else if (stderrLine.includes('Opening') && stderrLine.includes('rtmp://')) {
          logger.info(`[FFmpeg] 🔌 CONNECTING TO RTMP: ${stderrLine}`);
        } else if (stderrLine.includes('Metadata') || stderrLine.includes('onMetaData')) {
          logger.info(`[FFmpeg] 📤 RTMP METADATA SENT: ${stderrLine}`);
        } else if (stderrLine.includes('error') || stderrLine.includes('Error') ||
            stderrLine.includes('failed') || stderrLine.includes('Failed') ||
            stderrLine.includes('Invalid') || stderrLine.includes('invalid') ||
            stderrLine.includes('I/O error') || stderrLine.includes('Connection reset') ||
            stderrLine.includes('Broken pipe') || stderrLine.includes('Connection timed out') ||
            stderrLine.includes('rtmp') && (stderrLine.includes('error') || stderrLine.includes('failed'))) {
          // Errors are always logged at error level (including RTMP connection issues)
          logger.error(`[FFmpeg] ❌ ${stderrLine}`);
        } else if (stderrLine.includes('warning') || stderrLine.includes('Warning')) {
          // Warnings logged at warn level
          logger.warn(`[FFmpeg] ${stderrLine}`);
        } else if (stderrLine.includes('bitrate=') || stderrLine.includes('fps=') ||
                   stderrLine.includes('frame=') || stderrLine.includes('time=') ||
                   stderrLine.includes('speed=')) {
          // Progress info logged at info level (always visible)
          logger.info(`[FFmpeg] ${stderrLine}`);
        } else if (stderrLine.includes('RTP:') || stderrLine.includes('Input #') ||
                   stderrLine.includes('Output #') || stderrLine.includes('Stream #') ||
                   stderrLine.includes('codec') || stderrLine.includes('Codec')) {
          // Important stream/codec info logged at info level (always visible)
          logger.info(`[FFmpeg] ${stderrLine}`);
        } else {
          // Everything else logged at info level when using debug mode
          // This ensures we see ALL FFmpeg output in the logs
          logger.info(`[FFmpeg Debug] ${stderrLine}`);
        }
      });

    // Start FFmpeg process
    command.run();
    ffmpegProcesses.set(broadcastId, command); // Store single process by broadcast ID
    logger.info(`✅ FFmpeg multi-stream process started successfully for ${destinations.length} destination(s)`);

    // Store pipeline
    activePipelines.set(broadcastId, {
      videoPlainTransport: videoTransport,
      audioPlainTransport: audioTransport,
      videoConsumer,
      audioConsumer,
      ffmpegProcesses,
    });

    // DEBUG: Monitor video/audio packet flow every 5 seconds
    const monitorInterval = setInterval(async () => {
      try {
        const vProducerStats = await videoProducer.getStats();
        const aProducerStats = await audioProducer.getStats();
        const vConsumerStats = await videoConsumer.getStats();
        const aConsumerStats = await audioConsumer.getStats();

        // Extract packet counts from stats
        const videoProducerPackets = Array.from(vProducerStats.values())
          .filter((s: any) => s.type === 'outbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        const audioProducerPackets = Array.from(aProducerStats.values())
          .filter((s: any) => s.type === 'outbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        const videoConsumerPackets = Array.from(vConsumerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        const audioConsumerPackets = Array.from(aConsumerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        logger.info(`[Monitor] Broadcast ${broadcastId} - Video: Producer=${videoProducerPackets} pkts, Consumer=${videoConsumerPackets} pkts | Audio: Producer=${audioProducerPackets} pkts, Consumer=${audioConsumerPackets} pkts`);

        if (videoProducerPackets === 0) {
          logger.error(`❌ VIDEO PRODUCER HAS SENT 0 PACKETS! Compositor may not be generating video frames.`);
        }
        if (videoConsumerPackets === 0) {
          logger.error(`❌ VIDEO CONSUMER HAS RECEIVED 0 PACKETS! RTP video stream is not reaching FFmpeg.`);
        }
      } catch (error) {
        logger.error('Error monitoring packet stats:', error);
        clearInterval(monitorInterval);
      }
    }, 5000);

    // Store interval for cleanup
    (activePipelines.get(broadcastId) as any).monitorInterval = monitorInterval;

    logger.info(`Compositor pipeline created for broadcast ${broadcastId}`);
  } catch (error) {
    logger.error('Failed to create compositor pipeline:', error);
    throw error;
  }
}

/**
 * Stop and cleanup compositor pipeline
 */
export async function stopCompositorPipeline(broadcastId: string): Promise<void> {
  logger.info(`Stopping compositor pipeline for broadcast ${broadcastId}`);

  const pipeline = activePipelines.get(broadcastId);
  if (!pipeline) {
    logger.warn(`No pipeline found for broadcast ${broadcastId}`);
    return;
  }

  // Stop monitoring interval
  if ((pipeline as any).monitorInterval) {
    clearInterval((pipeline as any).monitorInterval);
    logger.info('Monitor interval stopped');
  }

  // Stop FFmpeg processes
  pipeline.ffmpegProcesses.forEach((command, destId) => {
    try {
      command.kill('SIGKILL');
      logger.info(`FFmpeg process stopped for destination ${destId}`);
    } catch (error) {
      logger.error(`Error stopping FFmpeg for destination ${destId}:`, error);
    }
  });

  // Clean up unified SDP file
  try {
    const fs = require('fs');
    const path = require('path');
    const sdpPath = path.join('/tmp', `unified_${broadcastId}.sdp`);

    if (fs.existsSync(sdpPath)) {
      fs.unlinkSync(sdpPath);
      logger.info('Unified SDP file deleted');
    }
  } catch (error) {
    logger.error('Error deleting SDP file:', error);
  }

  // Close consumers
  try {
    if (pipeline.videoConsumer && !pipeline.videoConsumer.closed) {
      pipeline.videoConsumer.close();
      logger.info('Video consumer closed');
    }
    if (pipeline.audioConsumer && !pipeline.audioConsumer.closed) {
      pipeline.audioConsumer.close();
      logger.info('Audio consumer closed');
    }
  } catch (error) {
    logger.error('Error closing consumers:', error);
  }

  // Close both plain transports
  try {
    if (pipeline.videoPlainTransport && !pipeline.videoPlainTransport.closed) {
      pipeline.videoPlainTransport.close();
      logger.info('Video plain transport closed');
    }
    if (pipeline.audioPlainTransport && !pipeline.audioPlainTransport.closed) {
      pipeline.audioPlainTransport.close();
      logger.info('Audio plain transport closed');
    }
  } catch (error) {
    logger.error('Error closing plain transports:', error);
  }

  activePipelines.delete(broadcastId);
  logger.info(`Compositor pipeline stopped for broadcast ${broadcastId}`);
}

/**
 * Check if pipeline is active
 */
export function isPipelineActive(broadcastId: string): boolean {
  return activePipelines.has(broadcastId);
}

/**
 * Get active pipelines
 */
export function getActivePipelines(): string[] {
  return Array.from(activePipelines.keys());
}

/**
 * Update destinations for an active pipeline
 */
export async function updatePipelineDestinations(
  broadcastId: string,
  destinations: RTMPDestination[]
): Promise<void> {
  logger.info(`Updating destinations for broadcast ${broadcastId}`);

  const pipeline = activePipelines.get(broadcastId);
  if (!pipeline) {
    throw new Error(`No pipeline found for broadcast ${broadcastId}`);
  }

  // Stop existing FFmpeg processes
  pipeline.ffmpegProcesses.forEach((command) => {
    try {
      command.kill('SIGKILL');
    } catch (error) {
      logger.error('Error stopping FFmpeg:', error);
    }
  });
  pipeline.ffmpegProcesses.clear();

  // Start new FFmpeg processes (implementation would be similar to createCompositorPipeline)
  logger.info('Pipeline destinations updated (implementation pending)');
}
