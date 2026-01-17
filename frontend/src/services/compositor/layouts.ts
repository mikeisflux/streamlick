/**
 * Compositor Layout Calculations
 *
 * Pure functions for calculating participant positions in different layouts.
 */

import { Position, CanvasSize } from './types';

const DEFAULT_PADDING = 10;
const SMALL_PADDING = 5;
const SMALL_GAP = 5;

/**
 * Calculate grid layout positions
 */
export function calculateGridLayout(
  count: number,
  canvas: CanvasSize,
  padding = DEFAULT_PADDING
): Position[] {
  if (count === 0) return [];

  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);

  const cellWidth = canvas.width / cols;
  const cellHeight = canvas.height / rows;

  const positions: Position[] = [];

  for (let i = 0; i < count; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);

    positions.push({
      x: col * cellWidth + padding,
      y: row * cellHeight + padding,
      width: cellWidth - padding * 2,
      height: cellHeight - padding * 2,
    });
  }

  return positions;
}

/**
 * Calculate spotlight layout positions
 * One large participant (80% width), others in sidebar (20% width)
 */
export function calculateSpotlightLayout(
  count: number,
  spotlightIndex: number,
  canvas: CanvasSize,
  padding = DEFAULT_PADDING
): { spotlight: Position; others: Position[] } {
  const mainWidth = canvas.width * 0.8;
  const mainHeight = canvas.height;

  const spotlight: Position = {
    x: 0,
    y: 0,
    width: mainWidth,
    height: mainHeight,
  };

  const sidebarWidth = canvas.width * 0.2;
  const otherCount = count - 1;
  const cellHeight = otherCount > 0 ? canvas.height / otherCount : 0;

  const others: Position[] = [];
  for (let i = 0; i < otherCount; i++) {
    others.push({
      x: canvas.width - sidebarWidth + padding,
      y: i * cellHeight + padding,
      width: sidebarWidth - padding * 2,
      height: cellHeight - padding * 2,
    });
  }

  return { spotlight, others };
}

/**
 * Calculate PIP (Picture-in-Picture) layout positions
 * Main participant full screen, secondary in corner
 */
export function calculatePipLayout(
  canvas: CanvasSize,
  margin = 20
): { main: Position; pip: Position } {
  const pipWidth = canvas.width * 0.2;
  const pipHeight = canvas.height * 0.2;

  return {
    main: {
      x: 0,
      y: 0,
      width: canvas.width,
      height: canvas.height,
    },
    pip: {
      x: canvas.width - pipWidth - margin,
      y: canvas.height - pipHeight - margin,
      width: pipWidth,
      height: pipHeight,
    },
  };
}

/**
 * Calculate screen share layout positions
 * Screen share takes 88% height at bottom, participants as thumbnails (12% height) at top
 */
export function calculateScreenShareLayout(
  participantCount: number,
  canvas: CanvasSize,
  padding = SMALL_PADDING,
  gap = SMALL_GAP
): { thumbnails: Position[]; screenShare: Position } {
  const thumbnailHeight = canvas.height * 0.12;
  const screenHeight = canvas.height * 0.88;

  const thumbnails: Position[] = [];

  if (participantCount > 0) {
    const thumbnailWidth = (canvas.width - padding * 2 - gap * (participantCount - 1)) / participantCount;

    for (let i = 0; i < participantCount; i++) {
      thumbnails.push({
        x: padding + i * (thumbnailWidth + gap),
        y: padding,
        width: thumbnailWidth,
        height: thumbnailHeight - padding * 2,
      });
    }
  }

  const screenShare: Position = {
    x: padding,
    y: thumbnailHeight + gap,
    width: canvas.width - padding * 2,
    height: screenHeight - gap - padding,
  };

  return { thumbnails, screenShare };
}

/**
 * Calculate aspect ratio fit for video in container
 */
export function calculateAspectRatioFit(
  videoWidth: number,
  videoHeight: number,
  containerWidth: number,
  containerHeight: number,
  containerX: number,
  containerY: number
): Position {
  const videoAspect = videoWidth / videoHeight;
  const containerAspect = containerWidth / containerHeight;

  let drawWidth = containerWidth;
  let drawHeight = containerHeight;
  let drawX = containerX;
  let drawY = containerY;

  if (videoAspect > containerAspect) {
    // Video is wider - fit to width
    drawHeight = containerWidth / videoAspect;
    drawY = containerY + (containerHeight - drawHeight) / 2;
  } else {
    // Video is taller - fit to height
    drawWidth = containerHeight * videoAspect;
    drawX = containerX + (containerWidth - drawWidth) / 2;
  }

  return { x: drawX, y: drawY, width: drawWidth, height: drawHeight };
}
