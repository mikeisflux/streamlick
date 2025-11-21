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

    // DO NOT CONNECT TRANSPORTS YET - we need FFmpeg to be listening first!
    // Connecting will cause MediaSoup to start sending immediately,
    // and FFmpeg will miss the initial packets with SPS/PPS headers
    logger.info(`Transports ready but NOT connected yet - will connect after FFmpeg starts`);
    logger.info(`Video will go to ${ffmpegIp}:${ffmpegVideoPort}, Audio to ${ffmpegIp}:${ffmpegAudioPort}`);

    // Request a keyframe from the producer before we start FFmpeg
    // This ensures the browser generates a keyframe with SPS/PPS headers
    try {
      logger.info('Requesting initial keyframe from video producer...');
      await videoConsumer.requestKeyFrame();
      logger.info('Initial keyframe requested');
    } catch (error) {
      logger.warn('Could not request initial keyframe:', error);
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

    // ALWAYS transcode video - this ensures we generate fresh SPS/PPS with libx264
    // PERFORMANCE FIX: Use stream copy instead of transcoding
    // Browser provides H.264 High profile - copy it directly to RTMP without re-encoding
    // This eliminates transcoding CPU load (~90% reduction) and prevents packet loss
    // Trade-off: Relies on browser sending proper SPS/PPS headers (we request keyframes to ensure this)
    const useVideoCopy = true;  // Use copy mode for performance
    const videoCodecName = useVideoCopy ? 'copy' : 'libx264';

    if (useVideoCopy) {
      logger.info('⚡ Using H.264 stream copy (no transcoding) for maximum performance');
    } else {
      logger.info('🎬 Using libx264 transcoding to ensure fresh SPS/PPS headers for RTMP');
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
        // Global options
        .addOptions([
          '-loglevel', 'info',            // Info level (less noisy than debug)
          '-fflags', '+genpts+discardcorrupt', // Generate timestamps if missing, discard corrupted packets
        ])
        // UNIFIED INPUT: ONE SDP file with both video and audio streams
        .input(sdpPath)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'sdp',
          '-rtbufsize', '50M',            // 50MB RTP buffer (moderate buffering)
          '-analyzeduration', '2000000',  // 2s analysis duration
          '-probesize', '5000000',        // 5MB probe size
          '-reorder_queue_size', '1000',  // 1000 packet reorder queue (increased for stability)
          '-thread_queue_size', '1024',   // Standard thread queue
          '-max_delay', '5000000',        // 5 second max delay (increased for stability)
          '-err_detect', 'ignore_err',    // CRITICAL: Ignore decoder errors (missing SPS/PPS) and wait for keyframe
          '-ec', '3',                     // Error concealment: guess missing data from surrounding frames
        ])
        // Video encoding - copy if SPS/PPS available, transcode otherwise
        .videoCodec(videoCodecName)
        // Audio encoding - transcode Opus to AAC for RTMP
        .audioCodec('aac');

      // Add video encoding options only if transcoding (not copy mode)
      if (!useVideoCopy) {
        command.outputOptions([
          '-preset', 'ultrafast',         // Ultra fast encoding for minimal latency
          '-tune', 'zerolatency',         // Optimize for streaming/low latency
          '-b:v', '5000k',                // Target bitrate 5 Mbps
          '-maxrate', '6000k',            // Max bitrate 6 Mbps
          '-bufsize', '12000k',           // 2x maxrate buffer (12MB)
          '-g', '60',                     // Keyframe interval: 60 frames (2s at 30fps, YouTube requires ≤4s)
          '-keyint_min', '60',            // Minimum keyframe interval (force regular keyframes)
          '-sc_threshold', '0',           // Disable scene change detection (prevents irregular keyframes)
          '-profile:v', 'high',           // H.264 High Profile as recommended by YouTube
          '-level', '4.1',                // H.264 Level 4.1 (supports 1080p30)
          '-x264-params', 'nal-hrd=cbr:force-cfr=1',  // CBR + force constant framerate
        ]);
      }

      command
        .outputOptions([
          '-b:a', '192k',              // YouTube recommends 192k for stereo
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
      ];

      // Frame sync method depends on codec mode
      if (useVideoCopy) {
        // Copy mode: Force constant frame rate to regenerate timestamps
        // RTP packets from MediaSoup may have missing/broken timestamps
        // Using CFR with explicit framerate ensures smooth, monotonic timestamps
        videoOutputOpts.push('-r', '30', '-fps_mode', 'cfr');
      } else {
        // Transcode mode: force constant frame rate for consistent output
        videoOutputOpts.push('-fps_mode', 'cfr');
      }

      // No bitstream filter needed - libx264 generates fresh SPS/PPS automatically
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
        // Global options
        .addOptions([
          '-loglevel', 'info',            // Info level (less noisy than debug)
          '-fflags', '+genpts+discardcorrupt', // Generate timestamps if missing, discard corrupted packets
        ])
        // UNIFIED INPUT: ONE SDP file with both video and audio streams
        .input(sdpPath)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'sdp',
          '-rtbufsize', '50M',            // 50MB RTP buffer (moderate buffering)
          '-analyzeduration', '2000000',  // 2s analysis duration
          '-probesize', '5000000',        // 5MB probe size
          '-reorder_queue_size', '1000',  // 1000 packet reorder queue (increased for stability)
          '-thread_queue_size', '1024',   // Standard thread queue
          '-max_delay', '5000000',        // 5 second max delay (increased for stability)
          '-err_detect', 'ignore_err',    // CRITICAL: Ignore decoder errors (missing SPS/PPS) and wait for keyframe
          '-ec', '3',                     // Error concealment: guess missing data from surrounding frames
        ])
        // Video encoding - copy if SPS/PPS available, transcode otherwise
        .videoCodec(videoCodecName)
        // Audio encoding - transcode Opus to AAC for RTMP
        .audioCodec('aac');

      // Add video encoding options only if transcoding (not copy mode)
      if (!useVideoCopy) {
        command.outputOptions([
          '-preset', 'ultrafast',         // Ultra fast encoding for minimal latency
          '-tune', 'zerolatency',         // Optimize for streaming/low latency
          '-b:v', '5000k',                // Target bitrate 5 Mbps
          '-maxrate', '6000k',            // Max bitrate 6 Mbps
          '-bufsize', '12000k',           // 2x maxrate buffer (12MB)
          '-g', '60',                     // Keyframe interval: 60 frames (2s at 30fps, YouTube requires ≤4s)
          '-keyint_min', '60',            // Minimum keyframe interval (force regular keyframes)
          '-sc_threshold', '0',           // Disable scene change detection (prevents irregular keyframes)
          '-profile:v', 'high',           // H.264 High Profile as recommended by YouTube
          '-level', '4.1',                // H.264 Level 4.1 (supports 1080p30)
          '-x264-params', 'nal-hrd=cbr:force-cfr=1',  // CBR + force constant framerate
        ]);
      }

      command
        .outputOptions([
          '-b:a', '192k',              // YouTube recommends 192k for stereo
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
      ];

      // Frame sync method depends on codec mode
      if (useVideoCopy) {
        // Copy mode: Force constant frame rate to regenerate timestamps
        // RTP packets from MediaSoup may have missing/broken timestamps
        // Using CFR with explicit framerate ensures smooth, monotonic timestamps
        teeOutputOpts.push('-r', '30', '-fps_mode', 'cfr');
      } else {
        // Transcode mode: force constant frame rate for consistent output
        teeOutputOpts.push('-fps_mode', 'cfr');
      }

      // No bitstream filter needed - libx264 generates fresh SPS/PPS automatically
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
        // Filter out repetitive debug noise that provides no diagnostic value
        // These messages can appear thousands of times per second and overwhelm logs
        if (
          stderrLine.includes('non-existing PPS') ||           // Repetitive decoder errors (handled by -err_detect ignore_err)
          stderrLine.includes('RTP: dropping old packet') ||   // Normal RTP jitter handling
          stderrLine.includes('nal_unit_type:') ||             // Low-level NAL unit debug spam
          stderrLine.includes('decode_slice_header error') ||  // Repetitive decoding errors
          stderrLine.includes('no frame!') ||                  // Repetitive frame drops
          stderrLine.includes('Last message repeated') ||      // Meta noise
          stderrLine.includes('sq: send') ||                   // Scheduler queue operations (per-packet spam)
          stderrLine.includes('sq: receive')                   // Scheduler queue operations (per-packet spam)
        ) {
          return; // Skip packet-level noise
        }

        // CRITICAL: Highlight when video stream is detected (or missing!)
        if (stderrLine.includes('Stream #0:0') && stderrLine.includes('Video')) {
          logger.info(`[FFmpeg] ✅ VIDEO STREAM DETECTED: ${stderrLine}`);
        } else if (stderrLine.includes('Stream #0:1') && stderrLine.includes('Audio')) {
          logger.info(`[FFmpeg] ✅ AUDIO STREAM DETECTED: ${stderrLine}`);
        } else if (stderrLine.includes('Input #0') && stderrLine.includes('sdp')) {
          logger.info(`[FFmpeg] 📥 SDP INPUT OPENED: ${stderrLine}`);
        } else if (stderrLine.includes('Output #0')) {
          logger.info(`[FFmpeg] 📤 OUTPUT CONFIGURED: ${stderrLine}`);
        } else if (stderrLine.includes('Opening') && stderrLine.includes('rtmp://')) {
          logger.info(`[FFmpeg] 🔌 CONNECTING TO RTMP: ${stderrLine}`);
        } else if (stderrLine.includes('Server version') || stderrLine.includes('Bandwidth')) {
          logger.info(`[FFmpeg] 🤝 RTMP HANDSHAKE: ${stderrLine}`);
        } else if (stderrLine.includes('Metadata') || stderrLine.includes('onMetaData')) {
          logger.info(`[FFmpeg] 📤 RTMP METADATA SENT: ${stderrLine}`);
        } else if (stderrLine.includes('Press [q] to stop')) {
          logger.info(`[FFmpeg] ▶️  ENCODING STARTED: ${stderrLine}`);
        } else if (stderrLine.includes('encoder') || stderrLine.includes('Encoder')) {
          logger.info(`[FFmpeg] ⚙️  ENCODER: ${stderrLine}`);
        } else if (stderrLine.includes('muxer') || stderrLine.includes('Muxer')) {
          logger.info(`[FFmpeg] ⚙️  MUXER: ${stderrLine}`);
        } else if (stderrLine.includes('error') || stderrLine.includes('Error') ||
            stderrLine.includes('failed') || stderrLine.includes('Failed') ||
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
          // Progress info logged at info level (shows encoding is working)
          logger.info(`[FFmpeg] 📊 ${stderrLine}`);
        } else if (stderrLine.includes('RTP:') || stderrLine.includes('Input #') ||
                   stderrLine.includes('Stream #') || stderrLine.includes('codec') ||
                   stderrLine.includes('Codec') || stderrLine.includes('Duration')) {
          // Important stream/codec info logged at info level (always visible)
          logger.info(`[FFmpeg] ${stderrLine}`);
        } else if (stderrLine.trim().length > 0) {
          // Everything else logged at info level (skip empty lines)
          logger.info(`[FFmpeg] ${stderrLine}`);
        }
      });

    // Start FFmpeg process - it will start listening on the RTP ports
    command.run();
    ffmpegProcesses.set(broadcastId, command); // Store single process by broadcast ID
    logger.info(`✅ FFmpeg process started and listening for RTP on ports ${ffmpegVideoPort} and ${ffmpegAudioPort}`);

    // CRITICAL: Wait for FFmpeg to fully initialize and start listening
    // If we connect too early, MediaSoup will send packets before FFmpeg is ready
    logger.info(`Waiting 2 seconds for FFmpeg to initialize...`);
    await new Promise(resolve => setTimeout(resolve, 2000));

    // NOW connect the transports - this will trigger MediaSoup to start sending RTP
    await videoTransport.connect({
      ip: ffmpegIp,
      port: ffmpegVideoPort,
      rtcpPort: ffmpegVideoRtcpPort,
    });
    logger.info(`✅ Video transport connected - MediaSoup sending RTP to ${ffmpegIp}:${ffmpegVideoPort}`);

    await audioTransport.connect({
      ip: ffmpegIp,
      port: ffmpegAudioPort,
      rtcpPort: ffmpegAudioRtcpPort,
    });
    logger.info(`✅ Audio transport connected - MediaSoup sending RTP to ${ffmpegIp}:${ffmpegAudioPort}`);

    // Request one more keyframe now that FFmpeg is definitely listening
    try {
      await videoConsumer.requestKeyFrame();
      logger.info(`🔑 Final keyframe requested after FFmpeg connection`);
    } catch (error) {
      logger.warn('Could not request final keyframe:', error);
    }

    logger.info(`✅ Pipeline fully connected and streaming to ${destinations.length} destination(s)`);

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
        // Producers receive packets FROM browser, so they have 'inbound-rtp' stats
        const videoProducerPackets = Array.from(vProducerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        const audioProducerPackets = Array.from(aProducerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .map((s: any) => s.packetCount)[0] || 0;

        // Consumers show what they RECEIVED from producer in inbound-rtp stats
        // For PlainRtpTransport, inbound shows what came from producer
        const videoConsumerPackets = Array.from(vConsumerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .reduce((sum: number, s: any) => sum + (s.packetCount || 0), 0);

        const audioConsumerPackets = Array.from(aConsumerStats.values())
          .filter((s: any) => s.type === 'inbound-rtp')
          .reduce((sum: number, s: any) => sum + (s.packetCount || 0), 0);

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
