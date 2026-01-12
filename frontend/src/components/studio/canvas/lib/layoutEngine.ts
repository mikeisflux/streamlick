/**
 * Layout Engine for StudioCanvas
 *
 * Calculates participant positions for all 10 layout types:
 * 1. Solo - Single participant centered
 * 2. Cropped - 2x2 grid
 * 3. Group - Auto-calculated equal grid
 * 4. Spotlight - One large + small boxes above
 * 5. News - Side by side
 * 6. Screen Share - Thumbnails on top, screen share below
 * 7. Picture-in-Picture - Main + corner overlay
 * 8. Cinema - Wide format
 * 9. Video Grid - Auto grid with gaps
 * 10. Advanced - Custom positions (handled separately)
 */

import { ParticipantPosition } from './types';

export interface LayoutParams {
  canvasWidth: number;
  canvasHeight: number;
  participantCount: number;
  isScreenSharing: boolean;
}

/**
 * Calculate positions for all participants based on layout type
 */
export function calculateLayoutPositions(
  layout: number,
  params: LayoutParams
): ParticipantPosition[] {
  const { canvasWidth, canvasHeight, participantCount, isScreenSharing } = params;

  // Screen Share layout takes priority when screen sharing
  const activeLayout = isScreenSharing ? 6 : layout;

  const positions: ParticipantPosition[] = [];

  switch (activeLayout) {
    case 1: // Solo - single participant centered at 60% of screen, 16:9 aspect ratio
      if (participantCount === 1) {
        const boxWidth = canvasWidth * 0.6;
        const boxHeight = boxWidth * (9 / 16);
        positions.push({
          x: (canvasWidth - boxWidth) / 2,
          y: (canvasHeight - boxHeight) / 2,
          width: boxWidth,
          height: boxHeight
        });
      } else {
        // Fallback to grid for multiple
        calculateGridPositions(positions, canvasWidth, canvasHeight, participantCount);
      }
      break;

    case 2: // Cropped - 2x2 grid
      {
        const cols = 2;
        const rows = 2;
        const boxWidth = canvasWidth / cols;
        const boxHeight = canvasHeight / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
        }
      }
      break;

    case 3: // Group - auto-calculated equal grid
      calculateGridPositions(positions, canvasWidth, canvasHeight, participantCount);
      break;

    case 4: // Spotlight - one large + small boxes above
      if (participantCount === 1) {
        positions.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
      } else {
        const topBarHeight = canvasHeight * 0.25;
        const mainHeight = canvasHeight * 0.75;
        const thumbnailWidth = canvasWidth / Math.min(3, participantCount - 1);

        // First participant is main (large)
        positions.push({ x: 0, y: topBarHeight, width: canvasWidth, height: mainHeight });

        // Rest are thumbnails in top bar
        for (let i = 1; i < participantCount; i++) {
          positions.push({
            x: (i - 1) * thumbnailWidth,
            y: 0,
            width: thumbnailWidth,
            height: topBarHeight
          });
        }
      }
      break;

    case 5: // News - side by side
      {
        const boxWidth = canvasWidth / Math.max(2, participantCount);
        for (let i = 0; i < participantCount; i++) {
          positions.push({ x: i * boxWidth, y: 0, width: boxWidth, height: canvasHeight });
        }
      }
      break;

    case 6: // Screen Share - thumbnails on top, screen share below
      {
        const topBarHeight = canvasHeight * 0.12;
        const thumbnailWidth = participantCount > 0 ? canvasWidth / participantCount : canvasWidth;
        for (let i = 0; i < participantCount; i++) {
          positions.push({
            x: i * thumbnailWidth,
            y: 0,
            width: thumbnailWidth,
            height: topBarHeight
          });
        }
      }
      break;

    case 7: // Picture-in-Picture - main + corner overlay
      if (participantCount === 1) {
        positions.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });
      } else {
        // First participant fullscreen
        positions.push({ x: 0, y: 0, width: canvasWidth, height: canvasHeight });

        // Others in bottom-right corner
        const pipWidth = 240;
        const pipHeight = 180;
        const gap = 10;
        for (let i = 1; i < participantCount; i++) {
          positions.push({
            x: canvasWidth - pipWidth - gap,
            y: canvasHeight - (pipHeight + gap) * i,
            width: pipWidth,
            height: pipHeight
          });
        }
      }
      break;

    case 8: // Cinema - wide format
      {
        const boxWidth = participantCount > 1 ? canvasWidth / 2 : canvasWidth;
        for (let i = 0; i < participantCount; i++) {
          positions.push({ x: i * boxWidth, y: 0, width: boxWidth, height: canvasHeight });
        }
      }
      break;

    case 9: // Video Grid - auto grid with gaps
      {
        const cols = Math.ceil(Math.sqrt(participantCount));
        const rows = Math.ceil(participantCount / cols);
        const gap = 4;
        const boxWidth = (canvasWidth - gap * (cols + 1)) / cols;
        const boxHeight = (canvasHeight - gap * (rows + 1)) / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: gap + col * (boxWidth + gap),
            y: gap + row * (boxHeight + gap),
            width: boxWidth,
            height: boxHeight
          });
        }
      }
      break;

    default:
      // Fallback to group layout
      calculateGridPositions(positions, canvasWidth, canvasHeight, participantCount);
  }

  return positions;
}

/**
 * Helper function to calculate grid positions
 */
function calculateGridPositions(
  positions: ParticipantPosition[],
  canvasWidth: number,
  canvasHeight: number,
  participantCount: number
): void {
  const cols = Math.ceil(Math.sqrt(participantCount));
  const rows = Math.ceil(participantCount / cols);
  const boxWidth = canvasWidth / cols;
  const boxHeight = canvasHeight / rows;

  for (let i = 0; i < participantCount; i++) {
    const col = i % cols;
    const row = Math.floor(i / cols);
    positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
  }
}

/**
 * Get the screen share area position for layout 6
 */
export function getScreenSharePosition(
  canvasWidth: number,
  canvasHeight: number
): ParticipantPosition {
  const topBarHeight = canvasHeight * 0.12;
  return {
    x: 0,
    y: topBarHeight,
    width: canvasWidth,
    height: canvasHeight - topBarHeight
  };
}

/**
 * Calculate optimal grid dimensions for a given participant count
 */
export function calculateDynamicGrid(participantCount: number): { cols: number; rows: number } {
  const cols = Math.ceil(Math.sqrt(participantCount));
  const rows = Math.ceil(participantCount / cols);
  return { cols, rows };
}
