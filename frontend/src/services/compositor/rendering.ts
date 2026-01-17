/**
 * Compositor Rendering Utilities
 *
 * Utility functions for drawing participants, avatars, and visual effects.
 */

import { Position } from './types';
import { calculateAspectRatioFit } from './layouts';

/**
 * Draw a participant's video onto the canvas
 */
export function drawVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  position: Position,
  cornerRadius = 8
): void {
  const { x, y, width, height } = position;

  // Draw rounded rectangle clip
  ctx.save();
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadius);
  ctx.clip();

  // Calculate aspect ratio fit
  const drawPos = calculateAspectRatioFit(
    video.videoWidth,
    video.videoHeight,
    width,
    height,
    x,
    y
  );

  ctx.drawImage(video, drawPos.x, drawPos.y, drawPos.width, drawPos.height);
  ctx.restore();
}

/**
 * Draw camera-off state with optional avatar
 */
export function drawCameraOff(
  ctx: CanvasRenderingContext2D,
  position: Position,
  name: string,
  avatarImage?: HTMLImageElement | null,
  audioLevel = 0,
  cornerRadius = 8
): void {
  const { x, y, width, height } = position;

  // Draw background
  ctx.fillStyle = '#2d2d2d';
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, cornerRadius);
  ctx.fill();

  // Calculate avatar/placeholder size
  const avatarSize = Math.min(width, height) * 0.4;
  const avatarX = x + (width - avatarSize) / 2;
  const avatarY = y + (height - avatarSize) / 2 - 20;

  // Draw audio ring if speaking
  if (audioLevel > 0.1) {
    const ringRadius = avatarSize / 2 + 10 + audioLevel * 20;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, ringRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(59, 130, 246, ${0.3 + audioLevel * 0.7})`;
    ctx.lineWidth = 3 + audioLevel * 3;
    ctx.stroke();
  }

  // Draw avatar or placeholder circle
  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
  ctx.clip();

  if (avatarImage && avatarImage.complete) {
    ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
  } else {
    // Draw placeholder circle with initial
    ctx.fillStyle = '#4a5568';
    ctx.fill();

    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${avatarSize * 0.4}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name.charAt(0).toUpperCase(), avatarX + avatarSize / 2, avatarY + avatarSize / 2);
  }
  ctx.restore();
}

/**
 * Draw participant name tag
 */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  name: string,
  position: Position,
  style: 'bottom' | 'top' = 'bottom'
): void {
  const { x, y, width, height } = position;
  const padding = 8;
  const fontSize = 14;

  ctx.font = `${fontSize}px sans-serif`;
  const textMetrics = ctx.measureText(name);
  const textWidth = Math.min(textMetrics.width + padding * 2, width - 20);

  const tagX = x + 10;
  const tagY = style === 'bottom' ? y + height - 30 : y + 10;
  const tagHeight = fontSize + padding * 2;

  // Draw background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  ctx.roundRect(tagX, tagY, textWidth, tagHeight, 4);
  ctx.fill();

  // Draw text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, tagX + padding, tagY + tagHeight / 2, textWidth - padding * 2);
}

/**
 * Draw a solid background
 */
export function drawSolidBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  color = '#000000'
): void {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, width, height);
}

/**
 * Draw an image background
 */
export function drawImageBackground(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number
): void {
  ctx.drawImage(image, 0, 0, width, height);
}

/**
 * Draw reconnecting overlay
 */
export function drawReconnectingOverlay(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  elapsedSeconds: number
): void {
  // Semi-transparent background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
  ctx.fillRect(0, 0, width, height);

  // Animated spinner
  const centerX = width / 2;
  const centerY = height / 2 - 40;
  const radius = 30;
  const rotation = (elapsedSeconds * 2) % 1 * Math.PI * 2;

  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';

  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2 + rotation;
    const opacity = 0.2 + (i / 8) * 0.8;
    const x1 = centerX + Math.cos(angle) * (radius - 10);
    const y1 = centerY + Math.sin(angle) * (radius - 10);
    const x2 = centerX + Math.cos(angle) * radius;
    const y2 = centerY + Math.sin(angle) * radius;

    ctx.beginPath();
    ctx.strokeStyle = `rgba(59, 130, 246, ${opacity})`;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 24px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('Reconnecting...', centerX, centerY + 60);

  ctx.font = '16px sans-serif';
  ctx.fillStyle = '#9ca3af';
  ctx.fillText('Please wait while we restore your stream', centerX, centerY + 90);
}

/**
 * Draw countdown overlay
 */
export function drawCountdown(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  value: number
): void {
  // Semi-transparent overlay
  ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
  ctx.fillRect(0, 0, width, height);

  // Large countdown number
  const centerX = width / 2;
  const centerY = height / 2;

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 200px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(value.toString(), centerX, centerY);

  // "Going Live" text
  ctx.font = 'bold 36px sans-serif';
  ctx.fillText('Going Live in...', centerX, centerY - 150);
}
