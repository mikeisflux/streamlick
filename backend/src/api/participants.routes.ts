import { Router } from 'express';
import prisma from '../database/prisma';
import { authenticate, AuthRequest, optionalAuth } from '../auth/middleware';
import { generateToken } from '../utils/crypto';
import logger from '../utils/logger';

const router = Router();

// Generate invite link
router.post('/invite', authenticate, async (req: AuthRequest, res) => {
  try {
    const { broadcastId, name, role } = req.body;

    // Verify broadcast belongs to user
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: broadcastId,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const joinLinkToken = generateToken(32);

    const participant = await prisma.participant.create({
      data: {
        broadcastId,
        name,
        role: role || 'guest',
        status: 'invited',
        joinLinkToken,
      },
    });

    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3002'}/join/${joinLinkToken}`;

    res.json({
      participant,
      inviteLink,
    });
  } catch (error) {
    logger.error('Create invite error:', error);
    res.status(500).json({ error: 'Failed to create invite' });
  }
});

// Join via invite link
router.post('/join/:token', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const { token } = req.params;
    const { name } = req.body;

    const participant = await prisma.participant.findUnique({
      where: { joinLinkToken: token },
      include: { broadcast: true },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Invalid invite link' });
    }

    if (participant.status === 'joined') {
      return res.status(400).json({ error: 'Invite link already used' });
    }

    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        name: name || participant.name,
        status: 'joined',
        joinedAt: new Date(),
        ...(req.user && { userId: req.user.userId }),
      },
    });

    res.json({
      participant: updated,
      broadcast: participant.broadcast,
    });
  } catch (error) {
    logger.error('Join broadcast error:', error);
    res.status(500).json({ error: 'Failed to join broadcast' });
  }
});

// Get participants for broadcast
router.get('/broadcast/:broadcastId', authenticate, async (req: AuthRequest, res) => {
  try {
    const { broadcastId } = req.params;

    // Verify broadcast belongs to user
    const broadcast = await prisma.broadcast.findFirst({
      where: {
        id: broadcastId,
        userId: req.user!.userId,
      },
    });

    if (!broadcast) {
      return res.status(404).json({ error: 'Broadcast not found' });
    }

    const participants = await prisma.participant.findMany({
      where: { broadcastId },
      orderBy: { createdAt: 'asc' },
    });

    res.json(participants);
  } catch (error) {
    logger.error('Get participants error:', error);
    res.status(500).json({ error: 'Failed to get participants' });
  }
});

// Update participant
router.patch('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const { role, status } = req.body;

    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: true },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Verify broadcast belongs to user
    if (participant.broadcast.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const updated = await prisma.participant.update({
      where: { id: req.params.id },
      data: {
        ...(role && { role }),
        ...(status && { status }),
        ...(status === 'disconnected' && { leftAt: new Date() }),
      },
    });

    res.json(updated);
  } catch (error) {
    logger.error('Update participant error:', error);
    res.status(500).json({ error: 'Failed to update participant' });
  }
});

// Remove participant
router.delete('/:id', authenticate, async (req: AuthRequest, res) => {
  try {
    const participant = await prisma.participant.findUnique({
      where: { id: req.params.id },
      include: { broadcast: true },
    });

    if (!participant) {
      return res.status(404).json({ error: 'Participant not found' });
    }

    // Verify broadcast belongs to user
    if (participant.broadcast.userId !== req.user!.userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await prisma.participant.delete({
      where: { id: req.params.id },
    });

    res.json({ message: 'Participant removed successfully' });
  } catch (error) {
    logger.error('Remove participant error:', error);
    res.status(500).json({ error: 'Failed to remove participant' });
  }
});

export default router;
