import axios from 'axios';
import { decrypt, encrypt } from '../utils/crypto';
import logger from '../utils/logger';
import prisma from '../database/prisma';
const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Refresh YouTube access token using refresh token
 */
export async function refreshYouTubeToken(
  refreshToken: string,
  clientId: string,
  clientSecret: string
): Promise<{ access_token: string; expires_in: number }> {
  try {
    const response = await axios.post(YOUTUBE_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    return {
      access_token: response.data.access_token,
      expires_in: response.data.expires_in || 3600,
    };
  } catch (error: any) {
    logger.error('YouTube token refresh error:', error.response?.data || error.message);
    throw new Error(`Failed to refresh YouTube token: ${error.response?.data?.error || error.message}`);
  }
}

/**
 * Validate YouTube access token
 */
export async function validateYouTubeToken(accessToken: string): Promise<boolean> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/channels`, {
      params: { part: 'snippet', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return !!response.data.items?.length;
  } catch (error: any) {
    if (error.response?.status === 401) {
      logger.warn('YouTube token is expired or invalid');
      return false;
    }
    logger.error('Error validating YouTube token:', error);
    throw error;
  }
}

/**
 * Get or refresh valid YouTube token for a destination
 */
export async function getValidYouTubeToken(destinationId: string): Promise<string> {
  const destination = await prisma.destination.findUnique({
    where: { id: destinationId },
  });

  if (!destination || !destination.accessToken) {
    throw new Error('YouTube destination not found or not configured');
  }

  let accessToken = decrypt(destination.accessToken);

  // Check if token is expired or will expire soon (within 5 minutes)
  if (destination.tokenExpiresAt) {
    const now = new Date();
    const expiryTime = new Date(destination.tokenExpiresAt);
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);

    if (expiryTime <= fiveMinutesFromNow) {
      logger.info(`YouTube token expired or expiring soon for destination ${destinationId}, refreshing...`);

      if (!destination.refreshToken) {
        throw new Error('No refresh token available for YouTube destination');
      }

      const refreshToken = decrypt(destination.refreshToken);
      const refreshed = await refreshYouTubeToken(
        refreshToken,
        process.env.YOUTUBE_CLIENT_ID!,
        process.env.YOUTUBE_CLIENT_SECRET!
      );

      accessToken = refreshed.access_token;

      // Update destination with new token
      await prisma.destination.update({
        where: { id: destinationId },
        data: {
          accessToken: encrypt(accessToken),
          tokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
        },
      });

      logger.info(`YouTube token refreshed for destination ${destinationId}`);
    }
  }

  return accessToken;
}

/**
 * Create a YouTube live broadcast
 */
export async function createYouTubeLiveBroadcast(
  accessToken: string,
  title: string,
  description?: string,
  scheduledStartTime?: string,
  privacyStatus: 'public' | 'unlisted' | 'private' = 'public'
): Promise<{ broadcastId: string; streamId: string; rtmpUrl: string; streamKey: string }> {
  try {
    logger.info('Creating YouTube live broadcast');

    // Step 1: Create liveBroadcast
    const broadcastResponse = await axios.post(
      `${YOUTUBE_API_BASE}/liveBroadcasts`,
      {
        snippet: {
          title,
          description: description || '',
          scheduledStartTime: scheduledStartTime || new Date().toISOString(),
        },
        status: {
          privacyStatus,
          selfDeclaredMadeForKids: false,
        },
        contentDetails: {
          enableAutoStart: true,
          enableAutoStop: true,
          enableDvr: true,
          recordFromStart: true,
          enableContentEncryption: false,
          enableEmbed: true,
        },
      },
      {
        params: { part: 'snippet,status,contentDetails' },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const broadcastId = broadcastResponse.data.id;
    logger.info(`YouTube broadcast created: ${broadcastId}`);

    // Step 2: Create or get liveStream
    const streamResponse = await axios.post(
      `${YOUTUBE_API_BASE}/liveStreams`,
      {
        snippet: {
          title: `${title} - Stream`,
        },
        cdn: {
          frameRate: '30fps',
          ingestionType: 'rtmp',
          resolution: '1080p',
        },
        contentDetails: {
          isReusable: false,
        },
      },
      {
        params: { part: 'snippet,cdn,contentDetails,status' },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    const streamId = streamResponse.data.id;
    const ingestionInfo = streamResponse.data.cdn.ingestionInfo;
    const rtmpUrl = ingestionInfo.ingestionAddress;
    const streamKey = ingestionInfo.streamName;

    logger.info(`YouTube stream created: ${streamId}`);

    // Step 3: Bind broadcast to stream
    await axios.post(
      `${YOUTUBE_API_BASE}/liveBroadcasts/bind`,
      null,
      {
        params: {
          id: broadcastId,
          streamId: streamId,
          part: 'id,contentDetails',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    logger.info(`YouTube broadcast ${broadcastId} bound to stream ${streamId}`);

    // Step 4: Transition to "ready" status
    await axios.post(
      `${YOUTUBE_API_BASE}/liveBroadcasts/transition`,
      null,
      {
        params: {
          id: broadcastId,
          broadcastStatus: 'ready',
          part: 'status',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    logger.info(`YouTube broadcast ${broadcastId} transitioned to ready`);

    return {
      broadcastId,
      streamId,
      rtmpUrl,
      streamKey,
    };
  } catch (error: any) {
    logger.error('Error creating YouTube live broadcast:', error.response?.data || error.message);
    throw new Error(
      `Failed to create YouTube live broadcast: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

/**
 * Transition YouTube broadcast to live
 */
export async function transitionYouTubeBroadcastToLive(
  broadcastId: string,
  accessToken: string
): Promise<void> {
  try {
    logger.info(`Transitioning YouTube broadcast ${broadcastId} to live`);

    await axios.post(
      `${YOUTUBE_API_BASE}/liveBroadcasts/transition`,
      null,
      {
        params: {
          id: broadcastId,
          broadcastStatus: 'live',
          part: 'status',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    logger.info(`YouTube broadcast ${broadcastId} is now live`);
  } catch (error: any) {
    logger.error('Error transitioning YouTube broadcast to live:', error.response?.data || error.message);
    throw new Error(
      `Failed to transition YouTube broadcast to live: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

/**
 * End a YouTube live broadcast
 */
export async function endYouTubeLiveBroadcast(
  broadcastId: string,
  accessToken: string
): Promise<void> {
  try {
    logger.info(`Ending YouTube live broadcast: ${broadcastId}`);

    await axios.post(
      `${YOUTUBE_API_BASE}/liveBroadcasts/transition`,
      null,
      {
        params: {
          id: broadcastId,
          broadcastStatus: 'complete',
          part: 'status',
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      }
    );

    logger.info(`YouTube broadcast ended: ${broadcastId}`);
  } catch (error: any) {
    logger.error('Error ending YouTube live broadcast:', error.response?.data || error.message);
    // Don't throw - ending might fail if already ended
  }
}

/**
 * Delete a YouTube live broadcast
 */
export async function deleteYouTubeLiveBroadcast(
  broadcastId: string,
  accessToken: string
): Promise<void> {
  try {
    logger.info(`Deleting YouTube live broadcast: ${broadcastId}`);

    await axios.delete(`${YOUTUBE_API_BASE}/liveBroadcasts`, {
      params: { id: broadcastId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    logger.info(`YouTube broadcast deleted: ${broadcastId}`);
  } catch (error: any) {
    logger.error('Error deleting YouTube live broadcast:', error.response?.data || error.message);
    // Don't throw - deletion is optional
  }
}

/**
 * Get YouTube broadcast status
 */
export async function getYouTubeBroadcastStatus(
  broadcastId: string,
  accessToken: string
): Promise<{ lifeCycleStatus: string; healthStatus?: any }> {
  try {
    const response = await axios.get(`${YOUTUBE_API_BASE}/liveBroadcasts`, {
      params: {
        part: 'status,contentDetails',
        id: broadcastId,
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const broadcast = response.data.items?.[0];
    if (!broadcast) {
      throw new Error('Broadcast not found');
    }

    return {
      lifeCycleStatus: broadcast.status.lifeCycleStatus,
      healthStatus: broadcast.contentDetails?.monitorStream?.healthStatus,
    };
  } catch (error: any) {
    logger.error('Error getting YouTube broadcast status:', error.response?.data || error.message);
    throw new Error(
      `Failed to get broadcast status: ${error.response?.data?.error?.message || error.message}`
    );
  }
}

/**
 * Check destinations for expiring tokens
 */
export async function getYouTubeDestinationsWithExpiringTokens(
  daysUntilExpiry: number = 7
): Promise<Array<{ id: string; userId: string; platform: string; displayName: string; expiresAt: Date }>> {
  const expiryThreshold = new Date(Date.now() + daysUntilExpiry * 24 * 60 * 60 * 1000);

  const destinations = await prisma.destination.findMany({
    where: {
      platform: 'youtube',
      isActive: true,
      tokenExpiresAt: {
        lte: expiryThreshold,
        gt: new Date(),
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

  return destinations.map((dest) => ({
    id: dest.id,
    userId: dest.userId,
    platform: dest.platform,
    displayName: dest.displayName || 'YouTube Channel',
    expiresAt: dest.tokenExpiresAt!,
  }));
}

/**
 * Monitor YouTube broadcast status and transition to live when ready
 * This function polls the broadcast status and transitions to live once YouTube detects the stream
 */
export async function monitorAndTransitionYouTubeBroadcast(
  broadcastId: string,
  accessToken: string,
  maxAttempts: number = 30,
  pollIntervalMs: number = 2000
): Promise<void> {
  logger.info(`Starting YouTube broadcast monitoring for ${broadcastId}`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wait before checking (except first attempt)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      const status = await getYouTubeBroadcastStatus(broadcastId, accessToken);
      logger.info(`YouTube broadcast ${broadcastId} status check ${attempt}/${maxAttempts}: ${status.lifeCycleStatus}, stream health: ${status.healthStatus?.status || 'unknown'}`);

      // Check if stream is receiving data
      if (status.healthStatus?.status === 'good' || status.healthStatus?.status === 'ok') {
        logger.info(`YouTube stream detected for broadcast ${broadcastId}, transitioning to live`);

        try {
          await transitionYouTubeBroadcastToLive(broadcastId, accessToken);
          logger.info(`YouTube broadcast ${broadcastId} successfully transitioned to live`);
          return;
        } catch (transitionError: any) {
          // Handle specific YouTube API errors
          const errorCode = transitionError.response?.data?.error?.code;
          const errorMessage = transitionError.response?.data?.error?.message || transitionError.message;

          // Error 400 with "transition" in message usually means invalid state transition
          if (errorCode === 400 && errorMessage.includes('transition')) {
            logger.warn(`YouTube broadcast ${broadcastId} transition failed (attempt ${attempt}): ${errorMessage}. Will retry.`);
            continue;
          }

          // Other errors are more serious
          throw transitionError;
        }
      }

      // Check for error states
      if (status.healthStatus?.status === 'bad' || status.healthStatus?.status === 'noData') {
        logger.warn(`YouTube stream health issue for broadcast ${broadcastId}: ${status.healthStatus.status}`);
        // Continue monitoring - stream might recover
      }

      // If we're at max attempts, log warning but don't throw
      if (attempt === maxAttempts) {
        logger.warn(`YouTube broadcast ${broadcastId} did not transition to live after ${maxAttempts} attempts (${maxAttempts * pollIntervalMs / 1000}s). Final status: ${status.lifeCycleStatus}`);
        // Don't throw - the broadcast was created successfully, just didn't auto-transition
        return;
      }

    } catch (error: any) {
      logger.error(`Error monitoring YouTube broadcast ${broadcastId} (attempt ${attempt}):`, error.response?.data || error.message);

      // If it's a 404 or auth error, stop trying
      if (error.response?.status === 404 || error.response?.status === 401 || error.response?.status === 403) {
        throw error;
      }

      // For other errors, continue trying if we have attempts left
      if (attempt === maxAttempts) {
        throw error;
      }
    }
  }
}
