/**
 * Compositor Frozen Detection
 *
 * Monitors canvas pixel changes to detect if the canvas has frozen.
 * This is part of the anti-mute strategy to prevent browser throttling.
 */

import logger from '../../utils/logger';

export interface FrozenDetectionState {
  lastPixelSample: Uint8ClampedArray | null;
  lastPixelSampleTime: number;
  frozenFrameCount: number;
}

export interface FrozenDetectionConfig {
  sampleInterval: number;       // How often to check (ms)
  sampleSize: number;           // Size of sample region (pixels)
  maxFrozenFrames: number;      // Alert after N consecutive frozen samples
  deltaThreshold: number;       // Minimum pixel delta to consider "not frozen"
}

export const DEFAULT_FROZEN_CONFIG: FrozenDetectionConfig = {
  sampleInterval: 1000,
  sampleSize: 100,
  maxFrozenFrames: 3,
  deltaThreshold: 0.5,
};

/**
 * Create initial frozen detection state
 */
export function createFrozenDetectionState(): FrozenDetectionState {
  return {
    lastPixelSample: null,
    lastPixelSampleTime: 0,
    frozenFrameCount: 0,
  };
}

/**
 * Check if canvas is frozen by comparing pixel deltas
 * @returns true if canvas appears frozen, false otherwise
 */
export function checkCanvasFrozen(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  canvasHeight: number,
  state: FrozenDetectionState,
  config: FrozenDetectionConfig = DEFAULT_FROZEN_CONFIG
): { isFrozen: boolean; avgDelta: number } {
  const now = Date.now();

  // Not time to check yet
  if (now - state.lastPixelSampleTime < config.sampleInterval) {
    return { isFrozen: false, avgDelta: -1 };
  }

  state.lastPixelSampleTime = now;

  try {
    // Sample a region from the center of the canvas
    const sampleX = Math.floor((canvasWidth - config.sampleSize) / 2);
    const sampleY = Math.floor((canvasHeight - config.sampleSize) / 2);

    const imageData = ctx.getImageData(
      sampleX,
      sampleY,
      config.sampleSize,
      config.sampleSize
    );

    const currentSample = imageData.data;

    if (state.lastPixelSample !== null) {
      // Compare with previous sample
      let totalDelta = 0;
      for (let i = 0; i < currentSample.length; i++) {
        totalDelta += Math.abs(currentSample[i] - state.lastPixelSample[i]);
      }

      const avgDelta = totalDelta / currentSample.length;

      if (avgDelta < config.deltaThreshold) {
        state.frozenFrameCount++;

        if (state.frozenFrameCount >= config.maxFrozenFrames) {
          logger.error(`[Canvas Frozen] CRITICAL: Canvas frozen for ${state.frozenFrameCount} consecutive checks!`, {
            avgDelta,
          });
          return { isFrozen: true, avgDelta };
        }
      } else {
        // Canvas is changing - reset frozen counter
        state.frozenFrameCount = 0;
      }

      // Store current sample for next comparison
      state.lastPixelSample = new Uint8ClampedArray(currentSample);

      return { isFrozen: false, avgDelta };
    }

    // First sample - store for next comparison
    state.lastPixelSample = new Uint8ClampedArray(currentSample);
    return { isFrozen: false, avgDelta: -1 };
  } catch (error) {
    logger.error('[Canvas Frozen] Error checking canvas frozen state:', error);
    return { isFrozen: false, avgDelta: -1 };
  }
}

/**
 * Reset frozen detection state
 */
export function resetFrozenDetection(state: FrozenDetectionState): void {
  state.lastPixelSample = null;
  state.lastPixelSampleTime = 0;
  state.frozenFrameCount = 0;
}
