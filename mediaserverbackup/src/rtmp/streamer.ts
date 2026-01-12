import ffmpeg from 'fluent-ffmpeg';
import logger from '../utils/logger';
import { diagnosticLogger } from '../services/diagnostic-logger.service';

export interface RTMPDestination {
  id: string;
  platform: string;
  rtmpUrl: string;
  streamKey: string;
}

export interface StreamerOptions {
  width: number;
  height: number;
  fps: number;
  videoBitrate: string;
  audioBitrate: string;
}

enum StreamState {
  STREAMING = 'streaming',
  RECONNECTING = 'reconnecting',
  FAILED = 'failed',
  STOPPED = 'stopped'
}

interface StreamerState {
  command: any;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  state: StreamState;
  reconnectTimer?: NodeJS.Timeout;
}

const activeStreamers = new Map<string, StreamerState>();

// Configurable retry parameters via environment variables
const MAX_RETRIES = parseInt(process.env.RTMP_MAX_RETRIES || '5', 10);
const BASE_RETRY_DELAY = parseInt(process.env.RTMP_BASE_RETRY_DELAY || '2000', 10); // milliseconds

/**
 * Start RTMP streaming with automatic reconnection
 */
function createStream(
  broadcastId: string,
  dest: RTMPDestination,
  options: StreamerOptions,
  retryCount: number = 0
): void {
  const streamKey = `${broadcastId}-${dest.id}`;
  const rtmpUrl = `${dest.rtmpUrl}/${dest.streamKey}`;

  // Calculate encoder parameters dynamically for optimal streaming
  // Based on industry best practices: YouTube (6-8Mbps), Twitch (6Mbps max), Facebook (4Mbps recommended)
  const bitrateNumeric = parseInt(options.videoBitrate, 10);
  const bufsize = `${bitrateNumeric * 2}k`; // 2x bitrate for VBV buffer (industry standard)
  const gopSize = options.fps * 2; // 2-second keyframe interval (required by YouTube, Twitch, Facebook)

  const command = ffmpeg()
    .input('pipe:0')
    .inputFormat('rawvideo')
    .inputOptions([
      `-pix_fmt yuv420p`,
      `-s ${options.width}x${options.height}`,
      `-r ${options.fps}`,
    ])
    .videoCodec('libx264')
    .outputOptions([
      // Encoding preset: veryfast = good quality/speed balance for live streaming
      '-preset veryfast',

      // Tuning: zerolatency = minimize buffering for live streams
      '-tune zerolatency',

      // CBR simulation for consistent bitrate (required by most platforms)
      `-b:v ${options.videoBitrate}`,        // Target bitrate
      `-minrate ${options.videoBitrate}`,    // Min bitrate (for CBR simulation)
      `-maxrate ${options.videoBitrate}`,    // Max bitrate (for CBR simulation)
      `-bufsize ${bufsize}`,                  // VBV buffer size (2x bitrate)

      // GOP size: 2-second keyframe interval (platform requirement)
      `-g ${gopSize}`,

      // Profile: main provides better quality than baseline while maintaining compatibility
      '-profile:v main',
      '-level 4.0', // Level 4.0 supports 1080p @ 30fps

      // Reconnection settings for resilient streaming
      '-reconnect 1',
      '-reconnect_streamed 1',
      '-reconnect_delay_max 5',
    ])
    .audioCodec('aac')
    .outputOptions([
      `-b:a ${options.audioBitrate}`,
      '-ar 48000',  // 48kHz sample rate (industry standard)
      '-ac 2',      // Stereo audio
    ])
    .format('flv')
    .output(rtmpUrl);

  command
    .on('start', (commandLine: string) => {
      const startTime = Date.now();

      // Diagnostic logging
      diagnosticLogger.logFFmpeg(
        'FFmpegStreamer',
        `FFmpeg process started for ${dest.platform}`,
        'info',
        {
          destination: dest.platform,
          destinationId: dest.id,
          rtmpUrl: dest.rtmpUrl,
          attempt: retryCount + 1,
          options: {
            resolution: `${options.width}x${options.height}`,
            fps: options.fps,
            videoBitrate: options.videoBitrate,
            audioBitrate: options.audioBitrate,
          },
          commandLine: commandLine.substring(0, 500), // Truncate for brevity
          timestamp: startTime,
        },
        broadcastId
      );

      const state = activeStreamers.get(streamKey);
      if (state) {
        state.state = StreamState.STREAMING;
        (state as any).startTime = startTime;
      }
    })
    .on('error', (err: Error, stdout: string | null, stderr: string | null) => {
      logger.error(`FFmpeg error for ${dest.platform}:`, err.message);

      const state = activeStreamers.get(streamKey);
      if (!state) return;

      state.lastError = err.message;
      const duration = (state as any).startTime ? Date.now() - (state as any).startTime : 0;

      // Diagnostic logging for errors
      diagnosticLogger.logError(
        'ffmpeg',
        'FFmpegStreamer',
        `FFmpeg process error for ${dest.platform}`,
        err,
        {
          destination: dest.platform,
          destinationId: dest.id,
          retryCount: state.retryCount,
          maxRetries: state.maxRetries,
          duration,
          stdout: stdout ? stdout.substring(0, 1000) : '',
          stderr: stderr ? stderr.substring(0, 1000) : '',
        },
        broadcastId
      );

      // Check if we should retry (atomic state transition)
      if (state.retryCount < state.maxRetries && state.state === StreamState.STREAMING) {
        state.state = StreamState.RECONNECTING;
        state.retryCount++;

        // Calculate exponential backoff delay
        const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, state.retryCount - 1), 30000);

        // Log reconnection attempt
        diagnosticLogger.logFFmpeg(
          'FFmpegStreamer',
          `Scheduling reconnection for ${dest.platform}`,
          'warn',
          {
            destination: dest.platform,
            delay,
            attemptNumber: state.retryCount,
            maxRetries: state.maxRetries,
          },
          broadcastId
        );

        // Schedule reconnection
        state.reconnectTimer = setTimeout(() => {
          diagnosticLogger.logFFmpeg(
            'FFmpegStreamer',
            `Executing reconnection for ${dest.platform}`,
            'info',
            { destination: dest.platform, attemptNumber: state.retryCount },
            broadcastId
          );
          createStream(broadcastId, dest, options, state.retryCount);
        }, delay);
      } else {
        logger.error(
          `Max retries (${state.maxRetries}) reached for ${dest.platform}. Giving up.`
        );

        // Log final failure
        diagnosticLogger.logFFmpeg(
          'FFmpegStreamer',
          `Max retries reached for ${dest.platform}, stream failed`,
          'error',
          {
            destination: dest.platform,
            totalAttempts: state.retryCount,
            lastError: state.lastError,
          },
          broadcastId
        );

        activeStreamers.delete(streamKey);
      }
    })
    .on('end', () => {
      const state = activeStreamers.get(streamKey);
      const duration = (state as any)?.startTime ? Date.now() - (state as any).startTime : 0;

      // Diagnostic logging for normal end
      diagnosticLogger.logFFmpeg(
        'FFmpegStreamer',
        `FFmpeg process ended for ${dest.platform}`,
        'info',
        {
          destination: dest.platform,
          duration,
          wasReconnecting: state?.state === StreamState.RECONNECTING || false,
        },
        broadcastId
      );

      if (state && state.state === StreamState.STREAMING) {
        // Stream ended unexpectedly, try to reconnect (atomic state transition)
        if (state.retryCount < state.maxRetries) {
          state.state = StreamState.RECONNECTING;
          state.retryCount++;

          const delay = Math.min(BASE_RETRY_DELAY * Math.pow(2, state.retryCount - 1), 30000);

          // Log unexpected end and reconnection
          diagnosticLogger.logFFmpeg(
            'FFmpegStreamer',
            `Stream ended unexpectedly for ${dest.platform}, scheduling reconnection`,
            'warn',
            {
              destination: dest.platform,
              delay,
              attemptNumber: state.retryCount,
            },
            broadcastId
          );

          state.reconnectTimer = setTimeout(() => {
            createStream(broadcastId, dest, options, state.retryCount);
          }, delay);
        }
      }
    });

  // Store or update state BEFORE running command to avoid race condition
  const existingState = activeStreamers.get(streamKey);
  if (existingState) {
    existingState.command = command;
    existingState.state = StreamState.STREAMING;
  } else {
    activeStreamers.set(streamKey, {
      command,
      retryCount,
      maxRetries: MAX_RETRIES,
      state: StreamState.STREAMING,
    });
  }

  // Try to run the command - if it fails, remove from activeStreamers
  try {
    command.run();
  } catch (error) {
    logger.error(`Failed to start FFmpeg command for ${dest.platform}:`, error);
    diagnosticLogger.logError(
      'ffmpeg',
      'FFmpegStreamer',
      `Failed to run FFmpeg command for ${dest.platform}`,
      error as Error,
      { destination: dest.platform, destinationId: dest.id },
      broadcastId
    );
    // Remove from activeStreamers since command failed to start
    activeStreamers.delete(streamKey);
    return;
  }
}

export function startRTMPStream(
  broadcastId: string,
  destinations: RTMPDestination[],
  options: StreamerOptions = {
    width: 1920,
    height: 1080,
    fps: 30,
    videoBitrate: '4000k',
    audioBitrate: '160k',
  }
): void {
  // Create stream for each destination
  destinations.forEach((dest) => {
    const streamKey = `${broadcastId}-${dest.id}`;

    if (activeStreamers.has(streamKey)) {
      return;
    }

    createStream(broadcastId, dest, options, 0);
  });
}

export function stopRTMPStream(broadcastId: string): void {
  activeStreamers.forEach((state, key) => {
    if (key.startsWith(broadcastId)) {
      try {
        // Clear any pending reconnection timers
        if (state.reconnectTimer) {
          clearTimeout(state.reconnectTimer);
        }

        // Kill the FFmpeg command
        if (state.command) {
          state.command.kill('SIGKILL');
        }

        activeStreamers.delete(key);
      } catch (error) {
        logger.error(`Error stopping stream ${key}:`, error);
      }
    }
  });
}

export function isStreamActive(broadcastId: string): boolean {
  for (const key of activeStreamers.keys()) {
    if (key.startsWith(broadcastId)) {
      return true;
    }
  }
  return false;
}

export function getActiveStreams(): string[] {
  return Array.from(activeStreamers.keys());
}

/**
 * Get retry statistics for a specific destination
 */
export function getStreamStats(broadcastId: string, destinationId: string): {
  retryCount: number;
  maxRetries: number;
  lastError?: string;
  state: StreamState;
} | null {
  const streamKey = `${broadcastId}-${destinationId}`;
  const state = activeStreamers.get(streamKey);

  if (!state) {
    return null;
  }

  return {
    retryCount: state.retryCount,
    maxRetries: state.maxRetries,
    lastError: state.lastError,
    state: state.state,
  };
}

/**
 * Get all stream stats for a broadcast
 */
export function getAllStreamStats(broadcastId: string): Map<string, any> {
  const stats = new Map();

  activeStreamers.forEach((state, key) => {
    if (key.startsWith(broadcastId)) {
      const destinationId = key.replace(`${broadcastId}-`, '');
      stats.set(destinationId, {
        retryCount: state.retryCount,
        maxRetries: state.maxRetries,
        lastError: state.lastError,
        state: state.state,
      });
    }
  });

  return stats;
}

/**
 * Manually retry a failed stream
 */
export function retryStream(
  broadcastId: string,
  destinationId: string,
  dest: RTMPDestination,
  options: StreamerOptions
): boolean {
  const streamKey = `${broadcastId}-${destinationId}`;
  const state = activeStreamers.get(streamKey);

  if (!state) {
    return false;
  }

  if (state.state === StreamState.RECONNECTING) {
    return false;
  }

  // Clear any pending reconnection timer
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = undefined;
  }

  // Clear existing command if any
  if (state.command) {
    try {
      state.command.kill('SIGKILL');
    } catch (error) {
      // Ignore
    }
  }

  // Reset retry count
  state.retryCount = 0;
  state.lastError = undefined;

  // Recreate stream
  createStream(broadcastId, dest, options, 0);

  return true;
}
