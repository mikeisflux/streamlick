/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS SERVICE CREATES VERTICAL VIDEO OUTPUT FROM THE STUDIOCANVAS.
 * ANY CHANGE TO CROPPING, POSITIONING, OR OUTPUT PROCESSING MUST BE VERIFIED
 * TO WORK CORRECTLY WITH THE HIDDEN CANVAS IN StudioCanvas.tsx (drawToCanvas function)
 * OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The output must accurately represent what is displayed in the React preview.
 *
 * ---
 * Vertical Video Compositor Service
 *
 * Creates 9:16 vertical video from 16:9 horizontal source.
 * Auto-crops to keep speaker centered for TikTok/Instagram Reels.
 */

interface VerticalCompositorConfig {
  inputWidth: number;
  inputHeight: number;
  outputWidth: number;  // e.g., 1080
  outputHeight: number; // e.g., 1920
  cropMode: 'center' | 'smart' | 'follow-face';
  smoothing: number; // 0-1, how smoothly to pan (0 = instant, 1 = very smooth)
}

interface CropPosition {
  x: number;
  y: number;
  width: number;
  height: number;
}

class VerticalCompositorService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private videoElement: HTMLVideoElement | null = null;
  private outputStream: MediaStream | null = null;
  private animationFrame: number | null = null;
  private isActive: boolean = false;

  private config: VerticalCompositorConfig = {
    inputWidth: 1920,
    inputHeight: 1080,
    outputWidth: 1080,
    outputHeight: 1920,
    cropMode: 'center',
    smoothing: 0.15,
  };

  // Current crop position (for smooth transitions)
  private currentCrop: CropPosition = {
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
  };

  // Target crop position (where we want to be)
  private targetCrop: CropPosition = {
    x: 0,
    y: 0,
    width: 1080,
    height: 1920,
  };

  /**
   * Start vertical video composition
   */
  async start(
    inputStream: MediaStream,
    config?: Partial<VerticalCompositorConfig>
  ): Promise<MediaStream> {
    if (this.isActive) {
      throw new Error('Vertical compositor already active');
    }

    // Merge config
    this.config = { ...this.config, ...config };

    // Create video element from input stream
    this.videoElement = document.createElement('video');
    this.videoElement.srcObject = inputStream;
    this.videoElement.autoplay = true;
    this.videoElement.playsInline = true;
    this.videoElement.muted = true;

    // Wait for video metadata
    await new Promise((resolve) => {
      this.videoElement!.onloadedmetadata = () => {
        // Update config with actual video dimensions
        this.config.inputWidth = this.videoElement!.videoWidth;
        this.config.inputHeight = this.videoElement!.videoHeight;
        resolve(null);
      };
    });

    // Create canvas for vertical output
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.config.outputWidth;
    this.canvas.height = this.config.outputHeight;
    this.ctx = this.canvas.getContext('2d')!;

    // Initialize crop positions
    this.initializeCropPosition();

    // Start rendering loop
    this.isActive = true;
    this.renderFrame();

    // Create output stream from canvas
    this.outputStream = this.canvas.captureStream(30); // 30 FPS

    // Copy audio from input stream
    const audioTracks = inputStream.getAudioTracks();
    audioTracks.forEach((track) => {
      this.outputStream!.addTrack(track);
    });

    console.log('📱 Vertical video compositor started (9:16 format)');
    return this.outputStream;
  }

  /**
   * Stop vertical video composition
   */
  stop(): void {
    this.isActive = false;

    if (this.animationFrame) {
      cancelAnimationFrame(this.animationFrame);
      this.animationFrame = null;
    }

    if (this.videoElement) {
      this.videoElement.pause();
      this.videoElement.srcObject = null;
      this.videoElement = null;
    }

    if (this.outputStream) {
      this.outputStream.getTracks().forEach((track) => {
        if (track.kind === 'video') {
          track.stop();
        }
      });
      this.outputStream = null;
    }

    this.canvas = null;
    this.ctx = null;

    console.log('📱 Vertical video compositor stopped');
  }

  /**
   * Initialize crop position based on mode
   */
  private initializeCropPosition(): void {
    const { inputWidth, inputHeight, outputWidth, outputHeight, cropMode } = this.config;

    // Calculate crop dimensions (9:16 aspect ratio from 16:9 source)
    // We want to crop a 9:16 rectangle from the center of 16:9
    const aspectRatio = 9 / 16;
    const cropWidth = Math.min(inputWidth, inputHeight * aspectRatio);
    const cropHeight = cropWidth / aspectRatio;

    // Center crop by default
    const cropX = (inputWidth - cropWidth) / 2;
    const cropY = (inputHeight - cropHeight) / 2;

    this.currentCrop = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };
    this.targetCrop = { ...this.currentCrop };
  }

  /**
   * Render each frame
   */
  private renderFrame(): void {
    if (!this.isActive || !this.videoElement || !this.canvas || !this.ctx) {
      return;
    }

    try {
      // Update target crop position based on mode
      this.updateTargetCrop();

      // Smooth transition to target crop
      this.smoothCropTransition();

      // Clear canvas
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Draw cropped video
      this.ctx.drawImage(
        this.videoElement,
        this.currentCrop.x,
        this.currentCrop.y,
        this.currentCrop.width,
        this.currentCrop.height,
        0,
        0,
        this.config.outputWidth,
        this.config.outputHeight
      );

      // Optional: Add debug overlay
      if (this.config.cropMode !== 'center') {
        this.drawDebugOverlay();
      }
    } catch (error) {
      console.error('Vertical compositor render error:', error);
    }

    // Schedule next frame
    this.animationFrame = requestAnimationFrame(() => this.renderFrame());
  }

  /**
   * Update target crop position based on crop mode
   */
  private updateTargetCrop(): void {
    const { inputWidth, inputHeight, cropMode } = this.config;

    switch (cropMode) {
      case 'center':
        // Already initialized to center, no updates needed
        break;

      case 'smart':
        // Smart crop: detect motion/activity and follow it
        this.updateSmartCrop();
        break;

      case 'follow-face':
        // Face detection crop (requires additional library)
        // For now, fallback to center
        break;
    }
  }

  /**
   * Smart crop: detect areas of activity and follow them
   */
  private updateSmartCrop(): void {
    // Simple implementation: analyze video for motion
    // In production, this would use computer vision to detect:
    // 1. Face position
    // 2. Motion areas
    // 3. Speaker location

    // For now, implement a simple left-right pan based on center of mass
    // This is a placeholder for more sophisticated detection

    const { inputWidth, inputHeight } = this.config;
    const aspectRatio = 9 / 16;
    const cropWidth = Math.min(inputWidth, inputHeight * aspectRatio);
    const cropHeight = cropWidth / aspectRatio;

    // Example: Slowly pan left-right (for demo purposes)
    // In production, replace with actual face/motion detection
    const time = Date.now() / 1000;
    const panAmount = Math.sin(time * 0.5) * 0.2; // -0.2 to 0.2

    const maxPanX = inputWidth - cropWidth;
    const centerX = maxPanX / 2;
    const targetX = centerX + (panAmount * maxPanX);

    this.targetCrop.x = Math.max(0, Math.min(maxPanX, targetX));
    this.targetCrop.y = (inputHeight - cropHeight) / 2;
    this.targetCrop.width = cropWidth;
    this.targetCrop.height = cropHeight;
  }

  /**
   * Smooth transition between current and target crop
   */
  private smoothCropTransition(): void {
    const smoothing = this.config.smoothing;

    // Lerp (linear interpolation) between current and target
    this.currentCrop.x += (this.targetCrop.x - this.currentCrop.x) * smoothing;
    this.currentCrop.y += (this.targetCrop.y - this.currentCrop.y) * smoothing;
    this.currentCrop.width += (this.targetCrop.width - this.currentCrop.width) * smoothing;
    this.currentCrop.height += (this.targetCrop.height - this.currentCrop.height) * smoothing;
  }

  /**
   * Draw debug overlay showing crop area
   */
  private drawDebugOverlay(): void {
    if (!this.ctx) return;

    // Draw crop indicator in corner
    const indicatorSize = 100;
    const margin = 10;

    this.ctx.save();
    this.ctx.strokeStyle = '#00ff00';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(margin, margin, indicatorSize, indicatorSize);

    // Draw text
    this.ctx.fillStyle = '#00ff00';
    this.ctx.font = '12px monospace';
    this.ctx.fillText(
      `Crop: ${Math.round(this.currentCrop.x)}, ${Math.round(this.currentCrop.y)}`,
      margin,
      margin + indicatorSize + 15
    );
    this.ctx.restore();
  }

  /**
   * Update crop mode on the fly
   */
  updateCropMode(mode: 'center' | 'smart' | 'follow-face'): void {
    this.config.cropMode = mode;
    console.log(`📱 Vertical crop mode changed to: ${mode}`);
  }

  /**
   * Update smoothing factor
   */
  updateSmoothing(smoothing: number): void {
    this.config.smoothing = Math.max(0, Math.min(1, smoothing));
  }

  /**
   * Get current output stream
   */
  getOutputStream(): MediaStream | null {
    return this.outputStream;
  }

  /**
   * Check if compositor is active
   */
  active(): boolean {
    return this.isActive;
  }

  /**
   * Get output dimensions
   */
  getOutputDimensions(): { width: number; height: number } {
    return {
      width: this.config.outputWidth,
      height: this.config.outputHeight,
    };
  }

  /**
   * Set output resolution (common vertical formats)
   */
  setOutputResolution(preset: '1080x1920' | '720x1280' | '540x960'): void {
    const resolutions = {
      '1080x1920': { width: 1080, height: 1920 },
      '720x1280': { width: 720, height: 1280 },
      '540x960': { width: 540, height: 960 },
    };

    const resolution = resolutions[preset];
    if (resolution && this.canvas) {
      this.config.outputWidth = resolution.width;
      this.config.outputHeight = resolution.height;
      this.canvas.width = resolution.width;
      this.canvas.height = resolution.height;
      console.log(`📱 Vertical resolution set to ${preset}`);
    }
  }
}

export const verticalCompositorService = new VerticalCompositorService();
export type { VerticalCompositorConfig, CropPosition };
