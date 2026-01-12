/**
 * Compositor Performance Monitoring
 *
 * Utilities for tracking and reporting compositor performance metrics.
 */

import type { PerformanceMetrics } from '../../types';

export interface PerformanceTracker {
  frameCount: number;
  droppedFrames: number;
  renderTimes: number[];
  lastFrameTime: number;
  lastFpsReport: number;
}

/**
 * Create a new performance tracker
 */
export function createPerformanceTracker(): PerformanceTracker {
  return {
    frameCount: 0,
    droppedFrames: 0,
    renderTimes: [],
    lastFrameTime: 0,
    lastFpsReport: 0,
  };
}

/**
 * Track a frame render
 * @returns true if a frame was dropped
 */
export function trackFrame(
  tracker: PerformanceTracker,
  frameStartTime: number,
  targetFps: number
): boolean {
  const targetFrameTime = 1000 / targetFps;
  let frameDropped = false;

  if (tracker.lastFrameTime > 0) {
    const frameDelta = frameStartTime - tracker.lastFrameTime;

    // Detect dropped frames (frame took longer than expected + 50% tolerance)
    if (frameDelta > targetFrameTime * 1.5) {
      tracker.droppedFrames++;
      frameDropped = true;
    }
  }

  tracker.lastFrameTime = frameStartTime;
  return frameDropped;
}

/**
 * Record render time for a frame
 */
export function recordRenderTime(
  tracker: PerformanceTracker,
  renderTime: number,
  maxSamples = 100
): void {
  tracker.renderTimes.push(renderTime);

  // Keep only last N render times
  if (tracker.renderTimes.length > maxSamples) {
    tracker.renderTimes.shift();
  }

  tracker.frameCount++;
}

/**
 * Calculate performance metrics
 */
export function calculateMetrics(
  tracker: PerformanceTracker,
  participantCount: number
): PerformanceMetrics | null {
  if (tracker.renderTimes.length === 0) return null;

  const avgRenderTime = tracker.renderTimes.reduce((a, b) => a + b, 0) / tracker.renderTimes.length;

  return {
    averageRenderTime: avgRenderTime.toFixed(2),
    droppedFrames: tracker.droppedFrames,
    totalFrames: tracker.frameCount,
    dropRate: ((tracker.droppedFrames / tracker.frameCount) * 100).toFixed(2),
    participantCount,
  };
}

/**
 * Check if it's time to report metrics
 */
export function shouldReportMetrics(
  tracker: PerformanceTracker,
  intervalMs = 5000
): boolean {
  const now = Date.now();
  if (now - tracker.lastFpsReport >= intervalMs) {
    tracker.lastFpsReport = now;
    return true;
  }
  return false;
}

/**
 * Reset performance tracker
 */
export function resetTracker(tracker: PerformanceTracker): void {
  tracker.frameCount = 0;
  tracker.droppedFrames = 0;
  tracker.renderTimes = [];
  tracker.lastFrameTime = 0;
  tracker.lastFpsReport = 0;
}
