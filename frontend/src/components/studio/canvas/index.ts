/**
 * IMPORTANT: NO CLIENT-SIDE CANVAS COMPOSITING
 * =============================================
 * All video compositing happens on the Ant Media Server.
 * The browser ONLY displays the server-side composite via CompositePreview.
 *
 * DO NOT re-enable StudioCanvas or add any canvas-based video compositing.
 * See: .claude/ARCHITECTURE_NO_CLIENT_COMPOSITING.md
 */

export { CaptionOverlay, CountdownOverlay } from './CanvasOverlay';
export { LayoutSelector } from './LayoutSelector';
// REMOVED: StudioCanvas - NO CLIENT-SIDE COMPOSITING ALLOWED
// export { StudioCanvas } from './StudioCanvas';
export { ParticipantBox } from './ParticipantBox';
export { PreviewArea } from './PreviewArea';
export { CanvasSettingsModal } from './CanvasSettingsModal';
export { TeleprompterOverlay } from './TeleprompterOverlay';
export { CommentOverlay } from './CommentOverlay';
export { CompositePreview } from './CompositePreview'; // Server composite viewer ONLY
