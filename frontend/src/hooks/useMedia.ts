// # WEBCAM-ISSUE - toggleVideo() only disables tracks, doesn't stop them
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

  const startCamera = useCallback(async (options?: {
    videoDeviceId?: string;
    audioDeviceId?: string;
    facingMode?: 'user' | 'environment';
    // Resolution options for bandwidth optimization
    width?: number;
    height?: number;
    frameRate?: number;
  }) => {
    try {
      // Stop existing stream if switching devices
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (rawStreamRef.current) {
        rawStreamRef.current.getTracks().forEach(track => track.stop());
      }
      audioMixerService.removeStream('local-microphone');
      audioProcessorService.stop();

      // Get all audio devices and select MICROPHONE, not system audio
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');

      // Filter out system audio devices - only use actual microphones
      const microphones = audioInputs.filter(device => {
        const name = device.label.toLowerCase();
        return !(
          name.includes('stereo mix') ||
          name.includes('wave out') ||
          name.includes('what u hear') ||
          name.includes('loopback') ||
          name.includes('system audio') ||
          name.includes('monitor')
        );
      });

      // Use provided audioDeviceId, or fall back to first microphone
      const micDeviceId = options?.audioDeviceId || (microphones.length > 0 ? microphones[0].deviceId : undefined);
      console.log('[useMedia] Using microphone:', microphones.find(m => m.deviceId === micDeviceId)?.label || 'default');

      // Build video constraints - support deviceId or facingMode (for mobile)
      // Use provided resolution or default to 1080p
      const targetWidth = options?.width || 1920;
      const targetHeight = options?.height || 1080;
      const targetFrameRate = options?.frameRate || 30;

      let videoConstraints: MediaTrackConstraints = {
        width: { ideal: targetWidth, max: targetWidth },
        height: { ideal: targetHeight, max: targetHeight },
        frameRate: { ideal: targetFrameRate, max: targetFrameRate },
      };

      console.log('[useMedia] Video constraints:', { width: targetWidth, height: targetHeight, frameRate: targetFrameRate });

      if (options?.videoDeviceId) {
        videoConstraints.deviceId = { exact: options.videoDeviceId };
        console.log('[useMedia] Using video device by ID:', options.videoDeviceId);
      } else if (options?.facingMode) {
        videoConstraints.facingMode = { ideal: options.facingMode };
        console.log('[useMedia] Using video facingMode:', options.facingMode);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints,
        audio: micDeviceId ? {
          deviceId: { exact: micDeviceId },
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 },
        } : {
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          sampleRate: { ideal: 48000 },
          sampleSize: { ideal: 16 },
          channelCount: { ideal: 2 },
        },
      });

      // Store raw stream
      rawStreamRef.current = stream;

      // Process audio through noise gate (always active, even when not live)
      logger.info('[useMedia] Processing audio through noise gate');
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

        // CRITICAL: Initialize audio mixer and add microphone for broadcast output
        // playLocally=false because host should NOT hear their own mic through speakers (causes feedback)
        // The mic audio goes to the mixer output which is sent to guests via preview stream
        audioMixerService.initialize();
        audioMixerService.addStream('local-microphone', new MediaStream([processedAudioTrack]), false);
        logger.info('[useMedia] Microphone added to audio mixer (broadcast only)');

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
    console.log('[useMedia] toggleAudio called, stream:', !!localStreamRef.current);
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      console.log('[useMedia] audioTrack:', !!audioTrack, 'enabled:', audioTrack?.enabled);
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setAudioEnabled(audioTrack.enabled);
        console.log('[useMedia] Audio toggled to:', audioTrack.enabled);
      }
    } else {
      console.warn('[useMedia] toggleAudio: No local stream available');
    }
  }, []); // No dependencies - uses ref

  const toggleVideo = useCallback(() => {
    console.log('[useMedia] toggleVideo called, stream:', !!localStreamRef.current);
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      console.log('[useMedia] videoTrack:', !!videoTrack, 'enabled:', videoTrack?.enabled);
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setVideoEnabled(videoTrack.enabled);
        console.log('[useMedia] Video toggled to:', videoTrack.enabled);
      }
    } else {
      console.warn('[useMedia] toggleVideo: No local stream available');
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
