// # WEBCAM-ISSUE - WebRTC initialization and cleanup
import { useState, useCallback, useEffect, useRef } from 'react';
import { webrtcService } from '../../services/webrtc.service';
import { audioMixerService } from '../../services/audio-mixer.service';
import { canvasStreamService } from '../../services/canvas-stream.service';
import toast from 'react-hot-toast';

export function useWebRTC(
  broadcastId: string | undefined,
  localStream: MediaStream | null,
  participantId?: string
) {
  const [isInitializing, setIsInitializing] = useState(false);
  const isInitializedRef = useRef(false);

  const initializeWebRTC = useCallback(async () => {
    if (!broadcastId) return;

    setIsInitializing(true);
    try {
      // Initialize WebRTC connection to LiveKit SFU with participant ID
      // This ensures the LiveKit participant.identity matches our database ID
      await webrtcService.initialize(broadcastId, participantId);

      // Get the canvas output stream (composited video) for publishing to LiveKit
      // This is what guests will see in their preview
      let publishStream: MediaStream | null = canvasStreamService.getOutputStream();

      if (!publishStream) {
        // Canvas not ready yet - use local stream temporarily
        // The canvas stream will be published when it becomes available
        console.log('[useWebRTC] Canvas stream not ready, using local stream');
        publishStream = localStream;
      }

      if (publishStream) {
        // Create combined stream with canvas video + audio mixer output
        const audioMixerOutputStream = audioMixerService.getOutputStream();
        const combinedTracks: MediaStreamTrack[] = [];

        // Add video track from canvas (or local stream if canvas not ready)
        const videoTrack = publishStream.getVideoTracks()[0];
        if (videoTrack) {
          combinedTracks.push(videoTrack);
        }

        // Add audio track from audio mixer (all audio sources combined)
        if (audioMixerOutputStream) {
          const audioTrack = audioMixerOutputStream.getAudioTracks()[0];
          if (audioTrack) {
            combinedTracks.push(audioTrack);
            console.log('[useWebRTC] Added audio mixer output to LiveKit stream');
          }
        } else if (localStream) {
          // Fallback to raw microphone if mixer not initialized
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            combinedTracks.push(audioTrack);
            console.warn('[useWebRTC] Audio mixer not ready, using raw microphone');
          }
        }

        const combinedStream = new MediaStream(combinedTracks);
        console.log('[useWebRTC] Joining LiveKit room with combined stream:', {
          videoTracks: combinedStream.getVideoTracks().length,
          audioTracks: combinedStream.getAudioTracks().length,
        });

        // Join the LiveKit conference room
        // This publishes our stream and allows us to receive guest streams
        await webrtcService.joinRoom(combinedStream);
      } else {
        console.warn('[useWebRTC] No stream available to publish');
      }

      isInitializedRef.current = true;
      toast.success('WebRTC initialized');
    } catch (error) {
      console.error('WebRTC initialization error:', error);
      toast.error('Failed to initialize WebRTC');
    } finally {
      setIsInitializing(false);
    }
  }, [broadcastId, localStream, participantId]);

  // Cleanup WebRTC on unmount
  useEffect(() => {
    return () => {
      if (isInitializedRef.current) {
        webrtcService.close().catch((error) => {
          console.error('Error closing WebRTC:', error);
        });
        isInitializedRef.current = false;
      }
    };
  }, []);

  return {
    isInitializing,
    initializeWebRTC,
  };
}
