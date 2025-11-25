/**
 * Audio Mixer Service
 *
 * Mixes multiple audio streams into output streams using Web Audio API.
 *
 * Architecture:
 * - Each audio source has its own channel (source -> gain -> destinations)
 * - Two destinations:
 *   1. Broadcast destination: ALL audio (local + remote) -> goes to broadcast/recording
 *   2. Monitor destination: ONLY remote audio -> goes to local speakers (so user doesn't hear themselves)
 *
 * Audio routing:
 * - Local user mic: broadcast only (not to monitor, prevents echo)
 * - Remote participants: broadcast + monitor (user hears them)
 * - Screen share audio: broadcast + monitor
 */

interface AudioChannel {
  source: MediaStreamAudioSourceNode;
  gainNode: GainNode;
  isLocal: boolean; // If true, only routes to broadcast (not monitor)
  stream: MediaStream;
  // Audio processing nodes (optional)
  compressor?: DynamicsCompressorNode;
  highpassFilter?: BiquadFilterNode;
  lowpassFilter?: BiquadFilterNode;
  analyser?: AnalyserNode;
}

interface ChannelEffects {
  // Gain (volume) 0-2 where 1 is unity
  gain?: number;
  // High-pass filter cutoff frequency (Hz) - removes low rumble
  highpassFreq?: number;
  // Low-pass filter cutoff frequency (Hz) - removes harsh highs
  lowpassFreq?: number;
  // Compressor settings
  compressor?: {
    threshold?: number;  // dB (-100 to 0)
    knee?: number;       // dB (0 to 40)
    ratio?: number;      // 1 to 20
    attack?: number;     // seconds (0 to 1)
    release?: number;    // seconds (0 to 1)
  };
  // Mute
  muted?: boolean;
}

class AudioMixerService {
  private audioContext: AudioContext | null = null;
  private broadcastDestination: MediaStreamAudioDestinationNode | null = null;
  private monitorDestination: MediaStreamAudioDestinationNode | null = null;
  private channels: Map<string, AudioChannel> = new Map();

  // Master gain nodes for overall control
  private broadcastMasterGain: GainNode | null = null;
  private monitorMasterGain: GainNode | null = null;

  /**
   * Initialize the audio mixer
   */
  initialize(): void {
    if (this.audioContext) {
      return; // Already initialized
    }

    // Create audio context with low latency
    this.audioContext = new AudioContext({
      latencyHint: 'interactive',
      sampleRate: 48000,
    });

    // Create broadcast destination (for streaming/recording)
    this.broadcastDestination = this.audioContext.createMediaStreamDestination();

    // Create monitor destination (for local playback - only remote audio)
    this.monitorDestination = this.audioContext.createMediaStreamDestination();

    // Create master gain nodes
    this.broadcastMasterGain = this.audioContext.createGain();
    this.broadcastMasterGain.gain.value = 1.0;
    this.broadcastMasterGain.connect(this.broadcastDestination);

    this.monitorMasterGain = this.audioContext.createGain();
    this.monitorMasterGain.gain.value = 1.0;
    this.monitorMasterGain.connect(this.monitorDestination);

    console.log('[AudioMixer] Initialized with broadcast and monitor destinations');
  }

  /**
   * Add an audio stream to the mix
   * @param id Unique identifier for this audio source
   * @param stream MediaStream containing audio
   * @param isLocal If true, audio only goes to broadcast (not monitor) to prevent echo
   */
  addStream(id: string, stream: MediaStream, isLocal: boolean = false): void {
    if (!this.audioContext || !this.broadcastMasterGain || !this.monitorMasterGain) {
      console.warn('[AudioMixer] Cannot add stream - mixer not initialized');
      return;
    }

    // Remove existing channel if any
    this.removeStream(id);

    // Create source from stream
    const source = this.audioContext.createMediaStreamSource(stream);

    // Create gain node for individual volume control
    const gainNode = this.audioContext.createGain();
    gainNode.gain.value = 1.0;

    // Connect source -> gain
    source.connect(gainNode);

    // Route to broadcast destination (ALL audio goes here)
    gainNode.connect(this.broadcastMasterGain);

    // Route to monitor destination (only remote/non-local audio)
    // This prevents the local user from hearing their own mic (echo)
    if (!isLocal) {
      gainNode.connect(this.monitorMasterGain);
    }

    // Store channel info
    this.channels.set(id, {
      source,
      gainNode,
      isLocal,
      stream,
    });

    console.log(`[AudioMixer] Channel added: ${id} (${isLocal ? 'local - broadcast only' : 'remote - broadcast + monitor'})`);
  }

  /**
   * Remove an audio stream from the mix
   */
  removeStream(id: string): void {
    const channel = this.channels.get(id);
    if (!channel) return;

    channel.source.disconnect();
    channel.gainNode.disconnect();
    this.channels.delete(id);

    console.log(`[AudioMixer] Channel removed: ${id}`);
  }

  /**
   * Set volume for a specific channel
   * @param id Channel identifier
   * @param volume Volume level 0-1
   */
  setStreamVolume(id: string, volume: number): void {
    const clampedVolume = Math.max(0, Math.min(1, volume));
    const channel = this.channels.get(id);

    if (channel) {
      channel.gainNode.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
      console.log(`[AudioMixer] Volume set for ${id}: ${clampedVolume}`);
    } else {
      console.warn(`[AudioMixer] Cannot set volume for ${id}: channel not found`);
    }
  }

  /**
   * Set master broadcast volume
   */
  setBroadcastVolume(volume: number): void {
    if (this.broadcastMasterGain) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.broadcastMasterGain.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
    }
  }

  /**
   * Set master monitor volume (what the local user hears)
   */
  setMonitorVolume(volume: number): void {
    if (this.monitorMasterGain) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      this.monitorMasterGain.gain.setValueAtTime(clampedVolume, this.audioContext?.currentTime || 0);
    }
  }

  /**
   * Get the broadcast output stream (all audio mixed for streaming)
   */
  getOutputStream(): MediaStream | null {
    if (!this.broadcastDestination) {
      return null;
    }
    return this.broadcastDestination.stream;
  }

  /**
   * Get the monitor output stream (remote audio only for local playback)
   */
  getMonitorStream(): MediaStream | null {
    if (!this.monitorDestination) {
      return null;
    }
    return this.monitorDestination.stream;
  }

  /**
   * Stop and cleanup the audio mixer
   */
  stop(): void {
    console.log('[AudioMixer] Stopping');

    // Disconnect all channels
    this.channels.forEach((channel, id) => {
      channel.source.disconnect();
      channel.gainNode.disconnect();
    });
    this.channels.clear();

    // Disconnect master gains
    if (this.broadcastMasterGain) {
      this.broadcastMasterGain.disconnect();
      this.broadcastMasterGain = null;
    }
    if (this.monitorMasterGain) {
      this.monitorMasterGain.disconnect();
      this.monitorMasterGain = null;
    }

    // Close audio context
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }

    this.audioContext = null;
    this.broadcastDestination = null;
    this.monitorDestination = null;
  }

  /**
   * Get number of active channels
   */
  getStreamCount(): number {
    return this.channels.size;
  }

  /**
   * Get channel info for debugging
   */
  getChannelInfo(): Array<{ id: string; isLocal: boolean; volume: number }> {
    return Array.from(this.channels.entries()).map(([id, channel]) => ({
      id,
      isLocal: channel.isLocal,
      volume: channel.gainNode.gain.value,
    }));
  }

  /**
   * Apply audio effects to a channel (producer mode)
   * This enables finer control over each audio source
   */
  setChannelEffects(id: string, effects: ChannelEffects): void {
    const channel = this.channels.get(id);
    if (!channel || !this.audioContext) {
      console.warn(`[AudioMixer] Cannot set effects for ${id}: channel not found`);
      return;
    }

    const currentTime = this.audioContext.currentTime;

    // Apply gain
    if (effects.gain !== undefined) {
      channel.gainNode.gain.setValueAtTime(
        effects.muted ? 0 : Math.max(0, Math.min(2, effects.gain)),
        currentTime
      );
    }

    // Apply mute (overrides gain)
    if (effects.muted !== undefined && effects.gain === undefined) {
      channel.gainNode.gain.setValueAtTime(effects.muted ? 0 : 1, currentTime);
    }

    // Apply high-pass filter (removes low frequency rumble)
    if (effects.highpassFreq !== undefined) {
      if (!channel.highpassFilter) {
        channel.highpassFilter = this.audioContext.createBiquadFilter();
        channel.highpassFilter.type = 'highpass';
        // Insert into chain: source -> highpass -> ...
        channel.source.disconnect();
        channel.source.connect(channel.highpassFilter);
        channel.highpassFilter.connect(channel.gainNode);
      }
      channel.highpassFilter.frequency.setValueAtTime(effects.highpassFreq, currentTime);
    }

    // Apply low-pass filter (removes harsh highs)
    if (effects.lowpassFreq !== undefined) {
      if (!channel.lowpassFilter) {
        channel.lowpassFilter = this.audioContext.createBiquadFilter();
        channel.lowpassFilter.type = 'lowpass';
        // Insert into chain
        const prevNode = channel.highpassFilter || channel.source;
        prevNode.disconnect();
        prevNode.connect(channel.lowpassFilter);
        channel.lowpassFilter.connect(channel.gainNode);
      }
      channel.lowpassFilter.frequency.setValueAtTime(effects.lowpassFreq, currentTime);
    }

    // Apply compressor (for consistent levels)
    if (effects.compressor) {
      if (!channel.compressor) {
        channel.compressor = this.audioContext.createDynamicsCompressor();
        // Insert before gain node
        const prevNode = channel.lowpassFilter || channel.highpassFilter || channel.source;
        prevNode.disconnect();
        prevNode.connect(channel.compressor);
        channel.compressor.connect(channel.gainNode);
      }

      const comp = effects.compressor;
      if (comp.threshold !== undefined) {
        channel.compressor.threshold.setValueAtTime(comp.threshold, currentTime);
      }
      if (comp.knee !== undefined) {
        channel.compressor.knee.setValueAtTime(comp.knee, currentTime);
      }
      if (comp.ratio !== undefined) {
        channel.compressor.ratio.setValueAtTime(comp.ratio, currentTime);
      }
      if (comp.attack !== undefined) {
        channel.compressor.attack.setValueAtTime(comp.attack, currentTime);
      }
      if (comp.release !== undefined) {
        channel.compressor.release.setValueAtTime(comp.release, currentTime);
      }
    }

    console.log(`[AudioMixer] Effects applied to ${id}:`, effects);
  }

  /**
   * Get audio level for a channel (for meters)
   */
  getChannelLevel(id: string): number {
    const channel = this.channels.get(id);
    if (!channel || !this.audioContext) return 0;

    // Create analyser if not exists
    if (!channel.analyser) {
      channel.analyser = this.audioContext.createAnalyser();
      channel.analyser.fftSize = 256;
      channel.analyser.smoothingTimeConstant = 0.3;
      // Connect after gain (so we see post-gain level)
      channel.gainNode.connect(channel.analyser);
    }

    const dataArray = new Uint8Array(channel.analyser.frequencyBinCount);
    channel.analyser.getByteFrequencyData(dataArray);

    // Calculate peak level
    let max = 0;
    for (let i = 0; i < dataArray.length; i++) {
      if (dataArray[i] > max) max = dataArray[i];
    }

    return max / 255;
  }

  /**
   * Apply preset effects for voice (good for speaking)
   */
  applyVoicePreset(id: string): void {
    this.setChannelEffects(id, {
      gain: 1.0,
      highpassFreq: 80,    // Remove rumble below 80Hz
      lowpassFreq: 12000,  // Remove harsh frequencies above 12kHz
      compressor: {
        threshold: -24,
        knee: 30,
        ratio: 4,
        attack: 0.003,
        release: 0.25,
      },
    });
  }

  /**
   * Apply preset effects for music
   */
  applyMusicPreset(id: string): void {
    this.setChannelEffects(id, {
      gain: 0.8,           // Slightly lower to avoid clipping
      highpassFreq: 20,    // Keep bass
      lowpassFreq: 20000,  // Keep highs
      compressor: {
        threshold: -12,
        knee: 10,
        ratio: 2,
        attack: 0.02,
        release: 0.1,
      },
    });
  }

  /**
   * Get audio levels for all channels (for visualization)
   * Returns a map of channel ID to level (0-1)
   */
  getAllChannelLevels(): Map<string, number> {
    const levels = new Map<string, number>();
    this.channels.forEach((channel, id) => {
      levels.set(id, this.getChannelLevel(id));
    });
    return levels;
  }

  /**
   * Get detailed channel info including levels (for producer mode UI)
   */
  getDetailedChannelInfo(): Array<{
    id: string;
    isLocal: boolean;
    volume: number;
    level: number;
    hasCompressor: boolean;
    hasHighpass: boolean;
    hasLowpass: boolean;
  }> {
    return Array.from(this.channels.entries()).map(([id, channel]) => ({
      id,
      isLocal: channel.isLocal,
      volume: channel.gainNode.gain.value,
      level: this.getChannelLevel(id),
      hasCompressor: !!channel.compressor,
      hasHighpass: !!channel.highpassFilter,
      hasLowpass: !!channel.lowpassFilter,
    }));
  }
}

// Export singleton instance
export const audioMixerService = new AudioMixerService();
