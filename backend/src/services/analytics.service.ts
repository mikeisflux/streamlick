/**
 * Analytics Service
 *
 * Features:
 * - Real-time metrics collection during streams
 * - Broadcast analytics aggregation
 * - User lifetime analytics tracking
 * - Platform-wide analytics
 * - Historical data storage and retrieval
 */

import prisma from '../database/prisma';
import logger from '../utils/logger';
import { EventEmitter } from 'events';

export interface StreamMetricData {
  broadcastId: string;
  totalViewers: number;
  peakViewers: number;
  youtubeViewers?: number;
  facebookViewers?: number;
  twitchViewers?: number;
  xViewers?: number;
  rumbleViewers?: number;
  linkedinViewers?: number;
  customViewers?: number;
  bitrate?: number;
  framerate?: number;
  droppedFrames?: number;
  totalFrames?: number;
  packetLoss?: number;
  rtt?: number;
  totalChatMessages?: number;
  youtubeChatCount?: number;
  facebookChatCount?: number;
  twitchChatCount?: number;
  xChatCount?: number;
  rumbleChatCount?: number;
}

export interface BroadcastSummary {
  broadcastId: string;
  userId: string;
  totalDurationSeconds: number;
  startedAt: Date;
  endedAt?: Date;
  totalViewers: number;
  peakViewers: number;
  averageViewers: number;
  platforms: string[];
  chatMessages: number;
}

export class AnalyticsService extends EventEmitter {
  private static instance: AnalyticsService;
  private metricsCollectionIntervals: Map<string, NodeJS.Timeout> = new Map();
  private broadcastStartTimes: Map<string, Date> = new Map();

  private constructor() {
    super();
  }

  static getInstance(): AnalyticsService {
    if (!AnalyticsService.instance) {
      AnalyticsService.instance = new AnalyticsService();
    }
    return AnalyticsService.instance;
  }

  /**
   * Start collecting metrics for a broadcast
   */
  async startMetricsCollection(broadcastId: string, userId: string): Promise<void> {
    try {
      // Record start time
      this.broadcastStartTimes.set(broadcastId, new Date());

      // Create or update broadcast analytics record
      await prisma.broadcastAnalytics.upsert({
        where: { broadcastId },
        update: {
          startedAt: new Date(),
          endedAt: null,
        },
        create: {
          broadcastId,
          userId,
          startedAt: new Date(),
          totalDurationSeconds: 0,
          totalViewers: 0,
          peakViewers: 0,
          averageViewers: 0,
          totalViewTimeSeconds: 0,
          youtubeViews: 0,
          facebookViews: 0,
          twitchViews: 0,
          xViews: 0,
          rumbleViews: 0,
          linkedinViews: 0,
          customViews: 0,
          totalChatMessages: 0,
          totalSuperChats: 0,
          superChatRevenue: 0,
          averageBitrate: 0,
          averageFramerate: 0,
          totalDroppedFrames: 0,
          totalParticipants: 0,
          averageWatchTime: 0,
        },
      });

      // Start periodic metrics collection (every 30 seconds)
      const interval = setInterval(() => {
        this.emit('collect-metrics', broadcastId);
      }, 30000);

      this.metricsCollectionIntervals.set(broadcastId, interval);

      logger.info(`Started metrics collection for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Start metrics collection error:', error);
      throw error;
    }
  }

  /**
   * Stop collecting metrics and finalize analytics
   */
  async stopMetricsCollection(broadcastId: string): Promise<void> {
    try {
      // Stop interval
      const interval = this.metricsCollectionIntervals.get(broadcastId);
      if (interval) {
        clearInterval(interval);
        this.metricsCollectionIntervals.delete(broadcastId);
      }

      // Calculate total duration
      const startTime = this.broadcastStartTimes.get(broadcastId);
      const endTime = new Date();
      const durationSeconds = startTime
        ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        : 0;

      // Update broadcast analytics with final data
      const analytics = await prisma.broadcastAnalytics.update({
        where: { broadcastId },
        data: {
          endedAt: endTime,
          totalDurationSeconds: durationSeconds,
        },
      });

      // Aggregate final metrics
      await this.aggregateBroadcastMetrics(broadcastId);

      // Update user analytics
      await this.updateUserAnalytics(analytics.userId, broadcastId);

      // Update platform analytics
      await this.updatePlatformAnalytics(broadcastId);

      this.broadcastStartTimes.delete(broadcastId);

      logger.info(`Stopped metrics collection for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Stop metrics collection error:', error);
      throw error;
    }
  }

  /**
   * Record stream metrics snapshot
   */
  async recordMetric(data: StreamMetricData): Promise<void> {
    try {
      await prisma.streamMetric.create({
        data: {
          broadcastId: data.broadcastId,
          timestamp: new Date(),
          totalViewers: data.totalViewers,
          peakViewers: data.peakViewers,
          youtubeViewers: data.youtubeViewers || 0,
          facebookViewers: data.facebookViewers || 0,
          twitchViewers: data.twitchViewers || 0,
          xViewers: data.xViewers || 0,
          rumbleViewers: data.rumbleViewers || 0,
          linkedinViewers: data.linkedinViewers || 0,
          customViewers: data.customViewers || 0,
          bitrate: data.bitrate,
          framerate: data.framerate,
          droppedFrames: data.droppedFrames || 0,
          totalFrames: data.totalFrames || 0,
          packetLoss: data.packetLoss || 0,
          rtt: data.rtt,
          totalChatMessages: data.totalChatMessages || 0,
          youtubeChatCount: data.youtubeChatCount || 0,
          facebookChatCount: data.facebookChatCount || 0,
          twitchChatCount: data.twitchChatCount || 0,
          xChatCount: data.xChatCount || 0,
          rumbleChatCount: data.rumbleChatCount || 0,
        },
      });

      // Also update broadcast analytics in real-time
      if (data.peakViewers > 0) {
        await prisma.broadcastAnalytics.update({
          where: { broadcastId: data.broadcastId },
          data: {
            peakViewers: {
              set: Math.max(data.peakViewers, (await this.getCurrentPeakViewers(data.broadcastId)) || 0),
            },
          },
        });
      }
    } catch (error) {
      logger.error('Record metric error:', error);
    }
  }

  /**
   * Aggregate broadcast metrics after stream ends
   */
  private async aggregateBroadcastMetrics(broadcastId: string): Promise<void> {
    try {
      // Get all metrics for this broadcast
      const metrics = await prisma.streamMetric.findMany({
        where: { broadcastId },
        orderBy: { timestamp: 'asc' },
      });

      if (metrics.length === 0) {
        return;
      }

      // Calculate aggregates
      const totalMetrics = metrics.length;
      const sumViewers = metrics.reduce((sum, m) => sum + m.totalViewers, 0);
      const peakViewers = Math.max(...metrics.map(m => m.peakViewers));
      const averageViewers = Math.floor(sumViewers / totalMetrics);

      const sumBitrate = metrics.reduce((sum, m) => sum + (m.bitrate || 0), 0);
      const averageBitrate = Math.floor(sumBitrate / totalMetrics);

      const sumFramerate = metrics.reduce((sum, m) => sum + (m.framerate || 0), 0);
      const averageFramerate = Math.floor(sumFramerate / totalMetrics);

      const totalDroppedFrames = metrics.reduce((sum, m) => sum + m.droppedFrames, 0);

      const lastMetric = metrics[metrics.length - 1];

      // Platform views
      const youtubeViews = lastMetric.youtubeViewers;
      const facebookViews = lastMetric.facebookViewers;
      const twitchViews = lastMetric.twitchViewers;
      const xViews = lastMetric.xViewers;
      const rumbleViews = lastMetric.rumbleViewers;
      const linkedinViews = lastMetric.linkedinViewers;
      const customViews = lastMetric.customViewers;

      // Chat statistics
      const totalChatMessages = lastMetric.totalChatMessages;

      // Update broadcast analytics
      await prisma.broadcastAnalytics.update({
        where: { broadcastId },
        data: {
          totalViewers: sumViewers,
          peakViewers,
          averageViewers,
          youtubeViews,
          facebookViews,
          twitchViews,
          xViews,
          rumbleViews,
          linkedinViews,
          customViews,
          totalChatMessages,
          averageBitrate,
          averageFramerate,
          totalDroppedFrames,
        },
      });

      logger.info(`Aggregated metrics for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Aggregate broadcast metrics error:', error);
    }
  }

  /**
   * Update user lifetime analytics
   */
  private async updateUserAnalytics(userId: string, broadcastId: string): Promise<void> {
    try {
      // Get broadcast analytics
      const broadcast = await prisma.broadcastAnalytics.findUnique({
        where: { broadcastId },
      });

      if (!broadcast) {
        return;
      }

      // Get or create user analytics
      let userAnalytics = await prisma.userAnalytics.findUnique({
        where: { userId },
      });

      if (!userAnalytics) {
        userAnalytics = await prisma.userAnalytics.create({
          data: {
            userId,
            totalBroadcasts: 0,
            totalStreamTime: 0,
            totalViewers: 0,
            totalViewTime: 0,
            peakViewers: 0,
            longestStreamSeconds: 0,
            youtubeStreams: 0,
            facebookStreams: 0,
            twitchStreams: 0,
            xStreams: 0,
            rumbleStreams: 0,
            linkedinStreams: 0,
            totalChatMessages: 0,
            totalSuperChats: 0,
            superChatRevenue: 0,
          },
        });
      }

      // Update user analytics
      const isNewPeakViewers = broadcast.peakViewers > userAnalytics.peakViewers;
      const isNewLongest = broadcast.totalDurationSeconds > userAnalytics.longestStreamSeconds;

      await prisma.userAnalytics.update({
        where: { userId },
        data: {
          totalBroadcasts: { increment: 1 },
          totalStreamTime: { increment: broadcast.totalDurationSeconds },
          totalViewers: { increment: broadcast.totalViewers },
          totalViewTime: { increment: broadcast.totalViewTimeSeconds },
          peakViewers: isNewPeakViewers ? broadcast.peakViewers : undefined,
          peakViewersBroadcast: isNewPeakViewers ? broadcastId : undefined,
          longestStreamSeconds: isNewLongest ? broadcast.totalDurationSeconds : undefined,
          youtubeStreams: { increment: broadcast.youtubeViews > 0 ? 1 : 0 },
          facebookStreams: { increment: broadcast.facebookViews > 0 ? 1 : 0 },
          twitchStreams: { increment: broadcast.twitchViews > 0 ? 1 : 0 },
          xStreams: { increment: broadcast.xViews > 0 ? 1 : 0 },
          rumbleStreams: { increment: broadcast.rumbleViews > 0 ? 1 : 0 },
          linkedinStreams: { increment: broadcast.linkedinViews > 0 ? 1 : 0 },
          totalChatMessages: { increment: broadcast.totalChatMessages },
          totalSuperChats: { increment: broadcast.totalSuperChats },
          superChatRevenue: { increment: broadcast.superChatRevenue },
          lastBroadcastAt: new Date(),
        },
      });

      logger.info(`Updated user analytics for user ${userId}`);
    } catch (error) {
      logger.error('Update user analytics error:', error);
    }
  }

  /**
   * Update platform-wide analytics (daily aggregation)
   */
  private async updatePlatformAnalytics(broadcastId: string): Promise<void> {
    try {
      const broadcast = await prisma.broadcastAnalytics.findUnique({
        where: { broadcastId },
      });

      if (!broadcast || !broadcast.startedAt) {
        return;
      }

      // Get date (start of day)
      const date = new Date(broadcast.startedAt);
      date.setHours(0, 0, 0, 0);

      // Update analytics for each platform used
      const platforms = [
        { name: 'youtube', views: broadcast.youtubeViews },
        { name: 'facebook', views: broadcast.facebookViews },
        { name: 'twitch', views: broadcast.twitchViews },
        { name: 'x', views: broadcast.xViews },
        { name: 'rumble', views: broadcast.rumbleViews },
        { name: 'linkedin', views: broadcast.linkedinViews },
        { name: 'custom', views: broadcast.customViews },
      ];

      for (const platform of platforms) {
        if (platform.views > 0) {
          await prisma.platformAnalytics.upsert({
            where: {
              date_platform: {
                date,
                platform: platform.name,
              },
            },
            update: {
              totalStreams: { increment: 1 },
              totalViewers: { increment: platform.views },
              totalStreamTime: { increment: broadcast.totalDurationSeconds },
              totalChatMessages: { increment: broadcast.totalChatMessages },
            },
            create: {
              date,
              platform: platform.name,
              totalStreams: 1,
              totalViewers: platform.views,
              totalStreamTime: broadcast.totalDurationSeconds,
              totalChatMessages: broadcast.totalChatMessages,
              averageViewers: 0,
              averageBitrate: 0,
              averageStreamLength: 0,
            },
          });
        }
      }

      logger.info(`Updated platform analytics for broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Update platform analytics error:', error);
    }
  }

  /**
   * Get broadcast analytics
   */
  async getBroadcastAnalytics(broadcastId: string): Promise<any> {
    try {
      return await prisma.broadcastAnalytics.findUnique({
        where: { broadcastId },
      });
    } catch (error) {
      logger.error('Get broadcast analytics error:', error);
      return null;
    }
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(userId: string): Promise<any> {
    try {
      return await prisma.userAnalytics.findUnique({
        where: { userId },
      });
    } catch (error) {
      logger.error('Get user analytics error:', error);
      return null;
    }
  }

  /**
   * Get stream metrics for a broadcast (historical data)
   */
  async getStreamMetrics(
    broadcastId: string,
    startTime?: Date,
    endTime?: Date
  ): Promise<any[]> {
    try {
      return await prisma.streamMetric.findMany({
        where: {
          broadcastId,
          timestamp: {
            gte: startTime,
            lte: endTime,
          },
        },
        orderBy: { timestamp: 'asc' },
      });
    } catch (error) {
      logger.error('Get stream metrics error:', error);
      return [];
    }
  }

  /**
   * Get user broadcast history with analytics
   */
  async getUserBroadcastHistory(userId: string, limit: number = 50): Promise<any[]> {
    try {
      return await prisma.broadcastAnalytics.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: limit,
      });
    } catch (error) {
      logger.error('Get user broadcast history error:', error);
      return [];
    }
  }

  /**
   * Get platform analytics for date range
   */
  async getPlatformAnalytics(
    platform: string,
    startDate: Date,
    endDate: Date
  ): Promise<any[]> {
    try {
      return await prisma.platformAnalytics.findMany({
        where: {
          platform,
          date: {
            gte: startDate,
            lte: endDate,
          },
        },
        orderBy: { date: 'asc' },
      });
    } catch (error) {
      logger.error('Get platform analytics error:', error);
      return [];
    }
  }

  /**
   * Get current peak viewers for a broadcast
   */
  private async getCurrentPeakViewers(broadcastId: string): Promise<number | null> {
    try {
      const analytics = await prisma.broadcastAnalytics.findUnique({
        where: { broadcastId },
        select: { peakViewers: true },
      });
      return analytics?.peakViewers || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cleanup
   */
  cleanup(): void {
    // Stop all intervals
    this.metricsCollectionIntervals.forEach(interval => clearInterval(interval));
    this.metricsCollectionIntervals.clear();
    this.broadcastStartTimes.clear();
    this.removeAllListeners();
  }
}

export default AnalyticsService.getInstance();
