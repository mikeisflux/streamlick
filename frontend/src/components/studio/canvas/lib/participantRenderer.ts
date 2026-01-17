/**
 * Participant Renderer for StudioCanvas
 *
 * Handles rendering individual participants:
 * - Video frames
 * - Avatar placeholders
 * - Speaking rings/animations
 * - Name tags
 */

import { ParticipantPosition, RemoteParticipant } from './types';

export interface ParticipantRenderData {
  type: 'local' | 'remote';
  id: string;
  video?: HTMLVideoElement;
  participant?: RemoteParticipant;
  videoEnabled: boolean;
}

export interface RenderOptions {
  ctx: CanvasRenderingContext2D;
  position: ParticipantPosition;
  avatarImage?: HTMLImageElement | null;
  isSpeaking: boolean;
  now: number;
  showNameTag?: boolean;
  participantName?: string;
}

/**
 * Draw a participant on the canvas
 */
export function drawParticipant(
  participant: ParticipantRenderData,
  options: RenderOptions
): void {
  const { ctx, position, avatarImage, isSpeaking, now, showNameTag, participantName } = options;
  const { x: _x, y: _y, width: _width, height: _height } = position;

  // Draw video only when camera is enabled and video is ready
  if (participant.videoEnabled && participant.video && participant.video.readyState >= 2) {
    drawVideo(ctx, participant.video, position);
  } else if (!participant.videoEnabled && participant.type === 'local' && avatarImage) {
    // Draw avatar when camera is OFF (local user only)
    drawCameraOffWithAvatar(ctx, position, avatarImage);
  } else {
    // Placeholder - camera off without avatar, or video not ready
    drawPlaceholder(ctx, position);
  }

  // Draw pulsating ring when speaking AND camera is off
  if (isSpeaking && !participant.videoEnabled) {
    drawSpeakingRing(ctx, position, now);
  }

  // Draw name tag if enabled
  if (showNameTag && participantName) {
    drawNameTag(ctx, position, participantName, isSpeaking);
  }
}

/**
 * Draw video frame covering the position
 */
export function drawVideo(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  position: ParticipantPosition
): void {
  ctx.drawImage(video, position.x, position.y, position.width, position.height);
}

/**
 * Draw camera off state with avatar
 */
export function drawCameraOffWithAvatar(
  ctx: CanvasRenderingContext2D,
  position: ParticipantPosition,
  avatarImage: HTMLImageElement
): void {
  const { x, y, width, height } = position;

  // Draw dark background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(x, y, width, height);

  // Draw circular avatar in center
  const size = Math.min(width, height) * 0.5;
  const avatarX = x + (width - size) / 2;
  const avatarY = y + (height - size) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(avatarImage, avatarX, avatarY, size, size);
  ctx.restore();
}

/**
 * Draw placeholder for camera off without avatar
 */
export function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  position: ParticipantPosition
): void {
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(position.x, position.y, position.width, position.height);
}

/**
 * Draw pulsating speaking ring animation
 */
export function drawSpeakingRing(
  ctx: CanvasRenderingContext2D,
  position: ParticipantPosition,
  now: number
): void {
  const { x, y, width, height } = position;

  // Calculate center of participant box
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const baseRadius = Math.min(width, height) / 2;

  // Pulsating animation based on time
  const pulseSpeed = 0.003;
  const pulseAmount = Math.sin(now * pulseSpeed) * 0.1 + 0.9;
  const radius = baseRadius * pulseAmount;

  // Draw multiple rings for glow effect
  ctx.save();
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius + i * 8, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 - i * 0.2})`;
    ctx.lineWidth = 4 - i;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Draw participant name tag
 */
export function drawNameTag(
  ctx: CanvasRenderingContext2D,
  position: ParticipantPosition,
  name: string,
  isSpeaking: boolean = false
): void {
  const { x, y, width, height } = position;

  // Name tag at bottom of participant box
  const padding = 8;
  const fontSize = 14;
  ctx.font = `${fontSize}px Inter, sans-serif`;

  const textWidth = ctx.measureText(name).width;
  const tagWidth = textWidth + padding * 2;
  const tagHeight = fontSize + padding * 1.5;
  const tagX = x + (width - tagWidth) / 2;
  const tagY = y + height - tagHeight - 10;

  // Background with rounded corners
  ctx.fillStyle = isSpeaking ? 'rgba(0, 200, 0, 0.8)' : 'rgba(0, 0, 0, 0.7)';
  ctx.beginPath();
  const radius = 4;
  ctx.roundRect(tagX, tagY, tagWidth, tagHeight, radius);
  ctx.fill();

  // Text
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(name, tagX + tagWidth / 2, tagY + tagHeight / 2);
}

/**
 * Draw screen share content
 */
export function drawScreenShare(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement,
  position: ParticipantPosition
): void {
  if (video.readyState >= 2) {
    ctx.drawImage(video, position.x, position.y, position.width, position.height);
  } else {
    // Placeholder while loading
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(position.x, position.y, position.width, position.height);
    ctx.fillStyle = '#ffffff';
    ctx.font = '16px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Screen Share Loading...', position.x + position.width / 2, position.y + position.height / 2);
  }
}
