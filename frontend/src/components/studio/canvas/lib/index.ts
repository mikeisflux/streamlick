/**
 * Canvas Library Exports
 *
 * Modular utilities for StudioCanvas rendering
 */

// Types
export * from './types';

// Layout Engine
export {
  calculateLayoutPositions,
  getScreenSharePosition,
  calculateDynamicGrid,
  type LayoutParams
} from './layoutEngine';

// Participant Renderer
export {
  drawParticipant,
  drawVideo,
  drawCameraOffWithAvatar,
  drawPlaceholder,
  drawSpeakingRing,
  drawNameTag,
  drawScreenShare,
  type ParticipantRenderData,
  type RenderOptions
} from './participantRenderer';

// Overlay Renderer
export {
  drawBanners,
  drawCaptions,
  drawChatOverlay,
  drawTeleprompter,
  drawSocialComment,
  type OverlayRenderContext
} from './overlayRenderer';
