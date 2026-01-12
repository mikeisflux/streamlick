/**
 * Compositor Overlay Rendering
 *
 * Functions for drawing overlays like chat, lower thirds, captions, etc.
 */

import { ChatMessage, LowerThird, CanvasSize } from './types';

const PLATFORM_COLORS: Record<string, string> = {
  youtube: '#FF0000',
  facebook: '#1877F2',
  twitch: '#9146FF',
  x: '#000000',
  rumble: '#85C742',
};

/**
 * Draw chat messages overlay
 */
export function drawChatMessages(
  ctx: CanvasRenderingContext2D,
  messages: ChatMessage[],
  canvas: CanvasSize,
  maxMessages = 5
): void {
  if (messages.length === 0) return;

  const displayMessages = messages.slice(-maxMessages);
  const chatWidth = 350;
  const chatX = canvas.width - chatWidth - 20;
  const chatY = canvas.height - 300;
  const messageHeight = 50;
  const padding = 10;

  // Draw chat container background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.beginPath();
  ctx.roundRect(chatX, chatY, chatWidth, messageHeight * displayMessages.length + padding * 2, 10);
  ctx.fill();

  displayMessages.forEach((msg, index) => {
    const y = chatY + padding + index * messageHeight;

    // Platform indicator
    ctx.fillStyle = PLATFORM_COLORS[msg.platform] || '#666666';
    ctx.beginPath();
    ctx.arc(chatX + 20, y + 20, 8, 0, Math.PI * 2);
    ctx.fill();

    // Author name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(msg.author, chatX + 40, y + 5, chatWidth - 60);

    // Message text
    ctx.font = '13px sans-serif';
    ctx.fillStyle = '#e5e5e5';
    ctx.fillText(msg.message, chatX + 40, y + 25, chatWidth - 60);
  });
}

/**
 * Draw lower third overlay
 */
export function drawLowerThird(
  ctx: CanvasRenderingContext2D,
  lowerThird: LowerThird,
  canvas: CanvasSize
): void {
  const { name, title, subtitle, style = 'modern', position = 'left' } = lowerThird;

  const ltWidth = 400;
  const ltHeight = title ? 80 : 50;
  const ltY = canvas.height - ltHeight - 80;

  let ltX: number;
  switch (position) {
    case 'center':
      ltX = (canvas.width - ltWidth) / 2;
      break;
    case 'right':
      ltX = canvas.width - ltWidth - 40;
      break;
    default:
      ltX = 40;
  }

  // Draw based on style
  switch (style) {
    case 'modern':
      drawModernLowerThird(ctx, ltX, ltY, ltWidth, ltHeight, name, title, subtitle);
      break;
    case 'classic':
      drawClassicLowerThird(ctx, ltX, ltY, ltWidth, ltHeight, name, title);
      break;
    case 'minimal':
      drawMinimalLowerThird(ctx, ltX, ltY, name, title);
      break;
    case 'bold':
      drawBoldLowerThird(ctx, ltX, ltY, ltWidth, ltHeight, name, title);
      break;
  }
}

function drawModernLowerThird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
  title?: string,
  subtitle?: string
): void {
  // Background with gradient
  const gradient = ctx.createLinearGradient(x, y, x + width, y);
  gradient.addColorStop(0, 'rgba(59, 130, 246, 0.9)');
  gradient.addColorStop(1, 'rgba(37, 99, 235, 0.9)');

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 8);
  ctx.fill();

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x + 15, y + 12, width - 30);

  // Title
  if (title) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillText(title, x + 15, y + 40, width - 30);
  }

  // Subtitle
  if (subtitle) {
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fillText(subtitle, x + 15, y + 58, width - 30);
  }
}

function drawClassicLowerThird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
  title?: string
): void {
  // Black background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
  ctx.fillRect(x, y, width, height);

  // Accent bar
  ctx.fillStyle = '#dc2626';
  ctx.fillRect(x, y, 5, height);

  // Name
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 18px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x + 15, y + 10, width - 30);

  // Title
  if (title) {
    ctx.font = '14px sans-serif';
    ctx.fillStyle = '#9ca3af';
    ctx.fillText(title, x + 15, y + 35, width - 30);
  }
}

function drawMinimalLowerThird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  name: string,
  title?: string
): void {
  // Just text with subtle shadow
  ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
  ctx.shadowBlur = 4;
  ctx.shadowOffsetX = 2;
  ctx.shadowOffsetY = 2;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name, x, y);

  if (title) {
    ctx.font = '16px sans-serif';
    ctx.fillText(title, x, y + 28);
  }

  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function drawBoldLowerThird(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  name: string,
  title?: string
): void {
  // Bold yellow background
  ctx.fillStyle = '#fbbf24';
  ctx.fillRect(x, y, width, height);

  // Name
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(name.toUpperCase(), x + 15, y + 10, width - 30);

  // Title
  if (title) {
    ctx.font = 'bold 14px sans-serif';
    ctx.fillText(title.toUpperCase(), x + 15, y + 40, width - 30);
  }
}

/**
 * Draw captions overlay
 */
export function drawCaptions(
  ctx: CanvasRenderingContext2D,
  text: string,
  isFinal: boolean,
  canvas: CanvasSize,
  position = { x: 50, y: 85 },
  size = { width: 600, height: 80 }
): void {
  const x = (position.x / 100) * canvas.width - size.width / 2;
  const y = (position.y / 100) * canvas.height - size.height / 2;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
  ctx.beginPath();
  ctx.roundRect(x, y, size.width, size.height, 8);
  ctx.fill();

  // Text
  ctx.fillStyle = isFinal ? '#ffffff' : '#d1d5db';
  ctx.font = isFinal ? 'bold 20px sans-serif' : '20px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // Word wrap
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  const maxWidth = size.width - 40;

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth) {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) lines.push(currentLine);

  const lineHeight = 24;
  const startY = y + size.height / 2 - ((lines.length - 1) * lineHeight) / 2;

  lines.forEach((line, i) => {
    ctx.fillText(line, x + size.width / 2, startY + i * lineHeight);
  });
}
