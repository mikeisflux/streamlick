/**
 * Chat Service
 *
 * Aggregates chat messages from multiple platforms:
 * - YouTube Live Chat
 * - Facebook Live Comments
 * - Twitch Chat
 * - X (Twitter) Replies/Mentions
 * - Rumble Live Chat
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto';
import logger from '../utils/logger';

const prisma = new PrismaClient();

export interface ChatMessage {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'x' | 'rumble';
  author: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
  isSuperChat?: boolean;
  superChatAmount?: number;
}

/**
 * YouTube Live Chat Polling
 */
export class YouTubeChatPoller {
  private broadcastId: string;
  private userId: string;
  private liveChatId: string | null = null;
  private pageToken: string | null = null;
  private accessToken: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    try {
      // Get YouTube destination for user
      const destination = await prisma.destination.findFirst({
        where: {
          userId: this.userId,
          platform: 'youtube',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        logger.warn(`No YouTube destination found for user ${this.userId}`);
        return;
      }

      this.accessToken = decrypt(destination.accessToken);

      // Get live broadcast
      const broadcastResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts',
        {
          params: {
            part: 'snippet',
            broadcastStatus: 'active',
            mine: true,
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const liveBroadcast = broadcastResponse.data.items?.[0];
      if (!liveBroadcast) {
        logger.warn('No active YouTube live broadcast found');
        return;
      }

      this.liveChatId = liveBroadcast.snippet.liveChatId;

      // Start polling
      this.poll();
    } catch (error: any) {
      logger.error('YouTube chat poller start error:', error.message);
    }
  }

  private async poll(): Promise<void> {
    if (!this.liveChatId || !this.accessToken) return;

    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/liveChat/messages',
        {
          params: {
            liveChatId: this.liveChatId,
            part: 'snippet,authorDetails',
            pageToken: this.pageToken,
          },
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
          },
        }
      );

      const { items, nextPageToken, pollingIntervalMillis } = response.data;

      // Process new messages
      if (items && items.length > 0) {
        for (const item of items) {
          const message: ChatMessage = {
            id: item.id,
            platform: 'youtube',
            author: item.authorDetails.displayName,
            authorAvatar: item.authorDetails.profileImageUrl,
            message: item.snippet.displayMessage,
            timestamp: new Date(item.snippet.publishedAt),
            isSuperChat: item.snippet.type === 'superChatEvent',
            superChatAmount: item.snippet.superChatDetails?.amountMicros
              ? item.snippet.superChatDetails.amountMicros / 1000000
              : undefined,
          };

          this.onMessage(message);

          // Save to database
          await prisma.chatMessage.create({
            data: {
              broadcastId: this.broadcastId,
              platform: 'youtube',
              authorName: message.author,
              messageText: message.message,
            },
          });
        }
      }

      this.pageToken = nextPageToken;

      // Schedule next poll
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, pollingIntervalMillis || 5000);
    } catch (error: any) {
      logger.error('YouTube chat poll error:', error.message);

      // Retry after 10 seconds on error
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 10000);
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    logger.info('YouTube chat poller stopped');
  }
}

/**
 * Facebook Live Comments Polling
 *
 * IMPORTANT (2025 Facebook API Best Practices):
 * - This implementation uses polling, but Facebook recommends using Webhooks for real-time comments
 * - Webhooks provide lower latency and reduce API calls
 * - To implement webhooks:
 *   1. Subscribe to 'live_videos' webhook topic for the Page
 *   2. Listen for 'comments' field updates
 *   3. Verify webhook signatures using app secret
 *   4. Handle webhook events at POST /api/webhooks/facebook
 * - Current polling interval: 3 seconds
 * - API version: v24.0 (updated for 2025 compatibility)
 * - Rate limits are monitored via x-app-usage header
 */
export class FacebookChatPoller {
  private broadcastId: string;
  private userId: string;
  private liveVideoId: string | null = null;
  private accessToken: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastCommentTime: Date = new Date();
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    try {
      // Get Facebook destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId: this.userId,
          platform: 'facebook',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        logger.warn(`No Facebook destination found for user ${this.userId}`);
        return;
      }

      this.accessToken = decrypt(destination.accessToken);

      // Get live video (this would typically be created when going live)
      // For now, we'll poll for the most recent live video
      const liveVideoResponse = await axios.get(
        'https://graph.facebook.com/v24.0/me/live_videos',
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,status',
          },
        }
      );

      const liveVideo = liveVideoResponse.data.data?.find(
        (v: any) => v.status === 'LIVE'
      );

      if (!liveVideo) {
        logger.warn('No active Facebook live video found');
        return;
      }

      this.liveVideoId = liveVideo.id;

      // Start polling
      this.poll();
    } catch (error: any) {
      logger.error('Facebook chat poller start error:', error.message);
    }
  }

  private async poll(): Promise<void> {
    if (!this.liveVideoId || !this.accessToken) return;

    try {
      const response = await axios.get(
        `https://graph.facebook.com/v24.0/${this.liveVideoId}/comments`,
        {
          params: {
            access_token: this.accessToken,
            fields: 'id,from{id,name,picture},message,created_time,parent,attachment',
            filter: 'stream',
            order: 'chronological',
          },
        }
      );

      const comments = response.data.data || [];

      for (const comment of comments) {
        const commentTime = new Date(comment.created_time);

        // Only process new comments
        if (commentTime > this.lastCommentTime) {
          const message: ChatMessage = {
            id: comment.id,
            platform: 'facebook',
            author: comment.from.name,
            authorAvatar: comment.from.picture?.data?.url,
            message: comment.message,
            timestamp: commentTime,
          };

          this.onMessage(message);

          // Save to database
          await prisma.chatMessage.create({
            data: {
              broadcastId: this.broadcastId,
              platform: 'facebook',
              authorName: message.author,
              messageText: message.message,
            },
          });

          this.lastCommentTime = commentTime;
        }
      }

      // Poll every 3 seconds (Facebook 2025 recommendation: use webhooks for real-time)
      // TODO: Implement webhook subscription for better performance and reduced API calls
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 3000);
    } catch (error: any) {
      logger.error('Facebook chat poll error:', error.response?.data || error.message);

      // Handle specific Facebook API error codes
      const errorCode = error.response?.data?.error?.code;
      const errorSubcode = error.response?.data?.error?.error_subcode;

      if (errorCode === 190) {
        // Access token expired or invalid - stop polling
        logger.error('Facebook access token expired (code 190). Stopping chat poller.');
        this.stop();
        return;
      } else if (errorCode === 368) {
        // Temporarily blocked for Policies violations - exponential backoff
        logger.warn('Facebook API temporarily blocked (code 368). Retrying after 60s.');
        this.pollingInterval = setTimeout(() => {
          this.poll();
        }, 60000); // Wait 60 seconds
        return;
      } else if (errorCode >= 200 && errorCode <= 299) {
        // Permission error - stop polling
        logger.error(`Facebook permission error (code ${errorCode}). Stopping chat poller.`);
        this.stop();
        return;
      }

      // Rate limit handling - check for rate limit headers
      const rateLimitRemaining = error.response?.headers['x-app-usage'];
      if (rateLimitRemaining) {
        try {
          const usage = JSON.parse(rateLimitRemaining);
          if (usage.call_count >= 95) { // Near limit threshold
            logger.warn('Facebook API rate limit approaching. Slowing down polling to 10s.');
            this.pollingInterval = setTimeout(() => {
              this.poll();
            }, 10000); // Slow down to 10 seconds
            return;
          }
        } catch (e) {
          // Ignore JSON parse errors
        }
      }

      // Default retry after 10 seconds on generic error
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 10000);
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    logger.info('Facebook chat poller stopped');
  }
}

/**
 * Twitch Chat Integration (using IRC)
 */
export class TwitchChatPoller {
  private broadcastId: string;
  private userId: string;
  private channel: string | null = null;
  private accessToken: string | null = null;
  private ws: any = null;
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    try {
      // Get Twitch destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId: this.userId,
          platform: 'twitch',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        logger.warn(`No Twitch destination found for user ${this.userId}`);
        return;
      }

      this.accessToken = decrypt(destination.accessToken);

      // Get channel name
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID || '',
        },
      });

      const twitchUser = userResponse.data.data?.[0];
      if (!twitchUser) {
        logger.warn('Twitch user not found');
        return;
      }

      this.channel = twitchUser.login.toLowerCase();

      // Connect to Twitch IRC via WebSocket
      this.connectToIRC();

      logger.info(`Twitch chat started for channel: ${this.channel}`);
    } catch (error: any) {
      logger.error('Twitch chat poller start error:', error.message);
    }
  }

  private connectToIRC(): void {
    try {
      // Use native WebSocket or ws library
      // For Node.js, ws library is required: npm install ws
      const WebSocket = require('ws');

      this.ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

      this.ws.on('open', () => {
        logger.info('Twitch IRC WebSocket connected');

        // Authenticate
        // Use oauth: prefix for the token
        this.ws.send(`PASS oauth:${this.accessToken}`);
        this.ws.send(`NICK ${this.channel}`);

        // Request capabilities for tags (includes user display names, badges, etc.)
        this.ws.send('CAP REQ :twitch.tv/tags twitch.tv/commands');

        // Join the channel
        this.ws.send(`JOIN #${this.channel}`);
      });

      this.ws.on('message', (data: any) => {
        const message = data.toString();
        this.handleIRCMessage(message);
      });

      this.ws.on('error', (error: any) => {
        logger.error('Twitch IRC WebSocket error:', error);
      });

      this.ws.on('close', () => {
        logger.info('Twitch IRC WebSocket closed');
        // Attempt reconnection after 5 seconds
        setTimeout(() => {
          if (this.ws) {
            logger.info('Attempting to reconnect to Twitch IRC...');
            this.connectToIRC();
          }
        }, 5000);
      });

      // Handle PING/PONG to keep connection alive
      setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send('PING :tmi.twitch.tv');
        }
      }, 60000); // Every 60 seconds
    } catch (error: any) {
      logger.error('Twitch IRC connection error:', error.message);
    }
  }

  private handleIRCMessage(rawMessage: string): void {
    try {
      // Handle PING
      if (rawMessage.startsWith('PING')) {
        this.ws.send('PONG :tmi.twitch.tv');
        return;
      }

      // Parse PRIVMSG (chat messages)
      // Format: @badges=...;display-name=Username;... :username!username@username.tmi.twitch.tv PRIVMSG #channel :message text
      if (rawMessage.includes('PRIVMSG')) {
        const tags: Record<string, string> = {};
        let username = '';
        let messageText = '';

        // Extract tags
        if (rawMessage.startsWith('@')) {
          const tagsEnd = rawMessage.indexOf(' :');
          const tagsString = rawMessage.substring(1, tagsEnd);
          tagsString.split(';').forEach((tag) => {
            const [key, value] = tag.split('=');
            tags[key] = value || '';
          });
        }

        // Extract username from source
        const sourceMatch = rawMessage.match(/:(\w+)!\w+@\w+\.tmi\.twitch\.tv/);
        if (sourceMatch) {
          username = sourceMatch[1];
        }

        // Extract message text (everything after "PRIVMSG #channel :")
        const messageMatch = rawMessage.match(/PRIVMSG #\w+ :(.+)$/);
        if (messageMatch) {
          messageText = messageMatch[1];
        }

        if (username && messageText) {
          // Emit chat message
          const chatMessage: ChatMessage = {
            id: `twitch-${Date.now()}-${Math.random()}`,
            platform: 'twitch',
            author: tags['display-name'] || username,
            authorAvatar: `https://static-cdn.jtvnw.net/jtv_user_pictures/${username}-profile_image-70x70.png`,
            message: messageText,
            timestamp: new Date(),
          };

          this.onMessage(chatMessage);
        }
      }
    } catch (error: any) {
      logger.error('Twitch IRC message parse error:', error.message);
    }
  }

  stop(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    logger.info('Twitch chat poller stopped');
  }
}

/**
 * X (Twitter) Chat Polling
 * Monitors mentions and replies to the broadcast tweet
 */
export class XChatPoller {
  private broadcastId: string;
  private userId: string;
  private accessToken: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastTweetId: string | null = null;
  private broadcastTweetId: string | null = null;
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    try {
      // Get X destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId: this.userId,
          platform: 'x',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        logger.warn(`No X destination found for user ${this.userId}`);
        return;
      }

      this.accessToken = decrypt(destination.accessToken);

      // In a real implementation, we would:
      // 1. Post a "Going Live" tweet with the broadcast link
      // 2. Monitor replies/mentions to that tweet
      // For now, we'll just monitor recent mentions

      this.poll();
    } catch (error: any) {
      logger.error('X chat poller start error:', error.message);
    }
  }

  private async poll(): Promise<void> {
    if (!this.accessToken) return;

    try {
      // Get user's mentions
      const response = await axios.get('https://api.twitter.com/2/users/me/mentions', {
        params: {
          max_results: 10,
          'tweet.fields': 'created_at,author_id',
          'user.fields': 'username,profile_image_url',
          expansions: 'author_id',
          since_id: this.lastTweetId,
        },
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      });

      const tweets = response.data.data || [];
      const users = response.data.includes?.users || [];

      for (const tweet of tweets) {
        const author = users.find((u: any) => u.id === tweet.author_id);

        const message: ChatMessage = {
          id: tweet.id,
          platform: 'x',
          author: author?.username || 'Unknown',
          authorAvatar: author?.profile_image_url,
          message: tweet.text,
          timestamp: new Date(tweet.created_at),
        };

        this.onMessage(message);

        // Save to database
        await prisma.chatMessage.create({
          data: {
            broadcastId: this.broadcastId,
            platform: 'x',
            authorName: message.author,
            messageText: message.message,
          },
        });

        this.lastTweetId = tweet.id;
      }

      // Poll every 10 seconds
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 10000);
    } catch (error: any) {
      logger.error('X chat poll error:', error.message);

      // Retry after 30 seconds on error
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 30000);
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    logger.info('X chat poller stopped');
  }
}

/**
 * Rumble Chat Polling
 * Monitors live chat for Rumble streams
 */
export class RumbleChatPoller {
  private broadcastId: string;
  private userId: string;
  private apiKey: string | null = null;
  private pollingInterval: NodeJS.Timeout | null = null;
  private lastMessageId: string | null = null;
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async start(): Promise<void> {
    try {
      // Get Rumble destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId: this.userId,
          platform: 'rumble',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        logger.warn(`No Rumble destination found for user ${this.userId}`);
        return;
      }

      this.apiKey = decrypt(destination.accessToken);

      this.poll();
    } catch (error: any) {
      logger.error('Rumble chat poller start error:', error.message);
    }
  }

  private async poll(): Promise<void> {
    if (!this.apiKey) return;

    try {
      // Get live chat messages
      const response = await axios.get('https://rumble.com/service.php', {
        params: {
          name: 'live.get_chat',
          key: this.apiKey,
          since_id: this.lastMessageId,
        },
      });

      const messages = response.data?.messages || [];

      for (const msg of messages) {
        const message: ChatMessage = {
          id: msg.id,
          platform: 'rumble',
          author: msg.username,
          authorAvatar: msg.avatar_url,
          message: msg.text,
          timestamp: new Date(msg.timestamp * 1000), // Convert unix timestamp
          isSuperChat: msg.is_rant || false,
          superChatAmount: msg.rant_amount,
        };

        this.onMessage(message);

        // Save to database
        await prisma.chatMessage.create({
          data: {
            broadcastId: this.broadcastId,
            platform: 'rumble',
            authorName: message.author,
            messageText: message.message,
          },
        });

        this.lastMessageId = msg.id;
      }

      // Poll every 5 seconds
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 5000);
    } catch (error: any) {
      logger.error('Rumble chat poll error:', error.message);

      // Retry after 10 seconds on error
      this.pollingInterval = setTimeout(() => {
        this.poll();
      }, 10000);
    }
  }

  stop(): void {
    if (this.pollingInterval) {
      clearTimeout(this.pollingInterval);
      this.pollingInterval = null;
    }
    logger.info('Rumble chat poller stopped');
  }
}

/**
 * Chat Manager
 * Manages all chat pollers for a broadcast
 */
export class ChatManager {
  private broadcastId: string;
  private userId: string;
  private pollers: Map<string, any> = new Map();
  private onMessage: (message: ChatMessage) => void;

  constructor(broadcastId: string, userId: string, onMessage: (message: ChatMessage) => void) {
    this.broadcastId = broadcastId;
    this.userId = userId;
    this.onMessage = onMessage;
  }

  async startAll(): Promise<void> {
    // Start YouTube poller
    const youtubePoller = new YouTubeChatPoller(
      this.broadcastId,
      this.userId,
      this.onMessage
    );
    await youtubePoller.start();
    this.pollers.set('youtube', youtubePoller);

    // Start Facebook poller
    const facebookPoller = new FacebookChatPoller(
      this.broadcastId,
      this.userId,
      this.onMessage
    );
    await facebookPoller.start();
    this.pollers.set('facebook', facebookPoller);

    // Start Twitch poller
    const twitchPoller = new TwitchChatPoller(
      this.broadcastId,
      this.userId,
      this.onMessage
    );
    await twitchPoller.start();
    this.pollers.set('twitch', twitchPoller);

    // Start X poller
    const xPoller = new XChatPoller(
      this.broadcastId,
      this.userId,
      this.onMessage
    );
    await xPoller.start();
    this.pollers.set('x', xPoller);

    // Start Rumble poller
    const rumblePoller = new RumbleChatPoller(
      this.broadcastId,
      this.userId,
      this.onMessage
    );
    await rumblePoller.start();
    this.pollers.set('rumble', rumblePoller);

    logger.info(`Chat manager started for broadcast ${this.broadcastId}`);
  }

  stopAll(): void {
    this.pollers.forEach((poller) => {
      poller.stop();
    });
    this.pollers.clear();
    logger.info(`Chat manager stopped for broadcast ${this.broadcastId}`);
  }
}
