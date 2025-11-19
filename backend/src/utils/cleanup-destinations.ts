/**
 * NUCLEAR CLEANUP SCRIPT
 * Force deletes ALL broadcast destinations to prevent accumulation
 * Run this EVERY TIME before starting a broadcast
 */

import { PrismaClient } from '@prisma/client';
import { logger } from './logger';

const prisma = new PrismaClient();

/**
 * FORCE DELETE all broadcast destinations for a specific broadcast
 * @param broadcastId - The broadcast ID to clean up
 * @returns Number of deleted destinations
 */
export async function forceDeleteBroadcastDestinations(broadcastId: string): Promise<number> {
  try {
    logger.info(`[NUCLEAR CLEANUP] 💥 FORCE DELETING all destinations for broadcast ${broadcastId}`);

    const result = await prisma.broadcastDestination.deleteMany({
      where: { broadcastId },
    });

    logger.info(`[NUCLEAR CLEANUP] ✓ FORCE DELETED ${result.count} destinations for broadcast ${broadcastId}`);
    return result.count;
  } catch (error) {
    logger.error(`[NUCLEAR CLEANUP] ❌ Failed to force delete destinations:`, error);
    throw error;
  }
}

/**
 * FORCE DELETE ALL broadcast destinations for ALL broadcasts
 * NUCLEAR OPTION - Use with caution!
 * @returns Number of deleted destinations
 */
export async function forceDeleteAllBroadcastDestinations(): Promise<number> {
  try {
    logger.warn(`[NUCLEAR CLEANUP] ☢️  FORCE DELETING ALL BROADCAST DESTINATIONS IN DATABASE`);

    const result = await prisma.broadcastDestination.deleteMany({});

    logger.warn(`[NUCLEAR CLEANUP] ☢️  FORCE DELETED ${result.count} TOTAL DESTINATIONS FROM DATABASE`);
    return result.count;
  } catch (error) {
    logger.error(`[NUCLEAR CLEANUP] ❌ Failed to force delete all destinations:`, error);
    throw error;
  }
}

/**
 * FORCE DELETE destinations for broadcasts older than X hours
 * @param hoursOld - Delete destinations for broadcasts older than this many hours
 * @returns Number of deleted destinations
 */
export async function forceDeleteOldBroadcastDestinations(hoursOld: number = 24): Promise<number> {
  try {
    const cutoffDate = new Date(Date.now() - hoursOld * 60 * 60 * 1000);
    logger.info(`[NUCLEAR CLEANUP] 🧹 Deleting destinations for broadcasts older than ${hoursOld} hours (before ${cutoffDate.toISOString()})`);

    // Find broadcasts older than cutoff
    const oldBroadcasts = await prisma.broadcast.findMany({
      where: {
        createdAt: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
      },
    });

    if (oldBroadcasts.length === 0) {
      logger.info(`[NUCLEAR CLEANUP] No old broadcasts found - nothing to clean up`);
      return 0;
    }

    const broadcastIds = oldBroadcasts.map((b) => b.id);
    logger.info(`[NUCLEAR CLEANUP] Found ${broadcastIds.length} old broadcasts - deleting their destinations`);

    const result = await prisma.broadcastDestination.deleteMany({
      where: {
        broadcastId: {
          in: broadcastIds,
        },
      },
    });

    logger.info(`[NUCLEAR CLEANUP] ✓ Deleted ${result.count} destinations from ${broadcastIds.length} old broadcasts`);
    return result.count;
  } catch (error) {
    logger.error(`[NUCLEAR CLEANUP] ❌ Failed to delete old destinations:`, error);
    throw error;
  }
}

// Standalone script execution
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  (async () => {
    try {
      if (command === 'all') {
        // NUCLEAR: Delete ALL destinations
        await forceDeleteAllBroadcastDestinations();
      } else if (command === 'old') {
        // Delete old destinations (24 hours by default)
        const hours = parseInt(args[1] || '24', 10);
        await forceDeleteOldBroadcastDestinations(hours);
      } else if (command) {
        // Delete destinations for specific broadcast ID
        await forceDeleteBroadcastDestinations(command);
      } else {
        console.log('Usage:');
        console.log('  npm run cleanup-destinations all           # Delete ALL destinations (NUCLEAR)');
        console.log('  npm run cleanup-destinations old [hours]   # Delete destinations older than X hours');
        console.log('  npm run cleanup-destinations <broadcast-id> # Delete destinations for specific broadcast');
      }
    } catch (error) {
      logger.error('Cleanup script failed:', error);
      process.exit(1);
    } finally {
      await prisma.$disconnect();
      process.exit(0);
    }
  })();
}
