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
    console.log('[useAudioLevel] Effect triggered', {
      hasStream: !!stream,
      audioEnabled,
      streamId: stream?.id,
      audioTracks: stream?.getAudioTracks().length
    });

    // Don't process if no stream or audio disabled
    if (!stream || !audioEnabled) {
      console.log('[useAudioLevel] Early exit - no stream or audio disabled');
      setIsSpeaking(false);
      return;
    }

    // Check if stream has audio tracks
    const audioTracks = stream.getAudioTracks();
    console.log('[useAudioLevel] Audio tracks:', audioTracks.map(t => ({
      id: t.id,
      label: t.label,
      enabled: t.enabled,
      readyState: t.readyState,
      muted: t.muted
    })));

    if (audioTracks.length === 0) {
      console.log('[useAudioLevel] No audio tracks in stream');
      setIsSpeaking(false);
      return;
    }

    // Create audio context and analyser
    try {
      console.log('[useAudioLevel] Creating AudioContext...');
      audioContextRef.current = new AudioContext();
      console.log('[useAudioLevel] AudioContext created, state:', audioContextRef.current.state);

      analyserRef.current = audioContextRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      analyserRef.current.smoothingTimeConstant = 0.8;
      console.log('[useAudioLevel] AnalyserNode created');

      // Clone the stream so we can create our own MediaStreamSource
      // This allows both captions and voice animations to analyze the same audio
      const audioTrack = stream.getAudioTracks()[0];
      if (!audioTrack) {
        console.error('[useAudioLevel] No audio track found in stream');
        setIsSpeaking(false);
        return;
      }

      console.log('[useAudioLevel] Cloning audio track:', {
        id: audioTrack.id,
        enabled: audioTrack.enabled,
        readyState: audioTrack.readyState
      });

      // Create a new MediaStream with cloned audio track
      const clonedTrack = audioTrack.clone();
      const clonedStream = new MediaStream([clonedTrack]);
      console.log('[useAudioLevel] Cloned stream created, active:', clonedStream.active);

      sourceRef.current = audioContextRef.current.createMediaStreamSource(clonedStream);
      sourceRef.current.connect(analyserRef.current);
      console.log('[useAudioLevel] MediaStreamSource connected to analyser');

      // Start analyzing audio levels
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      console.log('[useAudioLevel] Starting audio level monitoring, buffer size:', dataArray.length);

      const checkAudioLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);

        // Calculate average amplitude
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
        }
        const average = sum / dataArray.length;

        // Speaking threshold - adjusted to be more sensitive
        // Values typically range 0-255, threshold of 10-15 works well for most mics
        const speakingThreshold = 10;
        const speaking = average > speakingThreshold;

        // Debug logging - log every frame for now to diagnose
        console.log('[Audio Level]', {
          average: average.toFixed(2),
          threshold: speakingThreshold,
          speaking,
          audioEnabled,
          firstFewValues: Array.from(dataArray.slice(0, 10))
        });

        setIsSpeaking(speaking);

        animationFrameRef.current = requestAnimationFrame(checkAudioLevel);
      };

      console.log('[useAudioLevel] Starting checkAudioLevel loop...');
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
