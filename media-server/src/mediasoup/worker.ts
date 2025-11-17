/**
 * Mediasoup Worker Management
 *
 * This module manages mediasoup Worker instances and their associated Routers.
 *
 * WORKER LIFECYCLE:
 * 1. Workers are created during server initialization via createWorkers()
 * 2. Workers handle WebRTC media routing using Router instances
 * 3. Each worker runs in a separate process for CPU distribution
 * 4. Workers are automatically recreated if they die unexpectedly
 * 5. Router cleanup happens automatically when a worker dies
 *
 * ROUTER LIFECYCLE:
 * 1. Routers are created per broadcast via createRouter(broadcastId)
 * 2. Each Router is assigned to a worker using round-robin selection
 * 3. Routers handle WebRTC transports and producers/consumers for a broadcast
 * 4. Routers are cached to prevent duplicate creation
 * 5. Routers are cleaned up via deleteRouter() or automatically on worker death
 *
 * FAULT TOLERANCE:
 * - Worker death triggers automatic recreation to maintain pool size
 * - Dead worker's routers are closed and removed from cache
 * - If all workers die and recreation fails, the process exits
 * - Concurrent router creation for the same broadcast is prevented via promises
 */

import * as mediasoup from 'mediasoup';
import { Worker, Router } from 'mediasoup/node/lib/types';
import { mediasoupConfig } from '../config/mediasoup';
import logger from '../utils/logger';

/** Array of active mediasoup Worker instances */
let workers: Worker[] = [];

/** Index for round-robin worker selection */
let nextWorkerIdx = 0;

/** Map of broadcast ID to Router instance */
const routers = new Map<string, Router>();

/** Map of broadcast ID to pending Router creation promises (prevents duplicate creation) */
const routerCreationPromises = new Map<string, Promise<Router>>();

/** Target number of workers to maintain (used for auto-recreation on death) */
let desiredWorkerCount: number = 2;

/**
 * Create a single mediasoup Worker with automatic recreation on death
 *
 * @returns Promise resolving to the created Worker instance
 * @throws Error if worker creation fails
 */
async function createSingleWorker(): Promise<Worker> {
  const worker = await mediasoup.createWorker(mediasoupConfig.worker);

  worker.on('died', async () => {
    logger.error(`Mediasoup worker ${worker.pid} died unexpectedly!`);

    // Remove dead worker from the array
    const index = workers.indexOf(worker);
    if (index > -1) {
      workers.splice(index, 1);
      logger.info(`Removed dead worker from pool. Remaining workers: ${workers.length}`);
    }

    // Clean up routers that were on this worker
    try {
      const routersToRemove: string[] = [];
      routers.forEach((router, broadcastId) => {
        try {
          // Check if router belongs to the dead worker
          if (!router.closed) {
            router.close();
          }
          routersToRemove.push(broadcastId);
          logger.info(`Router closed for broadcast ${broadcastId} (worker died)`);
        } catch (error) {
          logger.error(`Error closing router for ${broadcastId}:`, error);
        }
      });

      // Remove closed routers from map
      routersToRemove.forEach(id => routers.delete(id));
    } catch (error) {
      logger.error('Error during router cleanup:', error);
    }

    // Recreate the worker to maintain pool size
    try {
      logger.info(`Attempting to recreate worker to maintain pool size of ${desiredWorkerCount}...`);
      const newWorker = await createSingleWorker();
      workers.push(newWorker);
      logger.info(`New mediasoup worker created [pid:${newWorker.pid}]. Pool restored to ${workers.length} worker(s)`);
    } catch (error) {
      logger.error('Failed to recreate worker:', error);

      // If all workers died and recreation failed, exit the process
      if (workers.length === 0) {
        logger.error('All mediasoup workers have died and recreation failed! Exiting process...');
        setTimeout(() => process.exit(1), 2000);
      } else {
        logger.warn(`Continuing with ${workers.length} remaining worker(s) (target: ${desiredWorkerCount})`);
      }
    }
  });

  return worker;
}

/**
 * Initialize the mediasoup worker pool
 *
 * Creates the specified number of workers (minimum 2 for redundancy).
 * Each worker runs in a separate process for CPU distribution.
 *
 * @param numWorkers - Number of workers to create (default: 2, minimum: 2)
 * @throws Error if any worker fails to create
 */
export async function createWorkers(numWorkers: number = 2): Promise<void> {
  // Ensure at least 2 workers for redundancy
  desiredWorkerCount = Math.max(numWorkers, 2);
  logger.info(`Creating ${desiredWorkerCount} mediasoup workers...`);

  for (let i = 0; i < desiredWorkerCount; i++) {
    const worker = await createSingleWorker();
    workers.push(worker);
    logger.info(`Mediasoup worker created [pid:${worker.pid}]`);
  }
}

/**
 * Get the next available worker using round-robin selection
 *
 * @returns Worker instance for media routing
 * @throws Error if no workers are available
 */
export function getNextWorker(): Worker {
  if (workers.length === 0) {
    throw new Error('No mediasoup workers available');
  }

  // Ensure index is within bounds
  if (nextWorkerIdx >= workers.length) {
    nextWorkerIdx = 0;
  }

  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

/**
 * Create or retrieve a Router for a broadcast
 *
 * Routers are cached to prevent duplicate creation. If a router is currently
 * being created for the broadcast, the existing promise is returned to prevent
 * race conditions.
 *
 * @param broadcastId - Unique identifier for the broadcast
 * @returns Promise resolving to the Router instance
 * @throws Error if router creation fails
 */
export async function createRouter(broadcastId: string): Promise<Router> {
  // Check if router already exists
  const existingRouter = routers.get(broadcastId);
  if (existingRouter) {
    logger.debug(`Router already exists for broadcast ${broadcastId}`);
    return existingRouter;
  }

  // Check if router is currently being created
  const pendingCreation = routerCreationPromises.get(broadcastId);
  if (pendingCreation) {
    logger.debug(`Waiting for pending router creation for broadcast ${broadcastId}`);
    return pendingCreation;
  }

  // Create new router
  const creationPromise = (async () => {
    let router: Router | undefined;
    try {
      const worker = getNextWorker();
      router = await worker.createRouter({
        mediaCodecs: mediasoupConfig.router.mediaCodecs,
      });

      routers.set(broadcastId, router);
      logger.info(`Router created for broadcast ${broadcastId}`);

      return router;
    } catch (error) {
      // If router was created but subsequent operations failed, close it
      if (router && !router.closed) {
        try {
          router.close();
          logger.warn(`Closed router for broadcast ${broadcastId} due to creation error`);
        } catch (closeError) {
          logger.error(`Error closing router during cleanup:`, closeError);
        }
      }
      // Remove from routers map if it was added
      routers.delete(broadcastId);
      throw error;
    } finally {
      // Always clean up the pending promise, even if error occurred
      routerCreationPromises.delete(broadcastId);
    }
  })();

  // Store the promise to prevent concurrent creation
  routerCreationPromises.set(broadcastId, creationPromise);

  return creationPromise;
}

/**
 * Get an existing Router for a broadcast
 *
 * @param broadcastId - Unique identifier for the broadcast
 * @returns Router instance if exists, undefined otherwise
 */
export function getRouter(broadcastId: string): Router | undefined {
  return routers.get(broadcastId);
}

/**
 * Close and delete a Router for a broadcast
 *
 * Safely closes the router and removes it from cache. Safe to call even if
 * router doesn't exist.
 *
 * @param broadcastId - Unique identifier for the broadcast
 */
export function deleteRouter(broadcastId: string): void {
  const router = routers.get(broadcastId);
  if (router) {
    router.close();
    routers.delete(broadcastId);
    logger.info(`Router deleted for broadcast ${broadcastId}`);
  }
}

/**
 * Close all workers and routers
 *
 * Called during graceful shutdown. Closes all worker processes and clears
 * router cache.
 */
export async function closeWorkers(): Promise<void> {
  for (const worker of workers) {
    worker.close();
  }
  workers = [];
  routers.clear();
}

export { workers, routers };
