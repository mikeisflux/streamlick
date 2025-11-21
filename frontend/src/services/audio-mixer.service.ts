/**
 * Audio Mixer Service
 *
 * Mixes multiple audio streams into a single output stream using Web Audio API
 */

class AudioMixerService {
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private masterGainNode: GainNode | null = null;
  private sources: Map<string, MediaStreamAudioSourceNode> = new Map();
  private gainNodes: Map<string, GainNode> = new Map();

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

    // Create master gain node for overall volume control
    this.masterGainNode = this.audioContext.createGain();
    this.masterGainNode.gain.value = 1.0; // Full volume by default

    // Create destination node
    this.destination = this.audioContext.createMediaStreamDestination();

    // Connect master gain to destination
    this.masterGainNode.connect(this.destination);

    console.log('Audio mixer initialized with master volume control');
  }

  /**
   * Add an audio stream to the mix
   */
  addStream(id: string, stream: MediaStream): void {
    if (!this.audioContext || !this.masterGainNode) {
      throw new Error('Audio mixer not initialized');
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from stream
    const source = this.audioContext.createMediaStreamSource(stream);

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0; // Full volume

    // Connect: source -> gain -> master gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    // Store source and gain node
    this.sources.set(id, source);
    this.gainNodes.set(id, gainNode);

    console.log(`Audio stream added: ${id}`);
  }

  /**
   * Add an HTML media element (video/audio) to the mix
   * Uses MediaElementSource for direct element audio capture
   */
  addMediaElement(id: string, element: HTMLVideoElement | HTMLAudioElement): void {
    if (!this.audioContext || !this.masterGainNode) {
      throw new Error('Audio mixer not initialized');
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from media element
    // NOTE: Once created, the element's audio is ONLY routed through Web Audio API
    const source = this.audioContext.createMediaElementSource(element);

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0; // Full volume

    // CRITICAL: Connect to BOTH destinations through master gain
    // 1. Connect to master gain -> mixer destination (for stream output to YouTube/etc)
    source.connect(gainNode);
    gainNode.connect(this.masterGainNode);

    // 2. Connect to local speakers (so user can hear the audio)
    gainNode.connect(this.audioContext.destination);

    // Store source and gain node (using same Map, they're compatible types)
    this.sources.set(id, source as any);
    this.gainNodes.set(id, gainNode);

    console.log(`Media element audio added: ${id} (dual output: stream + local)`);
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
   * Set master volume for entire stream (affects all audio sources)
   */
  setMasterVolume(volume: number): void {
    // Volume should be 0-1
    const clampedVolume = Math.max(0, Math.min(1, volume));

    if (this.masterGainNode) {
      this.masterGainNode.gain.value = clampedVolume;
      console.log(`Master volume set to: ${clampedVolume}`);
    } else {
      console.warn('Cannot set master volume: audio mixer not initialized');
    }
  }

  /**
   * Get current master volume
   */
  getMasterVolume(): number {
    if (this.masterGainNode) {
      return this.masterGainNode.gain.value;
    }
    return 1.0; // Default if not initialized
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

    // Disconnect master gain
    if (this.masterGainNode) {
      this.masterGainNode.disconnect();
      this.masterGainNode = null;
    }

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
}

// Export singleton instance
export const audioMixerService = new AudioMixerService();
