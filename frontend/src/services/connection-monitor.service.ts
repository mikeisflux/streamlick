/**
 * Connection Quality Monitoring Service
 *
 * Monitors WebRTC connection quality by tracking:
 * - Packet loss
 * - Jitter
 * - Round-trip time (RTT)
 * - Bitrate
 * - Frame rate
 */

export interface ConnectionQuality {
  overall: 'excellent' | 'good' | 'fair' | 'poor';
  score: number; // 0-100
  metrics: {
    packetLoss: number; // percentage
    jitter: number; // milliseconds
    rtt: number; // milliseconds
    bitrate: number; // bits per second
    frameRate: number; // frames per second
  };
  timestamp: number;
}

export interface QualityThresholds {
  excellent: { packetLoss: number; jitter: number; rtt: number };
  good: { packetLoss: number; jitter: number; rtt: number };
  fair: { packetLoss: number; jitter: number; rtt: number };
}

class ConnectionMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private peerConnection: RTCPeerConnection | null = null;
  private qualityCallback?: (quality: ConnectionQuality) => void;
  private readonly monitoringIntervalMs = 2000; // Check every 2 seconds

  // Quality thresholds
  private readonly thresholds: QualityThresholds = {
    excellent: { packetLoss: 1, jitter: 30, rtt: 100 },
    good: { packetLoss: 3, jitter: 50, rtt: 200 },
    fair: { packetLoss: 5, jitter: 100, rtt: 400 },
  };

  /**
   * Start monitoring connection quality
   */
  startMonitoring(
    peerConnection: RTCPeerConnection,
    callback: (quality: ConnectionQuality) => void
  ): void {
    this.stopMonitoring();

    this.peerConnection = peerConnection;
    this.qualityCallback = callback;

    this.monitoringInterval = setInterval(() => {
      this.checkConnectionQuality();
    }, this.monitoringIntervalMs);

    // Initial check
    this.checkConnectionQuality();
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.peerConnection = null;
    this.qualityCallback = undefined;
  }

  /**
   * Check current connection quality
   */
  private async checkConnectionQuality(): Promise<void> {
    if (!this.peerConnection || !this.qualityCallback) return;

    try {
      const stats = await this.peerConnection.getStats();
      const quality = this.analyzeStats(stats);

      if (quality) {
        this.qualityCallback(quality);
      }
    } catch (error) {
      console.error('Error checking connection quality:', error);
    }
  }

  /**
   * Analyze WebRTC stats and calculate quality metrics
   */
  private analyzeStats(stats: RTCStatsReport): ConnectionQuality | null {
    let packetLoss = 0;
    let jitter = 0;
    let rtt = 0;
    let bitrate = 0;
    let frameRate = 0;

    let hasInboundStats = false;
    let hasOutboundStats = false;

    stats.forEach((report) => {
      // Inbound RTP stats (receiving)
      if (report.type === 'inbound-rtp' && report.kind === 'video') {
        hasInboundStats = true;

        // Calculate packet loss
        if (report.packetsLost !== undefined && report.packetsReceived !== undefined) {
          const totalPackets = report.packetsLost + report.packetsReceived;
          if (totalPackets > 0) {
            packetLoss = (report.packetsLost / totalPackets) * 100;
          }
        }

        // Jitter
        if (report.jitter !== undefined) {
          jitter = report.jitter * 1000; // Convert to milliseconds
        }

        // Frame rate
        if (report.framesPerSecond !== undefined) {
          frameRate = report.framesPerSecond;
        }

        // Bitrate calculation
        if (report.bytesReceived !== undefined && report.timestamp !== undefined) {
          // This would require storing previous values to calculate delta
          // For now, we'll use the instantaneous value if available
          bitrate = report.bytesReceived * 8; // Convert to bits
        }
      }

      // Outbound RTP stats (sending)
      if (report.type === 'outbound-rtp' && report.kind === 'video') {
        hasOutboundStats = true;

        // Frame rate
        if (report.framesPerSecond !== undefined) {
          frameRate = Math.max(frameRate, report.framesPerSecond);
        }
      }

      // Candidate pair stats (RTT)
      if (report.type === 'candidate-pair' && report.state === 'succeeded') {
        if (report.currentRoundTripTime !== undefined) {
          rtt = report.currentRoundTripTime * 1000; // Convert to milliseconds
        }
      }

      // Remote inbound RTP (for RTT from sender perspective)
      if (report.type === 'remote-inbound-rtp' && report.kind === 'video') {
        if (report.roundTripTime !== undefined) {
          rtt = Math.max(rtt, report.roundTripTime * 1000);
        }
      }
    });

    // Only return quality if we have meaningful stats
    if (!hasInboundStats && !hasOutboundStats) {
      return null;
    }

    const metrics = {
      packetLoss: Math.round(packetLoss * 100) / 100,
      jitter: Math.round(jitter * 100) / 100,
      rtt: Math.round(rtt),
      bitrate: Math.round(bitrate),
      frameRate: Math.round(frameRate),
    };

    const score = this.calculateQualityScore(metrics);
    const overall = this.determineOverallQuality(metrics);

    return {
      overall,
      score,
      metrics,
      timestamp: Date.now(),
    };
  }

  /**
   * Calculate a quality score (0-100)
   */
  private calculateQualityScore(metrics: ConnectionQuality['metrics']): number {
    let score = 100;

    // Packet loss penalty (up to -40 points)
    score -= Math.min(40, metrics.packetLoss * 8);

    // Jitter penalty (up to -20 points)
    score -= Math.min(20, (metrics.jitter / 200) * 20);

    // RTT penalty (up to -30 points)
    score -= Math.min(30, (metrics.rtt / 500) * 30);

    // Frame rate bonus/penalty (up to -10 points)
    if (metrics.frameRate > 0) {
      const frameRatePenalty = Math.max(0, (30 - metrics.frameRate) / 3);
      score -= Math.min(10, frameRatePenalty);
    }

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Determine overall quality rating
   */
  private determineOverallQuality(
    metrics: ConnectionQuality['metrics']
  ): ConnectionQuality['overall'] {
    const { packetLoss, jitter, rtt } = metrics;

    // Excellent: All metrics within excellent thresholds
    if (
      packetLoss <= this.thresholds.excellent.packetLoss &&
      jitter <= this.thresholds.excellent.jitter &&
      rtt <= this.thresholds.excellent.rtt
    ) {
      return 'excellent';
    }

    // Good: All metrics within good thresholds
    if (
      packetLoss <= this.thresholds.good.packetLoss &&
      jitter <= this.thresholds.good.jitter &&
      rtt <= this.thresholds.good.rtt
    ) {
      return 'good';
    }

    // Fair: All metrics within fair thresholds
    if (
      packetLoss <= this.thresholds.fair.packetLoss &&
      jitter <= this.thresholds.fair.jitter &&
      rtt <= this.thresholds.fair.rtt
    ) {
      return 'fair';
    }

    // Poor: Anything worse than fair
    return 'poor';
  }

  /**
   * Get quality description for display
   */
  getQualityDescription(quality: ConnectionQuality['overall']): string {
    switch (quality) {
      case 'excellent':
        return 'Excellent - Crystal clear connection';
      case 'good':
        return 'Good - Smooth streaming experience';
      case 'fair':
        return 'Fair - Minor quality issues may occur';
      case 'poor':
        return 'Poor - Significant quality degradation';
      default:
        return 'Unknown';
    }
  }

  /**
   * Get quality color for UI
   */
  getQualityColor(quality: ConnectionQuality['overall']): string {
    switch (quality) {
      case 'excellent':
        return '#10b981'; // green
      case 'good':
        return '#3b82f6'; // blue
      case 'fair':
        return '#f59e0b'; // orange
      case 'poor':
        return '#ef4444'; // red
      default:
        return '#6b7280'; // gray
    }
  }

  /**
   * Check if quality is acceptable for streaming
   */
  isQualityAcceptable(quality: ConnectionQuality): boolean {
    return quality.overall !== 'poor' && quality.score >= 50;
  }
}

export const connectionMonitorService = new ConnectionMonitorService();
