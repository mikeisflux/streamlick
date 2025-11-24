import { logger } from '../utils/logger';

/**
 * Professional audio processing service with advanced noise gate
 * Implements industry-standard parameters: threshold, attack, release, hold, hysteresis, and filtering
 * Works continuously, even when not live
 */
class AudioProcessorService {
  private audioContext: AudioContext | null = null;
  private sourceNode: MediaStreamAudioSourceNode | null = null;
  private gainNode: GainNode | null = null;
  private analyser: AnalyserNode | null = null;
  private destination: MediaStreamAudioDestinationNode | null = null;
  private highPassFilter: BiquadFilterNode | null = null;
  private lowPassFilter: BiquadFilterNode | null = null;
  private animationFrameId: number | null = null;

  // Professional noise gate settings
  private noiseGateEnabled: boolean = true;

  // Threshold settings (with hysteresis to prevent flickering)
  private openThreshold: number = -38; // dB - gate opens when signal exceeds this
  private closeThreshold: number = -40; // dB - gate closes when signal drops below this

  // Timing parameters (optimized for vocals)
  private attackTime: number = 0.015; // 15ms - how fast gate opens (recommended 10-15ms for vocals)
  private releaseTime: number = 0.1; // 100ms - how fast gate closes (natural decay)
  private holdTime: number = 0.05; // 50ms - how long gate stays open after signal drops

  // Range/Reduction - instead of full muting, reduce noise by this amount
  private range: number = 1.0; // 1.0 = full gate (0dB to -∞), 0.5 = reduce by 50%, etc.

  // Filter settings
  private highPassEnabled: boolean = true;
  private highPassFrequency: number = 80; // Hz - removes low-frequency rumble
  private lowPassEnabled: boolean = false;
  private lowPassFrequency: number = 12000; // Hz - removes high-frequency hiss

  // Current state
  private currentGain: number = 1.0;
  private targetGain: number = 1.0;
  private isGateOpen: boolean = false;
  private holdTimer: number = 0; // Tracks hold time
  private isProcessing: boolean = false;
  private lastProcessTime: number = 0;

  /**
   * Initialize audio processing on a stream
   * Creates a processed output stream with noise gate and filters applied
   */
  async initialize(inputStream: MediaStream): Promise<MediaStream> {
    logger.info('[AudioProcessor] Initializing professional audio processing');

    // Create audio context if not exists
    if (!this.audioContext) {
      this.audioContext = new AudioContext({ sampleRate: 48000 });
    }

    // Clean up existing processing
    this.stop();

    try {
      // Create audio nodes
      this.sourceNode = this.audioContext.createMediaStreamSource(inputStream);

      // Create filter chain
      this.highPassFilter = this.audioContext.createBiquadFilter();
      this.highPassFilter.type = 'highpass';
      this.highPassFilter.frequency.value = this.highPassFrequency;
      this.highPassFilter.Q.value = 0.7071; // Butterworth response

      this.lowPassFilter = this.audioContext.createBiquadFilter();
      this.lowPassFilter.type = 'lowpass';
      this.lowPassFilter.frequency.value = this.lowPassFrequency;
      this.lowPassFilter.Q.value = 0.7071;

      this.gainNode = this.audioContext.createGain();
      this.analyser = this.audioContext.createAnalyser();
      this.destination = this.audioContext.createMediaStreamDestination();

      // Configure analyser for accurate level detection
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.8;

      // Connect nodes: source -> highpass -> lowpass -> gain -> analyser -> destination
      this.sourceNode.connect(this.highPassFilter);

      if (this.highPassEnabled) {
        this.highPassFilter.connect(this.lowPassFilter);
      } else {
        this.sourceNode.connect(this.lowPassFilter);
      }

      if (this.lowPassEnabled) {
        this.lowPassFilter.connect(this.gainNode);
      } else {
        if (this.highPassEnabled) {
          this.highPassFilter.connect(this.gainNode);
        } else {
          this.sourceNode.connect(this.gainNode);
        }
      }

      this.gainNode.connect(this.analyser);
      this.analyser.connect(this.destination);

      // Start processing loop
      this.isProcessing = true;
      this.lastProcessTime = performance.now();
      this.processAudio();

      logger.info('[AudioProcessor] Professional audio processing initialized');
      logger.info(`[AudioProcessor] Settings - Open: ${this.openThreshold}dB, Close: ${this.closeThreshold}dB, Attack: ${this.attackTime * 1000}ms, Release: ${this.releaseTime * 1000}ms, Hold: ${this.holdTime * 1000}ms`);

      // Return the processed stream
      return this.destination.stream;
    } catch (error) {
      logger.error('[AudioProcessor] Failed to initialize:', error);
      throw error;
    }
  }

  /**
   * Process audio in real-time with professional noise gate
   * Implements: threshold hysteresis, hold time, smooth attack/release, and range control
   */
  private processAudio = (): void => {
    if (!this.isProcessing || !this.analyser || !this.gainNode || !this.audioContext) {
      return;
    }

    // Calculate delta time for accurate timing
    const now = performance.now();
    const deltaTime = (now - this.lastProcessTime) / 1000; // Convert to seconds
    this.lastProcessTime = now;

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

    // Convert to dB (0-255 -> dB scale)
    const dB = average > 0 ? 20 * Math.log10(average / 255) : -100;

    // Apply noise gate with professional parameters
    if (this.noiseGateEnabled) {
      // Hysteresis logic - prevents gate flickering
      if (this.isGateOpen) {
        // Gate is open - check if signal drops below CLOSE threshold
        if (dB < this.closeThreshold) {
          // Signal dropped - start hold timer
          this.holdTimer += deltaTime;

          // Only close gate after hold time expires
          if (this.holdTimer >= this.holdTime) {
            this.isGateOpen = false;
            this.targetGain = 1.0 - this.range; // Apply range reduction
            this.holdTimer = 0;
          }
        } else {
          // Signal still strong - reset hold timer and keep gate open
          this.holdTimer = 0;
          this.targetGain = 1.0;
        }
      } else {
        // Gate is closed - check if signal exceeds OPEN threshold
        if (dB > this.openThreshold) {
          this.isGateOpen = true;
          this.targetGain = 1.0;
          this.holdTimer = 0;
        } else {
          this.targetGain = 1.0 - this.range; // Keep gate closed with range reduction
        }
      }

      // Smooth gain changes with attack/release envelope
      const isOpening = this.targetGain > this.currentGain;
      const timeConstant = isOpening ? this.attackTime : this.releaseTime;

      // Exponential smoothing for natural sound
      const smoothingFactor = Math.exp(-deltaTime / timeConstant);
      this.currentGain = this.targetGain + (this.currentGain - this.targetGain) * smoothingFactor;

      // Apply gain with smooth ramping to avoid clicks
      const audioTime = this.audioContext.currentTime;
      this.gainNode.gain.setTargetAtTime(this.currentGain, audioTime, 0.01);
    } else {
      // Noise gate disabled - full gain
      this.gainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.01);
      this.currentGain = 1.0;
      this.isGateOpen = true;
    }

    // Continue processing
    this.animationFrameId = requestAnimationFrame(this.processAudio);
  };

  /**
   * Set open threshold (gate opens when signal exceeds this level)
   * @param dB Threshold in decibels (-100 to 0)
   */
  setOpenThreshold(dB: number): void {
    this.openThreshold = Math.max(-100, Math.min(0, dB));
    // Ensure close threshold is below open threshold
    if (this.closeThreshold > this.openThreshold) {
      this.closeThreshold = this.openThreshold - 2;
    }
    logger.info(`[AudioProcessor] Open threshold set to ${this.openThreshold} dB`);
  }

  /**
   * Set close threshold (gate closes when signal drops below this level)
   * @param dB Threshold in decibels (-100 to 0)
   */
  setCloseThreshold(dB: number): void {
    this.closeThreshold = Math.max(-100, Math.min(0, dB));
    // Ensure close threshold is below open threshold
    if (this.closeThreshold > this.openThreshold) {
      this.openThreshold = this.closeThreshold + 2;
    }
    logger.info(`[AudioProcessor] Close threshold set to ${this.closeThreshold} dB`);
  }

  /**
   * Set noise gate threshold (sets both open and close with 2dB hysteresis)
   * @param dB Threshold in decibels (-100 to 0)
   */
  setNoiseGateThreshold(dB: number): void {
    const threshold = Math.max(-100, Math.min(0, dB));
    this.openThreshold = threshold;
    this.closeThreshold = threshold - 2; // 2dB hysteresis
    logger.info(`[AudioProcessor] Threshold set to ${threshold} dB (hysteresis: ${this.closeThreshold} to ${this.openThreshold} dB)`);
  }

  /**
   * Enable or disable noise gate
   */
  setNoiseGateEnabled(enabled: boolean): void {
    this.noiseGateEnabled = enabled;
    logger.info(`[AudioProcessor] Noise gate ${enabled ? 'enabled' : 'disabled'}`);

    // Reset state when disabling
    if (!enabled && this.gainNode && this.audioContext) {
      this.gainNode.gain.setTargetAtTime(1.0, this.audioContext.currentTime, 0.01);
      this.currentGain = 1.0;
      this.targetGain = 1.0;
      this.isGateOpen = true;
      this.holdTimer = 0;
    }
  }

  /**
   * Set attack time (how fast gate opens)
   * @param seconds Attack time in seconds (recommended: 0.010-0.020 for vocals)
   */
  setAttackTime(seconds: number): void {
    this.attackTime = Math.max(0.001, Math.min(1, seconds));
    logger.info(`[AudioProcessor] Attack time set to ${(this.attackTime * 1000).toFixed(1)}ms`);
  }

  /**
   * Set release time (how fast gate closes)
   * @param seconds Release time in seconds (recommended: 0.080-0.150 for vocals)
   */
  setReleaseTime(seconds: number): void {
    this.releaseTime = Math.max(0.001, Math.min(1, seconds));
    logger.info(`[AudioProcessor] Release time set to ${(this.releaseTime * 1000).toFixed(1)}ms`);
  }

  /**
   * Set hold time (how long gate stays open after signal drops)
   * @param seconds Hold time in seconds (recommended: 0.050-0.200 for vocals)
   */
  setHoldTime(seconds: number): void {
    this.holdTime = Math.max(0, Math.min(1, seconds));
    logger.info(`[AudioProcessor] Hold time set to ${(this.holdTime * 1000).toFixed(1)}ms`);
  }

  /**
   * Set gate range/reduction amount
   * @param range 0.0 to 1.0, where 1.0 = full mute, 0.5 = -6dB reduction, 0.0 = no effect
   */
  setRange(range: number): void {
    this.range = Math.max(0, Math.min(1, range));
    logger.info(`[AudioProcessor] Range set to ${(this.range * 100).toFixed(0)}% (${(this.range * -60).toFixed(1)}dB reduction)`);
  }

  /**
   * Configure high-pass filter (removes low-frequency rumble/hum)
   * @param enabled Enable/disable high-pass filter
   * @param frequency Cutoff frequency in Hz (recommended: 60-100 Hz)
   */
  setHighPassFilter(enabled: boolean, frequency?: number): void {
    this.highPassEnabled = enabled;
    if (frequency !== undefined && this.highPassFilter) {
      this.highPassFrequency = Math.max(20, Math.min(1000, frequency));
      this.highPassFilter.frequency.value = this.highPassFrequency;
    }
    logger.info(`[AudioProcessor] High-pass filter ${enabled ? 'enabled' : 'disabled'} at ${this.highPassFrequency}Hz`);
  }

  /**
   * Configure low-pass filter (removes high-frequency hiss)
   * @param enabled Enable/disable low-pass filter
   * @param frequency Cutoff frequency in Hz (recommended: 8000-15000 Hz)
   */
  setLowPassFilter(enabled: boolean, frequency?: number): void {
    this.lowPassEnabled = enabled;
    if (frequency !== undefined && this.lowPassFilter) {
      this.lowPassFrequency = Math.max(1000, Math.min(20000, frequency));
      this.lowPassFilter.frequency.value = this.lowPassFrequency;
    }
    logger.info(`[AudioProcessor] Low-pass filter ${enabled ? 'enabled' : 'disabled'} at ${this.lowPassFrequency}Hz`);
  }

  /**
   * Get current audio level (for UI visualization)
   * Returns both raw level and dB
   */
  getCurrentLevel(): { level: number; dB: number } {
    if (!this.analyser) return { level: 0, dB: -100 };

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteFrequencyData(dataArray);

    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }

    const average = sum / bufferLength;
    const level = average / 255; // Normalize to 0-1
    const dB = average > 0 ? 20 * Math.log10(average / 255) : -100;

    return { level, dB };
  }

  /**
   * Get comprehensive noise gate status
   */
  getStatus(): {
    enabled: boolean;
    openThreshold: number;
    closeThreshold: number;
    attackTime: number;
    releaseTime: number;
    holdTime: number;
    range: number;
    currentGain: number;
    isOpen: boolean;
    highPassEnabled: boolean;
    highPassFrequency: number;
    lowPassEnabled: boolean;
    lowPassFrequency: number;
  } {
    return {
      enabled: this.noiseGateEnabled,
      openThreshold: this.openThreshold,
      closeThreshold: this.closeThreshold,
      attackTime: this.attackTime,
      releaseTime: this.releaseTime,
      holdTime: this.holdTime,
      range: this.range,
      currentGain: this.currentGain,
      isOpen: this.isGateOpen,
      highPassEnabled: this.highPassEnabled,
      highPassFrequency: this.highPassFrequency,
      lowPassEnabled: this.lowPassEnabled,
      lowPassFrequency: this.lowPassFrequency,
    };
  }

  /**
   * Load preset configuration
   */
  loadPreset(preset: 'vocal' | 'instrument' | 'aggressive' | 'gentle'): void {
    switch (preset) {
      case 'vocal':
        // Optimized for voice recording
        this.setOpenThreshold(-38);
        this.setCloseThreshold(-40);
        this.setAttackTime(0.015); // 15ms
        this.setReleaseTime(0.1); // 100ms
        this.setHoldTime(0.05); // 50ms
        this.setRange(1.0);
        this.setHighPassFilter(true, 80);
        this.setLowPassFilter(false);
        logger.info('[AudioProcessor] Loaded VOCAL preset');
        break;

      case 'instrument':
        // For musical instruments with fast transients
        this.setOpenThreshold(-45);
        this.setCloseThreshold(-48);
        this.setAttackTime(0.005); // 5ms - faster for transients
        this.setReleaseTime(0.15); // 150ms - longer for natural decay
        this.setHoldTime(0.03); // 30ms
        this.setRange(1.0);
        this.setHighPassFilter(true, 60);
        this.setLowPassFilter(false);
        logger.info('[AudioProcessor] Loaded INSTRUMENT preset');
        break;

      case 'aggressive':
        // Strong noise reduction for noisy environments
        this.setOpenThreshold(-35);
        this.setCloseThreshold(-38);
        this.setAttackTime(0.01); // 10ms
        this.setReleaseTime(0.08); // 80ms - faster closing
        this.setHoldTime(0.03); // 30ms - shorter hold
        this.setRange(1.0);
        this.setHighPassFilter(true, 100);
        this.setLowPassFilter(true, 10000);
        logger.info('[AudioProcessor] Loaded AGGRESSIVE preset');
        break;

      case 'gentle':
        // Subtle noise reduction for clean environments
        this.setOpenThreshold(-45);
        this.setCloseThreshold(-50);
        this.setAttackTime(0.02); // 20ms - smoother
        this.setReleaseTime(0.15); // 150ms - gradual
        this.setHoldTime(0.1); // 100ms - longer hold
        this.setRange(0.7); // Partial reduction instead of full mute
        this.setHighPassFilter(true, 60);
        this.setLowPassFilter(false);
        logger.info('[AudioProcessor] Loaded GENTLE preset');
        break;
    }
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

    if (this.highPassFilter) {
      this.highPassFilter.disconnect();
      this.highPassFilter = null;
    }

    if (this.lowPassFilter) {
      this.lowPassFilter.disconnect();
      this.lowPassFilter = null;
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
