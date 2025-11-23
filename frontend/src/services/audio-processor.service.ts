import { logger } from '../utils/logger';

/**
 * Audio processing service for noise gate and audio enhancement
 * Works continuously, even when not live
 */
class AudioProcessorService {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private animationFrameId: number | null = null;

  // Noise gate settings
  private noiseGateThreshold: number = -50; // dB
  private noiseGateEnabled: boolean = true;
  private attackTime: number = 0.001; // seconds
  private releaseTime: number = 0.1; // seconds

  // Current state
  private currentGain: number = 1.0;
  private targetGain: number = 1.0;
  private isProcessing: boolean = false;

  /**
   * Initialize audio processing on a stream
   * Creates a processed output stream with noise gate applied
   */
  async initialize(inputStream: MediaStream): Promise<MediaStream> {
    logger.info('[AudioProcessor] Initializing audio processing');

    // Create audio context if not exists
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
    }

    // Clean up existing processing
    this.stop();

    try {
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);
      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.destination = this.audioContext.createMediaStreamDestination();

      // Configure analyser for noise detection
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect nodes: source -> gain -> analyser -> destination
      this.sourceNode.connect(this.gainNode);
      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.destination);

      // Start processing loop
      this.isProcessing = true;
      this.processAudio();

      logger.info('[AudioProcessor] Audio processing initialized successfully');

      // Return the processed stream
      return this.destination.stream;
    } catch (error) {
      logger.error('[AudioProcessor] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Process audio in real-time with noise gate
   */
  private processAudio = (): void => {
    if (!this.isProcessing || !this.analyser || !this.gainNode) {
      return;
    }

    // Get audio data
    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength;

    // Convert to dB (0-255 -> dB)
    const dB = 20 * Math.log10(average / 255);

    // Get current audio time for gain scheduling
    const now = this.audioContext!.currentTime;

    // Apply noise gate
    if (this.noiseGateEnabled) {
      if (dB > this.noiseGateThreshold) {
        // Signal is above threshold - gate open
        this.targetGain = 1.0;
      } else {
        // Signal is below threshold - gate closed
        this.targetGain = 0.0;
      }

      // Smooth gain changes to avoid clicks/pops
      const timeDelta = this.targetGain > this.currentGain ? this.attackTime : this.releaseTime;

      // Gradually move current gain toward target
      this.currentGain += (this.targetGain - this.currentGain) * (1 / (timeDelta * 60)); // 60fps

      // Apply gain
      this.gainNode.gain.setValueAtTime(this.currentGain, now);
    } else {
      // Noise gate disabled - full gain
      this.gainNode.gain.setValueAtTime(1.0, now);
    }

    // Continue processing
    this.animationFrameId = requestAnimationFrame(this.processAudio);
  };

  /**
   * Set noise gate threshold
   * @param dB Threshold in decibels (-100 to 0)
   */
  setNoiseGateThreshold(dB: number): void {
    this.noiseGateThreshold = Math.max(-100, Math.min(0, dB));
    logger.info(`[AudioProcessor] Noise gate threshold set to ${this.noiseGateThreshold} dB`);
  }

  /**
   * Enable or disable noise gate
   */
  setNoiseGateEnabled(enabled: boolean): void {
    this.noiseGateEnabled = enabled;
    logger.info(`[AudioProcessor] Noise gate ${enabled ? 'enabled' : 'disabled'}`);

    // Reset gain to 1.0 when disabling
    if (!enabled && this.gainNode && this.audioContext) {
      this.gainNode.gain.setValueAtTime(1.0, this.audioContext.currentTime);
      this.currentGain = 1.0;
      this.targetGain = 1.0;
    }
  }

  /**
   * Set attack time (how fast gate opens)
   * @param seconds Attack time in seconds
   */
  setAttackTime(seconds: number): void {
    this.attackTime = Math.max(0.001, Math.min(1, seconds));
    logger.info(`[AudioProcessor] Attack time set to ${this.attackTime}s`);
  }

  /**
   * Set release time (how fast gate closes)
   * @param seconds Release time in seconds
   */
  setReleaseTime(seconds: number): void {
    this.releaseTime = Math.max(0.001, Math.min(1, seconds));
    logger.info(`[AudioProcessor] Release time set to ${this.releaseTime}s`);
  }

  /**
   * Get current audio level (for UI visualization)
   */
  getCurrentLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }

    return sum / bufferLength / 255; // Normalize to 0-1
  }

  /**
   * Get noise gate status
   */
  getStatus(): {
    enabled: boolean;
    threshold: number;
    currentGain: number;
    isOpen: boolean;
  } {
    return {
      enabled: this.noiseGateEnabled,
      threshold: this.noiseGateThreshold,
      currentGain: this.currentGain,
      isOpen: this.currentGain > 0.5,
    };
  }

  /**
   * Stop audio processing and clean up
   */
  stop(): void {
    logger.info('[AudioProcessor] Stopping audio processing');

    this.isProcessing = false;

    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }

    if (this.sourceNode) {
      this.sourceNode.disconnect();
      this.sourceNode = null;
    }

    if (this.gainNode) {
      this.gainNode.disconnect();
      this.gainNode = null;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = null;
    }

    this.destination = null;
  }

  /**
   * Clean up and close audio context
   */
  async destroy(): Promise<void> {
    logger.info('[AudioProcessor] Destroying audio processor');

    this.stop();

    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
      this.audioContext = null;
    }
  }
}

// Export singleton instance
export const audioProcessorService = new AudioProcessorService();
