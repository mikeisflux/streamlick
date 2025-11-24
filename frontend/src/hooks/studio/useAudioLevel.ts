import { useState, useEffect, useRef } from 'react';

/**
 * Hook to detect audio levels from a MediaStream
 * Returns true when audio is above speaking threshold
 */
export function useAudioLevel(stream: MediaStream | null, audioEnabled: boolean): boolean {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    // Don't process if no stream or audio disabled
    if (!stream || !audioEnabled) {
      setIsSpeaking(false);
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) {
      setIsSpeaking(false);
      return;
    }

    // Create audio context and analyser
    try {
      audioContextRef.current = new AudioContext();
      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;

      // Get audio track from stream
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        console.error('[useAudioLevel] No audio track found in stream');
        setIsSpeaking(false);
        return;
      }

      // Use createMediaStreamTrackSource instead of createMediaStreamSource
      // This allows multiple connections to the same audio track (captions + voice animations)
      // Unlike createMediaStreamSource which only allows one connection per stream
      sourceRef.current = audioContextRef.current.createMediaStreamTrackSource(audioTrack);
      sourceRef.current.connect(analyserRef.current);

      // Start analyzing audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Speaking threshold - adjust sensitivity here
        // Values typically range 0-255, threshold of 15-30 works well
        const speakingThreshold = 20;
        const speaking = average > speakingThreshold;

        // Debug logging
        if (speaking) {
          console.log('[Audio Level] Speaking detected:', { average, threshold: speakingThreshold });
        }

        setIsSpeaking(speaking);

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      checkAudioLevel();
    } catch (error) {
      console.error('[useAudioLevel] Failed to create audio analyser:', error);
      setIsSpeaking(false);
    }

    // Cleanup
    return () => {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

      if (analyserRef.current) {
        analyserRef.current.disconnect();
      }

      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, [stream, audioEnabled]);

  return isSpeaking;
}
