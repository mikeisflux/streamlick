/**
 * Compositor Web Worker
 *
 * Handles video compositing off the main thread using OffscreenCanvas
 * to improve performance and reduce main thread blocking.
 *
 * Note: OffscreenCanvas support is required (Chrome 69+, Firefox 105+)
 */

interface WorkerMessage {
  type: 'init' | 'render' | 'stop' | 'updateLayout';
  data?: unknown;
}

interface InitData {
  canvas: OffscreenCanvas;
  width: number;
  height: number;
  fps: number;
}

interface RenderData {
  videoFrames: ImageBitmap[];
  layout: {
    positions: Array<{
      x: number;
      y: number;
      width: number;
      height: number;
      participantId: string;
    }>;
  };
  background?: ImageBitmap;
  overlays?: ImageBitmap[];
}

let ctx: OffscreenCanvasRenderingContext2D | null = null;
let animationId: number | null = null;
let isRunning = false;
let currentLayout: RenderData['layout'] | null = null;
let currentBackground: ImageBitmap | null = null;
let currentOverlays: ImageBitmap[] = [];
let fps = 30;
let lastFrameTime = 0;
const frameInterval = 1000 / fps;

/**
 * Initialize the worker with canvas and settings
 */
function initialize(data: InitData): void {
  const { canvas, width, height, fps: targetFps } = data;

  fps = targetFps;
  ctx = canvas.getContext('2d', {
    alpha: false,
    desynchronized: true,
  });

  if (!ctx) {
    self.postMessage({ type: 'error', error: 'Failed to get canvas context' });
    return;
  }

  // Set canvas size
  canvas.width = width;
  canvas.height = height;

  self.postMessage({ type: 'initialized' });
}

/**
 * Render a single frame
 */
function renderFrame(timestamp: number): void {
  if (!isRunning || !ctx) return;

  const elapsed = timestamp - lastFrameTime;

  if (elapsed >= frameInterval) {
    lastFrameTime = timestamp - (elapsed % frameInterval);

    // Clear canvas
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);

    // Draw background if available
    if (currentBackground && ctx) {
      try {
        ctx.drawImage(currentBackground, 0, 0, ctx.canvas.width, ctx.canvas.height);
      } catch (error) {
        console.error('Error drawing background:', error);
      }
    }

    // Draw video frames according to layout
    if (currentLayout && currentLayout.positions && ctx) {
      currentLayout.positions.forEach((position) => {
        if (!ctx) return;
        // In a real implementation, we would draw the actual video frames here
        // For now, we just draw placeholders
        ctx.fillStyle = '#1e40af';
        ctx.fillRect(position.x, position.y, position.width, position.height);

        // Draw border
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.strokeRect(position.x, position.y, position.width, position.height);
      });
    }

    // Draw overlays
    if (ctx) {
      currentOverlays.forEach((overlay) => {
        if (!ctx) return;
        try {
          // Position would be passed with the overlay in a real implementation
          ctx.drawImage(overlay, 0, 0);
        } catch (error) {
          console.error('Error drawing overlay:', error);
        }
      });
    }

    // Send performance metrics
    self.postMessage({
      type: 'frameRendered',
      timestamp,
      frameTime: performance.now() - timestamp,
    });
  }

  if (isRunning) {
    animationId = self.requestAnimationFrame(renderFrame);
  }
}

/**
 * Start rendering loop
 */
function startRendering(): void {
  if (isRunning) return;

  isRunning = true;
  lastFrameTime = performance.now();
  animationId = self.requestAnimationFrame(renderFrame);
}

/**
 * Stop rendering loop
 */
function stopRendering(): void {
  isRunning = false;
  if (animationId !== null) {
    self.cancelAnimationFrame(animationId);
    animationId = null;
  }
}

/**
 * Update layout configuration
 */
function updateLayout(layout: RenderData['layout']): void {
  currentLayout = layout;
}

/**
 * Handle messages from main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const { type, data } = event.data;

  switch (type) {
    case 'init':
      initialize(data as InitData);
      break;

    case 'render':
      const renderData = data as RenderData;
      if (renderData.layout) {
        currentLayout = renderData.layout;
      }
      if (renderData.background) {
        currentBackground = renderData.background;
      }
      if (renderData.overlays) {
        currentOverlays = renderData.overlays;
      }
      if (!isRunning) {
        startRendering();
      }
      break;

    case 'updateLayout':
      updateLayout(data as RenderData['layout']);
      break;

    case 'stop':
      stopRendering();
      // Clean up resources
      currentBackground?.close();
      currentOverlays.forEach(overlay => overlay.close());
      currentBackground = null;
      currentOverlays = [];
      currentLayout = null;
      break;

    default:
      console.warn('Unknown message type:', type);
  }
};

// Export empty object to make TypeScript treat this as a module
export {};
