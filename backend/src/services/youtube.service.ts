import axios from 'axios';
import { decrypt, encrypt } from '../utils/crypto';
import logger from '../utils/logger';
import prisma from '../database/prisma';
import { getOAuthCredentials } from '../api/oauth.routes';

const YOUTUBE_API_BASE = 'https://www.googleapis.com/youtube/v3';
const YOUTUBE_TOKEN_URL = 'https://oauth2.googleapis.com/token';

/**
 * Wait for YouTube stream to become active by polling the stream status
 * YouTube requires the RTMP stream to be actively receiving video before allowing broadcast transitions
 *
 * @param streamId - The YouTube stream ID to poll
 * @param accessToken - Valid YouTube access token
 * @param maxAttempts - Maximum number of polling attempts (default: 12 = 60 seconds)
 * @param delayMs - Delay between polling attempts in milliseconds (default: 5000 = 5 seconds)
 * @returns true if stream becomes active, false if timeout reached
 */
async function waitForStreamActive(
  streamId: string,
  accessToken: string,
  maxAttempts: number = 12,
  delayMs: number = 5000
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {

      const response = await axios.get(`${YOUTUBE_API_BASE}/liveStreams`, {
        params: {
          part: 'status',
          id: streamId,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      const stream = response.data.items?.[0];
      if (!stream) {
        logger.error(`[YouTube Stream Poll] Stream ${streamId} not found`);
        return false;
      }

      const streamStatus = stream.status?.streamStatus;

      // Stream is active when it's receiving video data
      if (streamStatus === 'active') {
        return true;
      }

      // If not active yet, wait before next poll
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (error: any) {
      logger.error(`[YouTube Stream Poll] Error checking stream status:`, error.response?.data || error.message);

      // If we can't check status, wait and retry
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    }
  }

  logger.warn(`[YouTube Stream Poll] ⏱️  Timeout reached after ${maxAttempts} attempts (${maxAttempts * delayMs / 1000}s)`);
  return false;
}

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
    logger.error('[YouTube Token] ❌ Token refresh failed');
    logger.error(`[YouTube Token] Error: ${error.response?.data?.error || error.message}`);
    logger.error(`[YouTube Token] Error description: ${error.response?.data?.error_description || 'N/A'}`);
    logger.error(`[YouTube Token] Full response: ${JSON.stringify(error.response?.data)}`);
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

      if (!destination.refreshToken) {
        throw new Error('No refresh token available for YouTube destination');
      }

      const refreshToken = decrypt(destination.refreshToken);

      // Get OAuth credentials from database (admin settings) or environment variables
      const credentials = await getOAuthCredentials('youtube');

      if (!credentials.clientId || !credentials.clientSecret) {
        logger.error('[YouTube Token] Missing OAuth credentials');
        throw new Error('YouTube OAuth credentials not configured in admin settings');
      }

      const refreshed = await refreshYouTubeToken(
        refreshToken,
        credentials.clientId,
        credentials.clientSecret
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

    // Use plain RTMP (not RTMPS) for FFmpeg compatibility
    // FFmpeg has issues with rtmps:// URLs - use standard rtmp:// on port 1935
    // YouTube supports both rtmp:// and rtmps:// endpoints
    const rtmpUrl = ingestionInfo.ingestionAddress; // Plain RTMP (e.g., rtmp://a.rtmp.youtube.com/live2)
    const streamKey = ingestionInfo.streamName;

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

    // Step 4: Return immediately - background monitoring will handle transition
    // The monitorAndTransitionYouTubeBroadcast function (called from broadcasts.routes.ts)
    // will poll the stream status and transition when active

    return {
      broadcastId,
      streamId,
      rtmpUrl,
      streamKey,
    };
  } catch (error: any) {
    const errorDetails = {
      message: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      apiError: error.response?.data?.error,
      requestUrl: error.config?.url,
      requestMethod: error.config?.method
    };

    logger.error('✗ Failed to create YouTube live broadcast', errorDetails);

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
    const response = await axios.post(
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
  } catch (error: any) {
    const errorDetails = {
      broadcastId,
      status: error.response?.status,
      statusText: error.response?.statusText,
      apiError: error.response?.data?.error,
      apiErrorMessage: error.response?.data?.error?.message,
      apiErrorCode: error.response?.data?.error?.code,
      message: error.message
    };

    logger.error('[YouTube Transition] ========== TRANSITION FAILED ==========', errorDetails);
    logger.error(`[YouTube Transition] Full error response: ${JSON.stringify(error.response?.data)}`);
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
    const response = await axios.post(
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
  } catch (error: any) {
    logger.warn(`[YouTube End] Failed to end broadcast (non-fatal)`, {
      broadcastId,
      status: error.response?.status,
      message: error.message
    });
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
    await axios.delete(`${YOUTUBE_API_BASE}/liveBroadcasts`, {
      params: { id: broadcastId },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch (error: any) {
    logger.error('Error deleting YouTube live broadcast:', error.response?.data || error.message);
    // Don't throw - deletion is optional
  }
}

/**
 * Get YouTube broadcast status
 * BEST PRACTICE: Also fetch the bound stream status to check if it's actively receiving data
 */
export async function getYouTubeBroadcastStatus(
  broadcastId: string,
  accessToken: string
): Promise<{ lifeCycleStatus: string; healthStatus?: any; streamStatus?: string; streamId?: string }> {
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

    const result: any = {
      lifeCycleStatus: broadcast.status.lifeCycleStatus,
      healthStatus: broadcast.contentDetails?.monitorStream?.healthStatus,
    };

    // BEST PRACTICE: Check the bound stream's status
    // YouTube recommends verifying streamStatus is 'active' before transitioning to live
    const boundStreamId = broadcast.contentDetails?.boundStreamId;
    if (boundStreamId) {
      try {
        const streamResponse = await axios.get(`${YOUTUBE_API_BASE}/liveStreams`, {
          params: {
            part: 'status',
            id: boundStreamId,
          },
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        const stream = streamResponse.data.items?.[0];
        if (stream) {
          result.streamStatus = stream.status?.streamStatus;
          result.streamId = boundStreamId;
        }
      } catch (streamError) {
        // Don't fail if we can't get stream status, just log it
        logger.warn(`Could not fetch stream status for ${boundStreamId}`);
      }
    }

    return result;
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
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wait before checking (except first attempt)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      const status = await getYouTubeBroadcastStatus(broadcastId, accessToken);
      if (status.healthStatus?.configurationIssues) {
        logger.warn(`[YouTube Monitor] Configuration Issues:`, status.healthStatus.configurationIssues);
      }

      // BEST PRACTICE: Check stream status is 'active' before transitioning
      // YouTube documentation recommends verifying the bound stream is actively receiving data
      // Check if we should transition to live:
      // 1. Health status is good/ok (YouTube explicitly validated stream), OR
      // 2. Lifecycle status is liveStarting (YouTube detected stream and is ready to go live), OR
      // 3. Stream status is 'active' AND we've waited at least 10 seconds (stream is receiving data)
      const healthIsGood = status.healthStatus?.status === 'good' || status.healthStatus?.status === 'ok';
      const lifecycleIsReady = status.lifeCycleStatus === 'liveStarting';
      const streamIsActive = status.streamStatus === 'active';
      const healthIsUnknownButStreamActive = streamIsActive && attempt >= 5; // Stream active for 10+ seconds

      const shouldTransition = healthIsGood || lifecycleIsReady || healthIsUnknownButStreamActive;

      if (shouldTransition) {
        let reason = '';
        if (healthIsGood) {
          reason = `Stream health is ${status.healthStatus.status.toUpperCase()}`;
        } else if (lifecycleIsReady) {
          reason = 'Lifecycle status is liveStarting';
        } else if (healthIsUnknownButStreamActive) {
          reason = `Stream status is ACTIVE (${status.streamStatus}) and has been running for 10+ seconds`;
        }

        try {
          await transitionYouTubeBroadcastToLive(broadcastId, accessToken);
          return;
        } catch (transitionError: any) {
          // Handle specific YouTube API errors
          const errorCode = transitionError.response?.data?.error?.code;
          const errorMessage = transitionError.response?.data?.error?.message || transitionError.message;

          // Error 400 with "transition" in message usually means invalid state transition
          if (errorCode === 400 && errorMessage.toLowerCase().includes('transition')) {
            logger.warn(`[YouTube Monitor] Transition rejected (attempt ${attempt}), will retry...`);
            logger.warn(`[YouTube Monitor] Error: ${errorMessage}`);
            continue;
          }

          // Other errors are more serious
          logger.error(`[YouTube Monitor] ========== TRANSITION ERROR ==========`);
          logger.error(`[YouTube Monitor] ✗ Non-retryable error on attempt ${attempt}`);
          logger.error(`[YouTube Monitor] Error code: ${errorCode}`);
          logger.error(`[YouTube Monitor] Error message: ${errorMessage}`);
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
