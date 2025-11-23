/**
 * Audio Mixer Service
 *
 * Mixes multiple audio streams into a single output stream using Web Audio API
 */

class AudioMixerService {
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private sources: Map<string, MediaStreamAudioSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();
  private currentMasterVolume: number = 1.0; // Store current master volume

  /**
   * Initialize the audio mixer
   */
  initialize(): void {
    if (this.audioContext) {
      return; // Already initialized
    }

    // Create audio context
    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    // Create destination node
    this.destination = this.audioContext.createMediaStreamDestination();

    console.log('Audio mixer initialized');
  }

  /**
   * Add an audio stream to the mix
   */
  addStream(id: string, stream: MediaStream): void {
    if (!this.audioContext || !this.destination) {
      throw new Error('Audio mixer not initialized');
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from stream
    const source = this.audioContext.createMediaStreamSource(stream);

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentMasterVolume; // Apply current master volume

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.destination);

    // Store source and gain node
    this.sources.set(id, source);
    this.gainNodes.set(id, gainNode);

    console.log(`Audio stream added: ${id} (volume: ${this.currentMasterVolume})`);
  }

  /**
   * Add an HTML media element (video/audio) to the mix
   * Uses MediaElementSource for direct element audio capture
   */
  addMediaElement(id: string, element: HTMLVideoElement | HTMLAudioElement): void {
    if (!this.audioContext || !this.destination) {
      throw new Error('Audio mixer not initialized');
    }

    // CRITICAL FIX: Resume audio context if suspended (required for audio playback)
    // Browsers auto-suspend audio contexts until user interaction
    if (this.audioContext.state === 'suspended') {
      console.log('[Audio Mixer] Resuming suspended audio context...');
      this.audioContext.resume().then(() => {
        console.log('[Audio Mixer] Audio context resumed successfully');
      }).catch((error) => {
        console.error('[Audio Mixer] Failed to resume audio context:', error);
      });
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from media element
    // NOTE: Once created, the element's audio is ONLY routed through Web Audio API
    const source = this.audioContext.createMediaElementSource(element);

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentMasterVolume; // Apply current master volume

    // CRITICAL FIX: Connect to BOTH destinations
    // 1. Connect to mixer destination (for stream output to YouTube/etc)
    source.connect(gainNode);
    gainNode.connect(this.destination);

    // 2. Connect to local speakers (so user can hear the audio)
    gainNode.connect(this.audioContext.destination);

    // Store source and gain node (using same Map, they're compatible types)
    this.sources.set(id, source as any);
    this.gainNodes.set(id, gainNode);

    console.log(`Media element audio added: ${id} (dual output: stream + local, volume: ${this.currentMasterVolume})`);
  }

  /**
   * Remove an audio stream from the mix
   */
  removeStream(id: string): void {
    const source = this.sources.get(id);
    const gainNode = this.gainNodes.get(id);

    if (source) {
      source.disconnect();
      this.sources.delete(id);
    }

    if (gainNode) {
      gainNode.disconnect();
      this.gainNodes.delete(id);
    }

    if (source || gainNode) {
      console.log(`Audio stream removed: ${id}`);
    }
  }

  /**
   * Set volume for a specific stream
   */
  setStreamVolume(id: string, volume: number): void {
    // Volume should be 0-1
    const clampedVolume = Math.max(0, Math.min(1, volume));

    const gainNode = this.gainNodes.get(id);
    if (gainNode) {
      gainNode.gain.value = clampedVolume;
      console.log(`Volume set for ${id}: ${clampedVolume}`);
    } else {
      console.warn(`Cannot set volume for ${id}: stream not found`);
    }
  }

  /**
   * Get the mixed output stream
   */
  getOutputStream(): MediaStream | null {
    if (!this.destination) {
      return null;
    }

    return this.destination.stream;
  }

  /**
   * Stop and cleanup the audio mixer
   */
  stop(): void {
    console.log('Stopping audio mixer');

    // Disconnect all sources and gain nodes
    this.sources.forEach((source) => {
      source.disconnect();
    });
    this.sources.clear();

    this.gainNodes.forEach((gainNode) => {
      gainNode.disconnect();
    });
    this.gainNodes.clear();

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.destination = null;
  }

  /**
   * Get number of active audio streams
   */
  getStreamCount(): number {
    return this.sources.size;
  }

  /**
   * Set master volume for all streams
   * This applies a volume multiplier to all existing streams AND stores it for future streams
   */
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Store for future streams
    this.currentMasterVolume = clampedVolume;

    console.log(`Setting master volume to ${clampedVolume} for ${this.gainNodes.size} existing streams`);

    // Apply to all existing streams
    this.gainNodes.forEach((gainNode, id) => {
      gainNode.gain.value = clampedVolume;
    });
  }

  /**
   * Get all stream IDs currently in the mixer
   */
  getStreamIds(): string[] {
    return Array.from(this.sources.keys());
  }
}

// Export singleton instance
export const audioMixerService = new AudioMixerService();
