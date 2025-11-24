/**
 * ⚠️ MANDATORY - KEEP IN SYNC WITH STUDIOCANVAS ⚠️
 *
 * Video Compositor Service - Canvas API output stream compositor
 *
 * Combines multiple participant video streams into a single composite video
 * using Canvas API. Supports:
 * - Multiple layouts (grid, spotlight, sidebar, picture-in-picture)
 * - Overlay graphics (logos, banners, lower thirds)
 * - Background images
 * - Recording and RTMP streaming
 * - Audio animations (pulsating rings for camera-off participants)
 *
 * MUST stay in sync with StudioCanvas.tsx (Browser preview HTML/CSS)
 * When making changes to:
 * - Layout logic (grid, spotlight, sidebar, pip)
 * - Participant positioning
 * - Audio animations (pulsating rings)
 * - Overlay rendering (backgrounds, logos, lower thirds)
 *
 * ALWAYS update BOTH compositor.service.ts AND StudioCanvas.tsx to maintain
 * visual consistency between output stream and preview!
 */

import { audioMixerService } from './audio-mixer.service';
import { webrtcService } from './webrtc.service';
import type { PerformanceMetrics } from '../types';
import logger from '../utils/logger';
import type { Caption } from './caption.service';

// CanvasCaptureMediaStreamTrack extends MediaStreamTrack with requestFrame() method
// This is returned by canvas.captureStream(0) for manual frame capture mode
interface CanvasCaptureMediaStreamTrack extends MediaStreamTrack {
  requestFrame(): void;
}

interface ParticipantStream {
  id: string;
  name: string;
  stream: MediaStream;
  isLocal: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
}

interface LayoutConfig {
  type: 'grid' | 'spotlight' | 'sidebar' | 'pip' | 'screenshare';
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
  private isBroadcasting = false; // Track if actively broadcasting to WebRTC
  private chatMessages: ChatMessage[] = [];
  private showChat = false;
  private lowerThird: LowerThird | null = null;
  private mediaClipOverlay: HTMLVideoElement | HTMLImageElement | null = null;
  private mediaClipOverlayHandlers: {
    ended?: () => void;
    error?: (event: Event) => void;
    canplaythrough?: () => void;
    loadedmetadata?: () => void;
  } = {};
  private countdownValue: number | null = null;

  // AI Captions
  private currentCaption: Caption | null = null;
  private captionPosition = { x: 50, y: 85 }; // x, y in percentage (matches CaptionOverlay)
  private captionSize = { width: 600, height: 80 }; // width, height in pixels

  // Image caching to prevent memory leaks from creating Images every frame
  private backgroundImage: HTMLImageElement | null = null;
  private overlayImages: Map<string, HTMLImageElement> = new Map();

  // Audio visualization for participants with camera off
  private audioAnalysers: Map<string, AnalyserNode> = new Map();
  private audioLevels: Map<string, number> = new Map(); // 0-1 normalized audio level

  // Video playback callbacks for auto-muting participants
  private onVideoStart?: () => void;
  private onVideoEnd?: () => void;

  // Canvas dimensions - configurable via environment or defaults to 1080p Full HD (1920x1080)
  private readonly WIDTH = parseInt(import.meta.env.VITE_CANVAS_WIDTH || '1920');
  private readonly HEIGHT = parseInt(import.meta.env.VITE_CANVAS_HEIGHT || '1080');
  private readonly FPS = parseInt(import.meta.env.VITE_CANVAS_FPS || '30');

  // Performance tracking
  private frameCount = 0;
  private lastFrameTime = 0;
  private lastRenderTime = 0; // For FPS throttling
  private lastFpsReport = 0;
  private renderTimes: number[] = [];
  private droppedFrames = 0;
  private performanceCallback?: (metrics: PerformanceMetrics) => void;

  // Pixel delta monitoring for frozen canvas detection
  private lastPixelSample: Uint8ClampedArray | null = null;
  private lastPixelSampleTime = 0;
  private pixelSampleInterval = 1000; // Check every 1 second
  private frozenFrameCount = 0;
  private readonly PIXEL_SAMPLE_SIZE = 100; // 100x100 pixel sample region
  private readonly MAX_FROZEN_FRAMES = 3; // Alert after 3 consecutive frozen samples

  // Tab visibility detection for aggressive anti-mute
  private isTabVisible = true;
  private visibilityChangeHandler = this.handleVisibilityChange.bind(this);

  // Failover overlay for stream reconnection
  private showReconnectingOverlay = false;
  private reconnectingOverlayStartTime = 0;

  // Backup timer for when tab is hidden (prevents stream muting)
  private backupTimerId: number | null = null;

  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.WIDTH;
    this.canvas.height = this.HEIGHT;
    this.ctx = this.canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    // Listen for media asset events (background, logo, overlay)
    this.setupMediaAssetListeners();
  }

  /**
   * Setup event listeners for media assets
   */
  private setupMediaAssetListeners(): void {
    // Background updates
    window.addEventListener('backgroundUpdated', ((e: CustomEvent) => {
      const { url } = e.detail;
      if (url) {
        logger.info('[Compositor] Background updated via event:', url);
        this.addOverlay({
          id: 'background',
          type: 'background',
          url,
          position: { x: 0, y: 0, width: this.WIDTH, height: this.HEIGHT },
        }).catch(err => logger.error('[Compositor] Failed to set background:', err));
      } else {
        logger.info('[Compositor] Background removed via event');
        this.removeOverlay('background');
      }
    }) as EventListener);

    // Logo updates
    window.addEventListener('logoUpdated', ((e: CustomEvent) => {
      const { url } = e.detail;
      if (url) {
        logger.info('[Compositor] Logo updated via event:', url);
        this.addOverlay({
          id: 'logo',
          type: 'logo',
          url,
          position: { x: 20, y: 20, width: 100, height: 100 },
        }).catch(err => logger.error('[Compositor] Failed to set logo:', err));
      } else {
        logger.info('[Compositor] Logo removed via event');
        this.removeOverlay('logo');
      }
    }) as EventListener);

    // Overlay updates
    window.addEventListener('overlayUpdated', ((e: CustomEvent) => {
      const { url } = e.detail;
      if (url) {
        logger.info('[Compositor] Overlay updated via event:', url);
        this.addOverlay({
          id: 'overlay',
          type: 'banner',
          url,
          position: { x: 0, y: 0, width: this.WIDTH, height: this.HEIGHT },
        }).catch(err => logger.error('[Compositor] Failed to set overlay:', err));
      } else {
        logger.info('[Compositor] Overlay removed via event');
        this.removeOverlay('overlay');
      }
    }) as EventListener);
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
      if (participant.audioEnabled && participant.stream) {
        const audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
          const audioStream = new MediaStream([audioTrack]);
          audioMixerService.addStream(participant.id, audioStream);

          // Create audio analyser for pulsating visualization when camera is off
          this.createAudioAnalyser(participant.id, audioStream);
        }
      }
    }

    // Start compositing
    this.start();
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

    // ⚠️ CRITICAL - DO NOT CHANGE: MediaStream readyState Polling Strategy ⚠️
    //
    // MediaStream sources (camera/microphone) do NOT fire 'loadeddata' events reliably.
    // Event-based waiting causes video.play() to never be called, breaking audio playback.
    //
    // MANDATORY: Use readyState polling (every 100ms) to detect when video data is ready.
    // This is the ONLY reliable way to ensure video.play() is called for MediaStream sources.
    //
    // Changing this back to event-based loading WILL BREAK AUDIO PLAYBACK.
    //
    if (participant.videoEnabled && hasVideoTracks) {
      try {
        // Poll the readyState until it reaches >= 2 (HAVE_CURRENT_DATA)
        const waitForVideoReady = new Promise<void>((resolve) => {
          // If already ready, play immediately
          if (video.readyState >= 2) {
            logger.info(`Video already ready for participant ${participant.id}, readyState: ${video.readyState}`);
            video.play().catch(err => logger.error('Failed to play video:', err));
            resolve();
            return;
          }

          // Poll readyState every 100ms until ready or timeout
          let attempts = 0;
          const maxAttempts = 30; // 3 seconds (30 * 100ms)

          const checkReadyState = () => {
            attempts++;

            if (video.readyState >= 2) {
              logger.info(`Video ready for participant ${participant.id} after ${attempts * 100}ms, readyState: ${video.readyState}`);
              video.play().catch(err => logger.error('Failed to play video:', err));
              resolve();
            } else if (attempts >= maxAttempts) {
              logger.warn(`Video readyState check timeout for participant ${participant.id} after ${attempts * 100}ms - readyState: ${video.readyState}`);
              // Try to play anyway
              video.play().catch(err => logger.error('Failed to play video after timeout:', err));
              resolve();
            } else {
              // Continue polling
              setTimeout(checkReadyState, 100);
            }
          };

          checkReadyState();
        });

        await waitForVideoReady;
      } catch (error) {
        logger.error(`Error loading video for participant ${participant.id}:`, error);
        // Continue anyway - don't fail the whole broadcast
      }
    } else {
      logger.info(`Skipping video data wait for participant ${participant.id} (videoEnabled: ${participant.videoEnabled}, hasVideoTracks: ${hasVideoTracks})`);
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
    const analyser = this.audioAnalysers.get(participantId);
    if (analyser) {
      analyser.disconnect();
      this.audioAnalysers.delete(participantId);
      this.audioLevels.delete(participantId);
    }

    this.participants.delete(participantId);
  }

  /**
   * Create audio analyser for visualizing participant audio levels
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

      // Store analyser
      this.audioAnalysers.set(participantId, analyser);
      this.audioLevels.set(participantId, 0);

      logger.info(`Audio analyser created for participant ${participantId}`);
    } catch (error) {
      logger.error(`Failed to create audio analyser for ${participantId}:`, error);
    }
  }

  /**
   * Update audio levels for all participants
   * Called every frame to detect speaking participants
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
   * Update layout configuration
   */
  setLayout(layout: LayoutConfig): void {
    logger.info('Updating compositor layout:', layout.type);
    this.layout = layout;
  }

  /**
   * Set input volume for all audio streams
   * @param volume Volume level (0-100)
   */
  setInputVolume(volume: number): void {
    // Convert from 0-100 to 0-1 range
    const normalizedVolume = Math.max(0, Math.min(100, volume)) / 100;
    logger.info(`Setting input volume to ${volume}% (${normalizedVolume.toFixed(2)})`);
    audioMixerService.setMasterVolume(normalizedVolume);
  }

  /**
   * Set broadcasting status (to control WebRTC track replacement)
   * @param isBroadcasting True if actively broadcasting to WebRTC
   */
  setBroadcasting(isBroadcasting: boolean): void {
    this.isBroadcasting = isBroadcasting;
    logger.info(`Compositor broadcasting status: ${isBroadcasting}`);
  }

  /**
   * Set callbacks for video playback events (for auto-muting participants)
   * @param onStart Called when a video starts playing
   * @param onEnd Called when a video ends
   */
  setVideoPlaybackCallbacks(onStart: () => void, onEnd: () => void): void {
    this.onVideoStart = onStart;
    this.onVideoEnd = onEnd;
    logger.info('Video playback callbacks registered');
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
   * Set current AI caption
   */
  setCaption(caption: Caption | null): void {
    this.currentCaption = caption;
  }

  /**
   * Get current caption
   */
  getCaption(): Caption | null {
    return this.currentCaption;
  }

  /**
   * Update caption position (percentage)
   */
  setCaptionPosition(x: number, y: number): void {
    this.captionPosition = { x, y };
  }

  /**
   * Update caption size (pixels)
   */
  setCaptionSize(width: number, height: number): void {
    this.captionSize = { width, height };
  }

  /**
   * Set media clip overlay (video or image)
   */
  setMediaClipOverlay(element: HTMLVideoElement | HTMLImageElement): void {
    this.mediaClipOverlay = element;
    const elementType = element instanceof HTMLVideoElement ? 'video' : 'image';
    const src = element instanceof HTMLVideoElement ? element.src : (element as HTMLImageElement).src;
    logger.info(`[Media Clip] Overlay set - ${elementType}: ${src.substring(src.lastIndexOf('/') + 1)}`);
  }

  /**
   * Clear media clip overlay
   */
  clearMediaClipOverlay(): void {
    const wasActive = this.mediaClipOverlay !== null;

    // CRITICAL FIX: Properly clean up video/image element before clearing reference
    if (this.mediaClipOverlay) {
      if (this.mediaClipOverlay instanceof HTMLVideoElement) {
        // CRITICAL FIX: Remove event listeners using removeEventListener (not property assignment)
        // Listeners were added with addEventListener, so they must be removed the same way
        if (this.mediaClipOverlayHandlers.ended) {
          this.mediaClipOverlay.removeEventListener('ended', this.mediaClipOverlayHandlers.ended);
        }
        if (this.mediaClipOverlayHandlers.error) {
          this.mediaClipOverlay.removeEventListener('error', this.mediaClipOverlayHandlers.error);
        }
        if (this.mediaClipOverlayHandlers.canplaythrough) {
          this.mediaClipOverlay.removeEventListener('canplaythrough', this.mediaClipOverlayHandlers.canplaythrough);
        }
        if (this.mediaClipOverlayHandlers.loadedmetadata) {
          this.mediaClipOverlay.removeEventListener('loadedmetadata', this.mediaClipOverlayHandlers.loadedmetadata);
        }

        // Clear handler references
        this.mediaClipOverlayHandlers = {};

        // Stop video playback
        this.mediaClipOverlay.pause();
        this.mediaClipOverlay.currentTime = 0;

        // Remove from DOM if attached (should not be, but check anyway)
        if (this.mediaClipOverlay.parentNode) {
          this.mediaClipOverlay.parentNode.removeChild(this.mediaClipOverlay);
        }

        // Clear video source to free resources (do this AFTER removing event listeners)
        this.mediaClipOverlay.src = '';
        this.mediaClipOverlay.load(); // Force cleanup

        logger.info('[Media Clip] Video element cleaned up and stopped');
      } else if (this.mediaClipOverlay instanceof HTMLImageElement) {
        // Clear image source
        this.mediaClipOverlay.src = '';

        // Remove from DOM if attached
        if (this.mediaClipOverlay.parentNode) {
          this.mediaClipOverlay.parentNode.removeChild(this.mediaClipOverlay);
        }

        logger.info('[Media Clip] Image element cleaned up');
      }
    }

    this.mediaClipOverlay = null;

    if (wasActive) {
      logger.info('[Media Clip] Overlay cleared - participants should now be visible');
      // The animate() loop is already running via requestAnimationFrame
      // The next frame will automatically render participants now that overlay is cleared
    }
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
      videoElement.muted = false; // Keep unmuted so audio can be captured by Web Audio API
      videoElement.volume = 1.0; // Set volume to 100% (CRITICAL for audio playback)
      videoElement.autoplay = false;
      videoElement.preload = 'auto'; // FIX FLICKERING: Preload entire video for smooth playback
      // Note: crossOrigin removed - not needed for same-origin video files and can cause issues

      logger.info(`Loading intro video: ${videoUrl}`);

      // CRITICAL FIX: Add timeout for video loading to prevent infinite hang
      const loadingTimeout = setTimeout(() => {
        logger.error(`[Media Clip] Video loading timeout after 10s: ${videoUrl}`);
        this.clearMediaClipOverlay();
        audioMixerService.removeStream('intro-video');
        reject(new Error('Video loading timeout'));
      }, 10000); // 10 second timeout

      // CRITICAL FIX: Store event handlers so they can be properly removed later
      const onLoadedMetadata = () => {
        // Clear loading timeout since metadata loaded successfully
        clearTimeout(loadingTimeout);
        logger.info(`Intro video metadata loaded: ${videoUrl}, dimensions: ${videoElement.videoWidth}x${videoElement.videoHeight}, duration: ${videoElement.duration}s`);

        // Ensure video has valid dimensions
        if (!videoElement.videoWidth || !videoElement.videoHeight) {
          logger.error('Intro video has invalid dimensions:', videoElement.videoWidth, videoElement.videoHeight);
          clearTimeout(loadingTimeout); // Clear loading timeout
          this.clearMediaClipOverlay();
          audioMixerService.removeStream('intro-video');
          reject(new Error('Invalid video dimensions'));
          return;
        }

        // CRITICAL FIX: Add intro video audio to the mixer BEFORE playing
        // This ensures the audio is captured and included in the output stream
        try {
          logger.info('Adding intro video audio to mixer...');
          audioMixerService.addMediaElement('intro-video', videoElement);
          logger.info('Intro video audio added to mixer successfully');
        } catch (error) {
          logger.error('Failed to add intro video audio to mixer:', error);
          // Continue anyway - video will play without audio in output stream
        }

        // FIX FLICKERING: Wait for video to have buffered data BEFORE setting as overlay
        // This prevents flickering caused by drawing frames before they're ready
        const setOverlayAndPlay = () => {
          logger.info('Intro video has enough buffered data, setting as overlay...');

          // Set as media clip overlay AFTER enough data is buffered
          this.setMediaClipOverlay(videoElement);
          logger.info('Intro video set as media clip overlay, starting playback...');

          // Notify that video is starting (for auto-muting participants)
          if (this.onVideoStart) {
            logger.info('[Auto-Mute] Calling onVideoStart callback');
            this.onVideoStart();
          }

          videoElement.play().catch((error) => {
            logger.error('Failed to play intro video:', error);
            clearTimeout(loadingTimeout); // Clear loading timeout
            this.clearMediaClipOverlay();
            // Clean up audio on error
            audioMixerService.removeStream('intro-video');
            reject(error);
          });
        };

        if (videoElement.readyState >= 3) {
          // HAVE_FUTURE_DATA or better - can play smoothly
          setOverlayAndPlay();
        } else {
          // Wait for enough buffered data before showing video
          const onCanPlayThrough = () => {
            setOverlayAndPlay();
          };
          this.mediaClipOverlayHandlers.canplaythrough = onCanPlayThrough;
          videoElement.addEventListener('canplaythrough', onCanPlayThrough, { once: true });
        }
      };

      const onEnded = () => {
        logger.info('Intro video ended, clearing overlay and removing audio from mixer');
        clearTimeout(loadingTimeout); // Clear loading timeout
        this.clearMediaClipOverlay();
        audioMixerService.removeStream('intro-video');

        // Notify that video has ended (for auto-unmuting participants)
        if (this.onVideoEnd) {
          logger.info('[Auto-Mute] Calling onVideoEnd callback');
          this.onVideoEnd();
        }

        resolve();
      };

      const onError = (event: Event) => {
        const errorMsg = videoElement.error
          ? `Code: ${videoElement.error.code}, Message: ${videoElement.error.message}`
          : 'Unknown error';
        logger.error(`Intro video error: ${errorMsg}`, event);
        clearTimeout(loadingTimeout); // Clear loading timeout
        this.clearMediaClipOverlay();
        audioMixerService.removeStream('intro-video');
        reject(new Error(`Video error: ${errorMsg}`));
      };

      // Store handlers for later removal
      this.mediaClipOverlayHandlers.loadedmetadata = onLoadedMetadata;
      this.mediaClipOverlayHandlers.ended = onEnded;
      this.mediaClipOverlayHandlers.error = onError;

      // Attach event listeners
      videoElement.addEventListener('loadedmetadata', onLoadedMetadata);
      videoElement.addEventListener('ended', onEnded);
      videoElement.addEventListener('error', onError);

      // If duration is specified, stop video after that duration
      if (duration) {
        setTimeout(() => {
          logger.info(`Intro video duration limit reached (${duration}s), clearing overlay and removing audio`);
          clearTimeout(loadingTimeout); // Clear loading timeout
          videoElement.pause();
          this.clearMediaClipOverlay();
          audioMixerService.removeStream('intro-video');

          // Notify that video has ended (for auto-unmuting participants)
          if (this.onVideoEnd) {
            logger.info('[Auto-Mute] Calling onVideoEnd callback (duration timeout)');
            this.onVideoEnd();
          }

          resolve();
        }, duration * 1000);
      }
    });
  }

  /**
   * Wait for compositor to be ready (first frame rendered)
   * Similar to waiting for video metadata before displaying
   * @returns Promise that resolves when compositor has rendered at least one frame
   */
  private async waitForCompositorReady(): Promise<void> {
    return new Promise((resolve, reject) => {
      // If not compositing, reject immediately
      if (!this.isCompositing) {
        reject(new Error('Compositor is not running'));
        return;
      }

      // If compositor already running and has rendered frames, resolve immediately
      if (this.frameCount > 0) {
        logger.info('[Compositor] Already ready, frameCount:', this.frameCount);
        resolve();
        return;
      }

      logger.info('[Compositor] Waiting for first frame to be rendered...');

      // Wait for first frame with timeout
      const startTime = Date.now();
      const checkInterval = setInterval(() => {
        if (this.frameCount > 0) {
          clearInterval(checkInterval);
          logger.info('[Compositor] First frame rendered, compositor ready');
          resolve();
        } else if (Date.now() - startTime > 5000) {
          clearInterval(checkInterval);
          logger.warn('[Compositor] Timeout waiting for first frame, proceeding anyway');
          resolve(); // Resolve anyway to prevent blocking
        }
      }, 50); // Check every 50ms
    });
  }

  /**
   * Start countdown timer
   * ANTI-MUTE: Uses timer.mp4 video with audio instead of canvas animation
   * Video files with audio are much less likely to be muted by browser
   * @param seconds - Number of seconds to countdown from (video duration may override)
   * @returns Promise that resolves when countdown finishes
   */
  async startCountdown(seconds: number): Promise<void> {
    // CRITICAL FIX: Ensure compositor is ready before starting countdown
    // This prevents the "black canvas" issue where countdown is set but not rendered
    try {
      await this.waitForCompositorReady();
    } catch (error) {
      logger.error('[Compositor] Failed to wait for compositor ready:', error);
      throw new Error('Compositor not ready for countdown');
    }

    // ANTI-MUTE: Play timer.mp4 video - ONLY METHOD, no fallback
    // Video with audio is MUCH better for preventing browser track muting
    // The video has both visual motion AND audio, making it impossible for browser to detect as "static"
    logger.info(`[Compositor] Starting countdown using timer.mp4 video (requested duration: ${seconds}s)`);
    await this.playIntroVideo('/backgrounds/timer.mp4', seconds);
    logger.info('[Compositor] Countdown video finished');
  }

  /**
   * Create a silent audio track to boost MediaStream priority
   * Browsers are less likely to suspend streams with audio present
   */
  private createSilentAudioTrack(): MediaStreamTrack {
    const ctx = new AudioContext();
    const oscillator = ctx.createOscillator();
    const dst = ctx.createMediaStreamDestination();
    oscillator.connect(dst);
    oscillator.start();
    return dst.stream.getAudioTracks()[0];
  }

  /**
   * Start compositing loop
   */
  start(): void {
    if (this.isCompositing) return;

    logger.info('Starting compositor');
    this.isCompositing = true;

    // ANTI-MUTE: Listen for tab visibility changes
    // When tab is hidden, browsers throttle canvas activity more aggressively
    document.addEventListener('visibilitychange', this.visibilityChangeHandler);
    this.isTabVisible = !document.hidden;
    logger.info(`[Tab Visibility] Initial state: ${this.isTabVisible ? 'visible' : 'hidden'}`);

    // Capture stream from canvas with AUTOMATIC frame capture at 30 fps
    // Using automatic mode instead of manual (0 fps) to prevent browser from muting track
    // Manual mode with requestFrame() was causing browser to detect "low activity" and mute the track
    this.outputStream = this.canvas!.captureStream(30);

    // Add silent audio track to boost stream priority in browser's scheduling engine
    // Even though composite stream has mixed audio, having audio on the raw canvas stream
    // signals to the browser that this is an active multimedia source
    const silentAudio = this.createSilentAudioTrack();
    this.outputStream.addTrack(silentAudio);

    // CRITICAL: Set contentHint to tell browser this is motion video content
    // This prevents browser optimization that auto-mutes "static" canvas tracks
    // https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/contentHint
    const videoTrack = this.outputStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.contentHint = 'motion';
      logger.info('[Canvas Track] Initial state:', {
        id: videoTrack.id,
        enabled: videoTrack.enabled,
        muted: videoTrack.muted,
        readyState: videoTrack.readyState,
        contentHint: videoTrack.contentHint,
      });

      // Monitor track ended event
      videoTrack.addEventListener('ended', () => {
        logger.error('[Canvas Track] Video track ENDED unexpectedly!', {
          id: videoTrack.id,
          readyState: videoTrack.readyState,
        });
      });

      // Monitor track muted event - CRITICAL FIX for browser auto-muting
      videoTrack.addEventListener('mute', async () => {
        logger.error('[Canvas Track] Video track MUTED! Recreating stream...', {
          id: videoTrack.id,
        });

        // FAILOVER: Show "Stream reconnecting..." overlay to viewers
        this.showReconnectingOverlay = true;
        this.reconnectingOverlayStartTime = Date.now();

        // Browser has auto-muted the track (usually due to "static" content detection)
        // We need to recreate the canvas stream to get an unmuted track
        try {
          // Stop old stream
          if (this.outputStream) {
            this.outputStream.getTracks().forEach(track => track.stop());
          }

          // Create new stream from canvas
          this.outputStream = this.canvas!.captureStream(30);

          // Add silent audio track to boost stream priority
          const silentAudio = this.createSilentAudioTrack();
          this.outputStream.addTrack(silentAudio);

          const newVideoTrack = this.outputStream.getVideoTracks()[0];

          // CRITICAL: Set contentHint on recreated track too
          if (newVideoTrack) {
            newVideoTrack.contentHint = 'motion';
          }

          logger.info('[Canvas Track] New stream created after mute', {
            oldTrackId: videoTrack.id,
            newTrackId: newVideoTrack.id,
            newTrackMuted: newVideoTrack.muted,
            newTrackState: newVideoTrack.readyState,
            contentHint: newVideoTrack.contentHint,
          });

          // Set up listeners on new track
          newVideoTrack.addEventListener('mute', () => {
            logger.error('[Canvas Track] New track also MUTED!', { id: newVideoTrack.id });
          });

          // Replace the track in the WebRTC producer (only if broadcasting)
          // This is CRITICAL when live - without this, the old muted track keeps sending to server
          if (this.isBroadcasting) {
            try {
              await webrtcService.replaceVideoTrack(newVideoTrack);
              logger.info('[Canvas Track] Successfully replaced track in WebRTC producer');

              // FAILOVER: Hide reconnecting overlay after successful recovery
              // Keep it visible for at least 2 seconds so viewers see the message
              const elapsed = Date.now() - this.reconnectingOverlayStartTime;
              if (elapsed < 2000) {
                setTimeout(() => {
                  this.showReconnectingOverlay = false;
                  logger.info('[Failover] Reconnecting overlay hidden after successful recovery');
                }, 2000 - elapsed);
              } else {
                this.showReconnectingOverlay = false;
                logger.info('[Failover] Reconnecting overlay hidden after successful recovery');
              }
            } catch (error) {
              logger.error('[Canvas Track] Failed to replace track in WebRTC producer:', error);
              // Keep overlay showing if track replacement failed
            }
          } else {
            // Not broadcasting - just hide the overlay
            logger.info('[Canvas Track] Not broadcasting, skipping WebRTC track replacement');
            this.showReconnectingOverlay = false;
          }
        } catch (error) {
          logger.error('[Canvas Track] Failed to recreate stream after mute:', error);
          // Keep overlay showing if stream recreation failed
        }
      });

      // Monitor track unmuted event
      videoTrack.addEventListener('unmute', () => {
        logger.info('[Canvas Track] Video track UNMUTED!', {
          id: videoTrack.id,
        });
      });
    }

    // Start animation loop
    this.animate();
  }

  /**
   * Stop compositing
   */
  stop(): void {
    logger.info('Stopping compositor');
    this.isCompositing = false;

    // ANTI-MUTE: Remove visibility change listener
    document.removeEventListener('visibilitychange', this.visibilityChangeHandler);

    // Clean up backup timer
    if (this.backupTimerId !== null) {
      window.clearInterval(this.backupTimerId);
      this.backupTimerId = null;
    }

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

    // NOTE: Do NOT clear overlay images here! Backgrounds/logos/overlays should
    // persist across compositor stop/start cycles (e.g., when going live/stopping).
    // Only clear them when explicitly removed via removeOverlay().
    // this.backgroundImage = null;
    // this.overlayImages.clear();

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
   * Main animation loop with FPS throttling
   */
  private animate = (): void => {
    if (!this.isCompositing) {
      logger.error('❌ Animation loop stopped: isCompositing = false');
      return;
    }

    if (!this.ctx) {
      logger.error('❌ Animation loop stopped: ctx is null');
      return;
    }

    // FPS throttling - only render if enough time has passed
    const now = performance.now();
    const elapsed = now - this.lastRenderTime;
    const targetFrameTime = 1000 / this.FPS; // 33.33ms for 30fps

    // If not enough time has passed, schedule next frame and skip rendering
    if (this.lastRenderTime > 0 && elapsed < targetFrameTime - 1) {
      this.animationFrameId = requestAnimationFrame(this.animate);
      return;
    }

    // Update render time, accounting for any drift
    this.lastRenderTime = now - (elapsed % targetFrameTime);

    const frameStartTime = now;

    // Track frame timing for performance metrics
    if (this.lastFrameTime > 0) {
      const frameDelta = frameStartTime - this.lastFrameTime;
      const expectedFrameTime = targetFrameTime;

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

      // CRITICAL FIX: Don't draw participants during countdown/intro to prevent flickering
      // The RGB anti-throttle pixel below is sufficient to keep track active
      const showingFullscreenOverlay = this.countdownValue !== null || this.mediaClipOverlay !== null;

      // DIAGNOSTIC LOGS DISABLED (too spammy)
      // if (this.frameCount % 30 === 0) {
      //   console.log('[Compositor] Render state:', {
      //     showingFullscreenOverlay,
      //     countdownValue: this.countdownValue,
      //     hasMediaClipOverlay: this.mediaClipOverlay !== null,
      //     participantCount: this.participants.size,
      //     videoElementCount: this.videoElements.size,
      //   });
      // }

      if (!showingFullscreenOverlay) {
        // Normal mode: Draw background, participants, and overlays
        if (this.background) {
          this.drawBackground();
        }

        // Update audio levels for pulsating avatar animations
        this.updateAudioLevels();

        this.drawParticipants();

        this.drawOverlays();

        // Draw chat messages if enabled
        if (this.showChat) {
          this.drawChatMessages();
        }

        // Draw lower third if active
        if (this.lowerThird) {
          this.drawLowerThird();
        }

        // Draw AI captions if active
        if (this.currentCaption) {
          this.drawCaptions();
        }
      } else {
        // Fullscreen overlay mode: Skip participants to prevent bleeding through
        // Draw intro video or countdown video (both use mediaClipOverlay) directly on black canvas
        if (this.mediaClipOverlay) {
          this.drawMediaClipOverlay();
        }
      }

      // ANTI-MUTE: Draw imperceptible noise to prevent browser from detecting static canvas
      // contentHint='motion' alone is NOT sufficient - browser still detects static canvas during countdown
      // CRITICAL FIX: Delta must be > 0.5 to avoid frozen detection
      // Drawing MANY pixels with higher alpha, distributed across canvas
      this.ctx!.save();

      // Log anti-mute execution every 60 frames to verify it's running
      if (this.frameCount % 60 === 0) {
        logger.info('[Anti-Mute] Drawing noise pixels:', {
          isTabVisible: this.isTabVisible,
          pixelCount: this.isTabVisible ? 200 : 300,
          alpha: this.isTabVisible ? 0.1 : 0.15,
          frameCount: this.frameCount,
        });
      }

      // CRITICAL FIX: Draw noise in the SAME region that frozen detection samples from (center 100x100)
      // Previous bug: noise was drawn randomly across entire canvas, so sample region missed it
      // This guarantees the frozen detection will see pixel changes
      const sampleX = Math.floor((this.WIDTH - this.PIXEL_SAMPLE_SIZE) / 2);
      const sampleY = Math.floor((this.HEIGHT - this.PIXEL_SAMPLE_SIZE) / 2);

      if (this.isTabVisible) {
        // Normal mode: Draw 50 noise pixels in sample region
        // Alpha 0.15 = 85% transparent, creates strong delta while still imperceptible
        this.ctx!.globalAlpha = 0.15;
        for (let i = 0; i < 50; i++) {
          this.ctx!.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
          this.ctx!.fillRect(
            sampleX + Math.random() * this.PIXEL_SAMPLE_SIZE,  // X within sample region
            sampleY + Math.random() * this.PIXEL_SAMPLE_SIZE,  // Y within sample region
            2,
            2
          );
        }
      } else {
        // AGGRESSIVE MODE: Tab is hidden, browser may throttle more aggressively
        // Draw 100 pixels with higher alpha in sample region
        this.ctx!.globalAlpha = 0.2;
        for (let i = 0; i < 100; i++) {
          this.ctx!.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
          this.ctx!.fillRect(
            sampleX + Math.random() * this.PIXEL_SAMPLE_SIZE,  // X within sample region
            sampleY + Math.random() * this.PIXEL_SAMPLE_SIZE,  // Y within sample region
            3,
            3
          );
        }
      }

      this.ctx!.restore();

      // FAILOVER: Draw reconnecting overlay on top of everything if track is being recovered
      if (this.showReconnectingOverlay) {
        this.drawReconnectingOverlay();
      }
    } catch (error) {
      logger.error('Compositor animation error:', error);
    }

    // DIAGNOSTIC: Monitor canvas track state periodically
    // Using automatic frame capture now (30 fps), so no manual requestFrame() needed
    if (this.outputStream) {
      const videoTrack = this.outputStream.getVideoTracks()[0];
      if (videoTrack) {
        // Log track state every 5 seconds (150 frames at 30fps)
        if (this.frameCount % 150 === 0) {
          logger.info('[Canvas Track] State check:', {
            frameCount: this.frameCount,
            enabled: videoTrack.enabled,
            muted: videoTrack.muted,
            readyState: videoTrack.readyState,
            trackId: videoTrack.id,
          });
        }
      }
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
    const metricsTime = Date.now();
    if (metricsTime - this.lastFpsReport >= 5000) {
      this.reportPerformanceMetrics();
      this.lastFpsReport = metricsTime;
    }

    // ANTI-MUTE: Check if canvas is actually frozen (pixel delta monitoring)
    this.checkCanvasFrozen();

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
   * ANTI-MUTE: Check if canvas is actually frozen by comparing pixel deltas
   * Even if requestAnimationFrame is running, the canvas content might be frozen
   * This detects that scenario and triggers alerts/recovery
   */
  private checkCanvasFrozen(): void {
    if (!this.ctx || !this.canvas) return;

    // Skip frozen detection when video/image overlay is playing
    // Video content (especially timer.mp4) may have low pixel delta but is NOT frozen
    if (this.mediaClipOverlay !== null) {
      // Reset frozen counter since we're skipping checks during video playback
      this.frozenFrameCount = 0;
      return;
    }

    const now = Date.now();
    if (now - this.lastPixelSampleTime < this.pixelSampleInterval) {
      return; // Not time to check yet
    }

    this.lastPixelSampleTime = now;

    try {
      // Sample a region from the center of the canvas
      const sampleX = Math.floor((this.WIDTH - this.PIXEL_SAMPLE_SIZE) / 2);
      const sampleY = Math.floor((this.HEIGHT - this.PIXEL_SAMPLE_SIZE) / 2);

      const imageData = this.ctx.getImageData(
        sampleX,
        sampleY,
        this.PIXEL_SAMPLE_SIZE,
        this.PIXEL_SAMPLE_SIZE
      );

      const currentSample = imageData.data;

      if (this.lastPixelSample !== null) {
        // Compare with previous sample
        let totalDelta = 0;
        for (let i = 0; i < currentSample.length; i++) {
          totalDelta += Math.abs(currentSample[i] - this.lastPixelSample[i]);
        }

        const avgDelta = totalDelta / currentSample.length;

        // Threshold: if average pixel change is less than 0.5 (out of 255), canvas is frozen
        // This accounts for the imperceptible noise pixel (0.01 alpha) which won't create much delta
        // But participant video with motion should create significant delta
        if (avgDelta < 0.5) {
          this.frozenFrameCount++;
          logger.warn(`[Canvas Frozen Detection] Canvas appears frozen! Delta: ${avgDelta.toFixed(3)}, consecutive frozen: ${this.frozenFrameCount}`);

          if (this.frozenFrameCount >= this.MAX_FROZEN_FRAMES) {
            logger.error(`[Canvas Frozen Detection] CRITICAL: Canvas frozen for ${this.frozenFrameCount} consecutive checks!`, {
              avgDelta,
              frameCount: this.frameCount,
              isCompositing: this.isCompositing,
              countdownActive: this.countdownValue !== null,
              mediaClipActive: this.mediaClipOverlay !== null,
            });

            // Could trigger track recreation here if needed
            // For now, just alert - the track mute listener will handle recreation
          }
        } else {
          // Canvas is changing - reset frozen counter
          if (this.frozenFrameCount > 0) {
            logger.info(`[Canvas Frozen Detection] Canvas motion detected, delta: ${avgDelta.toFixed(3)}, resetting frozen count`);
          }
          this.frozenFrameCount = 0;
        }
      }

      // Store current sample for next comparison
      this.lastPixelSample = new Uint8ClampedArray(currentSample);
    } catch (error) {
      logger.error('[Canvas Frozen Detection] Error checking canvas frozen state:', error);
    }
  }

  /**
   * ANTI-MUTE: Handle tab visibility changes
   * When tab is hidden, browsers are more aggressive about suspending canvas activity
   * We need more aggressive anti-mute measures when backgrounded
   */
  private handleVisibilityChange(): void {
    this.isTabVisible = !document.hidden;
    logger.info(`[Tab Visibility] Tab is now ${this.isTabVisible ? 'visible' : 'hidden'} - adjusting anti-mute strategy`);

    if (!this.isTabVisible && this.isCompositing) {
      // Tab is hidden - start backup timer to prevent stream muting
      // requestAnimationFrame gets throttled heavily when tab is hidden, so we need setInterval as backup
      logger.info('[Tab Visibility] Starting backup timer to prevent stream muting');
      this.backupTimerId = window.setInterval(() => {
        // Force a render even if requestAnimationFrame is throttled
        if (this.isCompositing && this.ctx) {
          try {
            // Just draw some noise to keep the stream active
            const sampleX = Math.floor((this.WIDTH - this.PIXEL_SAMPLE_SIZE) / 2);
            const sampleY = Math.floor((this.HEIGHT - this.PIXEL_SAMPLE_SIZE) / 2);

            this.ctx.save();
            this.ctx.globalAlpha = 0.2;
            for (let i = 0; i < 100; i++) {
              this.ctx.fillStyle = `rgb(${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)},${Math.floor(Math.random() * 255)})`;
              this.ctx.fillRect(
                sampleX + Math.random() * this.PIXEL_SAMPLE_SIZE,
                sampleY + Math.random() * this.PIXEL_SAMPLE_SIZE,
                3,
                3
              );
            }
            this.ctx.restore();
          } catch (error) {
            logger.error('[Backup Timer] Error rendering:', error);
          }
        }
      }, 1000 / this.FPS); // Run at target FPS
    } else if (this.isTabVisible && this.backupTimerId !== null) {
      // Tab is visible - stop backup timer, requestAnimationFrame will handle it
      logger.info('[Tab Visibility] Stopping backup timer');
      window.clearInterval(this.backupTimerId);
      this.backupTimerId = null;
    }
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
   * Draw all participants based on current layout
   */
  private drawParticipants(): void {
    const participantArray = Array.from(this.participants.values());

    // DIAGNOSTIC: Log participant state every 60 frames when we have participants
    if (this.frameCount % 60 === 0 && participantArray.length > 0) {
      console.log('[Compositor] Drawing participants:', {
        count: participantArray.length,
        layout: this.layout.type,
        participants: participantArray.map(p => ({
          id: p.id,
          name: p.name,
          videoEnabled: p.videoEnabled,
          hasVideoElement: this.videoElements.has(p.id),
        })),
      });
    }

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
      case 'screenshare':
        this.drawScreenShareLayout(participantArray);
        break;
    }
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
   * Draw screen share layout
   * Screen share takes 88% height at bottom, participants as thumbnails (12% height) at top
   */
  private drawScreenShareLayout(participants: ParticipantStream[]): void {
    if (participants.length === 0 || !this.ctx) return;

    // Find screen share participant
    const screenShare = participants.find(p => p.id === 'screen-share');
    const otherParticipants = participants.filter(p => p.id !== 'screen-share');

    const padding = 5;
    const thumbnailHeight = this.HEIGHT * 0.12; // 12% for thumbnails
    const screenHeight = this.HEIGHT * 0.88; // 88% for screen share
    const gap = 5;

    // Draw participant thumbnails at top (12% height)
    if (otherParticipants.length > 0) {
      const thumbnailWidth = (this.WIDTH - padding * 2 - gap * (otherParticipants.length - 1)) / otherParticipants.length;

      otherParticipants.forEach((participant, index) => {
        const x = padding + index * (thumbnailWidth + gap);
        const y = padding;
        const width = thumbnailWidth;
        const height = thumbnailHeight - padding * 2;

        this.drawParticipantVideo(participant.id, x, y, width, height);
        this.drawParticipantName(participant.name, x, y, width, height);
      });
    }

    // Draw screen share at bottom (88% height)
    if (screenShare) {
      const x = padding;
      const y = thumbnailHeight + gap;
      const width = this.WIDTH - padding * 2;
      const height = screenHeight - gap - padding;

      this.drawParticipantVideo(screenShare.id, x, y, width, height);
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

    if (!video || !participant) {
      // DIAGNOSTIC: Log missing video/participant every 60 frames
      if (this.frameCount % 60 === 0) {
        console.log('[Compositor] Cannot draw participant video:', {
          participantId,
          hasVideo: !!video,
          hasParticipant: !!participant,
        });
      }
      return;
    }

    // Draw black background
    this.ctx.fillStyle = '#1a1a1a';
    this.ctx.fillRect(x, y, width, height);

    // DIAGNOSTIC LOGS DISABLED (too spammy)
    // if (this.frameCount % 60 === 0) {
    //   console.log('[Compositor] Participant video state:', {
    //     participantId,
    //     videoEnabled: participant.videoEnabled,
    //     readyState: video.readyState,
    //     videoWidth: video.videoWidth,
    //     videoHeight: video.videoHeight,
    //     paused: video.paused,
    //     ended: video.ended,
    //     currentTime: video.currentTime,
    //     srcObject: !!video.srcObject,
    //     srcObjectActive: video.srcObject ? (video.srcObject as MediaStream).active : false,
    //     videoTracks: video.srcObject ? (video.srcObject as MediaStream).getVideoTracks().length : 0,
    //   });
    // }

    // CRITICAL FIX: Check if video is paused (not in diagnostic block anymore)
    if (this.frameCount % 60 === 0) {
      if (video.paused && video.srcObject) {
        console.warn('[Compositor] Video element is PAUSED! Forcing play...');
        video.play().catch(err => console.error('[Compositor] Failed to play paused video:', err));
      }
    }

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
      // DIAGNOSTIC: Log why video is not being drawn every 60 frames
      if (this.frameCount % 60 === 0) {
        console.log('[Compositor] Video not drawn - showing placeholder:', {
          participantId,
          videoEnabled: participant.videoEnabled,
          readyState: video.readyState,
          reason: !participant.videoEnabled ? 'video disabled' : 'readyState < 2',
        });
      }

      // Video disabled - show placeholder with audio visualization
      this.ctx.fillStyle = '#333333';
      this.ctx.fillRect(x, y, width, height);

      // Get audio level for pulsating animation
      const audioLevel = this.audioLevels.get(participantId) || 0;
      const isSpeaking = audioLevel > 0.05; // Threshold for detecting speech

      // DIAGNOSTIC: Log audio state every 30 frames
      if (this.frameCount % 30 === 0) {
        console.warn('🔊 AUDIO:', participantId, 'level:', audioLevel, 'speaking:', isSpeaking, 'analyzers:', this.audioAnalysers.size);
      }

      // Draw pulsating rings when speaking
      if (isSpeaking && participant.audioEnabled) {
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        // Create pulsating effect using time-based animation
        const time = Date.now() / 1000;
        const pulse = Math.sin(time * 4) * 0.5 + 0.5; // Pulsate at 4Hz (0-1)

        // Draw 3 concentric rings that pulse with audio
        for (let i = 0; i < 3; i++) {
          const ringDelay = i * 0.3; // Stagger the rings
          const ringPulse = Math.sin(time * 4 - ringDelay) * 0.5 + 0.5;
          const radius = baseRadius + (i * 20) + (ringPulse * audioLevel * 30);
          const alpha = (1 - i * 0.3) * audioLevel * 0.6;

          this.ctx.strokeStyle = `rgba(66, 153, 225, ${alpha})`; // Blue rings
          this.ctx.lineWidth = 3 + audioLevel * 5;
          this.ctx.beginPath();
          this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
          this.ctx.stroke();
        }
      }

      // Draw camera off icon
      this.ctx.fillStyle = isSpeaking ? '#88ccff' : '#666666'; // Brighten when speaking
      this.ctx.font = `${Math.min(width, height) * 0.3}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';
      this.ctx.fillText('📵', x + width / 2, y + height / 2);
    }

    // Draw border
    this.ctx.strokeStyle = '#444444';
    this.ctx.lineWidth = 2;
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
   * Draw AI captions on the output stream
   * Matches the styling from CaptionOverlay component in StudioCanvas
   */
  private drawCaptions(): void {
    if (!this.ctx || !this.currentCaption) return;

    const caption = this.currentCaption;

    // Convert percentage position to pixels
    const x = (this.captionPosition.x / 100) * this.WIDTH;
    const y = (this.captionPosition.y / 100) * this.HEIGHT;

    // Calculate actual position (centered)
    const boxX = x - this.captionSize.width / 2;
    const boxY = y - this.captionSize.height / 2;

    // Draw background box with rounded corners
    const bgOpacity = caption.isFinal ? 0.9 : 0.7;
    this.ctx.fillStyle = `rgba(0, 0, 0, ${bgOpacity})`;

    // Draw rounded rectangle for background
    const borderRadius = 12;
    this.ctx.beginPath();
    this.ctx.roundRect(boxX, boxY, this.captionSize.width, this.captionSize.height, borderRadius);
    this.ctx.fill();

    // Add subtle shadow effect
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    this.ctx.shadowBlur = 6;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 4;
    this.ctx.fill();

    // Reset shadow for text
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw caption text
    const fontSize = caption.isFinal ? 24 : 20;
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.font = `600 ${fontSize}px Arial`;
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    // Add text shadow for better readability
    this.ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    this.ctx.shadowBlur = 4;
    this.ctx.shadowOffsetX = 2;
    this.ctx.shadowOffsetY = 2;

    // Set opacity for interim results
    if (!caption.isFinal) {
      this.ctx.globalAlpha = 0.8;
    }

    // Wrap text if it exceeds the caption width
    const maxWidth = this.captionSize.width - 48; // Account for padding (24px each side)
    const words = caption.text.split(' ');
    let line = '';
    let lineY = y;
    const lineHeight = fontSize * 1.2;

    // Simple text wrapping
    const lines: string[] = [];
    for (const word of words) {
      const testLine = line + word + ' ';
      const metrics = this.ctx.measureText(testLine);

      if (metrics.width > maxWidth && line.length > 0) {
        lines.push(line.trim());
        line = word + ' ';
      } else {
        line = testLine;
      }
    }
    if (line.length > 0) {
      lines.push(line.trim());
    }

    // Draw lines centered vertically
    const totalHeight = lines.length * lineHeight;
    lineY = y - totalHeight / 2 + lineHeight / 2;

    for (const textLine of lines) {
      this.ctx.fillText(textLine, x, lineY);
      lineY += lineHeight;
    }

    // Reset alpha
    this.ctx.globalAlpha = 1.0;

    // Reset shadow
    this.ctx.shadowColor = 'transparent';
    this.ctx.shadowBlur = 0;
    this.ctx.shadowOffsetX = 0;
    this.ctx.shadowOffsetY = 0;

    // Draw pulsing indicator for interim results
    if (!caption.isFinal) {
      const time = Date.now() / 1000;
      const pulse = Math.sin(time * 3) * 0.5 + 0.5; // Pulse at 3Hz
      const dotRadius = 3;
      const dotSpacing = 8;
      const dotsY = boxY + this.captionSize.height - 15;
      const dotsX = x - (dotSpacing * 2); // Center 3 dots

      this.ctx.fillStyle = `rgba(96, 165, 250, ${0.6 + pulse * 0.4})`; // blue-400 with pulsing alpha

      // Draw 3 pulsing dots
      for (let i = 0; i < 3; i++) {
        const dotX = dotsX + i * dotSpacing;
        const delay = i * 0.2;
        const dotPulse = Math.sin(time * 3 - delay) * 0.5 + 0.5;

        this.ctx.beginPath();
        this.ctx.arc(dotX, dotsY, dotRadius * (0.8 + dotPulse * 0.2), 0, Math.PI * 2);
        this.ctx.fill();
      }
    }
  }

  /**
   * Draw media clip overlay (video or image)
   * Renders on top of everything else, centered on the canvas
   */
  private drawMediaClipOverlay(): void {
    if (!this.ctx || !this.mediaClipOverlay) return;

    const element = this.mediaClipOverlay;

    // CRITICAL FIX: Check if video is ready before attempting to draw
    if (element instanceof HTMLVideoElement) {
      // DIAGNOSTIC: Log video state every 30 frames to debug why it's not drawing
      if (this.frameCount % 30 === 0) {
        console.log('[Media Clip] Video state:', {
          readyState: element.readyState,
          videoWidth: element.videoWidth,
          videoHeight: element.videoHeight,
          paused: element.paused,
          ended: element.ended,
          currentTime: element.currentTime,
          duration: element.duration,
          src: element.src.substring(0, 50),
        });
      }

      // Video must have metadata loaded (readyState >= 2) to draw properly
      if (element.readyState < 2) {
        // Video metadata not loaded yet - skip drawing this frame
        logger.warn('[Media Clip] Skipping draw - readyState < 2:', element.readyState);
        return;
      }

      // Validate video dimensions are non-zero
      if (element.videoWidth === 0 || element.videoHeight === 0) {
        logger.warn('[Media Clip] Skipping draw - invalid dimensions:', {
          videoWidth: element.videoWidth,
          videoHeight: element.videoHeight,
          readyState: element.readyState,
        });
        return;
      }

      // Calculate dimensions to maintain aspect ratio - FILL ENTIRE CANVAS
      const videoAspect = element.videoWidth / element.videoHeight;
      const canvasAspect = this.WIDTH / this.HEIGHT;

      let drawWidth: number;
      let drawHeight: number;
      let drawX: number;
      let drawY: number;

      if (videoAspect > canvasAspect) {
        // Video is wider - fit to canvas width
        drawWidth = this.WIDTH;
        drawHeight = this.WIDTH / videoAspect;
        drawX = 0;
        drawY = (this.HEIGHT - drawHeight) / 2;
      } else {
        // Video is taller - fit to canvas height
        drawHeight = this.HEIGHT;
        drawWidth = this.HEIGHT * videoAspect;
        drawX = (this.WIDTH - drawWidth) / 2;
        drawY = 0;
      }

      // Draw the video fullscreen on canvas
      try {
        this.ctx.drawImage(element, drawX, drawY, drawWidth, drawHeight);
      } catch (error) {
        console.error('[Compositor] Failed to draw video to canvas:', error);
      }
    } else if (element instanceof HTMLImageElement) {
      // Handle image overlays
      if (!element.complete || element.naturalWidth === 0) {
        // Image not loaded yet
        return;
      }

      const imageAspect = element.naturalWidth / element.naturalHeight;
      const canvasAspect = this.WIDTH / this.HEIGHT;

      let drawWidth: number;
      let drawHeight: number;
      let drawX: number;
      let drawY: number;

      if (imageAspect > canvasAspect) {
        drawWidth = this.WIDTH;
        drawHeight = this.WIDTH / imageAspect;
        drawX = 0;
        drawY = (this.HEIGHT - drawHeight) / 2;
      } else {
        drawHeight = this.HEIGHT;
        drawWidth = this.HEIGHT * imageAspect;
        drawX = (this.WIDTH - drawWidth) / 2;
        drawY = 0;
      }

      try {
        this.ctx.drawImage(element, drawX, drawY, drawWidth, drawHeight);
      } catch (error) {
        console.error('[Compositor] Failed to draw image to canvas:', error);
      }
    }
  }

  /**
   * FAILOVER: Draw "Stream reconnecting..." overlay
   * Displayed when video track gets muted and is being recovered
   * Provides visual feedback to viewers that we're fixing the issue
   */
  private drawReconnectingOverlay(): void {
    if (!this.ctx) return;

    try {
      // Semi-transparent dark overlay at top of screen (doesn't block content completely)
      const bannerHeight = 100;
      const gradient = this.ctx.createLinearGradient(0, 0, 0, bannerHeight);
      gradient.addColorStop(0, 'rgba(220, 38, 38, 0.95)'); // red-600
      gradient.addColorStop(1, 'rgba(185, 28, 28, 0.95)'); // red-700
      this.ctx.fillStyle = gradient;
      this.ctx.fillRect(0, 0, this.WIDTH, bannerHeight);

      // Pulsing animation for urgency
      const time = Date.now() / 1000;
      const pulse = Math.sin(time * 3) * 0.5 + 0.5; // Fast pulse (3 Hz)
      const glowAlpha = 0.5 + pulse * 0.5;

      // Main message
      const fontSize = 48;
      this.ctx.font = `bold ${fontSize}px Arial`;
      this.ctx.textAlign = 'center';
      this.ctx.textBaseline = 'middle';

      // Pulsing glow
      this.ctx.shadowColor = `rgba(255, 255, 255, ${glowAlpha})`;
      this.ctx.shadowBlur = 30;
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.fillText('Stream Reconnecting...', this.WIDTH / 2, bannerHeight / 2);

      // Reset shadow
      this.ctx.shadowBlur = 0;
      this.ctx.shadowColor = 'transparent';
    } catch (error) {
      logger.error('[Failover] Error drawing reconnecting overlay:', error);
    }
  }
}

// Export singleton instance
export const compositorService = new CompositorService();
