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

    // Create Plain RTP transports for video and audio
    const videoTransport = await router.createPlainTransport({
      listenIp: { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: true,
    });

    const audioTransport = await router.createPlainTransport({
      listenIp: { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: true,
    });

    logger.info(
      `Plain transports created - Video: ${videoTransport.tuple.localPort}, Audio: ${audioTransport.tuple.localPort}`
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

    // Get RTP parameters
    const videoPort = videoTransport.tuple.localPort;
    const audioPort = audioTransport.tuple.localPort;
    const videoPayloadType = videoConsumer.rtpParameters.codecs[0].payloadType;
    const audioPayloadType = audioConsumer.rtpParameters.codecs[0].payloadType;

    // Start FFmpeg for each destination
    const ffmpegProcesses = new Map<string, any>();

    for (const dest of destinations) {
      const rtmpUrl = `${dest.rtmpUrl}/${dest.streamKey}`;

      // Create FFmpeg command that consumes RTP
      const command = ffmpeg()
        // Video input (RTP)
        .input(`rtp://127.0.0.1:${videoPort}`)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'rtp',
          '-codec:v', 'h264',
        ])
        // Audio input (RTP)
        .input(`rtp://127.0.0.1:${audioPort}`)
        .inputOptions([
          '-protocol_whitelist', 'file,rtp,udp',
          '-f', 'rtp',
          '-codec:a', 'opus',
        ])
        // Video encoding
        .videoCodec('copy') // Copy H264 stream
        // Audio encoding
        .audioCodec('aac')
        .outputOptions([
          '-b:a', '160k',
          '-ar', '48000',
          '-ac', '2',
        ])
        // Output format
        .format('flv')
        .output(rtmpUrl)
        // FFmpeg options
        .outputOptions([
          '-preset', 'veryfast',
          '-tune', 'zerolatency',
          '-g', '60',
          '-profile:v', 'baseline',
          '-level', '3.1',
        ]);

      command
        .on('start', (commandLine) => {
          logger.info(`FFmpeg started for ${dest.platform}:`);
          logger.debug(commandLine);
        })
        .on('error', (err, stdout, stderr) => {
          logger.error(`FFmpeg error for ${dest.platform}:`, err.message);
          logger.debug('FFmpeg stderr:', stderr);
        })
        .on('end', () => {
          logger.info(`FFmpeg ended for ${dest.platform}`);
        })
        .on('stderr', (stderrLine) => {
          logger.debug(`FFmpeg (${dest.platform}):`, stderrLine);
        });

      try {
        command.run();
        ffmpegProcesses.set(dest.id, command);
        logger.info(`FFmpeg process started for ${dest.platform}`);
      } catch (error) {
        logger.error(`Failed to start FFmpeg for ${dest.platform}:`, error);
      }
    }

    // Store pipeline
    activePipelines.set(broadcastId, {
      videoPlainTransport: videoTransport,
      audioPlainTransport: audioTransport,
      ffmpegProcesses,
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

  // Close plain transports
  try {
    if (pipeline.videoPlainTransport) {
      await pipeline.videoPlainTransport.close();
    }
    if (pipeline.audioPlainTransport) {
      await pipeline.audioPlainTransport.close();
    }
    logger.info('Plain transports closed');
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
