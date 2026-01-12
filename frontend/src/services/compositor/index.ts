/**
 * Compositor Modules Index
 *
 * Modular utilities for the compositor service.
 */

// Types
export * from './types';

// Layout calculations
export {
  calculateGridLayout,
  calculateSpotlightLayout,
  calculatePipLayout,
  calculateScreenShareLayout,
  calculateAspectRatioFit,
} from './layouts';

// Rendering utilities
export {
  drawVideo,
  drawCameraOff,
  drawNameTag,
  drawSolidBackground,
  drawImageBackground,
  drawReconnectingOverlay,
  drawCountdown,
} from './rendering';

// Overlay rendering
export {
  drawChatMessages,
  drawLowerThird,
  drawCaptions,
} from './overlays';

// Audio analysis
export {
  createAudioAnalyser,
  getAudioLevel,
  drawAudioRings,
} from './audio-analysis';

// Performance monitoring
export {
  createPerformanceTracker,
  trackFrame,
  recordRenderTime,
  calculateMetrics,
  shouldReportMetrics,
  resetTracker,
  type PerformanceTracker,
} from './performance';

// Frozen detection
export {
  createFrozenDetectionState,
  checkCanvasFrozen,
  resetFrozenDetection,
  DEFAULT_FROZEN_CONFIG,
  type FrozenDetectionState,
  type FrozenDetectionConfig,
} from './frozen-detection';

// Anti-mute strategies
export {
  createSilentAudioTrack,
  drawAntiMuteNoise,
  setupVisibilityHandler,
  setupBackupTimer,
  setupTrackMuteListener,
} from './anti-mute';
