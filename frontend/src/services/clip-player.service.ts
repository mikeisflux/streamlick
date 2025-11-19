/**
 * Clip Player Service
 * Handles playback of media clips (video, audio, images) during live streams
 */

export interface MediaClip {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  url: string;
  duration?: number; // milliseconds
  volume: number; // 0-100
  hotkey?: string;
}

interface PlaybackState {
  clip: MediaClip;
  element: HTMLVideoElement | HTMLAudioElement | HTMLImageElement;
  startTime: number;
  endTime?: number;
  audioContext?: AudioContext;
  gainNode?: GainNode;
  sourceNode?: MediaElementAudioSourceNode;
}

class ClipPlayerService {
  private activeClips: Map<string, PlaybackState> = new Map();
  private audioContext: AudioContext | null = null;
  private masterGainNode: GainNode | null = null;
  private onPlayCallback?: (clipId: string) => void;
  private onStopCallback?: (clipId: string) => void;

  constructor() {
    // Initialize audio context
    if (typeof window !== 'undefined' && window.AudioContext) {
      this.audioContext = new AudioContext();
      this.masterGainNode = this.audioContext.createGain();
      this.masterGainNode.connect(this.audioContext.destination);
    }
  }

  /**
   * Play a video clip
   */
  async playVideoClip(clip: MediaClip, canvas?: HTMLCanvasElement, compositorService?: any): Promise<void> {
    if (clip.type !== 'video') {
      throw new Error('Clip must be of type video');
    }

    // Stop any currently playing video (only one video at a time)
    this.stopAllVideos();

    const video = document.createElement('video');
    video.src = clip.url;
    video.crossOrigin = 'anonymous';
    video.muted = false;
    video.volume = clip.volume / 100;
    video.autoplay = true;
    video.loop = false;

    // Connect audio to audio context if available
    let audioContext: AudioContext | undefined;
    let gainNode: GainNode | undefined;
    let sourceNode: MediaElementAudioSourceNode | undefined;

    if (this.audioContext && this.masterGainNode) {
      try {
        sourceNode = this.audioContext.createMediaElementSource(video);
        gainNode = this.audioContext.createGain();
        gainNode.gain.value = clip.volume / 100;

        sourceNode.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        audioContext = this.audioContext;
      } catch (error) {
        console.warn('Failed to connect video audio to context:', error);
      }
    }

    const startTime = Date.now();
    const endTime = clip.duration ? startTime + clip.duration : undefined;

    const state: PlaybackState = {
      clip,
      element: video,
      startTime,
      endTime,
      audioContext,
      gainNode,
      sourceNode,
    };

    this.activeClips.set(clip.id, state);

    // CRITICAL FIX: Wait for video metadata to load before registering with compositor
    // This prevents the black canvas issue where compositor tries to draw before video is ready
    const metadataLoaded = new Promise<void>((resolve, reject) => {
      if (video.readyState >= 2) {
        // Metadata already loaded
        resolve();
      } else {
        // Wait for loadedmetadata event
        video.addEventListener('loadedmetadata', () => {
          console.log('[ClipPlayer] Video metadata loaded:', {
            width: video.videoWidth,
            height: video.videoHeight,
            duration: video.duration,
            readyState: video.readyState,
          });
          resolve();
        }, { once: true });

        video.addEventListener('error', (e) => {
          console.error('[ClipPlayer] Video load error:', e);
          reject(new Error('Failed to load video metadata'));
        }, { once: true });

        // Timeout after 10 seconds
        setTimeout(() => {
          if (video.readyState < 2) {
            reject(new Error('Video metadata load timeout'));
          }
        }, 10000);
      }
    });

    // Handle video end
    video.addEventListener('ended', () => {
      if (compositorService) {
        compositorService.clearMediaClipOverlay();
      }
      this.stopClip(clip.id);
    });

    // Auto-stop after duration if specified
    if (endTime) {
      setTimeout(() => {
        if (this.activeClips.has(clip.id)) {
          if (compositorService) {
            compositorService.clearMediaClipOverlay();
          }
          this.stopClip(clip.id);
        }
      }, clip.duration!);
    }

    // Start playing the video
    await video.play();

    // Wait for metadata to be loaded before registering with compositor
    try {
      await metadataLoaded;
      console.log('[ClipPlayer] Video ready to display on canvas');

      // NOW register with compositor - video is guaranteed to be ready
      if (compositorService) {
        compositorService.setMediaClipOverlay(video);
      }
    } catch (error) {
      console.error('[ClipPlayer] Failed to load video metadata:', error);
      // Clean up on error
      this.stopClip(clip.id);
      throw error;
    }

    if (this.onPlayCallback) {
      this.onPlayCallback(clip.id);
    }

    console.log(`Playing video clip: ${clip.name}`);
  }

  /**
   * Play an audio clip (sound effect)
   */
  async playAudioClip(clip: MediaClip): Promise<void> {
    if (clip.type !== 'audio') {
      throw new Error('Clip must be of type audio');
    }

    const audio = new Audio(clip.url);
    audio.crossOrigin = 'anonymous';
    audio.volume = clip.volume / 100;

    // Connect to audio context if available
    let audioContext: AudioContext | undefined;
    let gainNode: GainNode | undefined;
    let sourceNode: MediaElementAudioSourceNode | undefined;

    if (this.audioContext && this.masterGainNode) {
      try {
        sourceNode = this.audioContext.createMediaElementSource(audio);
        gainNode = this.audioContext.createGain();
        gainNode.gain.value = clip.volume / 100;

        sourceNode.connect(gainNode);
        gainNode.connect(this.masterGainNode);

        audioContext = this.audioContext;
      } catch (error) {
        console.warn('Failed to connect audio to context:', error);
      }
    }

    const startTime = Date.now();
    const endTime = clip.duration ? startTime + clip.duration : undefined;

    const state: PlaybackState = {
      clip,
      element: audio,
      startTime,
      endTime,
      audioContext,
      gainNode,
      sourceNode,
    };

    this.activeClips.set(clip.id, state);

    // Handle audio end
    audio.addEventListener('ended', () => {
      this.stopClip(clip.id);
    });

    // Auto-stop after duration if specified
    if (endTime) {
      setTimeout(() => {
        if (this.activeClips.has(clip.id)) {
          this.stopClip(clip.id);
        }
      }, clip.duration!);
    }

    await audio.play();

    if (this.onPlayCallback) {
      this.onPlayCallback(clip.id);
    }

    console.log(`Playing audio clip: ${clip.name}`);
  }

  /**
   * Show an image clip
   */
  showImageClip(clip: MediaClip, duration?: number, canvas?: HTMLCanvasElement, compositorService?: any): void {
    if (clip.type !== 'image') {
      throw new Error('Clip must be of type image');
    }

    // Stop any currently showing image (only one image at a time)
    this.stopAllImages();

    const img = new Image();
    img.src = clip.url;
    img.crossOrigin = 'anonymous';

    const startTime = Date.now();
    const displayDuration = duration || clip.duration || 5000; // Default 5 seconds
    const endTime = startTime + displayDuration;

    const state: PlaybackState = {
      clip,
      element: img,
      startTime,
      endTime,
    };

    this.activeClips.set(clip.id, state);

    // Register with compositor when image loads
    img.onload = () => {
      if (compositorService) {
        compositorService.setMediaClipOverlay(img);
      }
    };

    // Auto-hide after duration
    setTimeout(() => {
      if (this.activeClips.has(clip.id)) {
        if (compositorService) {
          compositorService.clearMediaClipOverlay();
        }
        this.stopClip(clip.id);
      }
    }, displayDuration);

    if (this.onPlayCallback) {
      this.onPlayCallback(clip.id);
    }

    console.log(`Showing image clip: ${clip.name} for ${displayDuration}ms`);
  }

  /**
   * Stop a specific clip
   */
  stopClip(clipId: string): void {
    const state = this.activeClips.get(clipId);
    if (!state) return;

    // Stop playback
    if (state.element instanceof HTMLVideoElement || state.element instanceof HTMLAudioElement) {
      state.element.pause();
      state.element.currentTime = 0;
    }

    // Disconnect audio nodes
    if (state.sourceNode && state.gainNode) {
      try {
        state.sourceNode.disconnect();
        state.gainNode.disconnect();
      } catch (error) {
        // Already disconnected
      }
    }

    this.activeClips.delete(clipId);

    if (this.onStopCallback) {
      this.onStopCallback(clipId);
    }

    console.log(`Stopped clip: ${state.clip.name}`);
  }

  /**
   * Stop all clips
   */
  stopAll(): void {
    const clipIds = Array.from(this.activeClips.keys());
    clipIds.forEach((id) => this.stopClip(id));
  }

  /**
   * Stop all video clips
   */
  stopAllVideos(): void {
    const videoClips = Array.from(this.activeClips.values())
      .filter((state) => state.clip.type === 'video');
    videoClips.forEach((state) => this.stopClip(state.clip.id));
  }

  /**
   * Stop all image clips
   */
  stopAllImages(): void {
    const imageClips = Array.from(this.activeClips.values())
      .filter((state) => state.clip.type === 'image');
    imageClips.forEach((state) => this.stopClip(state.clip.id));
  }

  /**
   * Get currently playing clip of a specific type
   */
  getActiveClip(type: 'video' | 'audio' | 'image'): PlaybackState | null {
    for (const state of this.activeClips.values()) {
      if (state.clip.type === type) {
        return state;
      }
    }
    return null;
  }

  /**
   * Get all active clips
   */
  getActiveClips(): PlaybackState[] {
    return Array.from(this.activeClips.values());
  }

  /**
   * Set master volume for all clips
   */
  setMasterVolume(volume: number): void {
    if (this.masterGainNode) {
      this.masterGainNode.gain.value = Math.max(0, Math.min(1, volume / 100));
    }
  }

  /**
   * Set volume for a specific clip
   */
  setClipVolume(clipId: string, volume: number): void {
    const state = this.activeClips.get(clipId);
    if (!state) return;

    const normalizedVolume = Math.max(0, Math.min(1, volume / 100));

    if (state.element instanceof HTMLVideoElement || state.element instanceof HTMLAudioElement) {
      state.element.volume = normalizedVolume;
    }

    if (state.gainNode) {
      state.gainNode.gain.value = normalizedVolume;
    }
  }

  /**
   * Set callback for when a clip starts playing
   */
  onPlay(callback: (clipId: string) => void): void {
    this.onPlayCallback = callback;
  }

  /**
   * Set callback for when a clip stops
   */
  onStop(callback: (clipId: string) => void): void {
    this.onStopCallback = callback;
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this.stopAll();

    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }

    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const clipPlayerService = new ClipPlayerService();
