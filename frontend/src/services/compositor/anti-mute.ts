/**
 * Compositor Anti-Mute Strategies
 *
 * Browser anti-mute utilities to prevent automatic track muting
 * when the browser detects "static" canvas content.
 */

import logger from '../../utils/logger';

/**
 * Create a silent audio track to boost MediaStream priority
 * Browsers are less likely to suspend streams with audio present
 */
export function createSilentAudioTrack(): MediaStreamTrack {
  const ctx = new AudioContext();
  const oscillator = ctx.createOscillator();
  const dst = ctx.createMediaStreamDestination();
  oscillator.connect(dst);
  oscillator.start();
  return dst.stream.getAudioTracks()[0];
}

/**
 * Draw anti-mute noise pixels to prevent browser from detecting static canvas
 * @param ctx Canvas 2D rendering context
 * @param sampleX X coordinate of sample region
 * @param sampleY Y coordinate of sample region
 * @param sampleSize Size of sample region
 * @param isTabHidden Whether the tab is currently hidden (requires more aggressive noise)
 */
export function drawAntiMuteNoise(
  ctx: CanvasRenderingContext2D,
  sampleX: number,
  sampleY: number,
  sampleSize: number,
  isTabHidden: boolean
): void {
  ctx.save();

  if (isTabHidden) {
    // AGGRESSIVE MODE: Tab is hidden, browser may throttle more aggressively
    // Draw 100 pixels with higher alpha in sample region
    ctx.globalAlpha = 0.2;
    for (let i = 0; i < 100; i++) {
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
      ctx.fillRect(
        sampleX + Math.random() * sampleSize,
        sampleY + Math.random() * sampleSize,
        3,
        3
      );
    }
  } else {
    // Normal mode: Draw 50 noise pixels in sample region
    // Alpha 0.15 = 85% transparent, creates strong delta while still imperceptible
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 50; i++) {
      ctx.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
      ctx.fillRect(
        sampleX + Math.random() * sampleSize,
        sampleY + Math.random() * sampleSize,
        2,
        2
      );
    }
  }

  ctx.restore();
}

/**
 * Setup visibility change handler for anti-mute
 * Returns cleanup function
 */
export function setupVisibilityHandler(
  onVisibilityChange: (isVisible: boolean) => void
): () => void {
  const handler = () => {
    onVisibilityChange(!document.hidden);
  };

  document.addEventListener('visibilitychange', handler);

  // Return cleanup function
  return () => {
    document.removeEventListener('visibilitychange', handler);
  };
}

/**
 * Setup backup timer for when tab is hidden
 * requestAnimationFrame gets throttled heavily when tab is hidden
 * @returns cleanup function
 */
export function setupBackupTimer(
  onTick: () => void,
  fps: number
): () => void {
  const timerId = window.setInterval(onTick, 1000 / fps);

  return () => {
    window.clearInterval(timerId);
  };
}

/**
 * Setup track mute listener to detect and recover from browser auto-muting
 */
export function setupTrackMuteListener(
  track: MediaStreamTrack,
  onMuted: () => void,
  onEnded: () => void
): void {
  track.addEventListener('mute', () => {
    logger.error('[Canvas Track] Video track MUTED!', { id: track.id });
    onMuted();
  });

  track.addEventListener('ended', () => {
    logger.error('[Canvas Track] Video track ENDED unexpectedly!', {
      id: track.id,
      readyState: track.readyState,
    });
    onEnded();
  });
}
