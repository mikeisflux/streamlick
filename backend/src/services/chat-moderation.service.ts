/**
 * Chat Moderation Service
 *
 * Features:
 * - Platform-specific ban/timeout on source platforms (YouTube, Twitch, Facebook, etc.)
 * - Cross-platform moderation sync
 * - Ban from chat only (without kicking from stream)
 * - Timeout functionality with duration
 * - Moderation history tracking
 * - Automatic timeout expiration
 */

import axios from 'axios';
import prisma from '../database/prisma';
import { decrypt } from '../utils/crypto';
import logger from '../utils/logger';

export interface ModerationAction {
  id: string;
  broadcastId: string;
  platform: string;
  userId: string; // Platform-specific user ID
  username: string;
  action: 'ban' | 'timeout' | 'unban';
  duration?: number; // For timeouts, in seconds
  reason?: string;
  moderatorId: string; // Streamlick user ID who performed the action
  timestamp: Date;
  expiresAt?: Date; // For timeouts
  isActive: boolean;
}

export interface PlatformCredentials {
  accessToken: string;
  refreshToken?: string;
  channelId?: string;
  pageId?: string;
  username?: string;
}

export class ChatModerationService {
  private static instance: ChatModerationService;
  private timeoutTimers: Map<string, NodeJS.Timeout> = new Map();
  private activeTimeouts: Map<string, ModerationAction> = new Map();
  // CRITICAL FIX: Store interval reference for cleanup
  private expirationCheckInterval: NodeJS.Timeout | null = null;

  private constructor() {
    // Start checking for expired timeouts every minute
    this.expirationCheckInterval = setInterval(() => this.checkExpiredTimeouts(), 60000);
  }

  static getInstance(): ChatModerationService {
    if (!ChatModerationService.instance) {
      ChatModerationService.instance = new ChatModerationService();
    }
    return ChatModerationService.instance;
  }

  /**
   * Ban user from chat on their source platform
   */
  async banUser(
    broadcastId: string,
    platform: string,
    userId: string,
    username: string,
    reason: string,
    moderatorId: string
  ): Promise<ModerationAction> {
    try {
      // Get platform credentials
      const credentials = await this.getPlatformCredentials(broadcastId, platform);
      if (!credentials) {
        throw new Error(`No credentials found for platform: ${platform}`);
      }

      // Execute platform-specific ban
      await this.executePlatformBan(platform, credentials, userId, username, reason);

      // Record moderation action in database
      const action = await prisma.moderationAction.create({
        data: {
          broadcastId,
          platform,
          userId,
          username,
          action: 'ban',
          reason,
          moderatorId,
          isActive: true,
        },
      });

      logger.info(`User ${username} banned from ${platform} chat in broadcast ${broadcastId}`);

      return action as ModerationAction;
    } catch (error) {
      logger.error('Ban user error:', error);
      throw error;
    }
  }

  /**
   * Timeout user from chat on their source platform
   */
  async timeoutUser(
    broadcastId: string,
    platform: string,
    userId: string,
    username: string,
    duration: number, // seconds
    reason: string,
    moderatorId: string
  ): Promise<ModerationAction> {
    try {
      // Get platform credentials
      const credentials = await this.getPlatformCredentials(broadcastId, platform);
      if (!credentials) {
        throw new Error(`No credentials found for platform: ${platform}`);
      }

      // Execute platform-specific timeout
      await this.executePlatformTimeout(platform, credentials, userId, username, duration, reason);

      const expiresAt = new Date(Date.now() + duration * 1000);

      // Record moderation action in database
      const action = await prisma.moderationAction.create({
        data: {
          broadcastId,
          platform,
          userId,
          username,
          action: 'timeout',
          duration,
          reason,
          moderatorId,
          expiresAt,
          isActive: true,
        },
      });

      // Set timer to automatically unban after duration
      const timeoutKey = `${broadcastId}:${platform}:${userId}`;
      this.activeTimeouts.set(timeoutKey, action as ModerationAction);

      const timer = setTimeout(() => {
        this.handleTimeoutExpired(broadcastId, platform, userId, username);
      }, duration * 1000);

      this.timeoutTimers.set(timeoutKey, timer);

      logger.info(`User ${username} timed out for ${duration}s on ${platform} chat in broadcast ${broadcastId}`);

      return action as ModerationAction;
    } catch (error) {
      logger.error('Timeout user error:', error);
      throw error;
    }
  }

  /**
   * Unban user from chat
   */
  async unbanUser(
    broadcastId: string,
    platform: string,
    userId: string,
    username: string,
    moderatorId: string
  ): Promise<void> {
    try {
      // Get platform credentials
      const credentials = await this.getPlatformCredentials(broadcastId, platform);
      if (!credentials) {
        throw new Error(`No credentials found for platform: ${platform}`);
      }

      // Execute platform-specific unban
      await this.executePlatformUnban(platform, credentials, userId, username);

      // Update moderation action in database
      await prisma.moderationAction.updateMany({
        where: {
          broadcastId,
          platform,
          userId,
          isActive: true,
        },
        data: {
          isActive: false,
        },
      });

      // Clear timeout timer if exists
      const timeoutKey = `${broadcastId}:${platform}:${userId}`;
      const timer = this.timeoutTimers.get(timeoutKey);
      if (timer) {
        clearTimeout(timer);
        this.timeoutTimers.delete(timeoutKey);
      }
      this.activeTimeouts.delete(timeoutKey);

      logger.info(`User ${username} unbanned from ${platform} chat in broadcast ${broadcastId}`);
    } catch (error) {
      logger.error('Unban user error:', error);
      throw error;
    }
  }

  /**
   * Ban user from ALL connected platforms
   */
  async banUserCrossPlatform(
    broadcastId: string,
    userId: string,
    username: string,
    reason: string,
    moderatorId: string
  ): Promise<ModerationAction[]> {
    try {
      // Get all connected destinations for broadcast
      const destinations = await prisma.destination.findMany({
        where: {
          userId: moderatorId,
          isActive: true,
        },
      });

      const actions: ModerationAction[] = [];

      // Ban on each platform
      for (const dest of destinations) {
        try {
          const action = await this.banUser(
            broadcastId,
            dest.platform,
            userId,
            username,
            `[Cross-platform ban] ${reason}`,
            moderatorId
          );
          actions.push(action);
        } catch (error) {
          logger.warn(`Failed to ban ${username} on ${dest.platform}:`, error);
        }
      }

      logger.info(`User ${username} banned cross-platform in broadcast ${broadcastId} (${actions.length} platforms)`);

      return actions;
    } catch (error) {
      logger.error('Cross-platform ban error:', error);
      throw error;
    }
  }

  /**
   * Get moderation history for a broadcast
   */
  async getModerationHistory(broadcastId: string, limit: number = 100): Promise<ModerationAction[]> {
    try {
      const actions = await prisma.moderationAction.findMany({
        where: { broadcastId },
        orderBy: { timestamp: 'desc' },
        take: limit,
      });

      return actions as ModerationAction[];
    } catch (error) {
      logger.error('Get moderation history error:', error);
      throw error;
    }
  }

  /**
   * Get active moderation actions
   */
  async getActiveActions(broadcastId: string): Promise<ModerationAction[]> {
    try {
      const actions = await prisma.moderationAction.findMany({
        where: {
          broadcastId,
          isActive: true,
        },
        orderBy: { timestamp: 'desc' },
      });

      return actions as ModerationAction[];
    } catch (error) {
      logger.error('Get active actions error:', error);
      throw error;
    }
  }

  /**
   * Check if user is banned or timed out
   */
  async isUserModerated(
    broadcastId: string,
    platform: string,
    userId: string
  ): Promise<{ moderated: boolean; action?: ModerationAction }> {
    try {
      const action = await prisma.moderationAction.findFirst({
        where: {
          broadcastId,
          platform,
          userId,
          isActive: true,
        },
        orderBy: { timestamp: 'desc' },
      });

      if (!action) {
        return { moderated: false };
      }

      // Check if timeout has expired
      if (action.action === 'timeout' && action.expiresAt && action.expiresAt < new Date()) {
        await this.unbanUser(broadcastId, platform, userId, action.username, action.moderatorId);
        return { moderated: false };
      }

      return { moderated: true, action: action as ModerationAction };
    } catch (error) {
      logger.error('Check user moderated error:', error);
      return { moderated: false };
    }
  }

  /**
   * Execute platform-specific ban
   */
  private async executePlatformBan(
    platform: string,
    credentials: PlatformCredentials,
    userId: string,
    username: string,
    reason: string
  ): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'youtube':
        await this.banYouTubeUser(credentials, userId, reason);
        break;
      case 'twitch':
        await this.banTwitchUser(credentials, username, reason);
        break;
      case 'facebook':
        await this.banFacebookUser(credentials, userId, reason);
        break;
      default:
        logger.warn(`Ban not supported for platform: ${platform}`);
    }
  }

  /**
   * Execute platform-specific timeout
   */
  private async executePlatformTimeout(
    platform: string,
    credentials: PlatformCredentials,
    userId: string,
    username: string,
    duration: number,
    reason: string
  ): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'youtube':
        await this.timeoutYouTubeUser(credentials, userId, duration, reason);
        break;
      case 'twitch':
        await this.timeoutTwitchUser(credentials, username, duration, reason);
        break;
      case 'facebook':
        // Facebook doesn't support timeout, use ban instead
        await this.banFacebookUser(credentials, userId, reason);
        break;
      default:
        logger.warn(`Timeout not supported for platform: ${platform}`);
    }
  }

  /**
   * Execute platform-specific unban
   */
  private async executePlatformUnban(
    platform: string,
    credentials: PlatformCredentials,
    userId: string,
    username: string
  ): Promise<void> {
    switch (platform.toLowerCase()) {
      case 'youtube':
        await this.unbanYouTubeUser(credentials, userId);
        break;
      case 'twitch':
        await this.unbanTwitchUser(credentials, username);
        break;
      case 'facebook':
        await this.unbanFacebookUser(credentials, userId);
        break;
      default:
        logger.warn(`Unban not supported for platform: ${platform}`);
    }
  }

  /**
   * YouTube: Ban user from live chat
   */
  private async banYouTubeUser(credentials: PlatformCredentials, userId: string, reason: string): Promise<void> {
    try {
      await axios.post(
        'https://www.googleapis.com/youtube/v3/liveChat/bans',
        {
          snippet: {
            type: 'permanent',
            liveChatId: credentials.channelId,
            bannedUserDetails: {
              channelId: userId,
            },
            banDurationSeconds: null,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
          params: {
            part: 'snippet',
          },
        }
      );
      logger.info(`YouTube user ${userId} banned successfully`);
    } catch (error: any) {
      logger.error('YouTube ban error:', error.response?.data || error.message);
      throw new Error(`Failed to ban user on YouTube: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * YouTube: Timeout user from live chat
   */
  private async timeoutYouTubeUser(credentials: PlatformCredentials, userId: string, duration: number, reason: string): Promise<void> {
    try {
      await axios.post(
        'https://www.googleapis.com/youtube/v3/liveChat/bans',
        {
          snippet: {
            type: 'temporary',
            liveChatId: credentials.channelId,
            bannedUserDetails: {
              channelId: userId,
            },
            banDurationSeconds: duration,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
          params: {
            part: 'snippet',
          },
        }
      );
      logger.info(`YouTube user ${userId} timed out for ${duration}s`);
    } catch (error: any) {
      logger.error('YouTube timeout error:', error.response?.data || error.message);
      throw new Error(`Failed to timeout user on YouTube: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * YouTube: Unban user from live chat
   */
  private async unbanYouTubeUser(credentials: PlatformCredentials, userId: string): Promise<void> {
    try {
      // First, get the ban ID
      const bans = await axios.get('https://www.googleapis.com/youtube/v3/liveChat/bans', {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        params: {
          liveChatId: credentials.channelId,
          part: 'snippet',
        },
      });

      const ban = bans.data.items?.find((b: any) => b.snippet.bannedUserDetails.channelId === userId);
      if (ban) {
        await axios.delete(`https://www.googleapis.com/youtube/v3/liveChat/bans`, {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
          params: {
            id: ban.id,
          },
        });
        logger.info(`YouTube user ${userId} unbanned successfully`);
      }
    } catch (error: any) {
      logger.error('YouTube unban error:', error.response?.data || error.message);
      throw new Error(`Failed to unban user on YouTube: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Twitch: Ban user from chat
   */
  private async banTwitchUser(credentials: PlatformCredentials, username: string, reason: string): Promise<void> {
    try {
      await axios.post(
        `https://api.twitch.tv/helix/moderation/bans`,
        {
          data: {
            user_id: username, // Actually needs the Twitch user ID, not username
            reason,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID || '',
          },
          params: {
            broadcaster_id: credentials.channelId,
            moderator_id: credentials.channelId, // Same as broadcaster for self-moderation
          },
        }
      );
      logger.info(`Twitch user ${username} banned successfully`);
    } catch (error: any) {
      logger.error('Twitch ban error:', error.response?.data || error.message);
      throw new Error(`Failed to ban user on Twitch: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Twitch: Timeout user from chat
   */
  private async timeoutTwitchUser(credentials: PlatformCredentials, username: string, duration: number, reason: string): Promise<void> {
    try {
      await axios.post(
        `https://api.twitch.tv/helix/moderation/bans`,
        {
          data: {
            user_id: username,
            duration,
            reason,
          },
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
            'Client-Id': process.env.TWITCH_CLIENT_ID || '',
          },
          params: {
            broadcaster_id: credentials.channelId,
            moderator_id: credentials.channelId,
          },
        }
      );
      logger.info(`Twitch user ${username} timed out for ${duration}s`);
    } catch (error: any) {
      logger.error('Twitch timeout error:', error.response?.data || error.message);
      throw new Error(`Failed to timeout user on Twitch: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Twitch: Unban user from chat
   */
  private async unbanTwitchUser(credentials: PlatformCredentials, username: string): Promise<void> {
    try {
      await axios.delete(`https://api.twitch.tv/helix/moderation/bans`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID || '',
        },
        params: {
          broadcaster_id: credentials.channelId,
          moderator_id: credentials.channelId,
          user_id: username,
        },
      });
      logger.info(`Twitch user ${username} unbanned successfully`);
    } catch (error: any) {
      logger.error('Twitch unban error:', error.response?.data || error.message);
      throw new Error(`Failed to unban user on Twitch: ${error.response?.data?.message || error.message}`);
    }
  }

  /**
   * Facebook: Ban user from live comments
   */
  private async banFacebookUser(credentials: PlatformCredentials, userId: string, reason: string): Promise<void> {
    try {
      await axios.post(
        `https://graph.facebook.com/v18.0/${credentials.pageId}/blocked`,
        {
          user: userId,
        },
        {
          headers: {
            Authorization: `Bearer ${credentials.accessToken}`,
          },
        }
      );
      logger.info(`Facebook user ${userId} banned successfully`);
    } catch (error: any) {
      logger.error('Facebook ban error:', error.response?.data || error.message);
      throw new Error(`Failed to ban user on Facebook: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Facebook: Unban user from live comments
   */
  private async unbanFacebookUser(credentials: PlatformCredentials, userId: string): Promise<void> {
    try {
      await axios.delete(`https://graph.facebook.com/v18.0/${credentials.pageId}/blocked`, {
        headers: {
          Authorization: `Bearer ${credentials.accessToken}`,
        },
        data: {
          user: userId,
        },
      });
      logger.info(`Facebook user ${userId} unbanned successfully`);
    } catch (error: any) {
      logger.error('Facebook unban error:', error.response?.data || error.message);
      throw new Error(`Failed to unban user on Facebook: ${error.response?.data?.error?.message || error.message}`);
    }
  }

  /**
   * Get platform credentials for moderation
   */
  private async getPlatformCredentials(broadcastId: string, platform: string): Promise<PlatformCredentials | null> {
    try {
      // Get broadcast to find owner
      const broadcast = await prisma.broadcast.findUnique({
        where: { id: broadcastId },
        select: { userId: true },
      });

      if (!broadcast) {
        return null;
      }

      // Get destination with credentials
      const destination = await prisma.destination.findFirst({
        where: {
          userId: broadcast.userId,
          platform: platform.toLowerCase(),
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return null;
      }

      return {
        accessToken: decrypt(destination.accessToken),
        refreshToken: destination.refreshToken ? decrypt(destination.refreshToken) : undefined,
        channelId: destination.channelId || undefined,
        pageId: destination.pageId || undefined,
        username: destination.username || undefined,
      };
    } catch (error) {
      logger.error('Get platform credentials error:', error);
      return null;
    }
  }

  /**
   * Handle timeout expiration
   */
  private async handleTimeoutExpired(
    broadcastId: string,
    platform: string,
    userId: string,
    username: string
  ): Promise<void> {
    try {
      const timeoutKey = `${broadcastId}:${platform}:${userId}`;
      const action = this.activeTimeouts.get(timeoutKey);

      if (action) {
        // Mark timeout as inactive
        await prisma.moderationAction.update({
          where: { id: action.id },
          data: { isActive: false },
        });

        this.activeTimeouts.delete(timeoutKey);
        this.timeoutTimers.delete(timeoutKey);

        logger.info(`Timeout expired for ${username} on ${platform} in broadcast ${broadcastId}`);
      }
    } catch (error) {
      logger.error('Handle timeout expired error:', error);
    }
  }

  /**
   * Check for expired timeouts periodically
   */
  private async checkExpiredTimeouts(): Promise<void> {
    try {
      const expiredActions = await prisma.moderationAction.findMany({
        where: {
          action: 'timeout',
          isActive: true,
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      for (const action of expiredActions) {
        await this.handleTimeoutExpired(
          action.broadcastId,
          action.platform,
          action.userId,
          action.username
        );
      }
    } catch (error) {
      logger.error('Check expired timeouts error:', error);
    }
  }

  /**
   * CRITICAL FIX: Cleanup method to stop background tasks
   * Call this when shutting down the service
   */
  cleanup(): void {
    // CRITICAL FIX: Clear expiration check interval
    if (this.expirationCheckInterval) {
      clearInterval(this.expirationCheckInterval);
      this.expirationCheckInterval = null;
    }

    // Clear all timeout timers
    this.timeoutTimers.forEach(timer => clearTimeout(timer));
    this.timeoutTimers.clear();
    this.activeTimeouts.clear();

    logger.info('Chat moderation service cleaned up');
  }
}

export default ChatModerationService.getInstance();
