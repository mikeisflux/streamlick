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
import { diagnosticLogger } from '../services/diagnostic-logger.service';

interface Pipeline {
  videoPlainTransport: PlainTransport | null;
  audioPlainTransport: PlainTransport | null;
  videoConsumer: any | null;
  audioConsumer: any | null;
  ffmpegProcesses: Map<string, any>;
  keyframeInterval: NodeJS.Timeout | null;
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
    diagnosticLogger.logRTPPipeline(
      'CompositorPipeline',
      'Starting compositor pipeline creation',
      'info',
      { broadcastId, destinationCount: destinations.length },
      broadcastId
    );

    // Create Plain RTP transports for video and audio
    // Support both single-server (FFmpeg on same machine) and multi-server (FFmpeg on different machine)
    const useExternalFFmpeg = process.env.EXTERNAL_FFMPEG === 'true';

    const videoTransport = await router.createPlainTransport({
      listenIp: useExternalFFmpeg
        ? { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }
        : { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: false, // MediaSoup will send to FFmpeg's listening address
    });

    // Add error handler for video transport (listenererror for listening socket errors)
    videoTransport.on('listenererror', (error: any) => {
      logger.error(`Video plain transport listener error for broadcast ${broadcastId}:`, error);
      diagnosticLogger.logError(
        'rtp-pipeline',
        'PlainTransport',
        'Video plain transport listener error',
        new Error(String(error)),
        { transportId: videoTransport.id },
        broadcastId
      );
    });

    const audioTransport = await router.createPlainTransport({
      listenIp: useExternalFFmpeg
        ? { ip: '0.0.0.0', announcedIp: process.env.MEDIASOUP_ANNOUNCED_IP }
        : { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: false, // MediaSoup will send to FFmpeg's listening address
    });

    // Add error handler for audio transport (listenererror for listening socket errors)
    audioTransport.on('listenererror', (error: any) => {
      logger.error(`Audio plain transport listener error for broadcast ${broadcastId}:`, error);
      diagnosticLogger.logError(
        'rtp-pipeline',
        'PlainTransport',
        'Audio plain transport listener error',
        new Error(String(error)),
        { transportId: audioTransport.id },
        broadcastId
      );
    });

    logger.info(
      `Plain transports created - Video: ${videoTransport.tuple.localPort}, Audio: ${audioTransport.tuple.localPort}`
    );
    logger.info(
      `FFmpeg deployment mode: ${useExternalFFmpeg ? 'EXTERNAL (multi-server)' : 'LOCAL (same server)'}`
    );
    diagnosticLogger.logRTPPipeline(
      'PlainTransport',
      'Plain RTP transports created',
      'info',
      {
        videoPort: videoTransport.tuple.localPort,
        audioPort: audioTransport.tuple.localPort,
        videoTransportId: videoTransport.id,
        audioTransportId: audioTransport.id,
      },
      broadcastId
    );

    // Create consumers on the plain transports
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

    logger.info('Consumers created on plain transports');

    // Request keyframe from video producer to help FFmpeg start decoding
    let keyframeInterval: NodeJS.Timeout | null = null;
    try {
      await videoProducer.requestKeyFrame();
      logger.info('Requested initial keyframe from video producer');

      // Set up periodic keyframe requests (every 2 seconds)
      // This ensures FFmpeg always has fresh keyframes for encoding
      keyframeInterval = setInterval(async () => {
        try {
          await videoProducer.requestKeyFrame();
          logger.debug('Requested periodic keyframe from video producer');
        } catch (error) {
          logger.warn('Failed to request periodic keyframe:', error);
        }
      }, 2000);
      logger.info('Started periodic keyframe requests (every 2 seconds)');

      // Wait 1 second for keyframes to arrive before starting FFmpeg
      logger.info('Waiting 1 second for keyframes to arrive...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      logger.info('Keyframe wait complete, starting FFmpeg');
    } catch (error) {
      logger.warn('Failed to request keyframe:', error);
    }
    diagnosticLogger.logRTPPipeline(
      'Consumer',
      'RTP consumers created on plain transports',
      'info',
      {
        videoConsumerId: videoConsumer.id,
        audioConsumerId: audioConsumer.id,
        videoProducerId: videoProducer.id,
        audioProducerId: audioProducer.id,
      },
      broadcastId
    );

    // Get RTP parameters
    const videoPort = videoTransport.tuple.localPort;
    const audioPort = audioTransport.tuple.localPort;
    const videoPayloadType = videoConsumer.rtpParameters.codecs[0].payloadType;
    const audioPayloadType = audioConsumer.rtpParameters.codecs[0].payloadType;

    // Use appropriate IP based on deployment mode
    const mediaServerIp = useExternalFFmpeg
      ? (process.env.MEDIASOUP_ANNOUNCED_IP || 'localhost')
      : '127.0.0.1';

    logger.info(`========== FFMPEG MULTI-DESTINATION SETUP ==========`);
    logger.info(`Total destinations: ${destinations.length}`);
    logger.info(`Media Server IP: ${mediaServerIp}`);
    logger.info(`MediaSoup Video Port: ${videoPort} (MediaSoup sends FROM this port)`);
    logger.info(`MediaSoup Audio Port: ${audioPort} (MediaSoup sends FROM this port)`);
    logger.info(`Destinations:`);
    destinations.forEach((dest, index) => {
      logger.info(`  [${index + 1}] ${dest.platform}: ${dest.rtmpUrl}/${dest.streamKey?.substring(0, 20)}...`);
    });

    // FFmpeg will listen on different ports to avoid binding conflicts
    // MediaSoup uses ports 40000-40100 for WebRTC, FFmpeg uses 40200-40203 (RTP + RTCP for video and audio)
    // Available range: 40000-49999
    const ffmpegVideoPort = 40200;      // Video RTP
    const ffmpegVideoRtcpPort = 40201;  // Video RTCP
    const ffmpegAudioPort = 40202;      // Audio RTP
    const ffmpegAudioRtcpPort = 40203;  // Audio RTCP
    const ffmpegIp = '127.0.0.1';

    // Connect plain transports to tell MediaSoup where to send RTP/RTCP
    // MediaSoup will send RTP packets TO FFmpeg's listening ports
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

    // Create SDP files for FFmpeg to understand the RTP stream parameters
    // The SDP describes what MediaSoup is sending TO FFmpeg
    // The ports in SDP are the ports FFmpeg is LISTENING on (40200, 40202)
    const videoSdp = `v=0
o=- 0 0 IN IP4 ${ffmpegIp}
s=Video Stream
c=IN IP4 ${ffmpegIp}
t=0 0
m=video ${ffmpegVideoPort} RTP/AVP ${videoPayloadType}
a=rtpmap:${videoPayloadType} H264/90000
a=fmtp:${videoPayloadType} level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f
a=recvonly`;

    const audioSdp = `v=0
o=- 0 0 IN IP4 ${ffmpegIp}
s=Audio Stream
c=IN IP4 ${ffmpegIp}
t=0 0
m=audio ${ffmpegAudioPort} RTP/AVP ${audioPayloadType}
a=rtpmap:${audioPayloadType} opus/48000/2
a=recvonly`;

    // Write SDP files to /tmp
    const fs = require('fs');
    const path = require('path');
    const videoSdpPath = path.join('/tmp', `video_${broadcastId}.sdp`);
    const audioSdpPath = path.join('/tmp', `audio_${broadcastId}.sdp`);

    fs.writeFileSync(videoSdpPath, videoSdp);
    fs.writeFileSync(audioSdpPath, audioSdp);

    logger.info(`SDP files created for FFmpeg:`);
    logger.info(`  Video SDP: ${videoSdpPath} (listening on ${ffmpegVideoPort})`);
    logger.info(`  Audio SDP: ${audioSdpPath} (listening on ${ffmpegAudioPort})`);

    // Build tee output for multiple RTMP destinations
    // Format: [f=flv:flvflags=no_duration_filesize]rtmp://url1|[f=flv:flvflags=no_duration_filesize]rtmp://url2
    const teeOutputs = destinations.map(dest => {
      const rtmpUrl = `${dest.rtmpUrl}/${dest.streamKey}`;
      return `[f=flv:flvflags=no_duration_filesize]${rtmpUrl}`;
    }).join('|');

    logger.info(`========== STARTING SINGLE FFMPEG PROCESS ==========`);
    logger.info(`Using tee muxer for ${destinations.length} destinations`);

    // Start FFmpeg for all destinations using tee muxer
    const ffmpegProcesses = new Map<string, any>();

    // Create a single FFmpeg command that outputs to multiple destinations
    // FFmpeg uses SDP files to understand the RTP stream from MediaSoup
    const command = ffmpeg()
      // Global options - verbose logging for debugging
      .addOptions([
        '-loglevel', 'verbose',
      ])
      // Video input - SDP file describes the H.264 stream on port 40200
      .input(videoSdpPath)
      .inputOptions([
        '-protocol_whitelist', 'file,rtp,udp',
        '-f', 'sdp',
      ])
      // Audio input - SDP file describes the Opus stream on port 40202
      .input(audioSdpPath)
      .inputOptions([
        '-protocol_whitelist', 'file,rtp,udp',
        '-f', 'sdp',
      ])
      // Video encoding - copy H.264 stream (no transcoding needed!)
      // Browser now produces H.264 directly, which RTMP supports natively
      .videoCodec('copy')
      // Audio encoding - transcode Opus to AAC for RTMP
      .audioCodec('aac')
      .outputOptions([
        '-b:a', '160k',
        '-ar', '48000',
        '-ac', '2',
      ])
      // Use tee muxer to output to multiple destinations
      .format('tee')
      .output(teeOutputs)
      .outputOptions([
        '-map', '0:v',
        '-map', '1:a',
      ]);

    command
      .on('start', (commandLine: string) => {
        logger.info(`========== FFMPEG MULTI-STREAM PROCESS STARTED ==========`);
        logger.info(`🚀 FFmpeg started for ${destinations.length} destination(s)`);
        logger.info(`⚙️  Command: ${commandLine}`);
        destinations.forEach((dest, index) => {
          logger.info(`  📺 [${index + 1}] ${dest.platform}: ${dest.rtmpUrl}`);
        });
        diagnosticLogger.logFFmpeg(
          'CompositorPipeline',
          `FFmpeg multi-stream process started for ${destinations.length} destinations`,
          'info',
          {
            destinationCount: destinations.length,
            videoPort,
            audioPort,
            commandLine: commandLine.substring(0, 500),
          },
          broadcastId
        );
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

        diagnosticLogger.logError(
          'ffmpeg',
          'CompositorPipeline',
          `FFmpeg multi-stream process error`,
          err,
          {
            destinationCount: destinations.length,
            stdout: stdout ? stdout.substring(0, 1000) : '',
            stderr: stderr ? stderr.substring(0, 1000) : '',
          },
          broadcastId
        );
      })
      .on('end', () => {
        logger.info(`FFmpeg multi-stream process ended for ${destinations.length} destination(s)`);
        diagnosticLogger.logFFmpeg(
          'CompositorPipeline',
          `FFmpeg multi-stream process ended`,
          'info',
          { destinationCount: destinations.length },
          broadcastId
        );
      })
      .on('stderr', (stderrLine: string) => {
        // Log ALL stderr output to help diagnose issues
        if (stderrLine.includes('error') || stderrLine.includes('Error') ||
            stderrLine.includes('warning') || stderrLine.includes('Warning') ||
            stderrLine.includes('failed') || stderrLine.includes('Failed') ||
            stderrLine.includes('Invalid') || stderrLine.includes('invalid')) {
          logger.error(`[FFmpeg Multi-Stream] ${stderrLine}`);
        } else if (stderrLine.includes('bitrate=') || stderrLine.includes('fps=')) {
          logger.info(`[FFmpeg Multi-Stream] ${stderrLine}`);
          const bitrateMatch = stderrLine.match(/bitrate=\s*([\d.]+)kbits\/s/);
          const fpsMatch = stderrLine.match(/fps=\s*([\d.]+)/);
          if (bitrateMatch || fpsMatch) {
            diagnosticLogger.logPerformance(
              'ffmpeg',
              'FFmpegMetrics',
              `FFmpeg multi-stream performance metrics`,
              {
                bitrate: bitrateMatch ? parseFloat(bitrateMatch[1]) : undefined,
                frameRate: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
              },
              broadcastId
            );
          }
        } else {
          logger.debug(`[FFmpeg Multi-Stream] ${stderrLine}`);
        }
      });

    try {
      command.run();
      ffmpegProcesses.set(broadcastId, command); // Store single process by broadcast ID
      logger.info(`✅ FFmpeg multi-stream process started successfully for ${destinations.length} destination(s)`);
    } catch (error) {
      logger.error(`========== FAILED TO START FFMPEG MULTI-STREAM ==========`);
      logger.error(`Exception during command.run():`);
      logger.error(`Error:`, error);
      logger.error(`Error message: ${(error as Error).message}`);
      logger.error(`Error stack:`, (error as Error).stack);
      logger.error(`Destination count: ${destinations.length}`);
      logger.error(`Media Server IP: ${mediaServerIp}`);
      logger.error(`Video Port: ${videoPort}, Audio Port: ${audioPort}`);
      logger.error(`========== END FAILED TO START FFMPEG ==========`);
      diagnosticLogger.logError(
        'ffmpeg',
        'CompositorPipeline',
        `Failed to start FFmpeg multi-stream process`,
        error as Error,
        {
          destinationCount: destinations.length,
          mediaServerIp,
          videoPort,
          audioPort,
        },
        broadcastId
      );
    }

    // Store pipeline
    activePipelines.set(broadcastId, {
      videoPlainTransport: videoTransport,
      audioPlainTransport: audioTransport,
      videoConsumer,
      audioConsumer,
      ffmpegProcesses,
      keyframeInterval,
    });

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

  // Stop FFmpeg processes
  pipeline.ffmpegProcesses.forEach((command, destId) => {
    try {
      command.kill('SIGKILL');
      logger.info(`FFmpeg process stopped for destination ${destId}`);
    } catch (error) {
      logger.error(`Error stopping FFmpeg for destination ${destId}:`, error);
    }
  });

  // Stop keyframe interval
  if (pipeline.keyframeInterval) {
    clearInterval(pipeline.keyframeInterval);
    logger.info('Stopped periodic keyframe requests');
  }

  // Clean up SDP files
  try {
    const fs = require('fs');
    const path = require('path');
    const videoSdpPath = path.join('/tmp', `video_${broadcastId}.sdp`);
    const audioSdpPath = path.join('/tmp', `audio_${broadcastId}.sdp`);

    if (fs.existsSync(videoSdpPath)) {
      fs.unlinkSync(videoSdpPath);
      logger.info('Video SDP file deleted');
    }
    if (fs.existsSync(audioSdpPath)) {
      fs.unlinkSync(audioSdpPath);
      logger.info('Audio SDP file deleted');
    }
  } catch (error) {
    logger.error('Error deleting SDP files:', error);
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

  // Close plain transports
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
