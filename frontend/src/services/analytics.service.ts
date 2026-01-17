/**
 * Advanced Analytics Service
 *
 * Tracks viewer behavior, engagement metrics, and provides AI-powered insights.
 */

interface ViewerEvent {
  type: 'join' | 'leave' | 'engage' | 'idle';
  viewerId: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

interface ViewerSession {
  viewerId: string;
  joinTime: number;
  leaveTime?: number;
  duration?: number;
  engagementScore: number;
  events: ViewerEvent[];
}

interface EngagementMetrics {
  totalViewers: number;
  currentViewers: number;
  peakViewers: number;
  peakViewerTime: number;
  averageWatchTime: number;
  totalWatchTime: number;
  engagementRate: number;
  dropOffRate: number;
}

interface StreamInsight {
  type: 'warning' | 'info' | 'success';
  category: 'intro' | 'pacing' | 'engagement' | 'technical';
  message: string;
  suggestion: string;
  timestamp: number;
  severity: number; // 1-10
}

interface HeatmapData {
  timestamp: number;
  viewers: number;
  engagement: number;
}

class AnalyticsService {
  private sessions: Map<string, ViewerSession> = new Map();
  private events: ViewerEvent[] = [];
  private heatmapData: HeatmapData[] = [];
  private streamStartTime: number = 0;
  private isTracking: boolean = false;
  private trackingInterval: NodeJS.Timeout | null = null;

  /**
   * Start analytics tracking
   */
  startTracking(): void {
    if (this.isTracking) return;

    this.isTracking = true;
    this.streamStartTime = Date.now();
    this.sessions.clear();
    this.events = [];
    this.heatmapData = [];

    // Record heatmap data every 10 seconds
    this.trackingInterval = setInterval(() => {
      this.recordHeatmapSnapshot();
    }, 10000);

  }

  /**
   * Stop analytics tracking
   */
  stopTracking(): void {
    if (!this.isTracking) return;

    this.isTracking = false;

    if (this.trackingInterval) {
      clearInterval(this.trackingInterval);
      this.trackingInterval = null;
    }

    // Close all active sessions
    this.sessions.forEach((session) => {
      if (!session.leaveTime) {
        this.recordViewerLeave(session.viewerId);
      }
    });

  }

  /**
   * Record viewer join event
   */
  recordViewerJoin(viewerId: string, metadata?: Record<string, any>): void {
    if (!this.isTracking) return;

    const now = Date.now();

    // Create session
    const session: ViewerSession = {
      viewerId,
      joinTime: now,
      engagementScore: 0,
      events: [],
    };

    this.sessions.set(viewerId, session);

    // Record event
    const event: ViewerEvent = {
      type: 'join',
      viewerId,
      timestamp: now,
      metadata,
    };

    this.events.push(event);
    session.events.push(event);

  }

  /**
   * Record viewer leave event
   */
  recordViewerLeave(viewerId: string): void {
    if (!this.isTracking) return;

    const session = this.sessions.get(viewerId);
    if (!session) return;

    const now = Date.now();
    session.leaveTime = now;
    session.duration = (now - session.joinTime) / 1000; // seconds

    // Record event
    const event: ViewerEvent = {
      type: 'leave',
      viewerId,
      timestamp: now,
    };

    this.events.push(event);
    session.events.push(event);

  }

  /**
   * Record viewer engagement (chat, reaction, interaction)
   */
  recordEngagement(viewerId: string, type: string, metadata?: Record<string, any>): void {
    if (!this.isTracking) return;

    const session = this.sessions.get(viewerId);
    if (!session) return;

    const now = Date.now();

    // Increase engagement score
    session.engagementScore += 1;

    // Record event
    const event: ViewerEvent = {
      type: 'engage',
      viewerId,
      timestamp: now,
      metadata: { engagementType: type, ...metadata },
    };

    this.events.push(event);
    session.events.push(event);
  }

  /**
   * Record heatmap snapshot
   */
  private recordHeatmapSnapshot(): void {
    const now = Date.now();
    const currentViewers = this.getCurrentViewerCount();
    const recentEngagement = this.getRecentEngagementRate(30); // last 30 seconds

    this.heatmapData.push({
      timestamp: now,
      viewers: currentViewers,
      engagement: recentEngagement,
    });
  }

  /**
   * Get current viewer count
   */
  getCurrentViewerCount(): number {
    let count = 0;
    this.sessions.forEach((session) => {
      if (!session.leaveTime) {
        count++;
      }
    });
    return count;
  }

  /**
   * Get recent engagement rate
   */
  private getRecentEngagementRate(seconds: number): number {
    const now = Date.now();
    const cutoff = now - seconds * 1000;

    const recentEvents = this.events.filter(
      (e) => e.type === 'engage' && e.timestamp >= cutoff
    );

    const currentViewers = this.getCurrentViewerCount();
    if (currentViewers === 0) return 0;

    // Engagement rate = engagements per viewer per second
    return recentEvents.length / currentViewers / seconds;
  }

  /**
   * Get engagement metrics
   */
  getEngagementMetrics(): EngagementMetrics {
    const totalViewers = this.sessions.size;
    const currentViewers = this.getCurrentViewerCount();

    // Find peak viewers
    let peakViewers = 0;
    let peakViewerTime = 0;

    this.heatmapData.forEach((data) => {
      if (data.viewers > peakViewers) {
        peakViewers = data.viewers;
        peakViewerTime = data.timestamp;
      }
    });

    // Calculate average watch time
    let totalWatchTime = 0;
    this.sessions.forEach((session) => {
      const duration = session.duration || (Date.now() - session.joinTime) / 1000;
      totalWatchTime += duration;
    });

    const averageWatchTime = totalViewers > 0 ? totalWatchTime / totalViewers : 0;

    // Calculate engagement rate
    const totalEngagements = this.events.filter((e) => e.type === 'engage').length;
    const engagementRate = totalViewers > 0 ? totalEngagements / totalViewers : 0;

    // Calculate drop-off rate
    const leftViewers = Array.from(this.sessions.values()).filter((s) => s.leaveTime).length;
    const dropOffRate = totalViewers > 0 ? leftViewers / totalViewers : 0;

    return {
      totalViewers,
      currentViewers,
      peakViewers,
      peakViewerTime,
      averageWatchTime,
      totalWatchTime,
      engagementRate,
      dropOffRate,
    };
  }

  /**
   * Get heatmap data
   */
  getHeatmapData(): HeatmapData[] {
    return [...this.heatmapData];
  }

  /**
   * Generate AI insights based on analytics
   */
  generateInsights(): StreamInsight[] {
    const insights: StreamInsight[] = [];
    const metrics = this.getEngagementMetrics();
    const streamDuration = (Date.now() - this.streamStartTime) / 1000; // seconds

    // Insight 1: Intro length analysis
    if (streamDuration > 120) {
      // After 2 minutes
      const firstMinuteViewers = this.getViewersAtTime(60);
      const secondMinuteViewers = this.getViewersAtTime(120);

      if (firstMinuteViewers > 0 && secondMinuteViewers / firstMinuteViewers < 0.7) {
        insights.push({
          type: 'warning',
          category: 'intro',
          message: 'Your intro may be too long',
          suggestion: `${Math.round((1 - secondMinuteViewers / firstMinuteViewers) * 100)}% of viewers left in the first 2 minutes. Consider shortening your intro to 30-60 seconds.`,
          timestamp: Date.now(),
          severity: 7,
        });
      }
    }

    // Insight 2: Engagement analysis
    if (metrics.engagementRate < 0.5 && metrics.totalViewers > 5) {
      insights.push({
        type: 'info',
        category: 'engagement',
        message: 'Low viewer engagement detected',
        suggestion: 'Try asking questions, running polls, or encouraging chat interaction to boost engagement.',
        timestamp: Date.now(),
        severity: 5,
      });
    } else if (metrics.engagementRate > 2.0) {
      insights.push({
        type: 'success',
        category: 'engagement',
        message: 'Excellent engagement!',
        suggestion: 'Your viewers are highly engaged. Keep up the interactive content!',
        timestamp: Date.now(),
        severity: 2,
      });
    }

    // Insight 3: Drop-off rate analysis
    if (metrics.dropOffRate > 0.6 && metrics.totalViewers > 10) {
      insights.push({
        type: 'warning',
        category: 'pacing',
        message: 'High viewer drop-off rate',
        suggestion: `${Math.round(metrics.dropOffRate * 100)}% of viewers have left. Consider varying your content or increasing energy levels.`,
        timestamp: Date.now(),
        severity: 8,
      });
    }

    // Insight 4: Watch time analysis
    if (metrics.averageWatchTime < 120 && metrics.totalViewers > 5) {
      insights.push({
        type: 'info',
        category: 'pacing',
        message: 'Short average watch time',
        suggestion: `Average watch time is ${Math.round(metrics.averageWatchTime)}s. Hook viewers early and deliver value quickly.`,
        timestamp: Date.now(),
        severity: 6,
      });
    } else if (metrics.averageWatchTime > 600) {
      insights.push({
        type: 'success',
        category: 'pacing',
        message: 'Great viewer retention!',
        suggestion: `Viewers are staying for an average of ${Math.round(metrics.averageWatchTime / 60)} minutes. Excellent content!`,
        timestamp: Date.now(),
        severity: 2,
      });
    }

    // Insight 5: Peak viewers analysis
    if (metrics.peakViewers > metrics.currentViewers * 1.5 && metrics.peakViewers > 5) {
      const peakTime = new Date(metrics.peakViewerTime);
      insights.push({
        type: 'info',
        category: 'engagement',
        message: 'You had more viewers earlier',
        suggestion: `Peak was ${metrics.peakViewers} viewers at ${peakTime.toLocaleTimeString()}. Consider what worked then.`,
        timestamp: Date.now(),
        severity: 4,
      });
    }

    // Insight 6: Viewer growth trend
    if (streamDuration > 300) {
      // After 5 minutes
      const trend = this.getViewerTrend();
      if (trend === 'growing') {
        insights.push({
          type: 'success',
          category: 'engagement',
          message: 'Viewer count is growing!',
          suggestion: 'Your content is attracting more viewers. Keep it up!',
          timestamp: Date.now(),
          severity: 1,
        });
      } else if (trend === 'declining') {
        insights.push({
          type: 'warning',
          category: 'engagement',
          message: 'Viewer count is declining',
          suggestion: 'Try switching topics, increasing energy, or announcing upcoming content to retain viewers.',
          timestamp: Date.now(),
          severity: 7,
        });
      }
    }

    return insights.sort((a, b) => b.severity - a.severity);
  }

  /**
   * Get number of viewers at specific time
   */
  private getViewersAtTime(secondsFromStart: number): number {
    const targetTime = this.streamStartTime + secondsFromStart * 1000;

    // Find closest heatmap data point
    const closestData = this.heatmapData.reduce((prev, curr) => {
      return Math.abs(curr.timestamp - targetTime) < Math.abs(prev.timestamp - targetTime)
        ? curr
        : prev;
    }, this.heatmapData[0] || { timestamp: 0, viewers: 0, engagement: 0 });

    return closestData.viewers;
  }

  /**
   * Get viewer trend (growing, stable, declining)
   */
  private getViewerTrend(): 'growing' | 'stable' | 'declining' {
    if (this.heatmapData.length < 6) return 'stable'; // Need at least 1 minute of data

    const recentData = this.heatmapData.slice(-6); // Last 6 data points (1 minute)
    const olderData = this.heatmapData.slice(-12, -6); // Previous 6 data points

    const recentAvg = recentData.reduce((sum, d) => sum + d.viewers, 0) / recentData.length;
    const olderAvg = olderData.reduce((sum, d) => sum + d.viewers, 0) / olderData.length;

    if (recentAvg > olderAvg * 1.2) return 'growing';
    if (recentAvg < olderAvg * 0.8) return 'declining';
    return 'stable';
  }

  /**
   * Export analytics data
   */
  exportData(): {
    sessions: ViewerSession[];
    events: ViewerEvent[];
    heatmap: HeatmapData[];
    metrics: EngagementMetrics;
    insights: StreamInsight[];
  } {
    return {
      sessions: Array.from(this.sessions.values()),
      events: this.events,
      heatmap: this.heatmapData,
      metrics: this.getEngagementMetrics(),
      insights: this.generateInsights(),
    };
  }

  /**
   * Get stream duration
   */
  getStreamDuration(): number {
    if (!this.isTracking) return 0;
    return (Date.now() - this.streamStartTime) / 1000;
  }

  /**
   * Check if tracking is active
   */
  active(): boolean {
    return this.isTracking;
  }

  /**
   * Clear all analytics data
   */
  clear(): void {
    this.sessions.clear();
    this.events = [];
    this.heatmapData = [];
    this.streamStartTime = 0;
  }
}

export const analyticsService = new AnalyticsService();
export type {
  ViewerEvent,
  ViewerSession,
  EngagementMetrics,
  StreamInsight,
  HeatmapData,
};
