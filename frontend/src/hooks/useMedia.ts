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
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
        audio: {
          // Enable all noise reduction features
          echoCancellation: { ideal: true },
          noiseSuppression: { ideal: true },
          autoGainControl: { ideal: true },
          // High-quality audio settings
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
