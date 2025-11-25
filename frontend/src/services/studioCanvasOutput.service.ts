/**
 * Studio Canvas Output Service
 *
 * Simple service that exposes the captured stream from StudioCanvas.
 * The StudioCanvas component registers its canvas here, and other parts
 * of the app can get the output stream for broadcasting/recording.
 */

import { audioMixerService } from './audio-mixer.service';
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
  layoutId?: number;
  spotlightId?: string;
}

class StudioCanvasOutputService {
  private canvas: HTMLCanvasElement | null = null;
  private outputStream: MediaStream | null = null;
  private isCapturing = false;
  private audioTrackAdded = false; // Track if audio has been added to output stream

  // Layout state (stored for reference by other components)
  private currentLayout: LayoutConfig = { type: 'grid', layoutId: 3 };

  // Participants (for audio mixing)
  private participants: Map<string, ParticipantStream> = new Map();

  // Media clip overlay element (video or image playing over canvas)
  private mediaClipOverlay: HTMLVideoElement | HTMLImageElement | null = null;

  // Countdown state
  private countdownValue: number | null = null;

  // Intro video state
  private introVideoElement: HTMLVideoElement | null = null;

  // Chat state
  private showChat = false;

  // Canvas dimensions from environment or defaults
  private readonly WIDTH = parseInt(import.meta.env.VITE_CANVAS_WIDTH || '1920');
  private readonly HEIGHT = parseInt(import.meta.env.VITE_CANVAS_HEIGHT || '1080');
  private readonly FPS = parseInt(import.meta.env.VITE_CANVAS_FPS || '30');

  /**
   * Register a canvas element from StudioCanvas component
   */
  registerCanvas(canvas: HTMLCanvasElement): void {
    logger.info('[StudioCanvasOutput] Registering canvas');
    this.canvas = canvas;
  }

  /**
   * Unregister the canvas (when component unmounts)
   */
  unregisterCanvas(): void {
    logger.info('[StudioCanvasOutput] Unregistering canvas');
    this.stop();
    this.canvas = null;
  }

  /**
   * Get the registered canvas element
   */
  getCanvas(): HTMLCanvasElement | null {
    return this.canvas;
  }

  /**
   * Initialize the output with participants (starts capturing)
   */
  async initialize(participants: ParticipantStream[]): Promise<void> {
    logger.info('[StudioCanvasOutput] Initializing with', participants.length, 'participants');

    this.participants.clear();

    // Initialize audio mixer
    audioMixerService.initialize();

    // Add each participant's audio to the mixer
    for (const participant of participants) {
      this.participants.set(participant.id, participant);

      if (participant.stream && participant.audioEnabled) {
        const audioTrack = participant.stream.getAudioTracks()[0];
        if (audioTrack) {
          const audioStream = new MediaStream([audioTrack]);
          audioMixerService.addStream(participant.id, audioStream);
        }
      }
    }

    // Start capturing if we have a canvas
    if (this.canvas) {
      this.start();
    } else {
      logger.warn('[StudioCanvasOutput] No canvas registered, waiting for registration');
    }
  }

  /**
   * Add a participant
   */
  async addParticipant(participant: ParticipantStream): Promise<void> {
    logger.info('[StudioCanvasOutput] Adding participant:', participant.id);
    this.participants.set(participant.id, participant);

    // Add audio to mixer
    if (participant.stream && participant.audioEnabled) {
      const audioTrack = participant.stream.getAudioTracks()[0];
      if (audioTrack) {
        const audioStream = new MediaStream([audioTrack]);
        audioMixerService.addStream(participant.id, audioStream);

        // Try to attach audio to output stream if not already done
        // This handles the case where first participant is added after start()
        if (this.isCapturing && !this.audioTrackAdded) {
          this.attachAudioTrack();
        }
      }
    }
  }

  /**
   * Remove a participant
   */
  removeParticipant(participantId: string): void {
    logger.info('[StudioCanvasOutput] Removing participant:', participantId);
    this.participants.delete(participantId);
    audioMixerService.removeStream(participantId);
  }

  /**
   * Start capturing from the canvas
   */
  start(): void {
    if (this.isCapturing) return;
    if (!this.canvas) {
      logger.warn('[StudioCanvasOutput] Cannot start - no canvas registered');
      return;
    }

    logger.info('[StudioCanvasOutput] Starting capture');
    this.isCapturing = true;
    this.audioTrackAdded = false;

    // Capture stream from canvas at target FPS
    this.outputStream = this.canvas.captureStream(this.FPS);

    // Add audio track immediately if mixer is ready
    this.attachAudioTrack();

    logger.info('[StudioCanvasOutput] Capture started:', {
      fps: this.FPS,
      videoTracks: this.outputStream.getVideoTracks().length,
      audioTracks: this.outputStream.getAudioTracks().length,
    });
  }

  /**
   * Attach mixed audio track to the output stream (called once)
   */
  private attachAudioTrack(): void {
    if (!this.outputStream || this.audioTrackAdded) return;

    const mixedAudioStream = audioMixerService.getOutputStream();
    if (!mixedAudioStream) return;

    const mixedAudioTrack = mixedAudioStream.getAudioTracks()[0];
    if (mixedAudioTrack) {
      this.outputStream.addTrack(mixedAudioTrack);
      this.audioTrackAdded = true;
      logger.info('[StudioCanvasOutput] Audio track attached to output stream');
    }
  }

  /**
   * Stop capturing
   */
  stop(): void {
    logger.info('[StudioCanvasOutput] Stopping capture');
    this.isCapturing = false;
    this.audioTrackAdded = false;

    if (this.outputStream) {
      this.outputStream.getTracks().forEach(track => track.stop());
      this.outputStream = null;
    }

    this.participants.clear();
    audioMixerService.stop();
  }

  /**
   * Get the composite output stream (video + mixed audio)
   * This is the main method other parts of the app use
   */
  getOutputStream(): MediaStream | null {
    if (!this.outputStream) {
      // Don't warn - this is expected when not live yet
      return null;
    }

    // Try to attach audio if not already attached
    // This handles the case where audio mixer wasn't ready during start()
    if (!this.audioTrackAdded) {
      this.attachAudioTrack();
    }

    return this.outputStream;
  }

  /**
   * Set the layout (stored for reference)
   */
  setLayout(layout: LayoutConfig): void {
    this.currentLayout = layout;
    // Emit event so StudioCanvas can update
    window.dispatchEvent(new CustomEvent('studioCanvasLayout', { detail: layout }));
  }

  /**
   * Get current layout
   */
  getLayout(): LayoutConfig {
    return this.currentLayout;
  }

  /**
   * Set whether to show chat on stream
   */
  setShowChat(show: boolean): void {
    this.showChat = show;
    window.dispatchEvent(new CustomEvent('studioCanvasShowChat', { detail: { show } }));
  }

  /**
   * Add a chat message (emits event for StudioCanvas to handle)
   */
  addChatMessage(message: { id: string; platform: string; author: string; message: string; timestamp: Date }): void {
    window.dispatchEvent(new CustomEvent('studioCanvasChatMessage', { detail: message }));
  }

  /**
   * Set media clip overlay (video or image to display over canvas)
   */
  setMediaClipOverlay(element: HTMLVideoElement | HTMLImageElement): void {
    this.mediaClipOverlay = element;
    window.dispatchEvent(new CustomEvent('studioCanvasMediaClip', { detail: { element, action: 'set' } }));
  }

  /**
   * Clear media clip overlay
   */
  clearMediaClipOverlay(): void {
    this.mediaClipOverlay = null;
    window.dispatchEvent(new CustomEvent('studioCanvasMediaClip', { detail: { element: null, action: 'clear' } }));
  }

  /**
   * Get current media clip overlay
   */
  getMediaClipOverlay(): HTMLVideoElement | HTMLImageElement | null {
    return this.mediaClipOverlay;
  }

  /**
   * Play intro video before going live
   */
  async playIntroVideo(videoUrl: string = '/backgrounds/videos/StreamLick.mp4', duration?: number): Promise<void> {
    return new Promise((resolve, reject) => {
      logger.info('[StudioCanvasOutput] Playing intro video:', videoUrl);

      const videoElement = document.createElement('video');
      videoElement.src = videoUrl;
      videoElement.muted = false;
      videoElement.autoplay = false;
      videoElement.preload = 'auto';
      videoElement.crossOrigin = 'anonymous';
      videoElement.playsInline = true;

      this.introVideoElement = videoElement;

      // Emit event so UI can show intro video
      window.dispatchEvent(new CustomEvent('studioCanvasIntroVideo', {
        detail: { url: videoUrl, playing: true }
      }));

      videoElement.addEventListener('loadedmetadata', () => {
        logger.info('[StudioCanvasOutput] Intro video metadata loaded');

        if (!videoElement.videoWidth || !videoElement.videoHeight) {
          reject(new Error('Invalid video dimensions'));
          return;
        }

        videoElement.addEventListener('playing', () => {
          this.setMediaClipOverlay(videoElement);
        }, { once: true });

        if (videoElement.readyState >= 3) {
          videoElement.play().catch(err => {
            videoElement.muted = true;
            videoElement.play().catch(reject);
          });
        } else {
          videoElement.addEventListener('canplay', () => {
            videoElement.play().catch(err => {
              videoElement.muted = true;
              videoElement.play().catch(reject);
            });
          }, { once: true });
        }
      });

      videoElement.addEventListener('ended', () => {
        logger.info('[StudioCanvasOutput] Intro video ended');
        this.clearMediaClipOverlay();
        this.introVideoElement = null;
        window.dispatchEvent(new CustomEvent('studioCanvasIntroVideo', {
          detail: { url: null, playing: false }
        }));
        resolve();
      });

      videoElement.addEventListener('error', (event) => {
        const errorMsg = videoElement.error?.message || 'Unknown error';
        logger.error('[StudioCanvasOutput] Intro video error:', errorMsg);
        this.clearMediaClipOverlay();
        this.introVideoElement = null;
        window.dispatchEvent(new CustomEvent('studioCanvasIntroVideo', {
          detail: { url: null, playing: false }
        }));
        reject(new Error(`Video error: ${errorMsg}`));
      });

      // Timeout after 10 seconds
      const loadTimeout = setTimeout(() => {
        logger.warn('[StudioCanvasOutput] Intro video load timeout');
        this.clearMediaClipOverlay();
        window.dispatchEvent(new CustomEvent('studioCanvasIntroVideo', {
          detail: { url: null, playing: false }
        }));
        resolve(); // Resolve to continue flow
      }, 10000);

      videoElement.addEventListener('loadedmetadata', () => {
        clearTimeout(loadTimeout);
      }, { once: true });

      // Duration limit
      if (duration) {
        setTimeout(() => {
          videoElement.pause();
          this.clearMediaClipOverlay();
          window.dispatchEvent(new CustomEvent('studioCanvasIntroVideo', {
            detail: { url: null, playing: false }
          }));
          resolve();
        }, duration * 1000);
      }
    });
  }

  /**
   * Start countdown timer
   */
  async startCountdown(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      logger.info(`[StudioCanvasOutput] Starting ${seconds}-second countdown`);
      this.countdownValue = seconds;

      window.dispatchEvent(new CustomEvent('studioCanvasCountdown', {
        detail: { seconds: this.countdownValue }
      }));

      const intervalId = setInterval(() => {
        if (this.countdownValue === null || this.countdownValue <= 0) {
          clearInterval(intervalId);
          this.countdownValue = null;
          window.dispatchEvent(new CustomEvent('studioCanvasCountdown', {
            detail: { seconds: null }
          }));
          resolve();
          return;
        }

        this.countdownValue--;
        window.dispatchEvent(new CustomEvent('studioCanvasCountdown', {
          detail: { seconds: this.countdownValue }
        }));
      }, 1000);
    });
  }

  /**
   * Check if currently capturing
   */
  isActive(): boolean {
    return this.isCapturing;
  }
}

// Export singleton instance
export const studioCanvasOutputService = new StudioCanvasOutputService();
