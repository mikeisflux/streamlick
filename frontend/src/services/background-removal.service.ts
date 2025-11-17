/**
 * AI-Powered Background Removal Service
 * Uses TensorFlow.js with BodyPix for real-time background segmentation
 */

// @ts-ignore - Will be installed
import * as bodyPix from '@tensorflow-models/body-pix';
// @ts-ignore
import '@tensorflow/tfjs-backend-webgl';

interface BackgroundOptions {
  type: 'none' | 'blur' | 'image' | 'color';
  blurAmount?: number;
  imageUrl?: string;
  color?: string;
  edgeSoftness?: number;
}

class BackgroundRemovalService {
  private model: any = null;
  private isLoading = false;
  private isProcessing = false;
  private videoElement: HTMLVideoElement | null = null;
  private canvasElement: HTMLCanvasElement | null = null;
  private outputStream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private backgroundOptions: BackgroundOptions = {
    type: 'none',
    blurAmount: 15,
    edgeSoftness: 0.3,
  };

  /**
   * Load the BodyPix model
   */
  async loadModel(): Promise<void> {
    if (this.model || this.isLoading) return;

    this.isLoading = true;
    console.log('Loading BodyPix model...');

    try {
      // Load BodyPix with optimized settings for real-time performance
      this.model = await bodyPix.load({
        architecture: 'MobileNetV1',
        outputStride: 16,
        multiplier: 0.75,
        quantBytes: 2,
      });

      console.log('BodyPix model loaded successfully');
    } catch (error) {
      console.error('Failed to load BodyPix model:', error);
      throw error;
    } finally {
      this.isLoading = false;
    }
  }

  /**
   * Start background removal on video stream
   */
  async start(
    stream: MediaStream,
    options: BackgroundOptions = { type: 'blur', blurAmount: 15 }
  ): Promise<MediaStream> {
    if (!this.model) {
      await this.loadModel();
    }

    this.backgroundOptions = options;

    // Create video element from stream
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = stream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    // Wait for video to be ready and have valid dimensions
    await new Promise((resolve, reject) => {
      let attempts = 0;
      const checkDimensions = () => {
        if (this.videoElement!.videoWidth > 0 && this.videoElement!.videoHeight > 0) {
          resolve(true);
        } else if (attempts < 100) {
          attempts++;
          setTimeout(checkDimensions, 50);
        } else {
          reject(new Error('Video dimensions not available'));
        }
      };

      this.videoElement!.onloadedmetadata = () => {
        // Give it a moment to ensure dimensions are set
        setTimeout(checkDimensions, 100);
      };

      // Start playing to trigger metadata load
      this.videoElement!.play().catch(console.error);
    });

    // Validate video dimensions
    const width = this.videoElement.videoWidth;
    const height = this.videoElement.videoHeight;

    if (width === 0 || height === 0) {
      throw new Error(`Invalid video dimensions: ${width}x${height}`);
    }

    console.log(`Initializing background removal with dimensions: ${width}x${height}`);

    // Create canvas for output
    this.canvasElement = document.createElement('canvas');
    this.canvasElement.width = width;
    this.canvasElement.height = height;

    // Start processing
    this.isProcessing = true;
    this.processFrame();

    // Create output stream from canvas
    this.outputStream = this.canvasElement.captureStream(30); // 30 FPS

    // Copy audio tracks from original stream
    const audioTracks = stream.getAudioTracks();
    audioTracks.forEach(track => {
      this.outputStream!.addTrack(track);
    });

    return this.outputStream;
  }

  /**
   * Stop background removal
   */
  stop(): void {
    this.isProcessing = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      // CRITICAL FIX: Remove event listeners
      this.videoElement.onloadedmetadata = null;
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    if (this.outputStream) {
      // CRITICAL FIX: Only stop the video track (canvas capture stream)
      // Don't stop audio tracks as they are references to the original stream
      const videoTracks = this.outputStream.getVideoTracks();
      videoTracks.forEach(track => track.stop());
      this.outputStream = null;
    }

    this.canvasElement = null;
  }

  /**
   * CRITICAL FIX: Cleanup all resources including ML model and cache
   * Call this when completely done with background removal (e.g., component unmount)
   */
  async cleanup(): Promise<void> {
    // Stop any active processing
    this.stop();

    // Clear background image cache
    this.backgroundImageCache.clear();

    // Dispose of TensorFlow model to free GPU/CPU memory
    if (this.model) {
      try {
        await this.model.dispose();
        console.log('BodyPix model disposed');
      } catch (error) {
        console.error('Error disposing BodyPix model:', error);
      }
      this.model = null;
    }

    this.isLoading = false;
  }

  /**
   * Process each video frame
   */
  private async processFrame(): Promise<void> {
    if (!this.isProcessing || !this.videoElement || !this.canvasElement) {
      return;
    }

    // Validate video element has valid dimensions
    if (this.videoElement.videoWidth === 0 || this.videoElement.videoHeight === 0) {
      console.warn('Video element has invalid dimensions, skipping frame');
      this.animationFrame = requestAnimationFrame(() => this.processFrame());
      return;
    }

    try {
      // Get canvas context
      const ctx = this.canvasElement.getContext('2d');
      if (!ctx) {
        console.error('Failed to get canvas context');
        return;
      }

      // Segment the person from the background
      const segmentation = await this.model.segmentPerson(this.videoElement, {
        flipHorizontal: false,
        internalResolution: 'medium',
        segmentationThreshold: 0.7,
      });

      // Double-check canvas still exists after async operation
      if (!this.canvasElement || !this.isProcessing) {
        return;
      }

      // Draw based on background type
      switch (this.backgroundOptions.type) {
        case 'blur':
          await this.drawBlurredBackground(ctx, segmentation);
          break;
        case 'image':
          await this.drawImageBackground(ctx, segmentation);
          break;
        case 'color':
          await this.drawColorBackground(ctx, segmentation);
          break;
        case 'none':
        default:
          // Just draw the original video
          if (this.videoElement) {
            ctx.drawImage(this.videoElement, 0, 0);
          }
          break;
      }
    } catch (error) {
      console.error('Frame processing error:', error);
    }

    // Schedule next frame only if still processing
    if (this.isProcessing) {
      this.animationFrame = requestAnimationFrame(() => this.processFrame());
    }
  }

  /**
   * Draw with blurred background
   */
  private async drawBlurredBackground(
    ctx: CanvasRenderingContext2D,
    segmentation: any
  ): Promise<void> {
    if (!this.canvasElement || !this.videoElement) return;

    const { width, height } = this.canvasElement;

    // Draw blurred background
    ctx.filter = `blur(${this.backgroundOptions.blurAmount}px)`;
    ctx.drawImage(this.videoElement, 0, 0, width, height);
    ctx.filter = 'none';

    // Draw person on top
    await this.drawSegmentedPerson(ctx, segmentation);
  }

  /**
   * Cache for loaded background images
   */
  private backgroundImageCache: Map<string, HTMLImageElement> = new Map();

  /**
   * Load background image
   */
  private async loadBackgroundImage(url: string): Promise<HTMLImageElement> {
    // Check cache first
    if (this.backgroundImageCache.has(url)) {
      return this.backgroundImageCache.get(url)!;
    }

    // Load new image
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        this.backgroundImageCache.set(url, img);
        resolve(img);
      };
      img.onerror = () => {
        reject(new Error(`Failed to load background image: ${url}`));
      };
      img.src = url;
    });
  }

  /**
   * Draw with image background
   */
  private async drawImageBackground(
    ctx: CanvasRenderingContext2D,
    segmentation: any
  ): Promise<void> {
    if (!this.canvasElement || !this.videoElement) return;

    const { width, height } = this.canvasElement;

    // Draw background image
    if (this.backgroundOptions.imageUrl) {
      try {
        const bgImage = await this.loadBackgroundImage(this.backgroundOptions.imageUrl);
        // Draw image to cover the entire canvas
        ctx.drawImage(bgImage, 0, 0, width, height);
      } catch (error) {
        console.error('Failed to draw background image:', error);
        // Fallback to solid color
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);
      }
    } else {
      // No image URL, use solid color as fallback
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, width, height);
    }

    // Draw person on top
    await this.drawSegmentedPerson(ctx, segmentation);
  }

  /**
   * Draw with solid color background
   */
  private async drawColorBackground(
    ctx: CanvasRenderingContext2D,
    segmentation: any
  ): Promise<void> {
    if (!this.canvasElement || !this.videoElement) return;

    const { width, height } = this.canvasElement;

    // Draw solid color background
    ctx.fillStyle = this.backgroundOptions.color || '#1a1a1a';
    ctx.fillRect(0, 0, width, height);

    // Draw person on top
    await this.drawSegmentedPerson(ctx, segmentation);
  }

  /**
   * Draw only the segmented person
   */
  private async drawSegmentedPerson(
    ctx: CanvasRenderingContext2D,
    segmentation: any
  ): Promise<void> {
    if (!this.canvasElement || !this.videoElement) return;

    const { width, height } = this.canvasElement;

    // Validate segmentation data
    if (!segmentation || !segmentation.data) {
      console.warn('Invalid segmentation data');
      return;
    }

    // Create temporary canvas for person
    const personCanvas = document.createElement('canvas');
    personCanvas.width = width;
    personCanvas.height = height;
    const personCtx = personCanvas.getContext('2d');

    if (!personCtx) {
      console.error('Failed to get person canvas context');
      return;
    }

    // Draw original video
    personCtx.drawImage(this.videoElement, 0, 0, width, height);

    // Get image data
    const imageData = personCtx.getImageData(0, 0, width, height);
    const data = imageData.data;

    // Apply mask with edge softness
    const edgeSoftness = this.backgroundOptions.edgeSoftness || 0.3;

    for (let i = 0; i < segmentation.data.length; i++) {
      const shouldKeep = segmentation.data[i];

      if (!shouldKeep) {
        // Make background transparent
        const pixelIndex = i * 4;
        data[pixelIndex + 3] = 0; // Alpha channel
      } else if (edgeSoftness > 0) {
        // Soften edges by reducing alpha near boundaries
        const neighbors = this.getNeighborMask(segmentation.data, i, width);
        const backgroundNeighbors = neighbors.filter(n => !n).length;

        if (backgroundNeighbors > 0) {
          const pixelIndex = i * 4;
          const alpha = 1 - (backgroundNeighbors / neighbors.length) * edgeSoftness;
          data[pixelIndex + 3] = Math.floor(data[pixelIndex + 3] * alpha);
        }
      }
    }

    personCtx.putImageData(imageData, 0, 0);

    // Draw person onto main canvas
    ctx.drawImage(personCanvas, 0, 0);
  }

  /**
   * Get neighboring mask values for edge softening
   */
  private getNeighborMask(
    mask: Uint8Array,
    index: number,
    width: number
  ): boolean[] {
    const neighbors: boolean[] = [];
    const x = index % width;
    const y = Math.floor(index / width);

    // Check 8 surrounding pixels
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;

        const nx = x + dx;
        const ny = y + dy;
        const nIndex = ny * width + nx;

        if (nIndex >= 0 && nIndex < mask.length) {
          neighbors.push(mask[nIndex] === 1);
        }
      }
    }

    return neighbors;
  }

  /**
   * Update background options on the fly
   */
  updateOptions(options: Partial<BackgroundOptions>): void {
    this.backgroundOptions = {
      ...this.backgroundOptions,
      ...options,
    };
  }

  /**
   * Check if model is loaded
   */
  isModelLoaded(): boolean {
    return this.model !== null;
  }

  /**
   * Check if currently processing
   */
  isActive(): boolean {
    return this.isProcessing;
  }

  /**
   * Get current background options
   */
  getOptions(): BackgroundOptions {
    return { ...this.backgroundOptions };
  }
}

export const backgroundRemovalService = new BackgroundRemovalService();
export type { BackgroundOptions };
