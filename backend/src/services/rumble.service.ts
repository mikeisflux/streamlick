/**
 * Rumble Service
 *
 * Rumble uses API key authentication and provides RTMP streaming.
 * API Documentation: https://rumblefaq.groovehq.com/help/how-to-use-rumble-s-live-stream-api
 *
 * Key Endpoints:
 * - service.php?name=live.get_chat - Get live chat messages
 * - service.php?name=live.create - Create a new live stream
 * - service.php?name=live.start - Start streaming
 * - service.php?name=live.stop - Stop streaming
 */

import axios from 'axios';
import { decrypt, encrypt } from '../utils/crypto';
import logger from '../utils/logger';
import prisma from '../database/prisma';

const RUMBLE_API_BASE = 'https://rumble.com/service.php';

/**
 * Validate Rumble API key
 */
export async function validateRumbleApiKey(apiKey: string): Promise<boolean> {
  try {
    // Try to fetch user info or channel info to validate the key
    const response = await axios.get(RUMBLE_API_BASE, {
      params: {
        name: 'user.info',
        key: apiKey,
      },
      timeout: 10000,
    });

    // If we get a successful response, the key is valid
    return response.status === 200 && !response.data?.error;
  } catch (error: any) {
    logger.error('Rumble API key validation error:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Create a Rumble live stream
 * Returns RTMP URL and stream key
 */
export async function createRumbleLiveStream(
  apiKey: string,
  title: string,
  description?: string
): Promise<{
  streamId: string;
  rtmpUrl: string;
  streamKey: string;
  streamUrl: string;
}> {
  try {
    logger.info('Creating Rumble live stream');

    const response = await axios.post(RUMBLE_API_BASE, null, {
      params: {
        name: 'live.create',
        key: apiKey,
        title,
        description: description || '',
      },
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    const data = response.data;

    // Rumble typically returns:
    // - stream_id: unique identifier
    // - rtmp_url: RTMP server URL
    // - stream_key: stream key for RTMP
    // - stream_url: public viewing URL

    return {
      streamId: data.stream_id || data.id,
      rtmpUrl: data.rtmp_url || 'rtmps://web-us-sf.rmbl.ws:443/live',
      streamKey: data.stream_key || data.key,
      streamUrl: data.stream_url || data.url || '',
    };
  } catch (error: any) {
    logger.error('Error creating Rumble live stream:', error.response?.data || error.message);
    throw new Error(
      `Failed to create Rumble live stream: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Start a Rumble live stream
 */
export async function startRumbleLiveStream(
  apiKey: string,
  streamId: string
): Promise<void> {
  try {
    logger.info(`Starting Rumble live stream: ${streamId}`);

    const response = await axios.post(RUMBLE_API_BASE, null, {
      params: {
        name: 'live.start',
        key: apiKey,
        stream_id: streamId,
      },
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    logger.info(`Rumble stream started: ${streamId}`);
  } catch (error: any) {
    logger.error('Error starting Rumble live stream:', error.response?.data || error.message);
    throw new Error(
      `Failed to start Rumble live stream: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Stop a Rumble live stream
 */
export async function stopRumbleLiveStream(
  apiKey: string,
  streamId: string
): Promise<void> {
  try {
    logger.info(`Stopping Rumble live stream: ${streamId}`);

    const response = await axios.post(RUMBLE_API_BASE, null, {
      params: {
        name: 'live.stop',
        key: apiKey,
        stream_id: streamId,
      },
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    logger.info(`Rumble stream stopped: ${streamId}`);
  } catch (error: any) {
    logger.error('Error stopping Rumble live stream:', error.response?.data || error.message);
    // Don't throw - stopping might fail if already stopped
  }
}

/**
 * Get Rumble stream status
 */
export async function getRumbleStreamStatus(
  apiKey: string,
  streamId: string
): Promise<{
  status: 'created' | 'live' | 'ended';
  viewerCount?: number;
  streamUrl?: string;
}> {
  try {
    const response = await axios.get(RUMBLE_API_BASE, {
      params: {
        name: 'live.status',
        key: apiKey,
        stream_id: streamId,
      },
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    return {
      status: response.data.status || 'created',
      viewerCount: response.data.viewer_count || 0,
      streamUrl: response.data.stream_url || response.data.url,
    };
  } catch (error: any) {
    logger.error('Error getting Rumble stream status:', error.response?.data || error.message);
    throw new Error(
      `Failed to get stream status: ${error.response?.data?.error || error.message}`
    );
  }
}

/**
 * Get Rumble channel info
 */
export async function getRumbleChannelInfo(
  apiKey: string
): Promise<{
  channelId: string;
  channelName: string;
  channelUrl: string;
  subscriberCount?: number;
}> {
  try {
    const response = await axios.get(RUMBLE_API_BASE, {
      params: {
        name: 'user.info',
        key: apiKey,
      },
    });

    if (response.data?.error) {
      throw new Error(response.data.error);
    }

    const data = response.data;

    return {
      channelId: data.channel_id || data.id || 'unknown',
      channelName: data.channel_name || data.username || 'Unknown Channel',
      channelUrl: data.channel_url || data.url || '',
      subscriberCount: data.subscriber_count || data.followers || 0,
    };
  } catch (error: any) {
    logger.error('Error getting Rumble channel info:', error.response?.data || error.message);
    throw new Error(
      `Failed to get channel info: ${error.response?.data?.error || error.message}`
    );
  }
}
