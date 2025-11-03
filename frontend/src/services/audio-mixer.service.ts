/**
 * Audio Mixer Service
 *
 * Mixes multiple audio streams into a single output stream using Web Audio API
 */

class AudioMixerService {
  private audioContext: AudioContext | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private sources: Map<string, MediaStreamAudioSourceNode> = new Map();

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
    gainNode.gain.value = 1.0; // Full volume

    // Connect: source -> gain -> destination
    source.connect(gainNode);
    gainNode.connect(this.destination);

    // Store source
    this.sources.set(id, source);

    console.log(`Audio stream added: ${id}`);
  }

  /**
   * Remove an audio stream from the mix
   */
  removeStream(id: string): void {
    const source = this.sources.get(id);
    if (source) {
      source.disconnect();
      this.sources.delete(id);
      console.log(`Audio stream removed: ${id}`);
    }
  }

  /**
   * Set volume for a specific stream
   */
  setStreamVolume(id: string, volume: number): void {
    // Volume should be 0-1
    const clampedVolume = Math.max(0, Math.min(1, volume));

    const source = this.sources.get(id);
    if (source) {
      // Get the gain node (first destination)
      const gainNode = source.context.createGain();
      gainNode.gain.value = clampedVolume;
      console.log(`Volume set for ${id}: ${clampedVolume}`);
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

    // Disconnect all sources
    this.sources.forEach((source) => {
      source.disconnect();
    });
    this.sources.clear();

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
