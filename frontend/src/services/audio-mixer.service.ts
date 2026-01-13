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
  private connectedElements: Map<HTMLMediaElement, string> = new Map();
  private currentMasterVolume: number = 1.0;
  private mutedStreams: Set<string> = new Set(); // Track which streams are muted
  private heartbeatOscillator: OscillatorNode | null = null; // Keep audio graph alive

  /**
   * Initialize the audio mixer with high-quality 192kbps equivalent settings
   */
  initialize(): void {
    if (this.audioContext) {
      return; // Already initialized
    }

    // Create audio context with high sample rate for better quality
    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    // Create destination node
    this.destination = this.audioContext.createMediaStreamDestination();

    // Create a silent "heartbeat" oscillator to keep the audio graph alive
    // This prevents WebRTC streams from becoming inactive when all sources are muted
    this.heartbeatOscillator = this.audioContext.createOscillator();
    const heartbeatGain = this.audioContext.createGain();
    heartbeatGain.gain.value = 0.0001; // Essentially silent but keeps graph active
    this.heartbeatOscillator.connect(heartbeatGain);
    heartbeatGain.connect(this.destination);
    this.heartbeatOscillator.start();
    console.log('[AudioMixer] Initialized with heartbeat oscillator to keep audio graph alive');
  }

  /**
   * Add an audio stream to the mix
   */
  addStream(id: string, stream: MediaStream): void {
    console.log('[AudioMixer] addStream called:', id, {
      initialized: !!this.audioContext && !!this.destination,
      contextState: this.audioContext?.state,
      streamTracks: stream.getTracks().map(t => ({
        kind: t.kind,
        id: t.id,
        enabled: t.enabled,
        muted: t.muted,
        readyState: t.readyState,
      })),
      existingStreams: Array.from(this.sources.keys()),
    });

    if (!this.audioContext || !this.destination) {
      console.error('[AudioMixer] Not initialized! Cannot add stream:', id);
      throw new Error('Audio mixer not initialized');
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from stream
    const source = this.audioContext.createMediaStreamSource(stream);

    // Create gain node for volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentMasterVolume;

    // Connect: source -> gain -> BOTH destinations (broadcast AND speakers)
    source.connect(gainNode);
    gainNode.connect(this.destination);  // For broadcast output
    gainNode.connect(this.audioContext.destination);  // For local speakers (host can hear guests)

    // Store source and gain node
    this.sources.set(id, source);
    this.gainNodes.set(id, gainNode);

    console.log('[AudioMixer] Stream added successfully:', id, {
      totalStreams: this.sources.size,
      allStreamIds: Array.from(this.sources.keys()),
    });
  }

  /**
   * Add an HTML media element (video/audio) to the mix
   * Uses MediaElementSource for direct element audio capture
   */
  addMediaElement(id: string, element: HTMLVideoElement | HTMLAudioElement): void {
    if (!this.audioContext || !this.destination) {
      throw new Error('[Audio Mixer] Not initialized');
    }

    // Check if this element is already connected to a source
    const existingId = this.connectedElements.get(element);
    if (existingId) {
      // If the ID is different, update tracking
      if (existingId !== id) {
        const existingSource = this.sources.get(existingId);
        const existingGain = this.gainNodes.get(existingId);
        if (existingSource && existingGain) {
          this.sources.delete(existingId);
          this.gainNodes.delete(existingId);
          this.sources.set(id, existingSource);
          this.gainNodes.set(id, existingGain);
          this.connectedElements.set(element, id);
        }
      }
      return;
    }

    // Remove existing source if any
    this.removeStream(id);

    // Create source from media element
    const source = this.audioContext.createMediaElementSource(element);

    // Track this element
    this.connectedElements.set(element, id);

    // Create gain node with optimal volume
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = this.currentMasterVolume * 1.5;

    // Connect to BOTH destinations for dual output
    source.connect(gainNode);
    gainNode.connect(this.destination);
    gainNode.connect(this.audioContext.destination);

    // Store source and gain node
    this.sources.set(id, source as any);
    this.gainNodes.set(id, gainNode);
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

    // Remove from muted set
    this.mutedStreams.delete(id);

    // Clean up element tracking
    for (const [element, elementId] of this.connectedElements.entries()) {
      if (elementId === id) {
        this.connectedElements.delete(element);
        break;
      }
    }
  }

  /**
   * Remove a media element from the mix
   */
  removeMediaElement(id: string): void {
    this.removeStream(id);
  }

  /**
   * Set volume for a specific stream
   */
  setStreamVolume(id: string, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    const gainNode = this.gainNodes.get(id);
    if (gainNode) {
      gainNode.gain.value = clampedVolume;
    }
  }

  /**
   * Mute a specific stream (sets gain to 0)
   */
  muteStream(id: string): void {
    const gainNode = this.gainNodes.get(id);
    if (gainNode) {
      gainNode.gain.value = 0;
      this.mutedStreams.add(id);
      console.log('[AudioMixer] Muted stream:', id);
    }
  }

  /**
   * Unmute a specific stream (restores to master volume)
   */
  unmuteStream(id: string): void {
    const gainNode = this.gainNodes.get(id);
    if (gainNode) {
      gainNode.gain.value = this.currentMasterVolume;
      this.mutedStreams.delete(id);
      console.log('[AudioMixer] Unmuted stream:', id);
    }
  }

  /**
   * Check if a stream is muted
   */
  isStreamMuted(id: string): boolean {
    return this.mutedStreams.has(id);
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
    // Stop heartbeat oscillator
    if (this.heartbeatOscillator) {
      this.heartbeatOscillator.stop();
      this.heartbeatOscillator.disconnect();
      this.heartbeatOscillator = null;
    }

    // Disconnect all sources and gain nodes
    this.sources.forEach((source) => {
      source.disconnect();
    });
    this.sources.clear();

    this.gainNodes.forEach((gainNode) => {
      gainNode.disconnect();
    });
    this.gainNodes.clear();

    // Clear muted streams tracking
    this.mutedStreams.clear();

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
   */
  setMasterVolume(volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));

    // Store for future streams
    this.currentMasterVolume = clampedVolume;

    // Apply to all existing streams (but preserve muted state)
    this.gainNodes.forEach((gainNode, id) => {
      // Don't change volume on muted streams - they should stay at 0
      if (!this.mutedStreams.has(id)) {
        gainNode.gain.value = clampedVolume;
      }
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
