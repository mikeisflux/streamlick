/**
 * Canvas Renderer Service
 *
 * Single source of truth for rendering the stream output.
 * Renders EVERYTHING to a canvas:
 * - Backgrounds
 * - Participants (video/avatar)
 * - Overlays (full-screen images)
 * - Logos
 * - Banners
 * - Chat
 * - Captions
 * - Teleprompter
 * - Lower thirds
 *
 * This canvas is:
 * 1. Displayed on screen (what user sees)
 * 2. Captured via captureStream() (what media server gets)
 *
 * ONE RENDERING PIPELINE - NO DUPLICATION
 */

import { audioMixerService } from './audio-mixer.service';
import logger from '../utils/logger';

interface Participant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  avatarUrl?: string;
  isLocal: boolean;
  role?: 'host' | 'guest' | 'backstage';
  isSpeaking?: boolean;
}

interface CanvasRendererConfig {
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  selectedLayout: number;
  orientation: 'landscape' | 'portrait';
}

interface Banner {
  id: string;
  type: 'lower-third' | 'text-overlay' | 'cta' | 'countdown';
  title: string;
  subtitle?: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  backgroundColor: string;
  textColor: string;
  visible: boolean;
}

interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

class CanvasRendererService {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private outputStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isRendering = false;

  // Configuration
  private config: CanvasRendererConfig;

  // Participants
  private participants: Map<string, Participant> = new Map();
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private avatarImages: Map<string, HTMLImageElement> = new Map();

  // Media assets
  private backgroundImage: HTMLImageElement | null = null;
  private logoImage: HTMLImageElement | null = null;
  private overlayImage: HTMLImageElement | null = null;

  // Overlays
  private banners: Banner[] = [];
  private chatMessages: ChatMessage[] = [];
  private showChat = false;

  // Performance
  private frameCount = 0;
  private lastFrameTime = 0;

  constructor(config: CanvasRendererConfig) {
    this.config = config;

    // Create canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = config.width;
    this.canvas.height = config.height;

    const ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      throw new Error('Failed to get 2D context');
    }

    this.ctx = ctx;

    logger.info('[CanvasRenderer] Initialized', {
      width: config.width,
      height: config.height,
      fps: config.fps,
    });
  }

  /**
   * Get the canvas element for display
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }

  /**
   * Get output stream for media server
   */
  getOutputStream(): MediaStream | null {
    if (!this.outputStream) {
      // Create stream from canvas
      this.outputStream = this.canvas.captureStream(this.config.fps);
      logger.info('[CanvasRenderer] Created output stream', {
        fps: this.config.fps,
        tracks: this.outputStream.getTracks().length,
      });
    }
    return this.outputStream;
  }

  /**
   * Start rendering loop
   */
  start(): void {
    if (this.isRendering) {
      logger.warn('[CanvasRenderer] Already rendering');
      return;
    }

    this.isRendering = true;
    this.render();
    logger.info('[CanvasRenderer] Started rendering');
  }

  /**
   * Stop rendering loop
   */
  stop(): void {
    this.isRendering = false;
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    logger.info('[CanvasRenderer] Stopped rendering');
  }

  /**
   * Main render loop
   */
  private render = (): void => {
    if (!this.isRendering) return;

    const now = performance.now();
    const elapsed = now - this.lastFrameTime;
    const targetFrameTime = 1000 / this.config.fps;

    // Throttle to target FPS
    if (elapsed >= targetFrameTime) {
      this.lastFrameTime = now - (elapsed % targetFrameTime);
      this.frameCount++;

      // Clear canvas
      this.ctx.fillStyle = this.config.backgroundColor;
      this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

      // Render background
      if (this.backgroundImage) {
        this.drawBackground();
      }

      // Render participants based on layout
      this.drawParticipants();

      // Render overlay (full-screen)
      if (this.overlayImage) {
        this.drawOverlay();
      }

      // Render logo
      if (this.logoImage) {
        this.drawLogo();
      }

      // Render banners
      this.drawBanners();

      // Render chat
      if (this.showChat) {
        this.drawChat();
      }

      // Log frame rate every 60 frames
      if (this.frameCount % 60 === 0) {
        const fps = 1000 / elapsed;
        console.log('[CanvasRenderer] FPS:', fps.toFixed(1));
      }
    }

    this.animationFrameId = requestAnimationFrame(this.render);
  };

  /**
   * Draw background image
   */
  private drawBackground(): void {
    if (!this.backgroundImage) return;
    this.ctx.drawImage(this.backgroundImage, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw participants based on layout
   */
  private drawParticipants(): void {
    const participantArray = Array.from(this.participants.values());

    // TODO: Implement layout rendering (grid, spotlight, etc.)
    // For now, just draw first participant
    if (participantArray.length > 0) {
      const participant = participantArray[0];
      this.drawParticipant(participant, 0, 0, this.canvas.width, this.canvas.height);
    }
  }

  /**
   * Draw a single participant
   */
  private drawParticipant(participant: Participant, x: number, y: number, width: number, height: number): void {
    const video = this.videoElements.get(participant.id);

    if (participant.videoEnabled && video && video.readyState >= 2) {
      // Draw video
      this.ctx.drawImage(video, x, y, width, height);
    } else {
      // Draw avatar or placeholder
      const avatar = this.avatarImages.get(participant.id);
      if (avatar && avatar.complete) {
        // Draw circular avatar
        const size = Math.min(width, height) * 0.5;
        const centerX = x + width / 2;
        const centerY = y + height / 2;

        this.ctx.save();
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
        this.ctx.closePath();
        this.ctx.clip();
        this.ctx.drawImage(avatar, centerX - size / 2, centerY - size / 2, size, size);
        this.ctx.restore();
      } else {
        // Placeholder
        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(x, y, width, height);
      }
    }
  }

  /**
   * Draw full-screen overlay
   */
  private drawOverlay(): void {
    if (!this.overlayImage) return;
    this.ctx.drawImage(this.overlayImage, 0, 0, this.canvas.width, this.canvas.height);
  }

  /**
   * Draw logo
   */
  private drawLogo(): void {
    if (!this.logoImage) return;
    // Logo in top-left corner
    const logoSize = 150;
    this.ctx.drawImage(this.logoImage, 20, 20, logoSize, logoSize);
  }

  /**
   * Draw banners
   */
  private drawBanners(): void {
    // TODO: Implement banner rendering
  }

  /**
   * Draw chat
   */
  private drawChat(): void {
    // TODO: Implement chat rendering
  }

  /**
   * Add participant
   */
  addParticipant(participant: Participant): void {
    this.participants.set(participant.id, participant);

    // Create video element if stream exists
    if (participant.stream) {
      const video = document.createElement('video');
      video.srcObject = participant.stream;
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.play().catch(err => logger.error('[CanvasRenderer] Failed to play video:', err));
      this.videoElements.set(participant.id, video);
    }

    // Load avatar if provided
    if (participant.avatarUrl) {
      this.loadAvatar(participant.id, participant.avatarUrl);
    }

    logger.info('[CanvasRenderer] Added participant:', participant.id);
  }

  /**
   * Remove participant
   */
  removeParticipant(participantId: string): void {
    this.participants.delete(participantId);

    const video = this.videoElements.get(participantId);
    if (video) {
      video.srcObject = null;
      this.videoElements.delete(participantId);
    }

    this.avatarImages.delete(participantId);
    logger.info('[CanvasRenderer] Removed participant:', participantId);
  }

  /**
   * Load avatar image
   */
  private loadAvatar(participantId: string, avatarUrl: string): void {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      this.avatarImages.set(participantId, img);
      logger.info('[CanvasRenderer] Avatar loaded:', participantId);
    };
    img.onerror = (err) => {
      logger.error('[CanvasRenderer] Failed to load avatar:', participantId, err);
    };
    img.src = avatarUrl;
  }

  /**
   * Set background image
   */
  async setBackground(url: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        this.backgroundImage = img;
        logger.info('[CanvasRenderer] Background loaded');
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Set logo image
   */
  async setLogo(url: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        this.logoImage = img;
        logger.info('[CanvasRenderer] Logo loaded');
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Set overlay image (full-screen)
   */
  async setOverlay(url: string): Promise<void> {
    const img = new Image();
    img.crossOrigin = 'anonymous';

    return new Promise((resolve, reject) => {
      img.onload = () => {
        this.overlayImage = img;
        logger.info('[CanvasRenderer] Overlay loaded');
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<CanvasRendererConfig>): void {
    this.config = { ...this.config, ...config };
    logger.info('[CanvasRenderer] Config updated:', config);
  }
}

// Export singleton instance
export const canvasRendererService = new CanvasRendererService({
  width: 1920,
  height: 1080,
  fps: 30,
  backgroundColor: '#0F1419',
  selectedLayout: 1,
  orientation: 'landscape',
});
