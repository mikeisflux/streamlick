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
  logger.info(`[YouTube Stream Poll] Starting to poll stream ${streamId} (max ${maxAttempts * delayMs / 1000}s)`);

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.info(`[YouTube Stream Poll] Attempt ${attempt}/${maxAttempts} - Checking stream status...`);

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
      const healthStatus = stream.status?.healthStatus?.status;

      logger.info(`[YouTube Stream Poll] Stream status: ${streamStatus}, Health: ${healthStatus || 'N/A'}`);

      // Stream is active when it's receiving video data
      if (streamStatus === 'active') {
        logger.info(`[YouTube Stream Poll] ✅ Stream is ACTIVE after ${attempt} attempts (${attempt * delayMs / 1000}s)`);
        return true;
      }

      // If not active yet, wait before next poll
      if (attempt < maxAttempts) {
        logger.info(`[YouTube Stream Poll] ⏳ Stream not active yet, waiting ${delayMs / 1000}s before retry...`);
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
    logger.info('[YouTube Token] Attempting to refresh token...');
    logger.info(`[YouTube Token] Client ID: ${clientId?.substring(0, 20)}...`);
    logger.info(`[YouTube Token] Refresh token present: ${!!refreshToken}`);

    const response = await axios.post(YOUTUBE_TOKEN_URL, {
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    });

    logger.info('[YouTube Token] ✅ Token refreshed successfully');

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
      logger.info(`YouTube token expired or expiring soon for destination ${destinationId}, refreshing...`);

      if (!destination.refreshToken) {
        throw new Error('No refresh token available for YouTube destination');
      }

      const refreshToken = decrypt(destination.refreshToken);

      // Get OAuth credentials from database (admin settings) or environment variables
      logger.info('[YouTube Token] Retrieving OAuth credentials from database...');
      const credentials = await getOAuthCredentials('youtube');

      if (!credentials.clientId || !credentials.clientSecret) {
        logger.error('[YouTube Token] Missing OAuth credentials');
        logger.error(`[YouTube Token] clientId present: ${!!credentials.clientId}`);
        logger.error(`[YouTube Token] clientSecret present: ${!!credentials.clientSecret}`);
        throw new Error('YouTube OAuth credentials not configured in admin settings');
      }

      logger.info('[YouTube Token] Successfully retrieved OAuth credentials from database');

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
    logger.info('Creating YouTube live broadcast', {
      title,
      privacyStatus,
      hasDescription: !!description,
      hasSchedule: !!scheduledStartTime
    });

    // Step 1: Create liveBroadcast
    logger.info('[YouTube Step 1/4] Creating liveBroadcast...');
    logger.info(`[YouTube Step 1/4] Request payload: title="${title}", description="${description || ''}", privacy=${privacyStatus}`);

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

    logger.info(`[YouTube Step 1/4] Response: broadcastId=${broadcastResponse.data.id}, title="${broadcastResponse.data.snippet?.title}"`);

    const broadcastId = broadcastResponse.data.id;
    logger.info(`[YouTube Step 1/4] ✓ LiveBroadcast created successfully`, {
      broadcastId,
      lifeCycleStatus: broadcastResponse.data.status?.lifeCycleStatus,
      privacyStatus: broadcastResponse.data.status?.privacyStatus
    });

    // Step 2: Create or get liveStream
    logger.info('[YouTube Step 2/4] Creating liveStream...');
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

    // BEST PRACTICE: Use RTMPS (secure RTMP over port 443) instead of plain RTMP
    // This prevents man-in-the-middle attacks and is recommended by YouTube
    const rtmpUrl = ingestionInfo.rtmpsIngestionAddress || ingestionInfo.ingestionAddress;
    const streamKey = ingestionInfo.streamName;

    logger.info(`[YouTube Step 2/4] ✓ LiveStream created successfully`, {
      streamId,
      rtmpUrl,
      usingRTMPS: rtmpUrl.startsWith('rtmps://'),
      streamKeyLength: streamKey?.length,
      resolution: streamResponse.data.cdn.resolution,
      frameRate: streamResponse.data.cdn.frameRate
    });

    // Step 3: Bind broadcast to stream
    logger.info('[YouTube Step 3/4] Binding broadcast to stream...');
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

    logger.info(`[YouTube Step 3/4] ✓ Broadcast bound to stream successfully`, {
      broadcastId,
      streamId
    });

    // Step 4: Return immediately - background monitoring will handle transition
    // The monitorAndTransitionYouTubeBroadcast function (called from broadcasts.routes.ts)
    // will poll the stream status and transition when active
    logger.info('[YouTube Step 4/4] ✓ Broadcast created and bound to stream');
    logger.info('[YouTube Step 4/4] Background monitoring will transition to live when stream is active');

    logger.info('✓ YouTube live broadcast created successfully', {
      broadcastId,
      streamId,
      rtmpUrl,
      privacyStatus,
      title
    });

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
    logger.info(`[YouTube Transition] ========== TRANSITIONING TO LIVE ==========`);
    logger.info(`[YouTube Transition] Broadcast ID: ${broadcastId}`);
    logger.info(`[YouTube Transition] Calling liveBroadcasts.transition with broadcastStatus="live"`);

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

    logger.info(`[YouTube Transition] ========== TRANSITION SUCCESSFUL ==========`);
    logger.info(`[YouTube Transition] ✓ Broadcast is now LIVE`, {
      broadcastId,
      lifeCycleStatus: response.data?.status?.lifeCycleStatus,
      privacyStatus: response.data?.status?.privacyStatus,
      recordingStatus: response.data?.status?.recordingStatus
    });
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
    logger.info(`[YouTube End] Ending broadcast`, { broadcastId });

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

    logger.info(`[YouTube End] ✓ Broadcast ended successfully`, {
      broadcastId,
      finalStatus: response.data?.status?.lifeCycleStatus
    });
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
  logger.info(`[YouTube Monitor] Starting broadcast monitoring`, {
    broadcastId,
    maxAttempts,
    pollIntervalMs,
    maxWaitTime: `${(maxAttempts * pollIntervalMs) / 1000}s`
  });

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      // Wait before checking (except first attempt)
      if (attempt > 1) {
        await new Promise(resolve => setTimeout(resolve, pollIntervalMs));
      }

      const status = await getYouTubeBroadcastStatus(broadcastId, accessToken);
      logger.info(`[YouTube Monitor] ========== STATUS CHECK ${attempt}/${maxAttempts} ==========`);
      logger.info(`[YouTube Monitor] Broadcast ID: ${broadcastId}`);
      logger.info(`[YouTube Monitor] Lifecycle Status: ${status.lifeCycleStatus}`);
      logger.info(`[YouTube Monitor] Stream Status: ${status.streamStatus || 'unknown'}`);
      logger.info(`[YouTube Monitor] Stream Health: ${status.healthStatus?.status || 'unknown'}`);
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

        logger.info(`[YouTube Monitor] ========== STREAM DETECTED! ==========`);
        logger.info(`[YouTube Monitor] ✓ ${reason}`);
        logger.info(`[YouTube Monitor] Initiating transition to live after ${attempt} attempt(s)...`);

        try {
          await transitionYouTubeBroadcastToLive(broadcastId, accessToken);
          logger.info(`[YouTube Monitor] ========== SUCCESS! ==========`);
          logger.info(`[YouTube Monitor] ✓ Successfully transitioned to live!`);
          logger.info(`[YouTube Monitor] Total attempts: ${attempt}`);
          logger.info(`[YouTube Monitor] Total wait time: ${(attempt * pollIntervalMs) / 1000}s`);
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
      } else {
        logger.info(`[YouTube Monitor] Waiting for stream... (streamStatus: ${status.streamStatus || 'unknown'}, health: ${status.healthStatus?.status || 'unknown'}, lifecycle: ${status.lifeCycleStatus})`);
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
