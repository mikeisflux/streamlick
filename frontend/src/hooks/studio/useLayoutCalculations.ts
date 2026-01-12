/**
 * useLayoutCalculations - Layout position calculation for StudioCanvas
 *
 * Handles all layout types and calculates participant positions on canvas
 */

export interface ParticipantPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutStyles {
  type: string;
  container: string;
  gridCols?: number;
  gridRows?: number;
  mainVideo?: string;
  secondaryVideo?: string;
  topBar?: string;
  topBarHeight?: string;
  screenShare?: string;
  pipOverlay?: string;
}

/**
 * Calculate dynamic grid dimensions based on participant count
 */
export function calculateDynamicGrid(participantCount: number): { cols: number; rows: number } {
  // Special case for solo layout: use 2x2 grid to keep same size as 4-person layout
  if (participantCount === 1) {
    return { cols: 2, rows: 2 };
  }
  const cols = Math.ceil(Math.sqrt(participantCount));
  const rows = Math.ceil(participantCount / cols);
  return { cols, rows };
}

/**
 * Calculate participant positions based on layout type
 */
export function calculateParticipantPositions(
  canvasWidth: number,
  canvasHeight: number,
  participantCount: number,
  layoutId: number,
  isScreenSharing: boolean
): ParticipantPosition[] {
  const positions: ParticipantPosition[] = [];

  // Layout 6 (Screen Share) takes priority when screen sharing
  const activeLayout = isScreenSharing ? 6 : layoutId;

  switch (activeLayout) {
    case 1: // Solo - single participant centered, or side-by-side with margins for multiple
      {
        const margin = 50;
        const gap = 20;
        if (participantCount === 1) {
          // Single participant: centered at 60% of screen, 16:9 aspect ratio
          const boxWidth = canvasWidth * 0.6;
          const boxHeight = boxWidth * (9 / 16);
          positions.push({
            x: (canvasWidth - boxWidth) / 2,
            y: (canvasHeight - boxHeight) / 2,
            width: boxWidth,
            height: boxHeight
          });
        } else if (participantCount === 2) {
          // Two participants: side by side, compact 16:9 boxes centered
          const boxWidth = canvasWidth * 0.4;
          const boxHeight = boxWidth * (9 / 16);
          const totalWidth = boxWidth * 2 + gap;
          const startX = (canvasWidth - totalWidth) / 2;
          const startY = (canvasHeight - boxHeight) / 2;
          for (let i = 0; i < participantCount; i++) {
            positions.push({
              x: startX + i * (boxWidth + gap),
              y: startY,
              width: boxWidth,
              height: boxHeight
            });
          }
        } else {
          // 3+ participants: grid with margins
          const cols = Math.ceil(Math.sqrt(participantCount));
          const rows = Math.ceil(participantCount / cols);
          const availableWidth = canvasWidth - margin * 2 - gap * (cols - 1);
          const availableHeight = canvasHeight - margin * 2 - gap * (rows - 1);
          const boxWidth = availableWidth / cols;
          const boxHeight = availableHeight / rows;
          for (let i = 0; i < participantCount; i++) {
            const col = i % cols;
            const row = Math.floor(i / cols);
            positions.push({
              x: margin + col * (boxWidth + gap),
              y: margin + row * (boxHeight + gap),
              width: boxWidth,
              height: boxHeight
            });
          }
        }
      }
      break;

    case 2: // Cropped - 2x2 grid with margins
      {
        const margin = 50;
        const gap = 20;
        const cols = 2;
        const rows = 2;
        const availableWidth = canvasWidth - margin * 2 - gap * (cols - 1);
        const availableHeight = canvasHeight - margin * 2 - gap * (rows - 1);
        const boxWidth = availableWidth / cols;
        const boxHeight = availableHeight / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: margin + col * (boxWidth + gap),
            y: margin + row * (boxHeight + gap),
            width: boxWidth,
            height: boxHeight
          });
        }
      }
      break;

    case 3: // Group - auto-calculated equal grid with margins
      {
        const margin = 50;
        const gap = 20;
        const cols = Math.ceil(Math.sqrt(participantCount));
        const rows = Math.ceil(participantCount / cols);
        const availableWidth = canvasWidth - margin * 2 - gap * (cols - 1);
        const availableHeight = canvasHeight - margin * 2 - gap * (rows - 1);
        const boxWidth = availableWidth / cols;
        const boxHeight = availableHeight / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: margin + col * (boxWidth + gap),
            y: margin + row * (boxHeight + gap),
            width: boxWidth,
            height: boxHeight
          });
        }
      }
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

    case 5: // News - side by side with margins and gap
      {
        const margin = 50;
        const gap = 20;
        const availableWidth = canvasWidth - margin * 2 - gap;
        const availableHeight = canvasHeight - margin * 2;
        const boxWidth = availableWidth / 2;
        const boxHeight = availableHeight;
        for (let i = 0; i < participantCount; i++) {
          positions.push({
            x: margin + i * (boxWidth + gap),
            y: margin,
            width: boxWidth,
            height: boxHeight
          });
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

    case 8: // Cinema - wide format with margins
      {
        const margin = 50;
        const gap = 20;
        const availableWidth = canvasWidth - margin * 2 - (participantCount > 1 ? gap : 0);
        const availableHeight = canvasHeight - margin * 2;
        const boxWidth = participantCount > 1 ? availableWidth / 2 : availableWidth;
        for (let i = 0; i < participantCount; i++) {
          positions.push({
            x: margin + i * (boxWidth + gap),
            y: margin,
            width: boxWidth,
            height: availableHeight
          });
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
      // Fallback to group layout with margins
      {
        const margin = 50;
        const gap = 20;
        const cols = Math.ceil(Math.sqrt(participantCount));
        const rows = Math.ceil(participantCount / cols);
        const availableWidth = canvasWidth - margin * 2 - gap * (cols - 1);
        const availableHeight = canvasHeight - margin * 2 - gap * (rows - 1);
        const boxWidth = availableWidth / cols;
        const boxHeight = availableHeight / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: margin + col * (boxWidth + gap),
            y: margin + row * (boxHeight + gap),
            width: boxWidth,
            height: boxHeight
          });
        }
      }
  }

  return positions;
}

/**
 * Get CSS layout styles for DOM-based layouts (used by ParticipantBox)
 */
export function getLayoutStyles(
  layoutId: number | 'screenshare',
  isSharingScreen: boolean,
  selectedLayout: number,
  totalParticipants: number
): LayoutStyles {
  // When screen is being shared, use layout 6 (Screen)
  if (layoutId === 'screenshare' || (isSharingScreen && selectedLayout === 6)) {
    return {
      type: 'screen',
      container: 'flex flex-col gap-1 p-1',
      topBar: 'flex flex-row gap-1',
      topBarHeight: 'h-[12%]',
      screenShare: 'flex-1 h-[88%]',
    };
  }

  const numericLayoutId = typeof layoutId === 'number' ? layoutId : selectedLayout;

  switch (numericLayoutId) {
    case 1: // Solo
      return {
        type: 'solo',
        container: 'grid gap-2 p-2',
        gridCols: 1,
        gridRows: 1,
        mainVideo: 'col-span-1 row-span-1',
      };

    case 2: // Cropped
      return {
        type: 'cropped',
        container: 'grid gap-2 p-2',
        gridCols: 2,
        gridRows: 2,
        mainVideo: 'col-span-1 row-span-1',
      };

    case 3: { // Group
      const { cols, rows } = calculateDynamicGrid(totalParticipants);
      return {
        type: 'group',
        container: 'grid gap-2 p-2',
        gridCols: cols,
        gridRows: rows,
        mainVideo: 'col-span-1 row-span-1',
      };
    }

    case 4: // Spotlight
      return {
        type: 'spotlight',
        container: 'grid gap-2 p-2',
        gridCols: 3,
        gridRows: 4,
        mainVideo: 'col-span-3 row-span-3',
        secondaryVideo: 'col-span-1 row-span-1',
      };

    case 5: // News
      return {
        type: 'news',
        container: 'grid gap-2 p-2',
        gridCols: 2,
        gridRows: 1,
        mainVideo: 'col-span-1 row-span-1',
      };

    case 6: // Screen
      return {
        type: 'screen',
        container: 'flex flex-col gap-2 p-2',
        topBar: 'flex flex-row gap-2',
        topBarHeight: 'h-[25%]',
        screenShare: 'flex-1 h-[75%]',
      };

    case 7: // Picture-in-Picture
      return {
        type: 'pip',
        container: 'relative p-2',
        mainVideo: 'w-full h-full',
        pipOverlay: 'absolute bottom-4 right-4 w-1/4 h-1/4',
      };

    case 8: // Cinema
      return {
        type: 'cinema',
        container: 'grid gap-2 p-2',
        gridCols: totalParticipants > 1 ? 2 : 1,
        gridRows: 1,
        mainVideo: 'col-span-1 row-span-1',
      };

    case 9: { // Video Grid
      const videoGrid = calculateDynamicGrid(totalParticipants);
      return {
        type: 'videogrid',
        container: 'grid gap-4 p-4',
        gridCols: videoGrid.cols,
        gridRows: videoGrid.rows,
        mainVideo: 'col-span-1 row-span-1 w-full h-full',
      };
    }

    case 10: // Advanced Positioning
      return {
        type: 'draggable',
        container: 'relative w-full h-full',
        mainVideo: 'absolute',
      };

    default: {
      const fallbackGrid = calculateDynamicGrid(totalParticipants);
      return {
        type: 'group',
        container: 'grid gap-2 p-2',
        gridCols: fallbackGrid.cols,
        gridRows: fallbackGrid.rows,
        mainVideo: 'col-span-1 row-span-1',
      };
    }
  }
}
