/**
 * Clip Player Service
 * Handles playback of media clips (video, audio, images) during live streams
 */

import { audioMixerService } from './audio-mixer.service';

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
}

class ClipPlayerService {
  private activeClips: Map<string, PlaybackState> = new Map();
  private onPlayCallback?: (clipId: string) => void;
  private onStopCallback?: (clipId: string) => void;

  constructor() {
    // Audio is now handled by audioMixerService - no separate AudioContext needed
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
    video.muted = false; // Keep unmuted so audio can be captured
    video.volume = clip.volume / 100;
    video.autoplay = true;
    video.loop = false;
    // Exclude from global speaker mute - clip volumes controlled independently
    (video as any).dataset.excludeGlobalMute = 'true';

    const startTime = Date.now();
    const endTime = clip.duration ? startTime + clip.duration : undefined;

    const state: PlaybackState = {
      clip,
      element: video,
      startTime,
      endTime,
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

      // CRITICAL FIX: Add video audio to the compositor's audio mixer
      // This ensures the clip's audio is included in the output stream to YouTube
      try {

        // CRITICAL: Resume AudioContext to enable audio playback
        // Browser autoplay policies suspend AudioContext by default
        const audioContext = (audioMixerService as any).audioContext;
        if (audioContext && audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        audioMixerService.addMediaElement(`clip-${clip.id}`, video);
        // Apply volume via mixer
        audioMixerService.setStreamVolume(`clip-${clip.id}`, clip.volume / 100);
      } catch (audioError) {
        console.error('[ClipPlayer] Failed to add video audio to mixer:', audioError);
        // Continue anyway - video will play without audio in output stream
      }

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
    // Exclude from global speaker mute - clip volumes controlled independently
    (audio as any).dataset.excludeGlobalMute = 'true';

    // CRITICAL FIX: Add audio to the compositor's audio mixer
    // This ensures the clip's audio is included in the output stream to YouTube
    try {
      audioMixerService.addMediaElement(`clip-${clip.id}`, audio);
      // Apply volume via mixer
      audioMixerService.setStreamVolume(`clip-${clip.id}`, clip.volume / 100);
    } catch (error) {
      console.error('[ClipPlayer] Failed to add audio to mixer:', error);
      // Continue anyway - audio will play locally but not in output stream
    }

    const startTime = Date.now();
    const endTime = clip.duration ? startTime + clip.duration : undefined;

    const state: PlaybackState = {
      clip,
      element: audio,
      startTime,
      endTime,
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

    // CRITICAL FIX: Remove audio from mixer
    audioMixerService.removeStream(`clip-${clipId}`);

    this.activeClips.delete(clipId);

    if (this.onStopCallback) {
      this.onStopCallback(clipId);
    }

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
   * NOTE: This is now handled by the audio mixer service
   */
  setMasterVolume(volume: number): void {
    // Master volume control is now handled by the broadcast audio mixer
  }

  /**
   * Set volume for a specific clip
   */
  setClipVolume(clipId: string, volume: number): void {
    const state = this.activeClips.get(clipId);
    if (!state) return;

    const normalizedVolume = Math.max(0, Math.min(1, volume / 100));

    // Update volume via audio mixer
    audioMixerService.setStreamVolume(`clip-${clipId}`, normalizedVolume);

    // Also update element volume as fallback
    if (state.element instanceof HTMLVideoElement || state.element instanceof HTMLAudioElement) {
      state.element.volume = normalizedVolume;
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
    // Stop all active clips (which will remove them from the audio mixer)
    this.stopAll();
  }
}

// Export singleton instance
export const clipPlayerService = new ClipPlayerService();
