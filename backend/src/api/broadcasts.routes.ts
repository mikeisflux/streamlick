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
  monitorAndTransitionYouTubeBroadcast,
} from '../services/youtube.service';
import { getIOInstance } from '../socket/io-instance';

const router = Router();

// CRITICAL FIX: Track countdown intervals to prevent memory leaks
// Stores interval IDs for each broadcast so they can be cleared on stop
const countdownIntervals = new Map<string, NodeJS.Timeout>();

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

    // CRITICAL FIX: Input validation to prevent DoS and data corruption
    // Validate title
    if (!title || typeof title !== 'string') {
      return res.status(400).json({ error: 'Title is required and must be a string' });
    }
    if (title.length > 200) {
      return res.status(400).json({ error: 'Title must be 200 characters or less' });
    }
    if (title.trim().length === 0) {
      return res.status(400).json({ error: 'Title cannot be empty' });
    }

    // Validate description (optional)
    if (description !== undefined && description !== null) {
      if (typeof description !== 'string') {
        return res.status(400).json({ error: 'Description must be a string' });
      }
      if (description.length > 5000) {
        return res.status(400).json({ error: 'Description must be 5000 characters or less' });
      }
    }

    // Validate studioConfig (optional)
    if (studioConfig !== undefined && studioConfig !== null) {
      if (typeof studioConfig !== 'object' || Array.isArray(studioConfig)) {
        return res.status(400).json({ error: 'Studio config must be an object' });
      }

      // Prevent excessively large configs (DoS prevention)
      const configString = JSON.stringify(studioConfig);
      if (configString.length > 100000) { // 100KB limit
        return res.status(400).json({ error: 'Studio config is too large (max 100KB)' });
      }
    }

    // Validate scheduledAt (optional)
    let scheduledAtDate: Date | null = null;
    if (scheduledAt) {
      scheduledAtDate = new Date(scheduledAt);
      if (isNaN(scheduledAtDate.getTime())) {
        return res.status(400).json({ error: 'Invalid scheduled date format' });
      }
    }

    const broadcast = await prisma.broadcast.create({
      data: {
        userId: req.user!.userId,
        title: title.trim(),
        description: description ? description.trim() : null,
        scheduledAt: scheduledAtDate,
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
    // CRITICAL FIX: Clear countdown interval if broadcast is deleted during countdown
    const broadcastId = req.params.id;
    const interval = countdownIntervals.get(broadcastId);
    if (interval) {
      clearInterval(interval);
      countdownIntervals.delete(broadcastId);
      logger.info(`Cleared countdown interval for deleted broadcast ${broadcastId}`);
    }

    const deleted = await prisma.broadcast.deleteMany({
      where: {
        id: broadcastId,
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
    logger.info(`[DEBUG ROUTE] ========== ROUTE HANDLER START ==========`);
    logger.info(`[DEBUG ROUTE] Raw request body: ${JSON.stringify(req.body)}`);
    const { destinationIds, destinationSettings = {} } = req.body; // destinationSettings: { [destinationId]: { privacyStatus, scheduledStartTime } }
    logger.info(`[DEBUG ROUTE] Broadcast start request - broadcastId: ${req.params.id}`);
    logger.info(`[DEBUG ROUTE] destinationIds: ${JSON.stringify(destinationIds)}`);
    logger.info(`[DEBUG ROUTE] destinationIds type: ${typeof destinationIds}, isArray: ${Array.isArray(destinationIds)}, length: ${destinationIds?.length}`);
    logger.info(`[DEBUG ROUTE] destinationSettings: ${JSON.stringify(destinationSettings)}`);
    logger.info(`[DEBUG ROUTE] ==============================================`);

    // CRITICAL FIX: Use atomic update to prevent race condition
    // Only update if status is 'idle' or 'ready', preventing duplicate starts
    const broadcast = await prisma.broadcast.updateMany({
      where: {
        id: req.params.id,
        userId: req.user!.userId,
        status: { in: ['idle', 'ready'] }, // Only allow starting from these states
      },
      data: {
        status: 'countdown',
        startedAt: new Date(),
      },
    });

    // If no rows were updated, broadcast is either not found or already starting
    if (broadcast.count === 0) {
      const existingBroadcast = await prisma.broadcast.findFirst({
        where: {
          id: req.params.id,
          userId: req.user!.userId,
        },
      });

      if (!existingBroadcast) {
        return res.status(404).json({ error: 'Broadcast not found' });
      }

      // Broadcast exists but is in wrong state (already starting/live)
      return res.status(409).json({
        error: 'Broadcast is already starting or live',
        status: existingBroadcast.status,
      });
    }

    // Fetch the updated broadcast to return its data
    const updatedBroadcast = await prisma.broadcast.findUnique({
      where: { id: req.params.id },
    });

    // Return immediately to start countdown on frontend
    const countdownDuration = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '15', 10);
    res.json({
      message: 'Countdown started',
      broadcastId: updatedBroadcast!.id,
      countdown: countdownDuration,
      status: 'countdown'
    });

    // Asynchronously prepare destinations during countdown
    // Use async IIFE instead of setImmediate to avoid race conditions
    logger.info(`[BEFORE IIFE] About to invoke async IIFE for broadcast ${updatedBroadcast!.id}`);
    (async () => {
      logger.info(`[ASYNC IIFE] ========== IIFE INVOKED ==========`);
      try {
        logger.info(`[ASYNC IIFE] Starting async broadcast preparation for ${updatedBroadcast!.id}`);
        logger.info(`[ASYNC IIFE] destinationIds: ${JSON.stringify(destinationIds)}`);

        const io = getIOInstance();
        // Configurable countdown duration (default 15 seconds)
        let countdownSeconds = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '15', 10);

        logger.info(`[ASYNC IIFE] Starting countdown: ${countdownSeconds} seconds`);

        // Emit countdown ticks
        const countdownInterval = setInterval(() => {
          countdownSeconds--;
          io.to(`broadcast:${updatedBroadcast!.id}`).emit('countdown-tick', {
            broadcastId: updatedBroadcast!.id,
            secondsRemaining: countdownSeconds,
          });

          if (countdownSeconds <= 0) {
            clearInterval(countdownInterval);
            // CRITICAL FIX: Remove from tracking Map when countdown completes
            countdownIntervals.delete(updatedBroadcast!.id);
          }
        }, 1000);

        // CRITICAL FIX: Store interval in Map so it can be cleared on broadcast stop
        countdownIntervals.set(updatedBroadcast!.id, countdownInterval);

        const broadcastDestinations: any[] = [];

        // If destinations are specified, create live videos for each platform
        if (destinationIds && destinationIds.length > 0) {
          // CRITICAL: Deduplicate destination IDs to prevent creating multiple stream keys for the same destination
          const uniqueDestinationIds = Array.from(new Set(destinationIds));

          logger.info(`[ASYNC IIFE] Processing ${destinationIds.length} selected destinations: ${JSON.stringify(destinationIds)}`);
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

          logger.info(`[ASYNC IIFE] Found ${destinations.length} active destinations in database for user ${req.user!.userId}`);
          logger.info(`[ASYNC IIFE] Destinations: ${JSON.stringify(destinations.map(d => ({ id: d.id, platform: d.platform, channelId: d.channelId })))}`);

          for (const destination of destinations) {
            try {
              logger.info(`[ASYNC IIFE] Processing destination ${destination.id} (${destination.platform})`);

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
                  updatedBroadcast!.title,
                  updatedBroadcast!.description || undefined
                );

                streamUrl = liveVideo.rtmpUrl;
                streamKey = liveVideo.streamKey;
                liveVideoId = liveVideo.liveVideoId;

                logger.info(`Created Facebook live video: ${liveVideoId}`);
              }

              // Handle YouTube live broadcast creation
              if (destination.platform === 'youtube' && destination.channelId) {
                try {
                  logger.info(`[YouTube] Starting broadcast creation for destination ${destination.id}`);

                  // Get valid token (auto-refreshes if needed)
                  const accessToken = await getValidYouTubeToken(destination.id);
                  logger.info(`[YouTube] Got valid access token for destination ${destination.id}`);

                  // Get privacy and scheduling settings for this destination
                  const settings = destinationSettings[destination.id] || {};
                  const privacyStatus = settings.privacyStatus || 'public';
                  const scheduledStartTime = settings.scheduledStartTime || undefined;
                  const title = settings.title || updatedBroadcast!.title || 'Live Stream';
                  const description = settings.description || updatedBroadcast!.description || '';

                  logger.info(`[YouTube] Creating broadcast with settings: title="${title}", description="${description}", privacy=${privacyStatus}`);

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

                  logger.info(`[YouTube] ✅ Created broadcast ${liveVideoId} - RTMP URL: ${streamUrl}`);
                  logger.info(`[YouTube] Privacy: ${privacyStatus}${scheduledStartTime ? ', scheduled: ' + scheduledStartTime : ''}`);

                  // Start monitoring and transitioning to live (non-blocking)
                  // This runs in the background and transitions the broadcast when YouTube detects the stream
                  monitorAndTransitionYouTubeBroadcast(ytBroadcast.broadcastId, accessToken)
                    .then(() => {
                      logger.info(`[YouTube] ✅ Broadcast ${liveVideoId} monitoring completed successfully`);
                    })
                    .catch((error) => {
                      logger.error(`[YouTube] ❌ Broadcast ${liveVideoId} monitoring failed: ${error.message}`);
                      // Don't fail the entire broadcast - it's already created
                    });
                } catch (error: any) {
                  logger.error(`[YouTube] ❌ Failed to create broadcast for destination ${destination.id}: ${error.message}`);
                  if (error.response?.data) {
                    logger.error(`[YouTube] Error response: ${JSON.stringify(error.response.data)}`);
                  }
                  continue; // Skip this destination
                }
              }

              // Get settings for this destination
              const settings = destinationSettings[destination.id] || {};

              // Create broadcast destination record
              const broadcastDest = await prisma.broadcastDestination.create({
                data: {
                  broadcastId: updatedBroadcast!.id,
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

          logger.info(`Broadcast prepared with ${broadcastDestinations.length} destinations`);

          // Roll back broadcast if all destination setups failed
          if (destinations.length > 0 && broadcastDestinations.length === 0) {
            logger.error(`All ${destinations.length} destination(s) failed to set up for broadcast ${updatedBroadcast!.id}`);

            // Update broadcast status to error
            await prisma.broadcast.update({
              where: { id: updatedBroadcast!.id },
              data: {
                status: 'error',
                endedAt: new Date()
              }
            });

            // Notify user via Socket.IO
            io.to(`broadcast:${updatedBroadcast!.id}`).emit('broadcast-error', {
              broadcastId: updatedBroadcast!.id,
              message: 'All streaming destinations failed to set up. Please check your destination configurations and try again.'
            });

            logger.warn(`Broadcast ${updatedBroadcast!.id} cancelled due to all destinations failing`);
            return; // Exit early, don't proceed to "live" status
          }
        } else {
          logger.warn(`Broadcast ${updatedBroadcast!.id} started with NO destinations selected`);
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
            io.to(`broadcast:${updatedBroadcast!.id}`).emit('countdown-complete', {
              broadcastId: updatedBroadcast!.id,
              status: 'live',
            });

            logger.info(`Broadcast ${req.params.id} went live after countdown`);
          } catch (error) {
            logger.error('Error updating broadcast to live after countdown:', error);

            // Notify connected clients via socket about the error
            io.to(`broadcast:${updatedBroadcast!.id}`).emit('broadcast-error', {
              broadcastId: updatedBroadcast!.id,
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
      } catch (error: any) {
        logger.error(`[ASYNC IIFE] ❌ Error preparing broadcast destinations: ${error.message}`);
        logger.error(`[ASYNC IIFE] Stack: ${error.stack}`);

        // CRITICAL FIX: Clear countdown interval on error to prevent memory leak
        if (countdownInterval) {
          clearInterval(countdownInterval);
          countdownIntervals.delete(updatedBroadcast!.id);
        }

        // Update broadcast status to error on failure
        try {
          await prisma.broadcast.update({
            where: { id: updatedBroadcast!.id },
            data: { status: 'error' },
          });

          // Notify clients via Socket.IO
          io.to(`broadcast:${updatedBroadcast!.id}`).emit('broadcast-error', {
            broadcastId: updatedBroadcast!.id,
            error: 'Failed to prepare broadcast destinations',
          });
        } catch (updateError) {
          logger.error(`[ASYNC IIFE] Failed to update broadcast to error status:`, updateError);
        }
      }
    })().catch((err) => {
      // CRITICAL FIX: Catch any unhandled promise rejections from the IIFE
      logger.error(`[ASYNC IIFE] Unhandled promise rejection:`, err);
      logger.error(`[ASYNC IIFE] Stack:`, err.stack);
    }); // CRITICAL: Invoke the IIFE and catch unhandled rejections!
  } catch (error) {
    logger.error('Start broadcast error:', error);
    res.status(500).json({ error: 'Failed to start broadcast' });
  }
});

// End broadcast
router.post('/:id/end', authenticate, async (req: AuthRequest, res) => {
  try {
    // CRITICAL FIX: Clear countdown interval if broadcast is ended during countdown
    const broadcastId = req.params.id;
    const interval = countdownIntervals.get(broadcastId);
    if (interval) {
      clearInterval(interval);
      countdownIntervals.delete(broadcastId);
      logger.info(`Cleared countdown interval for ended broadcast ${broadcastId}`);
    }

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

    // End all platform live videos
    for (const broadcastDest of broadcast.broadcastDestinations) {
      try {
        // End Facebook live videos
        if (
          broadcastDest.liveVideoId &&
          broadcastDest.destination.platform === 'facebook' &&
          broadcastDest.destination.accessToken
        ) {
          const accessToken = decrypt(broadcastDest.destination.accessToken);
          await endFacebookLiveVideo(broadcastDest.liveVideoId, accessToken);
          logger.info(`Ended Facebook live video: ${broadcastDest.liveVideoId}`);
        }

        // End YouTube live broadcasts
        if (
          broadcastDest.liveVideoId &&
          broadcastDest.destination.platform === 'youtube'
        ) {
          try {
            const accessToken = await getValidYouTubeToken(broadcastDest.destination.id);
            await endYouTubeLiveBroadcast(broadcastDest.liveVideoId, accessToken);
            logger.info(`Ended YouTube live broadcast: ${broadcastDest.liveVideoId}`);
          } catch (error) {
            logger.error(`Failed to end YouTube live broadcast ${broadcastDest.liveVideoId}:`, error);
            // Continue with other destinations
          }
        }

        // Update broadcast destination status
        await prisma.broadcastDestination.update({
          where: { id: broadcastDest.id },
          data: { status: 'ended' },
        });
      } catch (error) {
        logger.error(`Error ending destination ${broadcastDest.id}:`, error);
        // Continue with other destinations
      }
    }

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
    });

    // Decrypt stream keys for media server
    const destinationsForMediaServer = broadcastDestinations.map((bd) => ({
      id: bd.destination.id,
      platform: bd.destination.platform,
      rtmpUrl: bd.streamUrl,
      streamKey: bd.streamKey ? decrypt(bd.streamKey) : '',
      liveVideoId: bd.liveVideoId,
      status: bd.status,
    }));

    res.json(destinationsForMediaServer);
  } catch (error) {
    logger.error('Get broadcast destinations error:', error);
    res.status(500).json({ error: 'Failed to get broadcast destinations' });
  }
});

export default router;
