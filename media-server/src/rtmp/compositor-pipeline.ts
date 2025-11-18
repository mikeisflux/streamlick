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
    const videoTransport = await router.createPlainTransport({
      listenIp: { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: true,
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
      listenIp: { ip: '127.0.0.1', announcedIp: undefined },
      rtcpMux: false,
      comedia: true,
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
        .on('start', (commandLine: string) => {
          logger.info(`FFmpeg started for ${dest.platform}:`);
          logger.debug(commandLine);
          diagnosticLogger.logFFmpeg(
            'CompositorPipeline',
            `FFmpeg process started for ${dest.platform}`,
            'info',
            {
              destination: dest.platform,
              destinationId: dest.id,
              videoPort,
              audioPort,
              rtmpUrl: dest.rtmpUrl,
              commandLine: commandLine.substring(0, 500),
            },
            broadcastId
          );
        })
        .on('error', (err: Error, stdout: string | null, stderr: string | null) => {
          logger.error(`FFmpeg error for ${dest.platform}:`, err.message);
          logger.debug('FFmpeg stderr:', stderr);
          diagnosticLogger.logError(
            'ffmpeg',
            'CompositorPipeline',
            `FFmpeg process error for ${dest.platform}`,
            err,
            {
              destination: dest.platform,
              destinationId: dest.id,
              stdout: stdout ? stdout.substring(0, 1000) : '',
              stderr: stderr ? stderr.substring(0, 1000) : '',
            },
            broadcastId
          );
        })
        .on('end', () => {
          logger.info(`FFmpeg ended for ${dest.platform}`);
          diagnosticLogger.logFFmpeg(
            'CompositorPipeline',
            `FFmpeg process ended for ${dest.platform}`,
            'info',
            { destination: dest.platform, destinationId: dest.id },
            broadcastId
          );
        })
        .on('stderr', (stderrLine: string) => {
          logger.debug(`FFmpeg (${dest.platform}):`, stderrLine);
          // Log bitrate and performance metrics from ffmpeg stderr
          if (stderrLine.includes('bitrate=') || stderrLine.includes('fps=')) {
            const bitrateMatch = stderrLine.match(/bitrate=\s*([\d.]+)kbits\/s/);
            const fpsMatch = stderrLine.match(/fps=\s*([\d.]+)/);
            if (bitrateMatch || fpsMatch) {
              diagnosticLogger.logPerformance(
                'ffmpeg',
                'FFmpegMetrics',
                `FFmpeg performance metrics for ${dest.platform}`,
                {
                  bitrate: bitrateMatch ? parseFloat(bitrateMatch[1]) : undefined,
                  frameRate: fpsMatch ? parseFloat(fpsMatch[1]) : undefined,
                },
                broadcastId
              );
            }
          }
        });

      try {
        command.run();
        ffmpegProcesses.set(dest.id, command);
        logger.info(`FFmpeg process started for ${dest.platform}`);
      } catch (error) {
        logger.error(`Failed to start FFmpeg for ${dest.platform}:`, error);
        diagnosticLogger.logError(
          'ffmpeg',
          'CompositorPipeline',
          `Failed to start FFmpeg for ${dest.platform}`,
          error as Error,
          { destination: dest.platform, destinationId: dest.id },
          broadcastId
        );
      }
    }

    // Store pipeline
    activePipelines.set(broadcastId, {
      videoPlainTransport: videoTransport,
      audioPlainTransport: audioTransport,
      videoConsumer,
      audioConsumer,
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
