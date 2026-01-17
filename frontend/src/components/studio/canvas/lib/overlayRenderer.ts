/**
 * Overlay Renderer for StudioCanvas
 *
 * Handles rendering all overlay elements:
 * - Banners (lower thirds)
 * - Captions
 * - Chat messages
 * - Teleprompter
 * - Social comments
 */

import { Banner, ChatMessage, Comment } from './types';

export interface OverlayRenderContext {
  ctx: CanvasRenderingContext2D;
  canvasWidth: number;
  canvasHeight: number;
}

/**
 * Draw all visible banners
 */
export function drawBanners(
  context: OverlayRenderContext,
  banners: Banner[]
): void {
  const { ctx, canvasWidth, canvasHeight } = context;

  banners.filter(b => b.visible).forEach(banner => {
    const pos = getBannerPosition(banner.position, canvasWidth, canvasHeight);

    // Background
    ctx.fillStyle = banner.backgroundColor;
    const padding = 16;
    const titleSize = 18;
    const subtitleSize = 14;
    const textWidth = Math.max(
      ctx.measureText(banner.title).width,
      banner.subtitle ? ctx.measureText(banner.subtitle).width : 0
    );
    const width = Math.min(textWidth + padding * 2, canvasWidth * 0.4);
    const height = banner.subtitle ? titleSize + subtitleSize + padding * 2 : titleSize + padding * 2;

    // Draw banner background with rounded corners
    ctx.beginPath();
    ctx.roundRect(pos.x, pos.y, width, height, 8);
    ctx.fill();

    // Title
    ctx.fillStyle = banner.textColor;
    ctx.font = `bold ${titleSize}px Inter, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(banner.title, pos.x + padding, pos.y + padding);

    // Subtitle
    if (banner.subtitle) {
      ctx.font = `${subtitleSize}px Inter, sans-serif`;
      ctx.fillText(banner.subtitle, pos.x + padding, pos.y + padding + titleSize + 4);
    }
  });
}

/**
 * Get banner position coordinates based on position string
 */
function getBannerPosition(
  position: Banner['position'],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number } {
  const margin = 40;
  const bannerWidth = canvasWidth * 0.3;
  const bannerHeight = 60;

  switch (position) {
    case 'top-left':
      return { x: margin, y: margin };
    case 'top-center':
      return { x: (canvasWidth - bannerWidth) / 2, y: margin };
    case 'top-right':
      return { x: canvasWidth - bannerWidth - margin, y: margin };
    case 'bottom-left':
      return { x: margin, y: canvasHeight - bannerHeight - margin };
    case 'bottom-center':
      return { x: (canvasWidth - bannerWidth) / 2, y: canvasHeight - bannerHeight - margin };
    case 'bottom-right':
      return { x: canvasWidth - bannerWidth - margin, y: canvasHeight - bannerHeight - margin };
    default:
      return { x: margin, y: canvasHeight - bannerHeight - margin };
  }
}

/**
 * Draw captions at bottom of screen
 */
export function drawCaptions(
  context: OverlayRenderContext,
  caption: { text: string; isFinal: boolean } | null
): void {
  if (!caption || !caption.text) return;

  const { ctx, canvasWidth, canvasHeight } = context;
  const text = caption.text;

  // Caption styling
  const fontSize = 24;
  const padding = 16;
  const margin = 60;
  const maxWidth = canvasWidth * 0.8;

  ctx.font = `${fontSize}px Inter, sans-serif`;

  // Word wrap
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  // Calculate dimensions
  const lineHeight = fontSize * 1.4;
  const totalHeight = lines.length * lineHeight + padding * 2;
  const boxWidth = Math.min(maxWidth + padding * 2, canvasWidth - margin * 2);
  const boxX = (canvasWidth - boxWidth) / 2;
  const boxY = canvasHeight - totalHeight - margin;

  // Background
  ctx.fillStyle = caption.isFinal ? 'rgba(0, 0, 0, 0.8)' : 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(boxX, boxY, boxWidth, totalHeight, 8);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  lines.forEach((line, i) => {
    ctx.fillText(line, canvasWidth / 2, boxY + padding + i * lineHeight);
  });

  // Interim indicator (pulsing dot)
  if (!caption.isFinal) {
    const dotX = boxX + boxWidth - padding;
    const dotY = boxY + padding;
    const pulse = Math.sin(Date.now() * 0.005) * 0.3 + 0.7;
    ctx.fillStyle = `rgba(255, 0, 0, ${pulse})`;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Draw chat overlay
 */
export function drawChatOverlay(
  context: OverlayRenderContext,
  messages: ChatMessage[],
  position: { x: number; y: number },
  size: { width: number; height: number }
): void {
  if (messages.length === 0) return;

  const { ctx, canvasWidth, canvasHeight } = context;

  // Calculate actual position (percentages to pixels)
  const x = (position.x / 100) * canvasWidth;
  const y = (position.y / 100) * canvasHeight;
  const width = (size.width / 100) * canvasWidth;
  const height = (size.height / 100) * canvasHeight;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  // Header
  const headerHeight = 30;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
  ctx.fillRect(x, y, width, headerHeight);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('Live Chat', x + 12, y + headerHeight / 2);

  // Messages (show last 5)
  const visibleMessages = messages.slice(-5);
  const messageHeight = 24;
  const startY = y + headerHeight + 8;

  ctx.font = '12px Inter, sans-serif';
  visibleMessages.forEach((msg, i) => {
    const msgY = startY + i * messageHeight;
    if (msgY + messageHeight > y + height) return;

    // Author
    ctx.fillStyle = '#60a5fa'; // Blue
    ctx.fillText(msg.author + ':', x + 12, msgY + messageHeight / 2);

    // Message
    const authorWidth = ctx.measureText(msg.author + ': ').width;
    ctx.fillStyle = '#ffffff';
    const maxMsgWidth = width - authorWidth - 24;
    let displayMsg = msg.message;
    if (ctx.measureText(displayMsg).width > maxMsgWidth) {
      while (ctx.measureText(displayMsg + '...').width > maxMsgWidth && displayMsg.length > 0) {
        displayMsg = displayMsg.slice(0, -1);
      }
      displayMsg += '...';
    }
    ctx.fillText(displayMsg, x + 12 + authorWidth, msgY + messageHeight / 2);
  });
}

/**
 * Draw teleprompter overlay
 */
export function drawTeleprompter(
  context: OverlayRenderContext,
  notes: string,
  fontSize: number,
  scrollPosition: number
): void {
  if (!notes) return;

  const { ctx, canvasWidth, canvasHeight } = context;

  // Teleprompter area (right side of screen)
  const width = canvasWidth * 0.25;
  const height = canvasHeight * 0.4;
  const x = canvasWidth - width - 20;
  const y = 20;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  // Header
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 14px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('Teleprompter', x + 12, y + 12);

  // Notes (scrollable)
  ctx.save();
  ctx.beginPath();
  ctx.rect(x + 8, y + 36, width - 16, height - 44);
  ctx.clip();

  ctx.font = `${fontSize}px Inter, sans-serif`;
  ctx.fillStyle = '#ffffff';

  // Word wrap and render
  const lines = wrapText(ctx, notes, width - 24);
  const lineHeight = fontSize * 1.5;
  const startY = y + 40 - scrollPosition;

  lines.forEach((line, i) => {
    const lineY = startY + i * lineHeight;
    if (lineY > y + 36 && lineY < y + height - 8) {
      ctx.fillText(line, x + 12, lineY);
    }
  });

  ctx.restore();
}

/**
 * Draw social comment overlay
 */
export function drawSocialComment(
  context: OverlayRenderContext,
  comment: Comment
): void {
  const { ctx, canvasWidth, canvasHeight } = context;

  // Comment bubble at bottom center
  const width = canvasWidth * 0.5;
  const maxHeight = 120;
  const x = (canvasWidth - width) / 2;
  const y = canvasHeight - maxHeight - 100;

  // Platform colors
  const platformColors: Record<string, string> = {
    youtube: '#FF0000',
    facebook: '#1877F2',
    twitch: '#9146FF',
    linkedin: '#0A66C2',
    x: '#1DA1F2',
    rumble: '#85C742'
  };

  const platformColor = platformColors[comment.platform] || '#888888';

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.beginPath();
  ctx.roundRect(x, y, width, maxHeight, 12);
  ctx.fill();

  // Platform indicator (colored strip)
  ctx.fillStyle = platformColor;
  ctx.beginPath();
  ctx.roundRect(x, y, 6, maxHeight, [12, 0, 0, 12]);
  ctx.fill();

  // Author
  ctx.fillStyle = platformColor;
  ctx.font = 'bold 16px Inter, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(comment.authorName, x + 20, y + 16);

  // Message
  ctx.fillStyle = '#ffffff';
  ctx.font = '18px Inter, sans-serif';

  const lines = wrapText(ctx, comment.message, width - 40);
  const lineHeight = 24;
  lines.slice(0, 3).forEach((line, i) => {
    ctx.fillText(line, x + 20, y + 44 + i * lineHeight);
  });

  // Platform icon/name
  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.font = '12px Inter, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(comment.platform.toUpperCase(), x + width - 16, y + 16);
}

/**
 * Helper: Wrap text to fit within max width
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = ctx.measureText(testLine).width;
    if (width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });
  if (currentLine) lines.push(currentLine);

  return lines;
}
