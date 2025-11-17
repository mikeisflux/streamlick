import axios from 'axios';
import { decrypt, encrypt } from '../utils/crypto';
import logger from '../utils/logger';
import prisma from '../database/prisma';
const FACEBOOK_API_VERSION = 'v24.0';
const FACEBOOK_GRAPH_URL = `https://graph.facebook.com/${FACEBOOK_API_VERSION}`;

/**
 * Validate Facebook access token
 * @param token - The access token to validate
 * @returns true if valid, false if expired/invalid
 */
export async function validateFacebookToken(token: string): Promise<boolean> {
  try {
    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/me`, {
      params: { access_token: token },
    });
    return !!response.data.id;
  } catch (error: any) {
    // Error code 190 = expired/invalid token
    if (error.response?.data?.error?.code === 190) {
      logger.warn('Facebook token is expired or invalid');
      return false;
    }
    logger.error('Error validating Facebook token:', error);
    throw error;
  }
}

/**
 * Create a Facebook Live Video
 * @param pageId - The Facebook page ID
 * @param accessToken - The page access token
 * @param title - The stream title
 * @param description - The stream description
 * @returns Object containing liveVideoId and RTMP details
 */
export async function createFacebookLiveVideo(
  pageId: string,
  accessToken: string,
  title: string,
  description?: string
): Promise<{
  liveVideoId: string;
  rtmpUrl: string;
  streamKey: string;
  secureStreamUrl: string;
}> {
  try {
    logger.info(`Creating Facebook live video for page ${pageId}`);

    // Create the live video
    const response = await axios.post(
      `${FACEBOOK_GRAPH_URL}/${pageId}/live_videos`,
      {
        status: 'LIVE_NOW',
        title,
        description: description || '',
      },
      {
        params: { access_token: accessToken },
      }
    );

    const { id: liveVideoId, secure_stream_url } = response.data;

    if (!secure_stream_url) {
      throw new Error('No stream URL returned from Facebook');
    }

    // Parse the secure_stream_url (format: rtmps://server:port/rtmp/streamkey)
    const urlMatch = secure_stream_url.match(/^(rtmps?:\/\/[^\/]+\/rtmp\/)(.+)$/);

    let rtmpUrl: string;
    let streamKey: string;

    if (urlMatch) {
      rtmpUrl = urlMatch[1];
      streamKey = urlMatch[2];
    } else {
      // Fallback: use full URL as-is
      rtmpUrl = secure_stream_url;
      streamKey = '';
    }

    logger.info(`Facebook live video created: ${liveVideoId}`);

    return {
      liveVideoId,
      rtmpUrl,
      streamKey,
      secureStreamUrl: secure_stream_url,
    };
  } catch (error: any) {
    logger.error('Error creating Facebook live video:', error.response?.data || error.message);
    throw new Error(`Failed to create Facebook live video: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * End a Facebook Live Video
 * @param liveVideoId - The Facebook live video ID
 * @param accessToken - The access token
 */
export async function endFacebookLiveVideo(
  liveVideoId: string,
  accessToken: string
): Promise<void> {
  try {
    logger.info(`Ending Facebook live video: ${liveVideoId}`);

    await axios.post(
      `${FACEBOOK_GRAPH_URL}/${liveVideoId}`,
      { end_live_video: true },
      {
        params: { access_token: accessToken },
      }
    );

    logger.info(`Facebook live video ended: ${liveVideoId}`);
  } catch (error: any) {
    logger.error('Error ending Facebook live video:', error.response?.data || error.message);
    throw new Error(`Failed to end Facebook live video: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Delete a Facebook Live Video
 * @param liveVideoId - The Facebook live video ID
 * @param accessToken - The access token
 */
export async function deleteFacebookLiveVideo(
  liveVideoId: string,
  accessToken: string
): Promise<void> {
  try {
    logger.info(`Deleting Facebook live video: ${liveVideoId}`);

    await axios.delete(`${FACEBOOK_GRAPH_URL}/${liveVideoId}`, {
      params: { access_token: accessToken },
    });

    logger.info(`Facebook live video deleted: ${liveVideoId}`);
  } catch (error: any) {
    logger.error('Error deleting Facebook live video:', error.response?.data || error.message);
    // Don't throw - deletion is optional
  }
}

/**
 * Get Facebook Live Video status
 * @param liveVideoId - The Facebook live video ID
 * @param accessToken - The access token
 */
export async function getFacebookLiveVideoStatus(
  liveVideoId: string,
  accessToken: string
): Promise<{ status: string; liveViews?: number }> {
  try {
    const response = await axios.get(`${FACEBOOK_GRAPH_URL}/${liveVideoId}`, {
      params: {
        access_token: accessToken,
        fields: 'status,live_views',
      },
    });

    return {
      status: response.data.status,
      liveViews: response.data.live_views,
    };
  } catch (error: any) {
    logger.error('Error getting Facebook live video status:', error.response?.data || error.message);
    throw new Error(`Failed to get live video status: ${error.response?.data?.error?.message || error.message}`);
  }
}

/**
 * Check destinations for expiring tokens and return list of destinations needing renewal
 * @param daysUntilExpiry - How many days before expiry to warn (default: 7)
 */
export async function getDestinationsWithExpiringTokens(
  daysUntilExpiry: number = 7
): Promise<Array<{ id: string; userId: string; platform: string; displayName: string; expiresAt: Date }>> {
  const expiryThreshold = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  const destinations = await prisma.destination.findMany({
    where: {
      platform: 'facebook',
      isActive: true,
      tokenExpiresAt: {
        lte: expiryThreshold,
        gt: new Date(), // Not already expired
      },
    },
    select: {
      id: true,
      userId: true,
      platform: true,
      displayName: true,
      tokenExpiresAt: true,
    },
  });

  return destinations.map(dest => ({
    id: dest.id,
    userId: dest.userId,
    platform: dest.platform,
    displayName: dest.displayName || 'Facebook Page',
    expiresAt: dest.tokenExpiresAt!,
  }));
}

/**
 * Check if a destination's token is expired or about to expire
 * @param destinationId - The destination ID
 * @param warningDays - Days before expiry to consider as "about to expire" (default: 7)
 */
export async function isTokenExpiringSoon(
  destinationId: string,
  warningDays: number = 7
): Promise<{ expired: boolean; expiringSoon: boolean; expiresAt?: Date }> {
  const destination = await prisma.destination.findUnique({
    where: { id: destinationId },
    select: { tokenExpiresAt: true },
  });

  if (!destination?.tokenExpiresAt) {
    return { expired: false, expiringSoon: false };
  }

  const now = Date.now();
  const expiresAt = destination.tokenExpiresAt.getTime();
  const warningThreshold = now + warningDays * 24 * 60 * 60 * 1000;

  return {
    expired: expiresAt <= now,
    expiringSoon: expiresAt <= warningThreshold && expiresAt > now,
    expiresAt: destination.tokenExpiresAt,
  };
}
