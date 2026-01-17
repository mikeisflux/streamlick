/**
 * Background Processor Service
 * Applies background effects to video streams: blur, green screen, virtual backgrounds
 */

import { BackgroundEffect } from '../components/BackgroundEffects';

class BackgroundProcessorService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private outputStream: MediaStream | null = null;
  private animationFrameId: number | null = null;
  private isProcessing = false;
  private currentEffect: BackgroundEffect = { type: 'none' };
  private sourceVideo: HTMLVideoElement | null = null;
  private virtualBackgroundImage: HTMLImageElement | null = null;

  private readonly WIDTH = 3840;
  private readonly HEIGHT = 2160;
  private readonly FPS = 30;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.WIDTH;
    this.canvas.height = this.HEIGHT;
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      willReadFrequently: true,
    });
  }

  /**
   * Start processing with background effect
   */
  async start(sourceStream: MediaStream, effect: BackgroundEffect): Promise<MediaStream | null> {
    if (this.isProcessing) {
      this.stop();
    }

    this.currentEffect = effect;

    // Create video element from source stream
    this.sourceVideo = document.createElement('video');
    this.sourceVideo.srcObject = sourceStream;
    this.sourceVideo.autoplay = true;
    this.sourceVideo.muted = true;

    await this.sourceVideo.play();

    // Load virtual background if needed
    if (effect.type === 'virtual' && effect.virtualBackground) {
      await this.loadVirtualBackground(effect.virtualBackground.url);
    }

    // Start processing loop
    this.isProcessing = true;
    this.outputStream = this.canvas!.captureStream(this.FPS);

    // Copy audio tracks from source
    const audioTracks = sourceStream.getAudioTracks();
    audioTracks.forEach(track => {
      this.outputStream!.addTrack(track);
    });

    this.processFrame();

    return this.outputStream;
  }

  /**
   * Update background effect
   */
  updateEffect(effect: BackgroundEffect): void {
    this.currentEffect = effect;

    // Load virtual background if needed
    if (effect.type === 'virtual' && effect.virtualBackground) {
      this.loadVirtualBackground(effect.virtualBackground.url);
    } else {
      this.virtualBackgroundImage = null;
    }
  }

  /**
   * Stop processing
   */
  stop(): void {
    this.isProcessing = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sourceVideo) {
      this.sourceVideo.pause();
      this.sourceVideo.srcObject = null;
      this.sourceVideo = null;
    }

    this.outputStream = null;
    this.virtualBackgroundImage = null;
  }

  /**
   * Get output stream
   */
  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  /**
   * Load virtual background image
   */
  private async loadVirtualBackground(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.virtualBackgroundImage = img;
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }

  /**
   * Main processing loop
   */
  private processFrame = (): void => {
    if (!this.isProcessing || !this.ctx || !this.sourceVideo) return;

    try {
      const effect = this.currentEffect;

      if (effect.type === 'none') {
        // No effect - pass through
        this.drawPassthrough();
      } else if (effect.type === 'blur') {
        // Background blur
        this.drawBlurred(effect.blurAmount || 10);
      } else if (effect.type === 'greenscreen') {
        // Green screen / chroma key
        this.drawChromaKey(effect.chromaKey!);
      } else if (effect.type === 'virtual') {
        // Virtual background
        this.drawVirtualBackground(effect.chromaKey);
      }
    } catch (error) {
      console.error('Background processing error:', error);
    }

    this.animationFrameId = requestAnimationFrame(this.processFrame);
  };

  /**
   * Draw passthrough (no effect)
   */
  private drawPassthrough(): void {
    if (!this.ctx || !this.sourceVideo) return;
    this.ctx.drawImage(this.sourceVideo, 0, 0, this.WIDTH, this.HEIGHT);
  }

  /**
   * Draw with background blur
   */
  private drawBlurred(blurAmount: number): void {
    if (!this.ctx || !this.sourceVideo) return;

    // Apply blur filter
    this.ctx.filter = `blur(${blurAmount}px)`;
    this.ctx.drawImage(this.sourceVideo, 0, 0, this.WIDTH, this.HEIGHT);

    // Reset filter
    this.ctx.filter = 'none';
  }

  /**
   * Draw with chroma key (green screen removal)
   */
  private drawChromaKey(chromaKey: { color: string; similarity: number; smoothness: number }): void {
    if (!this.ctx || !this.sourceVideo) return;

    // Draw video to canvas
    this.ctx.drawImage(this.sourceVideo, 0, 0, this.WIDTH, this.HEIGHT);

    // Get image data
    const imageData = this.ctx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
    const data = imageData.data;

    // Parse chroma key color
    const keyColor = this.hexToRgb(chromaKey.color);
    if (!keyColor) return;

    // Process each pixel
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      // Calculate color difference
      const diff = this.colorDifference(r, g, b, keyColor.r, keyColor.g, keyColor.b);

      // Remove pixels similar to key color
      if (diff < chromaKey.similarity) {
        // Calculate alpha based on smoothness
        const alpha = Math.max(0, Math.min(255, (diff / chromaKey.similarity) * 255 / chromaKey.smoothness));
        data[i + 3] = alpha; // Set alpha
      }
    }

    // Put modified image data back
    this.ctx.putImageData(imageData, 0, 0);
  }

  /**
   * Draw with virtual background
   */
  private drawVirtualBackground(chromaKey?: { color: string; similarity: number; smoothness: number }): void {
    if (!this.ctx || !this.sourceVideo) return;

    // Draw virtual background first
    if (this.virtualBackgroundImage) {
      this.ctx.drawImage(this.virtualBackgroundImage, 0, 0, this.WIDTH, this.HEIGHT);
    } else {
      // Default to black background if no image loaded
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);
    }

    // Create temporary canvas for foreground processing
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.WIDTH;
    tempCanvas.height = this.HEIGHT;
    const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true });

    if (!tempCtx) return;

    // Draw video
    tempCtx.drawImage(this.sourceVideo, 0, 0, this.WIDTH, this.HEIGHT);

    // Apply chroma key if specified
    if (chromaKey) {
      const imageData = tempCtx.getImageData(0, 0, this.WIDTH, this.HEIGHT);
      const data = imageData.data;

      const keyColor = this.hexToRgb(chromaKey.color);
      if (keyColor) {
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];

          const diff = this.colorDifference(r, g, b, keyColor.r, keyColor.g, keyColor.b);

          if (diff < chromaKey.similarity) {
            const alpha = Math.max(0, Math.min(255, (diff / chromaKey.similarity) * 255 / chromaKey.smoothness));
            data[i + 3] = alpha;
          }
        }

        tempCtx.putImageData(imageData, 0, 0);
      }
    }

    // Draw processed foreground on top of background
    this.ctx.drawImage(tempCanvas, 0, 0);
  }

  /**
   * Calculate color difference (Euclidean distance)
   */
  private colorDifference(r1: number, g1: number, b1: number, r2: number, g2: number, b2: number): number {
    const dr = r1 - r2;
    const dg = g1 - g2;
    const db = b1 - b2;
    return Math.sqrt(dr * dr + dg * dg + db * db) / 441.67; // Normalize to 0-1
  }

  /**
   * Convert hex color to RGB
   */
  private hexToRgb(hex: string): { r: number; g: number; b: number } | null {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16),
    } : null;
  }
}

// Export singleton instance
export const backgroundProcessorService = new BackgroundProcessorService();
