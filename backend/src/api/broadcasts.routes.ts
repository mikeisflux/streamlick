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
} from '../services/youtube.service';
import { getIOInstance } from '../socket/io-instance';

const router = Router();

// Get all broadcasts for user
router.get('/', authenticate, async (req: AuthRequest, res) => {
  try {
    const broadcasts = await prisma.broadcast.findMany({
      where: { userId: req.user!.userId },
      include: {
        participants: true,
        recordings: true,
        broadcastDestinations: {
          include: { destination: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(broadcasts);
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
    const { destinationIds } = req.body; // Array of destination IDs to stream to

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
    const countdownDuration = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '15', 10);
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
        // Configurable countdown duration (default 15 seconds)
        let countdownSeconds = parseInt(process.env.BROADCAST_COUNTDOWN_SECONDS || '15', 10);

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

        // If destinations are specified, create live videos for each platform
        if (destinationIds && destinationIds.length > 0) {
          const destinations = await prisma.destination.findMany({
            where: {
              id: { in: destinationIds },
              userId: req.user!.userId,
              isActive: true,
            },
          });

          for (const destination of destinations) {
            try {
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

                logger.info(`Created Facebook live video: ${liveVideoId}`);
              }

              // Handle YouTube live broadcast creation
              if (destination.platform === 'youtube' && destination.channelId) {
                try {
                  // Get valid token (auto-refreshes if needed)
                  const accessToken = await getValidYouTubeToken(destination.id);

                  // Create YouTube live broadcast
                  const ytBroadcast = await createYouTubeLiveBroadcast(
                    accessToken,
                    broadcast.title,
                    broadcast.description || undefined,
                    undefined, // scheduledStartTime (use current time)
                    'public' // privacyStatus
                  );

                  streamUrl = ytBroadcast.rtmpUrl;
                  streamKey = ytBroadcast.streamKey;
                  liveVideoId = ytBroadcast.broadcastId;

                  logger.info(`Created YouTube live broadcast: ${liveVideoId}`);
                } catch (error) {
                  logger.error(`Failed to create YouTube live broadcast for destination ${destination.id}:`, error);
                  continue; // Skip this destination
                }
              }

              // Create broadcast destination record
              const broadcastDest = await prisma.broadcastDestination.create({
                data: {
                  broadcastId: broadcast.id,
                  destinationId: destination.id,
                  streamUrl,
                  streamKey: streamKey ? encrypt(streamKey) : null,
                  liveVideoId,
                  status: 'pending',
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

            logger.info(`Broadcast ${req.params.id} went live after countdown`);
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
      } catch (error) {
        logger.error('Error preparing broadcast destinations:', error);
      }
    });
  } catch (error) {
    logger.error('Start broadcast error:', error);
    res.status(500).json({ error: 'Failed to start broadcast' });
  }
});

// End broadcast
router.post('/:id/end', authenticate, async (req: AuthRequest, res) => {
  try {
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

export default router;
