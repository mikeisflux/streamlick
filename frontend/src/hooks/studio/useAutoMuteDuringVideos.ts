import { useEffect, useRef } from 'react';
import { compositorService } from '../../services/compositor.service';
import { logger } from '../../utils/logger';

/**
 * Hook to automatically mute participants during video playback
 * Users can still manually unmute themselves if they want
 */
export function useAutoMuteDuringVideos(
  localStream: MediaStream | null,
  audioEnabled: boolean
) {
  // Track the audio state before video started
  const audioStateBeforeVideo = useRef<boolean>(true);
  const isVideoPlaying = useRef<boolean>(false);

  useEffect(() => {
    const handleVideoStart = () => {
      logger.info('[Auto-Mute] Video started - muting participants');
      isVideoPlaying.current = true;

      // Store current audio state
      audioStateBeforeVideo.current = audioEnabled;

      // Mute local audio track if currently enabled
      if (localStream && audioEnabled) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          audioTrack.enabled = false;
          logger.info('[Auto-Mute] Local audio muted during video playback');
        }
      }
    };

    const handleVideoEnd = () => {
      logger.info('[Auto-Mute] Video ended - restoring audio state');
      isVideoPlaying.current = false;

      // Restore previous audio state (unless user manually changed it during playback)
      if (localStream && audioStateBeforeVideo.current) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack && !audioTrack.enabled) {
          // Only restore if track is still muted (user didn't manually unmute)
          audioTrack.enabled = true;
          logger.info('[Auto-Mute] Local audio restored after video playback');
        }
      }
    };

    // Register callbacks with compositor service
    compositorService.setVideoPlaybackCallbacks(handleVideoStart, handleVideoEnd);

    logger.info('[Auto-Mute] Video playback callbacks registered');

    // Cleanup on unmount
    return () => {
      logger.info('[Auto-Mute] Video playback callbacks unregistered');
    };
  }, [localStream, audioEnabled]);

  return {
    isVideoPlaying: isVideoPlaying.current,
  };
}
