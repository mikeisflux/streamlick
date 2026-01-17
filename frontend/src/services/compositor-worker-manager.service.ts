/**
 * Compositor Worker Manager Service
 *
 * Manages the compositor web worker with fallback to main thread
 * if OffscreenCanvas is not supported.
 */

interface CompositorConfig {
  width: number;
  height: number;
  fps: number;
}

interface LayoutConfig {
  positions: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
    participantId: string;
  }>;
}

class CompositorWorkerManager {
  private worker: Worker | null = null;
  private supportsOffscreenCanvas = false;
  private canvas: HTMLCanvasElement | null = null;
  private offscreenCanvas: OffscreenCanvas | null = null;
  private onFrameRendered?: (metrics: { timestamp: number; frameTime: number }) => void;

  constructor() {
    // Check for OffscreenCanvas support
    this.supportsOffscreenCanvas = typeof OffscreenCanvas !== 'undefined';
  }

  /**
   * Initialize compositor with worker (if supported) or fallback to main thread
   */
  async initialize(
    canvas: HTMLCanvasElement,
    config: CompositorConfig,
    onFrameRendered?: (metrics: { timestamp: number; frameTime: number }) => void
  ): Promise<boolean> {
    this.canvas = canvas;
    this.onFrameRendered = onFrameRendered;

    if (!this.supportsOffscreenCanvas) {
      console.warn('OffscreenCanvas not supported, using main thread compositing');
      return false;
    }

    try {
      // Create worker
      this.worker = new Worker(
        new URL('../workers/compositor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Transfer canvas to worker
      this.offscreenCanvas = canvas.transferControlToOffscreen();

      // Set up message handler
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Initialize worker
      this.worker.postMessage(
        {
          type: 'init',
          data: {
            canvas: this.offscreenCanvas,
            width: config.width,
            height: config.height,
            fps: config.fps,
          },
        },
        [this.offscreenCanvas as Transferable]
      );

      return new Promise((resolve) => {
        const handleInit = (event: MessageEvent) => {
          if (event.data.type === 'initialized') {
            this.worker?.removeEventListener('message', handleInit);
            resolve(true);
          }
        };
        this.worker?.addEventListener('message', handleInit);

        // Timeout after 5 seconds
        setTimeout(() => {
          this.worker?.removeEventListener('message', handleInit);
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      console.error('Failed to initialize compositor worker:', error);
      this.cleanup();
      return false;
    }
  }

  /**
   * Handle messages from worker
   */
  private handleWorkerMessage(event: MessageEvent): void {
    const { type, timestamp, frameTime, error } = event.data;

    switch (type) {
      case 'initialized':
        console.log('Compositor worker initialized');
        break;

      case 'frameRendered':
        if (this.onFrameRendered) {
          this.onFrameRendered({ timestamp, frameTime });
        }
        break;

      case 'error':
        console.error('Worker error:', error);
        break;

      default:
        console.warn('Unknown worker message type:', type);
    }
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(error: ErrorEvent): void {
    console.error('Compositor worker error:', error);
    // Could implement fallback to main thread here
  }

  /**
   * Render frame with given data
   */
  render(data: {
    layout: LayoutConfig;
    background?: ImageBitmap;
    overlays?: ImageBitmap[];
  }): void {
    if (!this.worker) {
      console.warn('Worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'render',
      data,
    });
  }

  /**
   * Update layout without full render
   */
  updateLayout(layout: LayoutConfig): void {
    if (!this.worker) {
      console.warn('Worker not initialized');
      return;
    }

    this.worker.postMessage({
      type: 'updateLayout',
      data: layout,
    });
  }

  /**
   * Stop compositor and clean up
   */
  stop(): void {
    if (this.worker) {
      this.worker.postMessage({ type: 'stop' });
    }
    this.cleanup();
  }

  /**
   * Clean up resources
   */
  private cleanup(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.offscreenCanvas = null;
    this.canvas = null;
    this.onFrameRendered = undefined;
  }

  /**
   * Check if worker is supported and initialized
   */
  isWorkerActive(): boolean {
    return this.worker !== null && this.supportsOffscreenCanvas;
  }

  /**
   * Get capability info
   */
  getCapabilities(): {
    offscreenCanvasSupported: boolean;
    workerActive: boolean;
  } {
    return {
      offscreenCanvasSupported: this.supportsOffscreenCanvas,
      workerActive: this.isWorkerActive(),
    };
  }
}

export const compositorWorkerManager = new CompositorWorkerManager();
