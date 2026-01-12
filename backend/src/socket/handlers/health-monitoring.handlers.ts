/**
 * Health Monitoring Socket Handlers
 *
 * Handles:
 * - Stream health monitoring start/stop
 * - Metrics updates (bitrate, framerate)
 * - Destination health tracking
 * - Adaptive bitrate control
 */

import { Socket, Server as SocketServer } from 'socket.io';
import { streamHealthMonitor } from '../../services/stream-health.service';
import logger from '../../utils/logger';

// Bitrate profile configuration for adaptive streaming
interface BitrateProfile {
  name: string;
  videoBitrate: number;
  audioBitrate: number;
  width: number;
  height: number;
  framerate: number;
}

// Available bitrate profiles
const BITRATE_PROFILES: BitrateProfile[] = [
  { name: 'Ultra', videoBitrate: 6000, audioBitrate: 192, width: 1920, height: 1080, framerate: 60 },
  { name: 'High', videoBitrate: 4500, audioBitrate: 160, width: 1920, height: 1080, framerate: 30 },
  { name: 'Medium', videoBitrate: 2500, audioBitrate: 128, width: 1280, height: 720, framerate: 30 },
  { name: 'Low', videoBitrate: 1200, audioBitrate: 96, width: 854, height: 480, framerate: 30 },
  { name: 'Very Low', videoBitrate: 600, audioBitrate: 64, width: 640, height: 360, framerate: 24 },
];

export function registerHealthMonitoringHandlers(socket: Socket, _io: SocketServer): void {
  // Start health monitoring
  socket.on('start-health-monitoring', ({ broadcastId }) => {
    try {
      streamHealthMonitor.startMonitoring(broadcastId);
      streamHealthMonitor.updateStatus(broadcastId, 'live');

      // Send initial metrics
      const metrics = streamHealthMonitor.getMetrics(broadcastId);
      if (metrics) {
        socket.emit('health-metrics', metrics);
      }
    } catch (error: any) {
      logger.error('Start health monitoring error:', error);
      socket.emit('error', { message: 'Failed to start health monitoring' });
    }
  });

  // Stop health monitoring
  socket.on('stop-health-monitoring', ({ broadcastId }) => {
    try {
      streamHealthMonitor.stopMonitoring(broadcastId);
    } catch (error: any) {
      logger.error('Stop health monitoring error:', error);
    }
  });

  // Update stream metrics (from media server or client)
  socket.on('update-stream-metrics', ({ broadcastId, bitrate, framerate }) => {
    try {
      if (bitrate !== undefined) {
        streamHealthMonitor.updateBitrate(broadcastId, bitrate);
      }
      if (framerate !== undefined) {
        streamHealthMonitor.updateFramerate(broadcastId, framerate);
      }
    } catch (error: any) {
      logger.error('Update stream metrics error:', error);
    }
  });

  // Update destination health
  socket.on('update-destination-health', ({ broadcastId, destinationId, health }) => {
    try {
      streamHealthMonitor.updateDestination(broadcastId, destinationId, health);
    } catch (error: any) {
      logger.error('Update destination health error:', error);
    }
  });

  // Get current health metrics
  socket.on('get-health-metrics', ({ broadcastId }) => {
    try {
      const metrics = streamHealthMonitor.getMetrics(broadcastId);
      socket.emit('health-metrics', metrics);
    } catch (error: any) {
      logger.error('Get health metrics error:', error);
      socket.emit('error', { message: 'Failed to get health metrics' });
    }
  });

  // Start adaptive bitrate
  socket.on('start-adaptive-bitrate', ({ broadcastId, initialProfile }) => {
    try {
      // This would integrate with the media-server's adaptive bitrate service
      socket.emit('adaptive-bitrate-started', { broadcastId, profile: initialProfile });
    } catch (error: any) {
      logger.error('Start adaptive bitrate error:', error);
      socket.emit('error', { message: 'Failed to start adaptive bitrate' });
    }
  });

  // Stop adaptive bitrate
  socket.on('stop-adaptive-bitrate', ({ broadcastId }) => {
    try {
      socket.emit('adaptive-bitrate-stopped', { broadcastId });
    } catch (error: any) {
      logger.error('Stop adaptive bitrate error:', error);
    }
  });

  // Set bitrate profile manually
  socket.on('set-bitrate-profile', ({ broadcastId, profileName }) => {
    try {
      socket.emit('bitrate-profile-updated', { broadcastId, profileName });
    } catch (error: any) {
      logger.error('Set bitrate profile error:', error);
      socket.emit('error', { message: 'Failed to set bitrate profile' });
    }
  });

  // Get available profiles
  socket.on('get-bitrate-profiles', () => {
    try {
      socket.emit('bitrate-profiles', BITRATE_PROFILES);
    } catch (error: any) {
      logger.error('Get bitrate profiles error:', error);
      socket.emit('error', { message: 'Failed to get bitrate profiles' });
    }
  });
}
