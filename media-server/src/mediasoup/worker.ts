import * as mediasoup from 'mediasoup';
import { Worker, Router } from 'mediasoup/node/lib/types';
import { mediasoupConfig } from '../config/mediasoup';
import logger from '../utils/logger';

let workers: Worker[] = [];
let nextWorkerIdx = 0;
const routers = new Map<string, Router>();

export async function createWorkers(numWorkers: number = 1): Promise<void> {
  logger.info(`Creating ${numWorkers} mediasoup workers...`);

  for (let i = 0; i < numWorkers; i++) {
    const worker = await mediasoup.createWorker(mediasoupConfig.worker);

    worker.on('died', () => {
      logger.error(`Mediasoup worker ${worker.pid} died, exiting in 2 seconds...`);
      setTimeout(() => process.exit(1), 2000);
    });

    workers.push(worker);
    logger.info(`Mediasoup worker created [pid:${worker.pid}]`);
  }
}

export function getNextWorker(): Worker {
  const worker = workers[nextWorkerIdx];
  nextWorkerIdx = (nextWorkerIdx + 1) % workers.length;
  return worker;
}

export async function createRouter(broadcastId: string): Promise<Router> {
  const worker = getNextWorker();
  const router = await worker.createRouter({
    mediaCodecs: mediasoupConfig.router.mediaCodecs,
  });

  routers.set(broadcastId, router);
  logger.info(`Router created for broadcast ${broadcastId}`);

  return router;
}

export function getRouter(broadcastId: string): Router | undefined {
  return routers.get(broadcastId);
}

export function deleteRouter(broadcastId: string): void {
  const router = routers.get(broadcastId);
  if (router) {
    router.close();
    routers.delete(broadcastId);
    logger.info(`Router deleted for broadcast ${broadcastId}`);
  }
}

export async function closeWorkers(): Promise<void> {
  for (const worker of workers) {
    worker.close();
  }
  workers = [];
  routers.clear();
}

export { workers, routers };
