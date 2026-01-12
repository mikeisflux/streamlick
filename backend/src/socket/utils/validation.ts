/**
 * Socket Validation Utilities
 *
 * Shared validation functions used across socket handlers
 */

import prisma from '../../database/prisma';
import logger from '../../utils/logger';

/**
 * Validate UUID format to prevent DoS attacks
 * Invalid UUIDs can cause database errors and resource exhaustion
 */
export function isValidUUID(id: string | undefined | null): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

/**
 * Verify broadcast ownership/permission
 * Returns true if user is authorized to control this broadcast
 */
export async function verifyBroadcastAccess(userId: string, broadcastId: string): Promise<boolean> {
  try {
    // Validate UUID format first
    if (!isValidUUID(broadcastId)) {
      logger.warn(`Invalid broadcast ID format: ${broadcastId}`);
      return false;
    }

    const broadcast = await prisma.broadcast.findUnique({
      where: { id: broadcastId },
      select: { userId: true },
    });

    if (!broadcast) {
      return false;
    }

    // User must be the broadcast owner
    return broadcast.userId === userId;
  } catch (error) {
    logger.error('Broadcast access verification error:', error);
    return false;
  }
}

/**
 * Validate participant belongs to broadcast
 */
export async function verifyParticipantInBroadcast(
  participantId: string,
  broadcastId: string
): Promise<boolean> {
  try {
    if (!isValidUUID(participantId) || !isValidUUID(broadcastId)) {
      return false;
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: { broadcastId: true },
    });

    return participant?.broadcastId === broadcastId;
  } catch (error) {
    logger.error('Participant verification error:', error);
    return false;
  }
}
