import { useState, useCallback, useRef, useEffect } from 'react';
import { audioProcessorService } from '../services/audio-processor.service';
import { audioMixerService } from '../services/audio-mixer.service';
import { logger } from '../utils/logger';

export function useMedia() {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [videoEnabled, setVideoEnabled] = useState(true);

  // Use refs to avoid stale closures in callbacks
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const rawStreamRef = useRef<MediaStream | null>(null); // Original unprocessed stream

  // Keep refs in sync with state
  useEffect(() => {
    localStreamRef.current = localStream;
  }, [localStream]);

  useEffect(() => {
    screenStreamRef.current = screenStream;
  }, [screenStream]);

  const startCamera = useCallback(async () => {
    try {
      // DIAGNOSTIC: Show all available audio devices and filter out system audio
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log('[useMedia] All audio input devices:', audioInputs.map(d => ({
        id: d.deviceId,
        label: d.label,
        groupId: d.groupId
      })));

      // Filter out system audio capture devices (Stereo Mix, Wave Out, etc.)
      const microphoneDevices = audioInputs.filter(device => {
        const name = device.label.toLowerCase();
        const isSystemAudio =
          name.includes('stereo mix') ||
          name.includes('wave out') ||
          name.includes('what u hear') ||
          name.includes('loopback') ||
          name.includes('system audio') ||
          name.includes('wave out mix') ||
          name.includes('waveout') ||
          name.includes('monitor');

        if (isSystemAudio) {
          console.warn('[useMedia] ⚠️  EXCLUDING system audio device:', device.label);
        }
        return !isSystemAudio;
      });

      console.log('[useMedia] ✅ Microphone devices (system audio excluded):', microphoneDevices.map(d => d.label));

      // Use first microphone device, not default (which might be system audio)
      const preferredDevice = microphoneDevices.length > 0 ? microphoneDevices[0].deviceId : undefined;

      if (!preferredDevice) {
        throw new Error('No microphone devices found! Only system audio devices detected. Please ensure a microphone is connected.');
      }

      console.log('[useMedia] 🎤 Using microphone:', microphoneDevices[0].label);

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          // Force use of microphone, not default device (which might be system audio)
          deviceId: { exact: preferredDevice },
          // Enable all noise reduction features for microphone
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // High-quality audio settings
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 },
        },
      });

      // DIAGNOSTIC: Show which audio device was actually selected
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        const settings = audioTrack.getSettings();
        const capabilities = audioTrack.getCapabilities();
        console.log('[useMedia] ⚠️  AUDIO DEVICE IN USE:', {
          deviceId: settings.deviceId,
          label: audioTrack.label,
          sampleRate: settings.sampleRate,
          channelCount: settings.channelCount,
          echoCancellation: settings.echoCancellation,
          noiseSuppression: settings.noiseSuppression,
          autoGainControl: settings.autoGainControl,
          capabilities: capabilities
        });

        // Warn if device name suggests system audio capture
        const deviceName = audioTrack.label.toLowerCase();
        if (deviceName.includes('stereo mix') ||
            deviceName.includes('wave out') ||
            deviceName.includes('what u hear') ||
            deviceName.includes('loopback') ||
            deviceName.includes('system audio')) {
          console.error('[useMedia] ⚠️⚠️⚠️ WARNING: System audio capture device detected!');
          console.error('[useMedia] Device:', audioTrack.label);
          console.error('[useMedia] This will capture your music/system sounds instead of microphone!');
          console.error('[useMedia] Please select a microphone device in your browser settings.');
        }
      }

      // Store raw stream
      rawStreamRef.current = stream;

      // Process audio through noise gate (always active, even when not live)
      logger.info('[useMedia] Processing microphone audio through noise gate');
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];

      logger.info('[useMedia] Original stream tracks:', {
        hasAudio: !!audioTrack,
        hasVideo: !!videoTrack,
        videoEnabled: videoTrack?.enabled,
        videoReadyState: videoTrack?.readyState,
        audioEnabled: audioTrack?.enabled,
      });

      if (audioTrack) {
        // Create stream with just audio for processing
        const audioOnlyStream = new MediaStream([audioTrack]);

        // Process through audio processor (noise gate, etc.)
        const processedAudioStream = await audioProcessorService.initialize(audioOnlyStream);
        const processedAudioTrack = processedAudioStream.getAudioTracks()[0];

        // Create combined stream with processed audio + original video
        const processedStream = new MediaStream([
          processedAudioTrack,
          ...(videoTrack ? [videoTrack] : []),
        ]);

        logger.info('[useMedia] Processed stream tracks:', {
          videoTracks: processedStream.getVideoTracks().length,
          audioTracks: processedStream.getAudioTracks().length,
          videoTrack: processedStream.getVideoTracks()[0]?.id,
          videoEnabled: processedStream.getVideoTracks()[0]?.enabled,
        });

        // CRITICAL: Initialize audio mixer and add microphone for monitor mode
        // This ensures all participants hear the microphone audio when WebRTC starts
        audioMixerService.initialize();
        audioMixerService.addStream('local-microphone', new MediaStream([processedAudioTrack]));
        logger.info('[useMedia] Microphone added to audio mixer for monitor mode');

        localStreamRef.current = processedStream;
        setLocalStream(processedStream);
        logger.info('[useMedia] Audio processing active - noise gate enabled');
        return processedStream;
      } else {
        // No audio track - just use original stream
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      throw error;
    }
  }, []);

  const stopCamera = useCallback(() => {
    // Remove microphone from audio mixer
    audioMixerService.removeStream('local-microphone');
    logger.info('[useMedia] Microphone removed from audio mixer');

    // Stop audio processor
    audioProcessorService.stop();

    // Stop all tracks
    if (rawStreamRef.current) {
      rawStreamRef.current.getTracks().forEach((track) => track.stop());
      rawStreamRef.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
    }

    setLocalStream(null);
    logger.info('[useMedia] Camera stopped, audio processing stopped');
  }, []); // No dependencies - uses ref

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always',
        } as MediaTrackConstraints,
        audio: {
          // Disable processing for system audio to preserve original quality
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
        },
      });
      screenStreamRef.current = stream;
      setScreenStream(stream);

      // Log if system audio was included
      const hasAudio = stream.getAudioTracks().length > 0;
      console.log(`[useMedia] Screen share ${hasAudio ? 'includes' : 'does not include'} system audio`);

      return stream;
    } catch (error) {
      console.error('Error sharing screen:', error);
      throw error;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
  }, []); // No dependencies - uses ref

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
      }
    }
  }, []); // No dependencies - uses ref

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
      }
    }
  }, []); // No dependencies - uses ref

  return {
    localStream,
    rawStream: rawStreamRef.current, // Raw audio before noise gate - use for audio level detection
    screenStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
  };
}
