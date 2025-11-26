import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest } from '../auth/middleware';
import logger from '../utils/logger';
import { decrypt, encrypt } from '../utils/crypto';
import {
  createFacebookLiveVideo,
  endFacebookLiveVideo,
  validateFacebookToken,
} from '../services/facebook.service';
import {
  createYouTubeLiveBroadcast,
  endYouTubeLiveBroadcast,
  getValidYouTubeToken,
  getYouTubeBroadcastStatus,
  monitorAndTransitionYouTubeBroadcast,
  transitionYouTubeBroadcastToLive,
} from '../services/youtube.service';
import { getIOInstance } from '../socket/io-instance';
import { forceDeleteBroadcastDestinations } from '../utils/cleanup-destinations';

const router = Router();

// CRITICAL FIX: Track countdown intervals to prevent memory leaks
// Stores interval IDs for each broadcast so they can be cleared on stop
const countdownIntervals = new Map<string, NodeJS.Timeout>();

// CRITICAL FIX: Helper function for type-safe error message extraction
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message);
  }
  return 'Unknown error';
}

// Get all broadcasts for user (with pagination)
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    // Pagination parameters
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100); // Max 100 per page
    const skip = (page - 1) * limit;

    // CRITICAL FIX: Add pagination to prevent performance issues with large datasets
    const [broadcasts, total] = await Promise.all([
      prisma.broadcast.findMany({
        where: { userId: req.user!.userId },
        include: {
          participants: true,
          recordings: true,
          broadcastDestinations: {
            include: { destination: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.broadcast.count({
        where: { userId: req.user!.userId },
      }),
    ]);

    // Return paginated response with metadata
    res.json({
      broadcasts,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: page * limit < total,
      },
    });
  } catch (error) {
    logger.error('Get broadcasts error:', error);
    res.status(500).json({ error: 'Failed to get broadcasts' });
  }
});

// Create new broadcast
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, scheduledAt, studioConfig } = req.body;

    const broadcast = await prisma.broadcast.create({
      data: {
        userId: req.user!.userId,
        title,
        description,
        scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
        studioConfig: studioConfig || {},
        status: 'scheduled',
      },
    });

    res.status(201).json(broadcast);
  } catch (error) {
    logger.error('Create broadcast error:', error);
    res.status(500).json({ error: 'Failed to create broadcast' });
  }
});

// Get broadcast details
router.get('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        participants: true,
        recordings: true,
        broadcastDestinations: {
          include: { destination: true },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json(broadcast);
  } catch (error) {
    logger.error('Get broadcast error:', error);
    res.status(500).json({ error: 'Failed to get broadcast' });
  }
});

// Update broadcast
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { title, description, scheduledAt, studioConfig, status } = req.body;

    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      data: {
        ...(title && { title }),
        ...(description !== undefined && { description }),
        ...(scheduledAt && { scheduledAt: new Date(scheduledAt) }),
        ...(studioConfig && { studioConfig }),
        ...(status && { status }),
      },
    });

    if (broadcast.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const updated = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update broadcast error:', error);
    res.status(500).json({ error: 'Failed to update broadcast' });
  }
});

// Delete broadcast
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const deleted = await prisma.broadcast.deleteMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    res.json({ message: 'Broadcast deleted successfully' });
  } catch (error) {
    logger.error('Delete broadcast error:', error);
    res.status(500).json({ error: 'Failed to delete broadcast' });
  }
});

// Start broadcast
router.post('/:id/start', authenticate, async (req: AuthRequest, res) => {
  try {
    const { destinationIds, destinationSettings = {} } = req.body; // destinationSettings: { [destinationId]: { privacyStatus, scheduledStartTime } }

    // NUCLEAR CLEANUP: Force delete ALL old broadcast destinations using utility function
    // This runs BEFORE any processing to ensure a clean slate every time
    await forceDeleteBroadcastDestinations(req.params.id);

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Set broadcast to countdown status
    await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: 'countdown',
        startedAt: new Date(),
      },
    });

    // Return immediately to start countdown on frontend
    // CRITICAL FIX: Validate parsed countdown duration to prevent NaN
    let countdownDuration = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '30', 10);
    if (isNaN(countdownDuration) || countdownDuration < 0 || countdownDuration > 300) {
      logger.warn(`Invalid BROADCAST_COUNTDOWN_SECONDS: ${process.env.BROADCAST_COUNTDOWN_SECONDS}, using default 30`);
      countdownDuration = 30; // Safe default - allows time for YouTube stream prep
    }

    res.json({
      message: 'Countdown started',
      broadcastId: broadcast.id,
      countdown: countdownDuration,
      status: 'countdown'
    });

    // Asynchronously prepare destinations during countdown
    // Use async IIFE instead of setImmediate to avoid race conditions
    (async () => {
      try {

        const io = getIOInstance();
        // Configurable countdown duration (default 30 seconds for stream prep)
        // CRITICAL FIX: Validate parsed countdown duration to prevent NaN
        let countdownSeconds = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '30', 10);
        if (isNaN(countdownSeconds) || countdownSeconds < 0 || countdownSeconds > 300) {
          logger.warn(`[ASYNC IIFE] Invalid BROADCAST_COUNTDOWN_SECONDS: ${process.env.BROADCAST_COUNTDOWN_SECONDS}, using default 30`);
          countdownSeconds = 30; // Safe default - allows time for YouTube stream prep
        }


        // Emit countdown ticks
        const countdownInterval = setInterval(() => {
          countdownSeconds--;
          io.to(`broadcast:${broadcast.id}`).emit('countdown-tick', {
            broadcastId: broadcast.id,
            secondsRemaining: countdownSeconds,
          });

          if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
          }
        }, 1000);

        const broadcastDestinations: any[] = [];

        // Nuclear cleanup already ran at route handler start - no need for duplicate cleanup here

        // If destinations are specified, create live videos for each platform
        if (destinationIds && destinationIds.length > 0) {
          // CRITICAL: Deduplicate destination IDs to prevent creating multiple stream keys for the same destination
          const uniqueDestinationIds = Array.from(new Set(destinationIds as string[])) as string[];

          if (uniqueDestinationIds.length !== destinationIds.length) {
            logger.warn(`[ASYNC IIFE] ⚠️  Detected ${destinationIds.length - uniqueDestinationIds.length} duplicate destination IDs`);
            logger.warn(`[ASYNC IIFE] Original array: ${JSON.stringify(destinationIds)}`);
            logger.warn(`[ASYNC IIFE] Deduplicated to: ${JSON.stringify(uniqueDestinationIds)}`);
          }

          const destinations = await prisma.destination.findMany({
            where: {
              id: { in: uniqueDestinationIds },
              userId: req.user!.userId,
              isActive: true,
            },
          });


          // TEMPORARY FIX: ONLY PROCESS FIRST DESTINATION UNTIL MULTI-DESTINATION BUG IS FIXED
          const singleDestination = destinations.slice(0, 1);
          logger.warn(`[ASYNC IIFE] ⚠️ TEMPORARY: Only processing FIRST destination (${singleDestination.length}) out of ${destinations.length} selected`);

          // CRITICAL FIX: Track processed destination IDs to prevent creating multiple broadcasts for same destination
          const processedDestinationIds = new Set<string>();

          for (const destination of singleDestination) {
            try {
              // SAFETY CHECK: Skip if already processed (should never happen, but prevents disaster)
              if (processedDestinationIds.has(destination.id)) {
                logger.error(`[ASYNC IIFE] ⚠️ CRITICAL: Destination ${destination.id} already processed - SKIPPING to prevent duplicate!`);
                continue;
              }

              processedDestinationIds.add(destination.id);

              let streamUrl = destination.rtmpUrl;
              let streamKey = destination.streamKey ? decrypt(destination.streamKey) : '';
              let liveVideoId: string | null = null;

              // Handle Facebook live video creation
              if (destination.platform === 'facebook' && destination.pageId && destination.accessToken) {
                const accessToken = decrypt(destination.accessToken);

                // Validate token before use
                const isValid = await validateFacebookToken(accessToken);
                if (!isValid) {
                  logger.error(`Facebook token expired for destination ${destination.id}`);
                  continue; // Skip this destination
                }

                // Create Facebook live video
                const liveVideo = await createFacebookLiveVideo(
                  destination.pageId,
                  accessToken,
                  broadcast.title,
                  broadcast.description || undefined
                );

                streamUrl = liveVideo.rtmpUrl;
                streamKey = liveVideo.streamKey;
                liveVideoId = liveVideo.liveVideoId;

              }

              // Handle YouTube live broadcast creation
              if (destination.platform === 'youtube' && destination.channelId) {
                try {

                  // Get valid token (auto-refreshes if needed)
                  const accessToken = await getValidYouTubeToken(destination.id);

                  // Get privacy and scheduling settings for this destination
                  const settings = destinationSettings[destination.id] || {};
                  const privacyStatus = settings.privacyStatus || 'public';
                  const scheduledStartTime = settings.scheduledStartTime || undefined;
                  const title = settings.title || broadcast.title || 'Live Stream';
                  const description = settings.description || broadcast.description || '';


                  // Create YouTube live broadcast
                  const ytBroadcast = await createYouTubeLiveBroadcast(
                    accessToken,
                    title,
                    description,
                    scheduledStartTime,
                    privacyStatus
                  );

                  streamUrl = ytBroadcast.rtmpUrl;
                  streamKey = ytBroadcast.streamKey;
                  liveVideoId = ytBroadcast.broadcastId;


                  // NOTE: We do NOT auto-transition to live here anymore!
                  // The frontend will call /broadcasts/:id/transition-youtube-to-live after:
                  // 1. 30-second countdown completes
                  // 2. RTMP stream is connected and healthy
                  // 3. Ready to play intro video to viewers
                } catch (error: unknown) {
                  // CRITICAL FIX: Type-safe error handling
                  logger.error(`[YouTube] ❌ Failed to create broadcast for destination ${destination.id}: ${getErrorMessage(error)}`);
                  if (error && typeof error === 'object' && 'response' in error) {
                    const axiosError = error as { response?: { data?: unknown } };
                    if (axiosError.response?.data) {
                      logger.error(`[YouTube] Error response: ${JSON.stringify(axiosError.response.data)}`);
                    }
                  }
                  continue; // Skip this destination
                }
              }

              // Get settings for this destination
              const settings = destinationSettings[destination.id] || {};

              // Create broadcast destination record
              const broadcastDest = await prisma.broadcastDestination.create({
                data: {
                  broadcastId: broadcast.id,
                  destinationId: destination.id,
                  streamUrl,
                  streamKey: streamKey ? encrypt(streamKey) : null,
                  liveVideoId,
                  status: 'pending',
                  privacyStatus: settings.privacyStatus || 'public',
                  scheduledStartTime: settings.scheduledStartTime ? new Date(settings.scheduledStartTime) : null,
                },
              });

              broadcastDestinations.push(broadcastDest);
            } catch (error) {
              logger.error(`Error setting up destination ${destination.id}:`, error);
              // Continue with other destinations
            }
          }


          // Roll back broadcast if all destination setups failed
          if (destinations.length > 0 && broadcastDestinations.length === 0) {
            logger.error(`All ${destinations.length} destination(s) failed to set up for broadcast ${broadcast.id}`);

            // Update broadcast status to error
            await prisma.broadcast.update({
              where: { id: broadcast.id },
              data: {
                status: 'error',
                endedAt: new Date()
              }
            });

            // Notify user via Socket.IO
            io.to(`broadcast:${broadcast.id}`).emit('broadcast-error', {
              broadcastId: broadcast.id,
              message: 'All streaming destinations failed to set up. Please check your destination configurations and try again.'
            });

            logger.warn(`Broadcast ${broadcast.id} cancelled due to all destinations failing`);
            return; // Exit early, don't proceed to "live" status
          }
        } else {
          logger.warn(`Broadcast ${broadcast.id} started with NO destinations selected`);
        }

        // After countdown, update status to live
        setTimeout(async () => {
          try {
            await prisma.broadcast.update({
              where: { id: req.params.id },
              data: {
                status: 'live',
              },
            });

            // Emit countdown complete event
            io.to(`broadcast:${broadcast.id}`).emit('countdown-complete', {
              broadcastId: broadcast.id,
              status: 'live',
            });

          } catch (error) {
            logger.error('Error updating broadcast to live after countdown:', error);

            // Notify connected clients via socket about the error
            io.to(`broadcast:${broadcast.id}`).emit('broadcast-error', {
              broadcastId: broadcast.id,
              error: 'Failed to transition broadcast to live status',
            });

            // Try to update broadcast to error status
            try {
              await prisma.broadcast.update({
                where: { id: req.params.id },
                data: { status: 'error' },
              });
            } catch (updateError) {
              logger.error('Failed to update broadcast to error status:', updateError);
            }
          }
        }, 15000); // 15 seconds
      } catch (error: unknown) {
        // CRITICAL FIX: Type-safe error handling
        logger.error(`[ASYNC IIFE] ❌ Error preparing broadcast destinations: ${getErrorMessage(error)}`);
        if (error instanceof Error && error.stack) {
          logger.error(`[ASYNC IIFE] Stack: ${error.stack}`);
        }
      }
    })(); // CRITICAL: Invoke the IIFE!
  } catch (error) {
    logger.error('Start broadcast error:', error);
    res.status(500).json({ error: 'Failed to start broadcast' });
  }
});

// Transition YouTube broadcasts to live
// Called by frontend after countdown ends and stream is ready
router.post('/:id/transition-youtube-to-live', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcastId = req.params.id;

    // Find all YouTube broadcast destinations for this broadcast
    const broadcastDestinations = await prisma.broadcastDestination.findMany({
      where: {
        broadcastId,
        destination: {
          platform: 'youtube',
        },
      },
      include: {
        destination: true,
      },
    });


    if (broadcastDestinations.length === 0) {
      logger.warn(`[YouTube Transition] No YouTube destinations found for broadcast ${broadcastId}`);
      return res.json({ message: 'No YouTube destinations to transition', transitioned: [] });
    }

    const results: Array<{
      destinationId: string;
      liveVideoId: string;
      status: 'success' | 'error';
      error?: string;
    }> = [];

    // Transition each YouTube broadcast
    for (const broadcastDest of broadcastDestinations) {
      const { liveVideoId, destination } = broadcastDest;

      if (!liveVideoId) {
        logger.warn(`[YouTube Transition] No liveVideoId for destination ${destination.id}, skipping`);
        continue;
      }

      try {

        // Get valid access token (auto-refreshes if needed)
        const accessToken = await getValidYouTubeToken(destination.id);

        // CRITICAL: Check broadcast state before transitioning
        // YouTube requires broadcast to be in 'testing' state before going live
        const status = await getYouTubeBroadcastStatus(liveVideoId, accessToken);

        // If still in 'ready' state, wait for YouTube to detect stream and transition to 'testing'
        if (status.lifeCycleStatus === 'ready') {

          // Poll for up to 20 seconds (10 attempts x 2 seconds)
          let becameTesting = false;
          for (let attempt = 1; attempt <= 10; attempt++) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds

            const updatedStatus = await getYouTubeBroadcastStatus(liveVideoId, accessToken);

            if (updatedStatus.lifeCycleStatus === 'testing' || updatedStatus.lifeCycleStatus === 'liveStarting') {
              becameTesting = true;
              break;
            }
          }

          if (!becameTesting) {
            throw new Error('Broadcast did not transition to testing state - YouTube may not have detected the stream yet. Please wait longer and try again.');
          }
        } else if (status.lifeCycleStatus === 'testing' || status.lifeCycleStatus === 'liveStarting') {
        } else if (status.lifeCycleStatus === 'live') {

          // Update status in database
          await prisma.broadcastDestination.update({
            where: { id: broadcastDest.id },
            data: { status: 'live' },
          });

          results.push({
            destinationId: destination.id,
            liveVideoId,
            status: 'success',
          });
          continue; // Skip transition, already live
        } else {
          throw new Error(`Broadcast is in unexpected state: ${status.lifeCycleStatus}`);
        }

        // Transition to live
        await transitionYouTubeBroadcastToLive(liveVideoId, accessToken);


        // Update status in database
        await prisma.broadcastDestination.update({
          where: { id: broadcastDest.id },
          data: { status: 'live' },
        });

        results.push({
          destinationId: destination.id,
          liveVideoId,
          status: 'success',
        });
      } catch (error: any) {
        logger.error(`[YouTube Transition] ❌ Failed to transition ${liveVideoId}:`, error.message);
        results.push({
          destinationId: destination.id,
          liveVideoId,
          status: 'error',
          error: error.message,
        });
      }
    }


    res.json({
      message: 'YouTube transition completed',
      transitioned: results,
    });
  } catch (error) {
    logger.error('[YouTube Transition] Error:', error);
    res.status(500).json({ error: 'Failed to transition YouTube broadcasts' });
  }
});

// End broadcast
router.post('/:id/end', authenticate, async (req: AuthRequest, res) => {
  try {
    // FORCE DELETE: Nuke ALL broadcast destinations IMMEDIATELY - no waiting, no questions
    const forceDeleteResult = await prisma.broadcastDestination.deleteMany({
      where: { broadcastId: req.params.id },
    });

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        broadcastDestinations: {
          include: {
            destination: true,
          },
        },
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Note: broadcast.broadcastDestinations will be empty array since we just deleted them all
    // Keeping this loop for potential future platform-specific cleanup if needed

    const endedAt = new Date();
    const durationSeconds = broadcast.startedAt
      ? Math.floor((endedAt.getTime() - broadcast.startedAt.getTime()) / 1000)
      : 0;

    const updated = await prisma.broadcast.update({
      where: { id: req.params.id },
      data: {
        status: 'ended',
        endedAt,
        durationSeconds,
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('End broadcast error:', error);
    res.status(500).json({ error: 'Failed to end broadcast' });
  }
});

// Get broadcast statistics
router.get('/:id/stats', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
      include: {
        participants: true,
        chatMessages: true,
        broadcastDestinations: true,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const stats = {
      totalParticipants: broadcast.participants.length,
      totalMessages: broadcast.chatMessages.length,
      totalViewers: broadcast.broadcastDestinations.reduce(
        (sum: any, dest: any) => sum + dest.viewerCount,
        0
      ),
      duration: broadcast.durationSeconds,
      platforms: broadcast.broadcastDestinations.map((dest: any) => dest.status),
    };

    res.json(stats);
  } catch (error) {
    logger.error('Get stats error:', error);
    res.status(500).json({ error: 'Failed to get statistics' });
  }
});

// Get broadcast destinations with RTMP details for media server
router.get('/:id/destinations', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Get broadcast destinations with decrypted stream keys
    const broadcastDestinations = await prisma.broadcastDestination.findMany({
      where: { broadcastId: req.params.id },
      include: {
        destination: {
          select: {
            id: true,
            platform: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc', // Get most recent first
      },
    });

    // CRITICAL FIX: Deduplicate by destination ID to prevent multiple streams to the same destination
    // This handles the case where old records weren't cleaned up
    const seenDestinationIds = new Set<string>();
    const deduplicatedDestinations = broadcastDestinations.filter((bd) => {
      if (seenDestinationIds.has(bd.destination.id)) {
        logger.warn(`[Get Destinations] Skipping duplicate destination ${bd.destination.id} for broadcast ${req.params.id}`);
        return false;
      }
      seenDestinationIds.add(bd.destination.id);
      return true;
    });

    if (deduplicatedDestinations.length !== broadcastDestinations.length) {
      logger.warn(`[Get Destinations] Deduplicated ${broadcastDestinations.length} to ${deduplicatedDestinations.length} destinations for broadcast ${req.params.id}`);
    }


    // Decrypt stream keys for media server
    const destinationsForMediaServer = deduplicatedDestinations.map((bd) => ({
      id: bd.destination.id,
      platform: bd.destination.platform,
      rtmpUrl: bd.streamUrl,
      streamKey: bd.streamKey ? decrypt(bd.streamKey) : '',
      liveVideoId: bd.liveVideoId,
      status: bd.status,
    }));

    // CRITICAL LOGGING: Log EXACTLY what we're returning to catch any duplication
    destinationsForMediaServer.forEach((dest, index) => {
    });

    res.json(destinationsForMediaServer);
  } catch (error) {
    logger.error('Get broadcast destinations error:', error);
    res.status(500).json({ error: 'Failed to get broadcast destinations' });
  }
});

// Start RTMP streaming via Ant Media Server
router.post('/:id/start-rtmp', authenticate, async (req: AuthRequest, res) => {
  try {
    const { antMediaService } = await import('../services/antmedia.service');

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Get broadcast destinations
    const broadcastDestinations = await prisma.broadcastDestination.findMany({
      where: { broadcastId: req.params.id },
      include: {
        destination: {
          select: {
            id: true,
            platform: true,
          },
        },
      },
    });

    // Prepare destinations for Ant Media
    const destinations = broadcastDestinations.map((bd) => ({
      platform: bd.destination.platform,
      rtmpUrl: bd.streamUrl,
      streamKey: bd.streamKey ? decrypt(bd.streamKey) : '',
    }));

    // Start RTMP streaming via Ant Media
    const streamId = req.params.id;
    await antMediaService.getOrCreateBroadcast(streamId, broadcast.title || 'Live Stream');
    const success = await antMediaService.startRtmpStreaming(streamId, destinations);

    if (success) {
      logger.info(`[Ant Media] RTMP streaming started for broadcast ${req.params.id}`);
      res.json({ success: true, message: 'RTMP streaming started' });
    } else {
      res.status(500).json({ error: 'Failed to start RTMP streaming' });
    }
  } catch (error) {
    logger.error('Start RTMP error:', error);
    res.status(500).json({ error: 'Failed to start RTMP streaming' });
  }
});

// Stop RTMP streaming via Ant Media Server
router.post('/:id/stop-rtmp', authenticate, async (req: AuthRequest, res) => {
  try {
    const { antMediaService } = await import('../services/antmedia.service');

    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    // Stop RTMP streaming via Ant Media
    const streamId = req.params.id;
    const success = await antMediaService.stopRtmpStreaming(streamId);

    if (success) {
      logger.info(`[Ant Media] RTMP streaming stopped for broadcast ${req.params.id}`);
      res.json({ success: true, message: 'RTMP streaming stopped' });
    } else {
      res.status(500).json({ error: 'Failed to stop RTMP streaming' });
    }
  } catch (error) {
    logger.error('Stop RTMP error:', error);
    res.status(500).json({ error: 'Failed to stop RTMP streaming' });
  }
});

export default router;
