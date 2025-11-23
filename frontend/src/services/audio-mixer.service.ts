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
  private connectedElements: Map<HTMLMediaElement, string> = new Map(); // Track connected media elements
  private currentMasterVolume: number = 1.0; // Store current master volume

  /**
   * Initialize the audio mixer with high-quality 192kbps equivalent settings
   */
  initialize(): void {
    if (this.audioContext) {
      console.log('[Audio Mixer] Already initialized, state:', this.audioContext.state);
      return; // Already initialized
    }

    // Create audio context with high sample rate for better quality (192kbps equivalent)
    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000, // High sample rate for professional audio quality
    });

    // Create destination node
    this.destination = this.audioContext.createMediaStreamDestination();

    console.log('[Audio Mixer] ✅ Initialized with 48kHz sample rate (professional quality)');
    console.log('[Audio Mixer] Initial AudioContext state:', this.audioContext.state);
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
   * NOTE: AudioContext must be in 'running' state before calling this
   */
  addMediaElement(id: string, element: HTMLVideoElement | HTMLAudioElement): void {
    if (!this.audioContext || !this.destination) {
      throw new Error('[Audio Mixer] Not initialized');
    }

    console.log('[Audio Mixer] 🔌 Adding media element:', id);
    console.log('[Audio Mixer] AudioContext state:', this.audioContext.state);

    // Check if this element is already connected to a source
    const existingId = this.connectedElements.get(element);
    if (existingId) {
      console.log(`[Audio Mixer] ⚠️ Element already connected as '${existingId}', skipping duplicate connection`);
      // If the ID is different, we need to update our tracking
      if (existingId !== id) {
        console.log(`[Audio Mixer] Updating ID from '${existingId}' to '${id}'`);
        const existingSource = this.sources.get(existingId);
        const existingGain = this.gainNodes.get(existingId);
        if (existingSource && existingGain) {
          // Move the source and gain to the new ID
          this.sources.delete(existingId);
          this.gainNodes.delete(existingId);
          this.sources.set(id, existingSource);
          this.gainNodes.set(id, existingGain);
          this.connectedElements.set(element, id);
        }
      }
      return;
    }

    // Remove existing source if any (for the ID, not the element)
    this.removeStream(id);

    // Create source from media element
    // NOTE: Once created, the element's audio is ONLY routed through Web Audio API
    console.log('[Audio Mixer] Creating MediaElementSource...');
    const source = this.audioContext.createMediaElementSource(element);
    console.log('[Audio Mixer] ✅ MediaElementSource created');

    // Track this element
    this.connectedElements.set(element, id);

    // Create gain node with optimal volume (1.5x for good volume without distortion)
    const gainNode = this.audioContext.createGain();
    // 1.5x provides good volume boost without causing audio clipping/distortion
    gainNode.gain.value = this.currentMasterVolume * 1.5;

    console.log('[Audio Mixer] Connecting audio graph...');
    // CRITICAL: Connect to BOTH destinations for dual output
    // 1. Connect to mixer destination (for stream output to WebRTC/YouTube)
    source.connect(gainNode);
    gainNode.connect(this.destination);

    // 2. Connect to local speakers (so user can hear the audio)
    gainNode.connect(this.audioContext.destination);

    // Store source and gain node
    this.sources.set(id, source as any);
    this.gainNodes.set(id, gainNode);

    console.log(`[Audio Mixer] ✅✅ Media element added successfully:`);
    console.log(`[Audio Mixer]    - ID: ${id}`);
    console.log(`[Audio Mixer]    - Gain: ${gainNode.gain.value}x`);
    console.log(`[Audio Mixer]    - Sample rate: ${this.audioContext.sampleRate}Hz`);
    console.log(`[Audio Mixer]    - Outputs: mixer stream + local speakers`);
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

    // Clean up element tracking
    for (const [element, elementId] of this.connectedElements.entries()) {
      if (elementId === id) {
        this.connectedElements.delete(element);
        break;
      }
    }

    if (source || gainNode) {
      console.log(`Audio stream removed: ${id}`);
    }
  }

  /**
   * Remove a media element from the mix
   * Alias for removeStream - works for both streams and media elements
   */
  removeMediaElement(id: string): void {
    this.removeStream(id);
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
