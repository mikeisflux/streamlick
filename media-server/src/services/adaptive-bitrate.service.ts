import { EventEmitter } from 'events';
import logger from '../../../backend/src/utils/logger';

export interface BitrateProfile {
  name: string;
  videoBitrate: number; // kbps
  audioBitrate: number; // kbps
  width: number;
  height: number;
  framerate: number;
}

export interface NetworkCondition {
  quality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  avgRtt: number; // ms
  avgPacketLoss: number; // percentage
  avgBitrate: number; // kbps
  dropRate: number; // percentage
}

export interface BitrateAdjustment {
  broadcastId: string;
  oldProfile: BitrateProfile;
  newProfile: BitrateProfile;
  reason: string;
  timestamp: Date;
}

/**
 * Adaptive Bitrate Control Service
 * Automatically adjusts stream quality based on network conditions
 *
 * Platform Compatibility:
 * - YouTube: Max 51 Mbps, recommended 6-8 Mbps for 1080p
 * - Twitch: Max 6000 Kbps (6 Mbps)
 * - Facebook: Recommended 4000 Kbps for 1080p
 * - LinkedIn: Max 5 Mbps
 * - Twitter/X: Recommended 3-6 Mbps for 1080p
 */
export class AdaptiveBitrateService extends EventEmitter {
  private profiles: BitrateProfile[] = [
    // 4K profiles (for custom RTMP or YouTube 4K)
    // WARNING: Exceeds Twitch, Facebook limits - use only for compatible platforms
    {
      name: '4K Ultra',
      videoBitrate: 20000, // 20 Mbps - YouTube 4K @ 60fps
      audioBitrate: 256,   // High quality audio
      width: 3840,
      height: 2160,
      framerate: 60,
    },
    {
      name: '4K High',
      videoBitrate: 15000, // 15 Mbps - YouTube 4K @ 30fps
      audioBitrate: 192,
      width: 3840,
      height: 2160,
      framerate: 30,
    },

    // 1080p profiles (recommended for most platforms)
    {
      name: '1080p Ultra',
      videoBitrate: 8000, // 8 Mbps - YouTube recommended max for 1080p @ 60fps
      audioBitrate: 160,  // Optimized for stereo
      width: 1920,
      height: 1080,
      framerate: 60,
    },
    {
      name: '1080p High',
      videoBitrate: 6000, // 6 Mbps - Twitch max, YouTube recommended for 1080p @ 30fps
      audioBitrate: 160,
      width: 1920,
      height: 1080,
      framerate: 30,
    },
    {
      name: '1080p Medium',
      videoBitrate: 4000, // 4 Mbps - Facebook recommended for 1080p
      audioBitrate: 128,
      width: 1920,
      height: 1080,
      framerate: 30,
    },

    // 720p profiles (good fallback for network issues)
    {
      name: '720p High',
      videoBitrate: 3500, // 3.5 Mbps - Good quality 720p
      audioBitrate: 128,
      width: 1280,
      height: 720,
      framerate: 30,
    },
    {
      name: '720p Medium',
      videoBitrate: 2500, // 2.5 Mbps - Standard 720p
      audioBitrate: 128,
      width: 1280,
      height: 720,
      framerate: 30,
    },

    // Lower quality profiles (for poor network conditions)
    {
      name: '480p Low',
      videoBitrate: 1200,
      audioBitrate: 96,
      width: 854,
      height: 480,
      framerate: 30,
    },
    {
      name: '360p Very Low',
      videoBitrate: 600,
      audioBitrate: 64,
      width: 640,
      height: 360,
      framerate: 24,
    },
  ];

  private currentProfiles: Map<string, BitrateProfile> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();
  private adjustmentHistory: Map<string, BitrateAdjustment[]> = new Map();

  // Adjustment parameters
  private readonly ADJUSTMENT_INTERVAL = 10000; // Check every 10 seconds
  private readonly STABILITY_THRESHOLD = 3; // Require 3 consecutive bad readings before downgrade
  private readonly UPGRADE_THRESHOLD = 5; // Require 5 consecutive good readings before upgrade
  private stabilityCounters: Map<string, { bad: number; good: number }> = new Map();

  /**
   * Start adaptive bitrate control for a broadcast
   */
  startAdaptiveBitrate(broadcastId: string, initialProfile?: BitrateProfile): void {
    if (this.monitoringIntervals.has(broadcastId)) {
      logger.warn(`Adaptive bitrate already enabled for broadcast ${broadcastId}`);
      return;
    }

    // Set initial profile (default to 1080p High @ 6000 kbps for maximum platform compatibility)
    // 6000 kbps works for: Twitch (max), YouTube (recommended), Facebook, LinkedIn, Twitter/X
    const profile = initialProfile || this.profiles[3]; // 1080p High (6000 kbps)
    this.currentProfiles.set(broadcastId, profile);
    this.stabilityCounters.set(broadcastId, { bad: 0, good: 0 });
    this.adjustmentHistory.set(broadcastId, []);

    logger.info(`Starting adaptive bitrate for broadcast ${broadcastId} with profile: ${profile.name}`);

    // Monitor and adjust every 10 seconds
    const interval = setInterval(() => {
      this.checkAndAdjust(broadcastId);
    }, this.ADJUSTMENT_INTERVAL);

    this.monitoringIntervals.set(broadcastId, interval);
  }

  /**
   * Stop adaptive bitrate control
   */
  stopAdaptiveBitrate(broadcastId: string): void {
    const interval = this.monitoringIntervals.get(broadcastId);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(broadcastId);
    }

    this.currentProfiles.delete(broadcastId);
    this.stabilityCounters.delete(broadcastId);

    logger.info(`Stopped adaptive bitrate for broadcast ${broadcastId}`);
  }

  /**
   * Get current profile for a broadcast
   */
  getCurrentProfile(broadcastId: string): BitrateProfile | null {
    return this.currentProfiles.get(broadcastId) || null;
  }

  /**
   * Get all available profiles
   */
  getAvailableProfiles(): BitrateProfile[] {
    return [...this.profiles];
  }

  /**
   * Get adjustment history for a broadcast
   */
  getAdjustmentHistory(broadcastId: string): BitrateAdjustment[] {
    return this.adjustmentHistory.get(broadcastId) || [];
  }

  /**
   * Manually set profile (disables adaptive for this adjustment)
   */
  setProfile(broadcastId: string, profileName: string): boolean {
    const profile = this.profiles.find((p) => p.name === profileName);
    if (!profile) {
      logger.error(`Profile not found: ${profileName}`);
      return false;
    }

    const oldProfile = this.currentProfiles.get(broadcastId);
    if (!oldProfile) {
      logger.error(`No active profile for broadcast ${broadcastId}`);
      return false;
    }

    this.currentProfiles.set(broadcastId, profile);

    // Record adjustment
    const adjustment: BitrateAdjustment = {
      broadcastId,
      oldProfile,
      newProfile: profile,
      reason: 'Manual adjustment',
      timestamp: new Date(),
    };
    this.recordAdjustment(broadcastId, adjustment);

    // Emit event
    this.emit('bitrate-adjusted', adjustment);

    logger.info(`Manually set profile for broadcast ${broadcastId} to ${profile.name}`);
    return true;
  }

  /**
   * Check network conditions and adjust bitrate if needed
   */
  private async checkAndAdjust(broadcastId: string): Promise<void> {
    try {
      // Get network condition (this would come from stream-health.service in real implementation)
      const condition = await this.getNetworkCondition(broadcastId);
      if (!condition) return;

      const currentProfile = this.currentProfiles.get(broadcastId);
      if (!currentProfile) return;

      const counters = this.stabilityCounters.get(broadcastId);
      if (!counters) return;

      // Determine if we should adjust
      const shouldDowngrade = this.shouldDowngrade(condition);
      const shouldUpgrade = this.shouldUpgrade(condition);

      if (shouldDowngrade) {
        counters.bad++;
        counters.good = 0; // Reset good counter

        if (counters.bad >= this.STABILITY_THRESHOLD) {
          this.downgradeProfile(broadcastId, condition);
          counters.bad = 0; // Reset after adjustment
        }
      } else if (shouldUpgrade) {
        counters.good++;
        counters.bad = 0; // Reset bad counter

        if (counters.good >= this.UPGRADE_THRESHOLD) {
          this.upgradeProfile(broadcastId, condition);
          counters.good = 0; // Reset after adjustment
        }
      } else {
        // Stable - reset counters
        counters.bad = 0;
        counters.good = 0;
      }
    } catch (error: any) {
      logger.error(`Error checking adaptive bitrate for ${broadcastId}:`, error.message);
    }
  }

  /**
   * Get network condition (stub - would integrate with stream-health.service)
   */
  private async getNetworkCondition(broadcastId: string): Promise<NetworkCondition | null> {
    // In production, this would fetch from stream-health.service
    // For now, return null (caller would need to integrate)
    return null;
  }

  /**
   * Determine if we should downgrade
   */
  private shouldDowngrade(condition: NetworkCondition): boolean {
    // Downgrade if network is poor or critical
    if (condition.quality === 'poor' || condition.quality === 'critical') {
      return true;
    }

    // Downgrade if packet loss > 5% or drop rate > 3%
    if (condition.avgPacketLoss > 5 || condition.dropRate > 3) {
      return true;
    }

    // Downgrade if RTT > 300ms consistently
    if (condition.avgRtt > 300) {
      return true;
    }

    return false;
  }

  /**
   * Determine if we should upgrade
   */
  private shouldUpgrade(condition: NetworkCondition): boolean {
    // Only upgrade if network is excellent or good
    if (condition.quality !== 'excellent' && condition.quality !== 'good') {
      return false;
    }

    // Upgrade if packet loss < 0.5% and drop rate < 0.5%
    if (condition.avgPacketLoss < 0.5 && condition.dropRate < 0.5) {
      return true;
    }

    // Upgrade if RTT < 100ms consistently
    if (condition.avgRtt < 100) {
      return true;
    }

    return false;
  }

  /**
   * Downgrade to lower quality profile
   */
  private downgradeProfile(broadcastId: string, condition: NetworkCondition): void {
    const currentProfile = this.currentProfiles.get(broadcastId);
    if (!currentProfile) return;

    const currentIndex = this.profiles.findIndex((p) => p.name === currentProfile.name);
    if (currentIndex === -1 || currentIndex === this.profiles.length - 1) {
      logger.warn(`Already at lowest profile for broadcast ${broadcastId}`);
      return;
    }

    const newProfile = this.profiles[currentIndex + 1];
    this.currentProfiles.set(broadcastId, newProfile);

    const adjustment: BitrateAdjustment = {
      broadcastId,
      oldProfile: currentProfile,
      newProfile,
      reason: `Network degradation: ${condition.quality} quality, ${condition.avgPacketLoss.toFixed(1)}% packet loss`,
      timestamp: new Date(),
    };

    this.recordAdjustment(broadcastId, adjustment);
    this.emit('bitrate-adjusted', adjustment);

    logger.warn(`Downgraded broadcast ${broadcastId}: ${currentProfile.name} → ${newProfile.name}`);
  }

  /**
   * Upgrade to higher quality profile
   */
  private upgradeProfile(broadcastId: string, condition: NetworkCondition): void {
    const currentProfile = this.currentProfiles.get(broadcastId);
    if (!currentProfile) return;

    const currentIndex = this.profiles.findIndex((p) => p.name === currentProfile.name);
    if (currentIndex === -1 || currentIndex === 0) {
      logger.info(`Already at highest profile for broadcast ${broadcastId}`);
      return;
    }

    const newProfile = this.profiles[currentIndex - 1];
    this.currentProfiles.set(broadcastId, newProfile);

    const adjustment: BitrateAdjustment = {
      broadcastId,
      oldProfile: currentProfile,
      newProfile,
      reason: `Network improvement: ${condition.quality} quality, ${condition.avgPacketLoss.toFixed(1)}% packet loss`,
      timestamp: new Date(),
    };

    this.recordAdjustment(broadcastId, adjustment);
    this.emit('bitrate-adjusted', adjustment);

    logger.info(`Upgraded broadcast ${broadcastId}: ${currentProfile.name} → ${newProfile.name}`);
  }

  /**
   * Record adjustment in history
   */
  private recordAdjustment(broadcastId: string, adjustment: BitrateAdjustment): void {
    const history = this.adjustmentHistory.get(broadcastId) || [];
    history.push(adjustment);

    // Keep only last 50 adjustments
    if (history.length > 50) {
      history.shift();
    }

    this.adjustmentHistory.set(broadcastId, history);
  }

  /**
   * Get all active broadcasts
   */
  getActiveBroadcasts(): string[] {
    return Array.from(this.currentProfiles.keys());
  }
}

// Export singleton instance
export const adaptiveBitrateService = new AdaptiveBitrateService();
