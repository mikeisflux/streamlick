/**
 * Comment Posting Service
 *
 * Posts comments/messages to multiple streaming platforms:
 * - YouTube Live Chat
 * - Facebook Live Comments
 * - Twitch Chat
 * - LinkedIn Posts/Comments
 * - Rumble Live Chat
 */

import axios from 'axios';
import { PrismaClient } from '@prisma/client';
import { decrypt } from '../utils/crypto';
import logger from '../utils/logger';
import WebSocket from 'ws';

const prisma = new PrismaClient();

interface PostResult {
  platform: string;
  success: boolean;
  error?: string;
  messageId?: string;
}

class CommentPostingService {
  /**
   * Post to multiple platforms
   */
  async postToMultiplePlatforms(
    userId: string,
    message: string,
    platforms: string[]
  ): Promise<PostResult[]> {
    const results: PostResult[] = [];

    for (const platform of platforms) {
      let result: PostResult;

      try {
        switch (platform) {
          case 'youtube':
            result = await this.postToYouTube(userId, message);
            break;
          case 'facebook':
            result = await this.postToFacebook(userId, message);
            break;
          case 'twitch':
            result = await this.postToTwitch(userId, message);
            break;
          case 'linkedin':
            result = await this.postToLinkedIn(userId, message);
            break;
          case 'rumble':
            result = await this.postToRumble(userId, message);
            break;
          default:
            result = {
              platform,
              success: false,
              error: 'Unsupported platform',
            };
        }
      } catch (error: any) {
        result = {
          platform,
          success: false,
          error: error.message || 'Unknown error',
        };
      }

      results.push(result);
    }

    return results;
  }

  /**
   * Post to YouTube Live Chat
   */
  async postToYouTube(userId: string, message: string): Promise<PostResult> {
    try {
      // Get YouTube destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId,
          platform: 'youtube',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return {
          platform: 'youtube',
          success: false,
          error: 'YouTube destination not found or not connected',
        };
      }

      const accessToken = decrypt(destination.accessToken);

      // Get active live broadcast
      const broadcastResponse = await axios.get(
        'https://www.googleapis.com/youtube/v3/liveBroadcasts',
        {
          params: {
            part: 'snippet',
            broadcastStatus: 'active',
            mine: true,
          },
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const liveBroadcast = broadcastResponse.data.items?.[0];
      if (!liveBroadcast) {
        return {
          platform: 'youtube',
          success: false,
          error: 'No active YouTube live broadcast found',
        };
      }

      const liveChatId = liveBroadcast.snippet.liveChatId;
      if (!liveChatId) {
        return {
          platform: 'youtube',
          success: false,
          error: 'Live chat not available for this broadcast',
        };
      }

      // Post message to live chat
      const response = await axios.post(
        'https://www.googleapis.com/youtube/v3/liveChat/messages',
        {
          snippet: {
            liveChatId,
            type: 'textMessageEvent',
            textMessageDetails: {
              messageText: message,
            },
          },
        },
        {
          params: { part: 'snippet' },
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        platform: 'youtube',
        success: true,
        messageId: response.data.id,
      };
    } catch (error: any) {
      logger.error('YouTube post error:', error.response?.data || error.message);
      return {
        platform: 'youtube',
        success: false,
        error: error.response?.data?.error?.message || error.message,
      };
    }
  }

  /**
   * Post to Facebook Live Comments
   */
  async postToFacebook(userId: string, message: string): Promise<PostResult> {
    try {
      // Get Facebook destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId,
          platform: 'facebook',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return {
          platform: 'facebook',
          success: false,
          error: 'Facebook destination not found or not connected',
        };
      }

      const accessToken = decrypt(destination.accessToken);

      // Get active live video
      // Note: You'll need to store the live video ID when starting the stream
      const liveVideoId = destination.streamKey; // Assuming streamKey stores the video ID

      if (!liveVideoId) {
        return {
          platform: 'facebook',
          success: false,
          error: 'No active Facebook live video found',
        };
      }

      // Post comment to live video
      const response = await axios.post(
        `https://graph.facebook.com/v24.0/${liveVideoId}/comments`,
        {
          message,
        },
        {
          params: {
            access_token: accessToken,
          },
        }
      );

      return {
        platform: 'facebook',
        success: true,
        messageId: response.data.id,
      };
    } catch (error: any) {
      logger.error('Facebook post error:', error.response?.data || error.message);

      // Handle specific Facebook API error codes (2025 best practices)
      const errorCode = error.response?.data?.error?.code;
      let errorMessage = error.response?.data?.error?.message || error.message;

      if (errorCode === 190) {
        errorMessage = 'Facebook access token expired. Please reconnect your account.';
      } else if (errorCode === 368) {
        errorMessage = 'Temporarily blocked by Facebook. Please try again later.';
      } else if (errorCode === 100) {
        errorMessage = 'Invalid parameter. Please check your message content.';
      } else if (errorCode >= 200 && errorCode <= 299) {
        errorMessage = 'Permission denied. Please ensure your Facebook app has the required permissions.';
      }

      return {
        platform: 'facebook',
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Post to Twitch Chat (WebSocket)
   */
  async postToTwitch(userId: string, message: string): Promise<PostResult> {
    try {
      // Get Twitch destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId,
          platform: 'twitch',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return {
          platform: 'twitch',
          success: false,
          error: 'Twitch destination not found or not connected',
        };
      }

      const accessToken = decrypt(destination.accessToken);

      // Get channel name from Twitch API
      const userResponse = await axios.get('https://api.twitch.tv/helix/users', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Client-Id': process.env.TWITCH_CLIENT_ID || '',
        },
      });

      const channelName = userResponse.data.data[0]?.login;
      if (!channelName) {
        return {
          platform: 'twitch',
          success: false,
          error: 'Could not get Twitch channel name',
        };
      }

      // Send message via Twitch IRC
      // Note: For production, you should maintain persistent IRC connections
      // This is a simplified implementation
      return await new Promise((resolve) => {
        const ws = new WebSocket('wss://irc-ws.chat.twitch.tv:443');

        ws.on('open', () => {
          // Authenticate
          ws.send(`PASS oauth:${accessToken}`);
          ws.send(`NICK ${channelName}`);
          ws.send(`JOIN #${channelName}`);
        });

        ws.on('message', (data: WebSocket.Data) => {
          const msg = data.toString();

          // Wait for successful join
          if (msg.includes('End of /NAMES list')) {
            // Send the message
            ws.send(`PRIVMSG #${channelName} :${message}`);

            setTimeout(() => {
              ws.close();
              resolve({
                platform: 'twitch',
                success: true,
              });
            }, 1000);
          }
        });

        ws.on('error', (error) => {
          resolve({
            platform: 'twitch',
            success: false,
            error: error.message,
          });
        });

        // Timeout after 10 seconds
        setTimeout(() => {
          ws.close();
          resolve({
            platform: 'twitch',
            success: false,
            error: 'Connection timeout',
          });
        }, 10000);
      });
    } catch (error: any) {
      logger.error('Twitch post error:', error.message);
      return {
        platform: 'twitch',
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Post to LinkedIn
   */
  async postToLinkedIn(userId: string, message: string): Promise<PostResult> {
    try {
      // Get LinkedIn destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId,
          platform: 'linkedin',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return {
          platform: 'linkedin',
          success: false,
          error: 'LinkedIn destination not found or not connected',
        };
      }

      const accessToken = decrypt(destination.accessToken);

      // Get user profile
      const profileResponse = await axios.get('https://api.linkedin.com/v2/me', {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const personUrn = `urn:li:person:${profileResponse.data.id}`;

      // Create a post (share)
      const response = await axios.post(
        'https://api.linkedin.com/v2/ugcPosts',
        {
          author: personUrn,
          lifecycleState: 'PUBLISHED',
          specificContent: {
            'com.linkedin.ugc.ShareContent': {
              shareCommentary: {
                text: message,
              },
              shareMediaCategory: 'NONE',
            },
          },
          visibility: {
            'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
          },
        },
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
            'X-Restli-Protocol-Version': '2.0.0',
          },
        }
      );

      return {
        platform: 'linkedin',
        success: true,
        messageId: response.data.id,
      };
    } catch (error: any) {
      logger.error('LinkedIn post error:', error.response?.data || error.message);
      return {
        platform: 'linkedin',
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Post to Rumble Live Chat
   */
  async postToRumble(userId: string, message: string): Promise<PostResult> {
    try {
      // Get Rumble destination
      const destination = await prisma.destination.findFirst({
        where: {
          userId,
          platform: 'rumble',
          isActive: true,
        },
      });

      if (!destination || !destination.accessToken) {
        return {
          platform: 'rumble',
          success: false,
          error: 'Rumble destination not found or not connected',
        };
      }

      const apiKey = decrypt(destination.accessToken);

      // Post message to Rumble live chat using their API
      // API endpoint: https://rumble.com/service.php?name=live.post_comment
      const response = await axios.post(
        'https://rumble.com/service.php',
        null,
        {
          params: {
            name: 'live.post_comment',
            key: apiKey,
            message: message,
          },
        }
      );

      if (response.data?.error) {
        throw new Error(response.data.error);
      }

      return {
        platform: 'rumble',
        success: true,
        messageId: response.data?.comment_id || response.data?.id || 'unknown',
      };
    } catch (error: any) {
      logger.error('Rumble post error:', error.message);
      return {
        platform: 'rumble',
        success: false,
        error: error.message,
      };
    }
  }
}

export const commentPostingService = new CommentPostingService();
