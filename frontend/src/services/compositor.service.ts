/**
 * Video Compositor Service
 *
 * Combines multiple participant video streams into a single composite video
 * using Canvas API. Supports:
 * - Multiple layouts (grid, spotlight, sidebar, picture-in-picture)
 * - Overlay graphics (logos, banners, lower thirds)
 * - Background images
 * - Recording and RTMP streaming
 */

import { audioMixerService } from './audio-mixer.service';
import type { PerformanceMetrics } from '../types';
import logger from '../utils/logger';

interface ParticipantStream {
  id: string;
  name: string;
  stream: MediaStream;
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface LayoutConfig {
  type: 'grid' | 'spotlight' | 'sidebar' | 'pip';
  layoutId?: number; // 1-8 for specific layout styles
  spotlightId?: string; // For spotlight layout
  positions?: Array<{ x: number; y: number; width: number; height: number }>;
}

interface OverlayAsset {
  id: string;
  type: 'logo' | 'banner' | 'background';
  url: string;
  position?: { x: number; y: number; width?: number; height?: number };
}

interface ChatMessage {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'x' | 'rumble';
  author: string;
  message: string;
  timestamp: Date;
}

interface LowerThird {
  id: string;
  name: string;
  title?: string;
  subtitle?: string;
  style?: 'modern' | 'classic' | 'minimal' | 'bold';
  position?: 'left' | 'center' | 'right';
}

class CompositorService {
  private canvas: HTMLCanvasElement | null = null;
  private ctx: CanvasRenderingContext2D | null = null;
  private outputStream: MediaStream | null = null;
  private videoElements: Map<string, HTMLVideoElement> = new Map();
  private participants: Map<string, ParticipantStream> = new Map();
  private overlays: OverlayAsset[] = [];
  private background: OverlayAsset | null = null;
  private layout: LayoutConfig = { type: 'grid' };
  private animationFrameId: number | null = null;
  private isCompositing = false;
  private chatMessages: ChatMessage[] = [];
  private showChat = false;
  private lowerThird: LowerThird | null = null;
  private mediaClipOverlay: HTMLVideoElement | HTMLImageElement | null = null;
  private countdownValue: number | null = null;

  // Image caching to prevent memory leaks from creating Images every frame
  private backgroundImage: HTMLImageElement | null = null;
  private overlayImages: Map<string, HTMLImageElement> = new Map();

  // Audio analyzers for voice visualization
  private audioAnalysers: Map<string, AnalyserNode> = new Map();
  private audioLevels: Map<string, number> = new Map(); // 0-1 normalized audio level
  private audioContexts: Map<string, AudioContext> = new Map(); // Track contexts for cleanup

  // Canvas dimensions - configurable via environment or defaults to 4K UHD (3840x2160)
  private readonly WIDTH = parseInt(import.meta.env.VITE_CANVAS_WIDTH || '3840');
  private readonly HEIGHT = parseInt(import.meta.env.VITE_CANVAS_HEIGHT || '2160');
  private readonly FPS = parseInt(import.meta.env.VITE_CANVAS_FPS || '30');

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private lastFpsReport = 0;
  private renderTimes: number[] = [];
  private droppedFrames = 0;
  private performanceCallback?: (metrics: PerformanceMetrics) => void;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.WIDTH;
    this.canvas.height = this.HEIGHT;
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });
  }

  /**
   * Initialize compositor with participants
   */
  async initialize(participants: ParticipantStream[]): Promise<void> {
    logger.info('Initializing compositor with', participants.length, 'participants');

    // Clear existing state
    this.stop();
    this.videoElements.clear();
    this.participants.clear();

    // Initialize audio mixer
    audioMixerService.initialize();

    // Create video elements and add audio for each participant
    for (const participant of participants) {
      await this.addParticipant(participant);

      // Add participant audio to mixer and create audio analyser for visualization
      if (participant.stream) {
        const audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
          const audioStream = new MediaStream([audioTrack]);
          if (participant.audioEnabled) {
            audioMixerService.addStream(participant.id, audioStream);
          }
          // Always create analyser for voice visualization (even if muted in mix)
          this.createAudioAnalyser(participant.id, audioStream);
        }
      }
    }

    // Start compositing
    this.start();
  }

  /**
   * Create an audio analyser for voice visualization (pulsating rings)
   */
  private createAudioAnalyser(participantId: string, audioStream: MediaStream): void {
    try {
      // Create a separate audio context for analysis (not the mixer context)
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();

      // Configure analyser for speech detection
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;

      // Connect source to analyser (don't connect to destination - just analyze)
      source.connect(analyser);

      // Store analyser and context
      this.audioAnalysers.set(participantId, analyser);
      this.audioContexts.set(participantId, audioContext);
      this.audioLevels.set(participantId, 0);

      logger.info(`Audio analyser created for participant ${participantId}`);
    } catch (error) {
      logger.error(`Failed to create audio analyser for ${participantId}:`, error);
    }
  }

  /**
   * Update audio levels for all participants (called every frame)
   */
  private updateAudioLevels(): void {
    this.audioAnalysers.forEach((analyser, participantId) => {
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      // Calculate average volume
      let sum = 0;
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i];
      }
      const average = sum / bufferLength;

      // Normalize to 0-1 range (0-255 → 0-1)
      const normalizedLevel = average / 255;

      // Store level for drawing
      this.audioLevels.set(participantId, normalizedLevel);
    });
  }

  /**
   * Add a participant to the composition
   */
  async addParticipant(participant: ParticipantStream): Promise<void> {
    logger.info('Adding participant to compositor:', participant.id);

    const video = document.createElement('video');
    video.autoplay = true;
    video.playsInline = true;
    video.muted = true; // Mute for composition (audio handled separately)

    // Check if stream has video tracks
    const hasVideoTracks = participant.stream && participant.stream.getVideoTracks().length > 0;

    // Set the stream source
    video.srcObject = participant.stream;

    // Only wait for metadata if video is enabled and has video tracks
    if (participant.videoEnabled && hasVideoTracks) {
      try {
        // Wait for video to be ready with 2 second timeout (reduced from 5s)
        await Promise.race([
          new Promise<void>((resolve) => {
            // If already loaded, resolve immediately
            if (video.readyState >= 1) {
              video.play().catch(err => logger.error('Failed to play video:', err));
              resolve();
              return;
            }
            video.onloadedmetadata = () => {
              video.play().catch(err => logger.error('Failed to play video:', err));
              resolve();
            };
          }),
          new Promise<void>((resolve) => setTimeout(() => {
            logger.warn(`Video metadata load timeout for participant ${participant.id} - continuing anyway`);
            // Try to play anyway
            video.play().catch(err => logger.error('Failed to play video after timeout:', err));
            resolve();
          }, 2000))
        ]);
      } catch (error) {
        logger.error(`Error loading video for participant ${participant.id}:`, error);
        // Continue anyway - don't fail the whole broadcast
      }
    } else {
      logger.info(`Skipping video metadata wait for participant ${participant.id} (videoEnabled: ${participant.videoEnabled}, hasVideoTracks: ${hasVideoTracks})`);
    }

    this.videoElements.set(participant.id, video);
    this.participants.set(participant.id, participant);
  }

  /**
   * Remove a participant from the composition
   */
  removeParticipant(participantId: string): void {
    logger.info('Removing participant from compositor:', participantId);

    const video = this.videoElements.get(participantId);
    if (video) {
      video.pause();
      video.srcObject = null;
      this.videoElements.delete(participantId);
    }

    // Clean up audio analyser
    const audioContext = this.audioContexts.get(participantId);
    if (audioContext && audioContext.state !== 'closed') {
      audioContext.close().catch(err => logger.error('Failed to close audio context:', err));
    }
    this.audioContexts.delete(participantId);
    this.audioAnalysers.delete(participantId);
    this.audioLevels.delete(participantId);

    this.participants.delete(participantId);
  }

  /**
   * Update layout configuration
   */
  setLayout(layout: LayoutConfig): void {
    logger.info('Updating compositor layout:', layout.type);
    this.layout = layout;
  }

  /**
   * Add overlay asset (logo, banner, etc.)
   */
  async addOverlay(overlay: OverlayAsset): Promise<void> {
    logger.info('Adding overlay:', overlay.type, overlay.id);

    if (overlay.type === 'background') {
      // Preload background image with 10 second timeout before setting overlay
      const img = new Image();
      img.crossOrigin = 'anonymous';

      try {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            img.onload = () => {
              // Clean up event listeners to prevent memory leaks
              img.onload = null;
              img.onerror = null;
              resolve();
            };
            img.onerror = () => {
              // Clean up event listeners
              img.onload = null;
              img.onerror = null;
              reject(new Error('Failed to load background image'));
            };
            img.src = overlay.url;
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error('Background image load timeout')), 10000)
          )
        ]);

        // Only set overlay and image if loading succeeded
        this.background = overlay;
        this.backgroundImage = img;
      } catch (error) {
        logger.error('Failed to load background image:', error);
        // Maintain consistent state - don't set overlay or image on error
        throw error;
      }
    } else {
      this.overlays.push(overlay);

      // Preload overlay image with 10 second timeout
      const img = new Image();
      img.crossOrigin = 'anonymous';

      try {
        await Promise.race([
          new Promise<void>((resolve, reject) => {
            img.onload = () => {
              // Clean up event listeners to prevent memory leaks
              img.onload = null;
              img.onerror = null;
              resolve();
            };
            img.onerror = () => {
              // Clean up event listeners
              img.onload = null;
              img.onerror = null;
              reject(new Error(`Failed to load overlay image: ${overlay.id}`));
            };
            img.src = overlay.url;
          }),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`Overlay image load timeout: ${overlay.id}`)), 10000)
          )
        ]);
        this.overlayImages.set(overlay.id, img);
      } catch (error) {
        logger.error(`Failed to load overlay image ${overlay.id}:`, error);
        // Remove from overlays array on failure
        this.overlays = this.overlays.filter((o) => o.id !== overlay.id);
        throw error;
      }
    }
  }

  /**
   * Remove overlay asset
   */
  removeOverlay(overlayId: string): void {
    this.overlays = this.overlays.filter((o) => o.id !== overlayId);

    // Clean up cached overlay image
    if (this.overlayImages.has(overlayId)) {
      this.overlayImages.delete(overlayId);
    }

    if (this.background?.id === overlayId) {
      this.background = null;
      this.backgroundImage = null;
    }
  }

  /**
   * Add chat message to compositor
   */
  addChatMessage(message: ChatMessage): void {
    this.chatMessages.push(message);

    // Keep only last 50 messages - use slice to avoid O(n) shift operation
    // Slice is more efficient as it creates a new array with correct references
    // rather than shifting all elements one position
    if (this.chatMessages.length > 50) {
      this.chatMessages = this.chatMessages.slice(-50);
    }
  }

  /**
   * Toggle chat display on composite video
   */
  setShowChat(show: boolean): void {
    this.showChat = show;
  }

  /**
   * Clear all chat messages
   */
  clearChatMessages(): void {
    this.chatMessages = [];
  }

  /**
   * Show lower third overlay
   */
  showLowerThird(lowerThird: LowerThird): void {
    this.lowerThird = lowerThird;
  }

  /**
   * Hide lower third overlay
   */
  hideLowerThird(): void {
    this.lowerThird = null;
  }

  /**
   * Get current lower third
   */
  getLowerThird(): LowerThird | null {
    return this.lowerThird;
  }

  /**
   * Set media clip overlay (video or image)
   */
  setMediaClipOverlay(element: HTMLVideoElement | HTMLImageElement): void {
    this.mediaClipOverlay = element;
  }

  /**
   * Clear media clip overlay
   */
  clearMediaClipOverlay(): void {
    this.mediaClipOverlay = null;
  }

  /**
   * Get current media clip overlay
   */
  getMediaClipOverlay(): HTMLVideoElement | HTMLImageElement | null {
    return this.mediaClipOverlay;
  }

  /**
   * Play intro video
   * @param videoUrl - URL of the intro video (defaults to StreamLick intro)
   * @param duration - Optional duration in seconds (defaults to video duration)
   * @returns Promise that resolves when video finishes
   */
  async playIntroVideo(videoUrl: string = '/backgrounds/videos/StreamLick.mp4', duration?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.muted = false; // Enable audio for intro video
      videoElement.autoplay = false;
      videoElement.preload = 'metadata'; // Load metadata first to get dimensions
      videoElement.crossOrigin = 'anonymous'; // Allow CORS for local files

      logger.info(`Loading intro video: ${videoUrl}`);

      // Emit event so visible UI can show intro video too
      window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: videoUrl, playing: true } }));

      // Wait for metadata (dimensions) to load first
      videoElement.addEventListener('loadedmetadata', () => {
        logger.info(`Intro video metadata loaded: ${videoUrl}, dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}, duration: ${videoElement.duration}s`);

        // Ensure video has valid dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
          logger.error('Intro video has invalid dimensions:', videoElement.videoWidth, videoElement.videoHeight);
          window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: null, playing: false } }));
          reject(new Error('Invalid video dimensions'));
          return;
        }

        // Set as media clip overlay BEFORE playing
        this.setMediaClipOverlay(videoElement);
        logger.info('Intro video set as media clip overlay');

        // Now wait for enough data to play
        const playWhenReady = () => {
          logger.info('Intro video ready to play, starting playback...');
          videoElement.play().catch((error) => {
            logger.error('Failed to play intro video:', error);
            this.clearMediaClipOverlay();
            window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: null, playing: false } }));
            reject(error);
          });
        };

        if (videoElement.readyState >= 3) {
          // HAVE_FUTURE_DATA or better - can play
          playWhenReady();
        } else {
          videoElement.addEventListener('canplay', playWhenReady, { once: true });
        }
      });

      // Clear overlay when video ends
      videoElement.addEventListener('ended', () => {
        logger.info('Intro video ended, clearing overlay');
        this.clearMediaClipOverlay();
        window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: null, playing: false } }));
        resolve();
      });

      // Handle errors
      videoElement.addEventListener('error', (event) => {
        const errorMsg = videoElement.error
          ? `Code: ${videoElement.error.code}, Message: ${videoElement.error.message}`
          : 'Unknown error';
        logger.error(`Intro video error: ${errorMsg}`, event);
        this.clearMediaClipOverlay();
        window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: null, playing: false } }));
        reject(new Error(`Video error: ${errorMsg}`));
      });

      // If duration is specified, stop video after that duration
      if (duration) {
        setTimeout(() => {
          logger.info(`Intro video duration limit reached (${duration}s), clearing overlay`);
          videoElement.pause();
          this.clearMediaClipOverlay();
          window.dispatchEvent(new CustomEvent('compositor-intro-video', { detail: { url: null, playing: false } }));
          resolve();
        }, duration * 1000);
      }
    });
  }

  /**
   * Start countdown timer
   * @param seconds - Number of seconds to countdown from
   * @returns Promise that resolves when countdown finishes
   */
  async startCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      logger.info(`Starting ${seconds}-second countdown on canvas`);
      this.countdownValue = seconds;

      // Emit event so visible UI can show countdown too
      window.dispatchEvent(new CustomEvent('compositor-countdown', { detail: { seconds: this.countdownValue } }));

      const intervalId = setInterval(() => {
        if (this.countdownValue === null || this.countdownValue <= 0) {
          clearInterval(intervalId);
          this.countdownValue = null;
          // Emit countdown complete event
          window.dispatchEvent(new CustomEvent('compositor-countdown', { detail: { seconds: null } }));
          logger.info('Countdown finished');
          resolve();
          return;
        }

        this.countdownValue--;
        // Emit tick event for visible UI
        window.dispatchEvent(new CustomEvent('compositor-countdown', { detail: { seconds: this.countdownValue } }));
        logger.debug(`Countdown: ${this.countdownValue}`);
      }, 1000);
    });
  }

  /**
   * Start compositing loop
   */
  start(): void {
    if (this.isCompositing) return;

    logger.info('Starting compositor');
    this.isCompositing = true;

    // Capture stream from canvas
    const frameRate = this.FPS;
    this.outputStream = this.canvas!.captureStream(frameRate);

    // Start animation loop
    this.animate();
  }

  /**
   * Stop compositing
   */
  stop(): void {
    logger.info('Stopping compositor');
    this.isCompositing = false;

    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.outputStream) {
      this.outputStream.getTracks().forEach((track) => track.stop());
      this.outputStream = null;
    }

    // CRITICAL FIX: Clean up video elements to prevent DOM memory leaks
    this.videoElements.forEach((video, participantId) => {
      // Stop video and clear srcObject
      video.pause();
      video.srcObject = null;
      video.load(); // Force cleanup
      // Remove from DOM if attached
      if (video.parentNode) {
        video.parentNode.removeChild(video);
      }
      logger.debug(`Cleaned up video element for participant ${participantId}`);
    });
    this.videoElements.clear();

    // Clean up cached images
    this.backgroundImage = null;
    this.overlayImages.clear();

    // Stop audio mixer
    audioMixerService.stop();
  }

  /**
   * Get the composite output stream (video + mixed audio)
   */
  getOutputStream(): MediaStream | null {
    if (!this.outputStream) {
      return null;
    }

    // Get mixed audio stream
    const mixedAudioStream = audioMixerService.getOutputStream();

    if (!mixedAudioStream) {
      // Return video-only stream if no audio
      return this.outputStream;
    }

    // Combine video from canvas with mixed audio
    const compositeStream = new MediaStream();

    // Add video track from canvas
    const videoTrack = this.outputStream.getVideoTracks()[0];
    if (videoTrack) {
      compositeStream.addTrack(videoTrack);
    }

    // Add mixed audio track
    const audioTrack = mixedAudioStream.getAudioTracks()[0];
    if (audioTrack) {
      compositeStream.addTrack(audioTrack);
    }

    return compositeStream;
  }

  /**
   * Get the canvas element for direct rendering (e.g., media clip overlays)
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Main animation loop
   */
  private animate = (): void => {
    if (!this.isCompositing || !this.ctx) return;

    const frameStartTime = performance.now();

    // Track frame timing
    if (this.lastFrameTime > 0) {
      const frameDelta = frameStartTime - this.lastFrameTime;
      const expectedFrameTime = 1000 / this.FPS;

      // Detect dropped frames (frame took longer than expected + 50% tolerance)
      if (frameDelta > expectedFrameTime * 1.5) {
        this.droppedFrames++;
      }
    }
    this.lastFrameTime = frameStartTime;

    try {
      // Clear canvas
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

      // Draw background if exists
      if (this.background) {
        this.drawBackground();
      }

      // Update audio levels for voice visualization
      this.updateAudioLevels();

      // Draw participants based on layout
      this.drawParticipants();

      // Draw overlays (logos, banners, lower thirds)
      this.drawOverlays();

      // Draw chat messages if enabled
      if (this.showChat) {
        this.drawChatMessages();
      }

      // Draw lower third if active
      if (this.lowerThird) {
        this.drawLowerThird();
      }

      // Draw media clip overlay if active (on top of everything)
      if (this.mediaClipOverlay) {
        this.drawMediaClipOverlay();
      }

      // Draw countdown if active (on top of everything else)
      if (this.countdownValue !== null) {
        this.drawCountdown();
      }
    } catch (error) {
      logger.error('Compositor animation error:', error);
    }

    // Track render time
    const renderTime = performance.now() - frameStartTime;
    this.renderTimes.push(renderTime);

    // Keep only last 100 render times for performance tracking
    // This provides a rolling window for FPS and render time calculations without unbounded memory growth
    if (this.renderTimes.length > 100) {
      this.renderTimes.shift();
    }

    this.frameCount++;

    // Report performance metrics every 5 seconds
    const now = Date.now();
    if (now - this.lastFpsReport >= 5000) {
      this.reportPerformanceMetrics();
      this.lastFpsReport = now;
    }

    // Continue loop
    this.animationFrameId = requestAnimationFrame(this.animate);
  };

  /**
   * Report performance metrics
   */
  private reportPerformanceMetrics(): void {
    if (this.renderTimes.length === 0) return;

    const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;
    const maxRenderTime = Math.max(...this.renderTimes);
    const minRenderTime = Math.min(...this.renderTimes);

    const metrics = {
      averageRenderTime: avgRenderTime.toFixed(2),
      maxRenderTime: maxRenderTime.toFixed(2),
      minRenderTime: minRenderTime.toFixed(2),
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount,
      dropRate: ((this.droppedFrames / this.frameCount) * 100).toFixed(2),
      participantCount: this.participants.size,
      overlayCount: this.overlays.length,
      chatMessagesCount: this.chatMessages.length,
    };

    // Call performance callback if set
    if (this.performanceCallback) {
      this.performanceCallback(metrics);
    }

    logger.performance('Compositor performance:', metrics);
  }

  /**
   * Set performance callback for external monitoring
   */
  setPerformanceCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.performanceCallback = callback;
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics | null {
    if (this.renderTimes.length === 0) return null;

    const avgRenderTime = this.renderTimes.reduce((a, b) => a + b, 0) / this.renderTimes.length;

    return {
      averageRenderTime: avgRenderTime.toFixed(2),
      droppedFrames: this.droppedFrames,
      totalFrames: this.frameCount,
      dropRate: ((this.droppedFrames / this.frameCount) * 100).toFixed(2),
      participantCount: this.participants.size,
    };
  }

  /**
   * Draw background image
   */
  private drawBackground(): void {
    if (!this.background || !this.ctx || !this.backgroundImage) return;

    // Use cached image - no new Image objects created every frame!
    // Draw stretched to fill canvas
    this.ctx.drawImage(this.backgroundImage, 0, 0, this.WIDTH, this.HEIGHT);
  }

  /**
   * Calculate layout positions based on layout ID (1-8)
   */
  private getLayoutPositions(layoutId: number, participantCount: number): Array<{ x: number; y: number; width: number; height: number }> {
    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const gap = 1; // 1% gap between elements

    switch (layoutId) {
      case 1: // Solo - One person centered (35% width, 40% height - 50% smaller than before)
        positions.push({ x: 32.5, y: 30, width: 35, height: 40 });
        for (let i = 1; i < participantCount; i++) {
          const thumbWidth = 12;
          const thumbX = 5 + (i - 1) * (thumbWidth + gap);
          positions.push({ x: thumbX, y: 85, width: thumbWidth, height: 12 });
        }
        break;

      case 2: // Cropped - 2x2 tight grid
        const crop2x2 = [
          { x: 1, y: 1, width: 48.5, height: 48.5 },
          { x: 50.5, y: 1, width: 48.5, height: 48.5 },
          { x: 1, y: 50.5, width: 48.5, height: 48.5 },
          { x: 50.5, y: 50.5, width: 48.5, height: 48.5 },
        ];
        for (let i = 0; i < Math.min(participantCount, 4); i++) {
          positions.push(crop2x2[i]);
        }
        break;

      case 3: // Group - Dynamic grid
        const cols = Math.ceil(Math.sqrt(participantCount));
        const rows = Math.ceil(participantCount / cols);
        const cellWidth = (100 - (cols + 1) * gap) / cols;
        const cellHeight = (100 - (rows + 1) * gap) / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: gap + col * (cellWidth + gap),
            y: gap + row * (cellHeight + gap),
            width: cellWidth,
            height: cellHeight,
          });
        }
        break;

      case 4: // Spotlight - Large main speaker with small boxes above
        positions.push({ x: 15, y: 25, width: 70, height: 70 });
        const topBoxWidth = 18;
        const topBoxHeight = 20;
        const startX = 10;
        for (let i = 1; i < Math.min(participantCount, 5); i++) {
          positions.push({
            x: startX + (i - 1) * (topBoxWidth + gap),
            y: 2,
            width: topBoxWidth,
            height: topBoxHeight,
          });
        }
        break;

      case 5: // News - Side-by-side (50/50)
        positions.push({ x: 1, y: 1, width: 48.5, height: 98 });
        positions.push({ x: 50.5, y: 1, width: 48.5, height: 98 });
        for (let i = 2; i < participantCount; i++) {
          const slotHeight = 98 / Math.ceil((participantCount - 1));
          positions[i] = {
            x: 50.5,
            y: 1 + (i - 1) * slotHeight,
            width: 48.5,
            height: slotHeight - gap,
          };
        }
        break;

      case 6: // Screen - Tiny participants at top
        const topParticipants = Math.min(participantCount, 4);
        const topWidthScreen = (100 - (topParticipants + 1) * gap) / topParticipants;
        for (let i = 0; i < topParticipants; i++) {
          positions.push({
            x: gap + i * (topWidthScreen + gap),
            y: 1,
            width: topWidthScreen,
            height: 18,
          });
        }
        break;

      case 7: // Picture-in-Picture
        positions.push({ x: 1, y: 1, width: 98, height: 98 });
        if (participantCount > 1) {
          positions.push({ x: 72, y: 70, width: 25, height: 27 });
        }
        for (let i = 2; i < participantCount; i++) {
          positions.push({
            x: 72,
            y: 70 - (i - 1) * 30,
            width: 25,
            height: 27,
          });
        }
        break;

      case 8: // Cinema - Ultra-wide letterbox
        const letterboxHeight = 56;
        const letterboxY = (100 - letterboxHeight) / 2;
        if (participantCount === 1) {
          positions.push({ x: 15, y: letterboxY + 5, width: 70, height: letterboxHeight - 10 });
        } else {
          const boxWidth = (100 - 3 * gap) / Math.min(participantCount, 3);
          for (let i = 0; i < Math.min(participantCount, 3); i++) {
            positions.push({
              x: gap + i * (boxWidth + gap),
              y: letterboxY,
              width: boxWidth,
              height: letterboxHeight,
            });
          }
        }
        break;

      default:
        // Fallback to grid
        const defCols = Math.ceil(Math.sqrt(participantCount));
        const defRows = Math.ceil(participantCount / defCols);
        const defCellWidth = (100 - (defCols + 1) * gap) / defCols;
        const defCellHeight = (100 - (defRows + 1) * gap) / defRows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % defCols;
          const row = Math.floor(i / defCols);
          positions.push({
            x: gap + col * (defCellWidth + gap),
            y: gap + row * (defCellHeight + gap),
            width: defCellWidth,
            height: defCellHeight,
          });
        }
    }

    return positions;
  }

  /**
   * Draw all participants based on current layout
   */
  private drawParticipants(): void {
    const participantArray = Array.from(this.participants.values());

    // If we have a specific layoutId, use the precise positioning
    if (this.layout.layoutId && this.layout.layoutId >= 1 && this.layout.layoutId <= 8) {
      this.drawLayoutById(participantArray, this.layout.layoutId);
      return;
    }

    // Fallback to legacy layout types
    switch (this.layout.type) {
      case 'grid':
        this.drawGridLayout(participantArray);
        break;
      case 'spotlight':
        this.drawSpotlightLayout(participantArray);
        break;
      case 'sidebar':
        this.drawSidebarLayout(participantArray);
        break;
      case 'pip':
        this.drawPipLayout(participantArray);
        break;
    }
  }

  /**
   * Draw layout using specific layout ID (1-8)
   */
  private drawLayoutById(participants: ParticipantStream[], layoutId: number): void {
    if (participants.length === 0 || !this.ctx) return;

    const positions = this.getLayoutPositions(layoutId, participants.length);

    participants.forEach((participant, index) => {
      const pos = positions[index];
      if (!pos) return;

      // Convert percentage to pixels
      const x = (pos.x / 100) * this.WIDTH;
      const y = (pos.y / 100) * this.HEIGHT;
      const width = (pos.width / 100) * this.WIDTH;
      const height = (pos.height / 100) * this.HEIGHT;

      this.drawParticipantVideo(participant.id, x, y, width, height);
      this.drawParticipantName(participant.name, x, y, width, height);
    });
  }

  /**
   * Draw grid layout
   */
  private drawGridLayout(participants: ParticipantStream[]): void {
    if (participants.length === 0 || !this.ctx) return;

    const count = participants.length;
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);

    const cellWidth = this.WIDTH / cols;
    const cellHeight = this.HEIGHT / rows;
    const padding = 10;

    participants.forEach((participant, index) => {
      const col = index % cols;
      const row = Math.floor(index / cols);

      const x = col * cellWidth + padding;
      const y = row * cellHeight + padding;
      const width = cellWidth - padding * 2;
      const height = cellHeight - padding * 2;

      this.drawParticipantVideo(participant.id, x, y, width, height);
      this.drawParticipantName(participant.name, x, y, width, height);
    });
  }

  /**
   * Draw spotlight layout (one large, others small)
   */
  private drawSpotlightLayout(participants: ParticipantStream[]): void {
    if (participants.length === 0 || !this.ctx) return;

    const spotlightId = this.layout.spotlightId || participants[0]?.id;
    const spotlight = participants.find((p) => p.id === spotlightId);
    const others = participants.filter((p) => p.id !== spotlightId);

    if (spotlight) {
      // Draw main participant (80% of width)
      const mainWidth = this.WIDTH * 0.8;
      const mainHeight = this.HEIGHT;
      this.drawParticipantVideo(spotlight.id, 0, 0, mainWidth, mainHeight);
      this.drawParticipantName(spotlight.name, 0, 0, mainWidth, mainHeight);
    }

    // Draw others in sidebar (20% width)
    const sidebarWidth = this.WIDTH * 0.2;
    const cellHeight = others.length > 0 ? this.HEIGHT / others.length : 0;
    const padding = 10;

    others.forEach((participant, index) => {
      const x = this.WIDTH - sidebarWidth + padding;
      const y = index * cellHeight + padding;
      const width = sidebarWidth - padding * 2;
      const height = cellHeight - padding * 2;

      this.drawParticipantVideo(participant.id, x, y, width, height);
      this.drawParticipantName(participant.name, x, y, width, height);
    });
  }

  /**
   * Draw sidebar layout
   */
  private drawSidebarLayout(participants: ParticipantStream[]): void {
    // Similar to spotlight but optimized for side-by-side
    this.drawSpotlightLayout(participants);
  }

  /**
   * Draw picture-in-picture layout
   */
  private drawPipLayout(participants: ParticipantStream[]): void {
    if (participants.length === 0 || !this.ctx) return;

    const main = participants[0];
    const pip = participants[1];

    // Draw main participant (full screen)
    this.drawParticipantVideo(main.id, 0, 0, this.WIDTH, this.HEIGHT);
    this.drawParticipantName(main.name, 0, 0, this.WIDTH, this.HEIGHT);

    // Draw PIP in corner (20% size)
    if (pip) {
      const pipWidth = this.WIDTH * 0.2;
      const pipHeight = this.HEIGHT * 0.2;
      const x = this.WIDTH - pipWidth - 20;
      const y = this.HEIGHT - pipHeight - 20;

      this.drawParticipantVideo(pip.id, x, y, pipWidth, pipHeight);
      this.drawParticipantName(pip.name, x, y, pipWidth, pipHeight);
    }
  }

  /**
   * Draw individual participant video
   */
  private drawParticipantVideo(
    participantId: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.ctx) return;

    const video = this.videoElements.get(participantId);
    const participant = this.participants.get(participantId);

    if (!video || !participant) return;

    // Draw black background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, width, height);

    // Draw video if enabled
    if (participant.videoEnabled && video.readyState >= 2) {
      // Calculate aspect ratio fit
      const videoAspect = video.videoWidth / video.videoHeight;
      const targetAspect = width / height;

      let drawWidth = width;
      let drawHeight = height;
      let drawX = x;
      let drawY = y;

      if (videoAspect > targetAspect) {
        // Video is wider
        drawHeight = width / videoAspect;
        drawY = y + (height - drawHeight) / 2;
      } else {
        // Video is taller
        drawWidth = height * videoAspect;
        drawX = x + (width - drawWidth) / 2;
      }

      this.ctx.drawImage(video, drawX, drawY, drawWidth, drawHeight);
    } else {
      // Video disabled - show placeholder with audio visualization
      this.ctx.fillStyle = '#333333';
      this.ctx.fillRect(x, y, width, height);

      // Get audio level for pulsating animation
      const audioLevel = this.audioLevels.get(participantId) || 0;
      const isSpeaking = audioLevel > 0.05; // Threshold for detecting speech

      // Draw pulsating rings when speaking
      if (isSpeaking && participant.audioEnabled) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        // Create pulsating effect using time-based animation
        const time = Date.now() / 1000;

        // Draw 3 concentric rings that pulse with audio
        for (let i = 0; i < 3; i++) {
          const ringDelay = i * 0.3; // Stagger the rings
          const ringPulse = Math.sin(time * 4 - ringDelay) * 0.5 + 0.5;
          const radius = baseRadius + (i * 20) + (ringPulse * audioLevel * 50);
          const alpha = (1 - i * 0.3) * audioLevel * 0.8;

          this.ctx.strokeStyle = `rgba(66, 153, 225, ${alpha})`; // Blue rings
          this.ctx.lineWidth = 4 + audioLevel * 8;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      // Draw camera off icon
      this.ctx.fillStyle = '#666666';
      this.ctx.font = `${Math.min(width, height) * 0.3}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📵', x + width / 2, y + height / 2);
    }

    // Draw border - audio-reactive when speaking
    const audioLevel = this.audioLevels.get(participantId) || 0;
    const isSpeaking = audioLevel > 0.05 && participant.audioEnabled;

    if (isSpeaking) {
      // Glowing border when speaking
      const glowIntensity = Math.min(audioLevel * 2, 1);
      this.ctx.strokeStyle = `rgba(66, 153, 225, ${0.5 + glowIntensity * 0.5})`; // Blue glow
      this.ctx.lineWidth = 4 + audioLevel * 8;
    } else {
      this.ctx.strokeStyle = '#444444';
      this.ctx.lineWidth = 2;
    }
    this.ctx.strokeRect(x, y, width, height);
  }

  /**
   * Draw participant name label
   */
  private drawParticipantName(
    name: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): void {
    if (!this.ctx) return;

    const fontSize = Math.max(12, Math.min(24, width * 0.05));
    const padding = 10;
    const labelHeight = fontSize + padding * 2;

    // Draw semi-transparent background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(x, y + height - labelHeight, width, labelHeight);

    // Draw name text
    this.ctx.fillStyle = '#ffffff';
    this.ctx.font = `${fontSize}px Arial`;
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'middle';
    this.ctx.fillText(name, x + padding, y + height - labelHeight / 2);
  }

  /**
   * Draw overlay graphics (logos, banners)
   */
  private drawOverlays(): void {
    if (!this.ctx) return;

    this.overlays.forEach((overlay) => {
      // Use cached image - no new Image objects created every frame!
      const img = this.overlayImages.get(overlay.id);
      if (!img) return; // Image not loaded yet

      const pos = overlay.position || { x: 0, y: 0 };
      const width = overlay.position?.width || img.width;
      const height = overlay.position?.height || img.height;

      this.ctx!.drawImage(img, pos.x, pos.y, width, height);
    });
  }

  /**
   * Draw chat messages on composite video
   * Shows the most recent 3 messages in the bottom-right corner
   */
  private drawChatMessages(): void {
    if (!this.ctx || this.chatMessages.length === 0) return;

    const maxMessages = 3;
    const recentMessages = this.chatMessages.slice(-maxMessages);

    const chatWidth = 400;
    const messageHeight = 80;
    const padding = 20;
    const gap = 10;

    const startX = this.WIDTH - chatWidth - padding;
    const startY = this.HEIGHT - (recentMessages.length * (messageHeight + gap)) - padding;

    recentMessages.forEach((msg, index) => {
      const y = startY + index * (messageHeight + gap);

      // Draw message background
      this.ctx!.fillStyle = 'rgba(17, 24, 39, 0.9)'; // gray-900 with opacity
      this.ctx!.fillRect(startX, y, chatWidth, messageHeight);

      // Draw platform indicator
      const platformColors: Record<string, string> = {
        youtube: '#FF0000',
        facebook: '#1877F2',
        twitch: '#9146FF',
        x: '#000000',
        rumble: '#85C742',
      };

      this.ctx!.fillStyle = platformColors[msg.platform] || '#666666';
      this.ctx!.fillRect(startX, y, 4, messageHeight);

      // Draw author name
      this.ctx!.fillStyle = '#FFFFFF';
      this.ctx!.font = 'bold 16px Arial';
      this.ctx!.textAlign = 'left';
      this.ctx!.textBaseline = 'top';

      const textX = startX + 15;
      const textY = y + 10;

      this.ctx!.fillText(msg.author, textX, textY);

      // Draw message (wrap text if needed)
      this.ctx!.fillStyle = '#E5E7EB'; // gray-200
      this.ctx!.font = '14px Arial';

      const maxWidth = chatWidth - 30;
      const words = msg.message.split(' ');
      let line = '';
      let lineY = textY + 25;

      for (let i = 0; i < words.length; i++) {
        const testLine = line + words[i] + ' ';
        const metrics = this.ctx!.measureText(testLine);

        if (metrics.width > maxWidth && i > 0) {
          this.ctx!.fillText(line, textX, lineY);
          line = words[i] + ' ';
          lineY += 20;
          if (lineY > y + messageHeight - 10) break; // Stop if out of space
        } else {
          line = testLine;
        }
      }
      this.ctx!.fillText(line, textX, lineY);
    });
  }

  /**
   * Draw lower third overlay
   * Shows name, title, and subtitle with styled background
   */
  private drawLowerThird(): void {
    if (!this.ctx || !this.lowerThird) return;

    const lt = this.lowerThird;
    const padding = 30;
    const innerPadding = 20;
    const maxWidth = 600;
    const minWidth = 400;

    // Calculate position
    let x = padding;
    if (lt.position === 'center') {
      x = (this.WIDTH - minWidth) / 2;
    } else if (lt.position === 'right') {
      x = this.WIDTH - maxWidth - padding;
    }

    const y = this.HEIGHT - 180;

    // Calculate text metrics for sizing
    this.ctx.font = 'bold 36px Arial';
    const nameWidth = Math.max(minWidth, Math.min(maxWidth, this.ctx.measureText(lt.name).width + innerPadding * 2));

    let totalHeight = 70;
    if (lt.title) totalHeight += 30;
    if (lt.subtitle) totalHeight += 25;

    // Draw based on style
    const style = lt.style || 'modern';

    if (style === 'modern') {
      // Gradient background
      const gradient = this.ctx.createLinearGradient(x, y, x + nameWidth, y);
      gradient.addColorStop(0, '#3B82F6');  // blue-500
      gradient.addColorStop(1, '#2563EB');  // blue-600
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, nameWidth, totalHeight);

      // Bottom accent line
      this.ctx.fillStyle = '#60A5FA'; // blue-400
      this.ctx.fillRect(x, y + totalHeight - 4, nameWidth, 4);
    } else if (style === 'classic') {
      // Solid dark background
      this.ctx.fillStyle = 'rgba(17, 24, 39, 0.95)'; // gray-900
      this.ctx.fillRect(x, y, nameWidth, totalHeight);

      // Gold accent line
      this.ctx.fillStyle = '#F59E0B'; // amber-500
      this.ctx.fillRect(x, y, nameWidth, 4);
    } else if (style === 'minimal') {
      // Translucent background with blur effect simulation
      this.ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
      this.ctx.fillRect(x, y, nameWidth, totalHeight);

      // Thin border
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      this.ctx.lineWidth = 1;
      this.ctx.strokeRect(x, y, nameWidth, totalHeight);
    } else if (style === 'bold') {
      // Bold red/orange gradient
      const gradient = this.ctx.createLinearGradient(x, y, x + nameWidth, y);
      gradient.addColorStop(0, '#DC2626');  // red-600
      gradient.addColorStop(1, '#EA580C');  // orange-600
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(x, y, nameWidth, totalHeight);
    }

    // Draw text content
    const textX = x + innerPadding;
    let textY = y + innerPadding;

    // Name
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = 'bold 36px Arial';
    this.ctx.textAlign = 'left';
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(lt.name, textX, textY);
    textY += 40;

    // Title
    if (lt.title) {
      this.ctx.fillStyle = style === 'minimal' ? '#FFFFFF' : '#E5E7EB'; // gray-200
      this.ctx.font = '600 24px Arial';
      this.ctx.fillText(lt.title, textX, textY);
      textY += 30;
    }

    // Subtitle
    if (lt.subtitle) {
      this.ctx.fillStyle = style === 'minimal' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(229, 231, 235, 0.8)';
      this.ctx.font = '20px Arial';
      this.ctx.fillText(lt.subtitle, textX, textY);
    }
  }

  /**
   * Draw media clip overlay (video or image)
   * Renders on top of everything else, centered on the canvas
   */
  private drawMediaClipOverlay(): void {
    if (!this.ctx || !this.mediaClipOverlay) return;

    const element = this.mediaClipOverlay;

    // Calculate dimensions to maintain aspect ratio
    let drawWidth = this.WIDTH;
    let drawHeight = this.HEIGHT;
    let drawX = 0;
    let drawY = 0;

    if (element instanceof HTMLVideoElement || element instanceof HTMLImageElement) {
      const videoWidth = element instanceof HTMLVideoElement ? element.videoWidth : element.naturalWidth;
      const videoHeight = element instanceof HTMLVideoElement ? element.videoHeight : element.naturalHeight;

      if (videoWidth && videoHeight) {
        const aspectRatio = videoWidth / videoHeight;
        const canvasAspectRatio = this.WIDTH / this.HEIGHT;

        if (aspectRatio > canvasAspectRatio) {
          // Video is wider than canvas
          drawWidth = this.WIDTH;
          drawHeight = this.WIDTH / aspectRatio;
          drawX = 0;
          drawY = (this.HEIGHT - drawHeight) / 2;
        } else {
          // Video is taller than canvas
          drawHeight = this.HEIGHT;
          drawWidth = this.HEIGHT * aspectRatio;
          drawX = (this.WIDTH - drawWidth) / 2;
          drawY = 0;
        }
      }

      // Draw the media clip
      this.ctx.drawImage(element, drawX, drawY, drawWidth, drawHeight);
    }
  }

  /**
   * Draw countdown timer
   * Renders large countdown number centered on canvas
   */
  private drawCountdown(): void {
    if (!this.ctx || this.countdownValue === null) return;

    // Semi-transparent black overlay
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    this.ctx.fillRect(0, 0, this.WIDTH, this.HEIGHT);

    // Draw countdown number
    const fontSize = Math.floor(this.HEIGHT / 4); // Large font size (25% of canvas height)
    this.ctx.font = `bold ${fontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // White text with black outline for visibility
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 20;
    this.ctx.strokeText(this.countdownValue.toString(), this.WIDTH / 2, this.HEIGHT / 2);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText(this.countdownValue.toString(), this.WIDTH / 2, this.HEIGHT / 2);

    // Draw "Going Live..." text below countdown
    const subFontSize = Math.floor(this.HEIGHT / 15);
    this.ctx.font = `${subFontSize}px Arial`;

    const subTextY = this.HEIGHT / 2 + fontSize / 2 + subFontSize + 40;

    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 10;
    this.ctx.strokeText('Going Live...', this.WIDTH / 2, subTextY);

    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillText('Going Live...', this.WIDTH / 2, subTextY);
  }
}

// Export singleton instance
export const compositorService = new CompositorService();
