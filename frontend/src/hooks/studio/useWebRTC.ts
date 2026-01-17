// # WEBCAM-ISSUE - WebRTC initialization and cleanup
import { useState, useCallback, useEffect, useRef } from 'react';
import { webrtcService } from '../../services/webrtc.service';
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

      // Architecture: All Participants → LiveKit → All Participants
      //                                    ↓
      //                        Host composites → RTMP out
      //
      // Each participant publishes their individual camera/mic to LiveKit
      // Host composites all streams locally and sends composite to RTMP
      // We publish raw localStream (individual camera) NOT the canvas composite
      if (localStream) {
        console.log('[useWebRTC] Joining LiveKit room with local stream (individual camera):', {
          videoTracks: localStream.getVideoTracks().length,
          audioTracks: localStream.getAudioTracks().length,
        });

        // Join the LiveKit conference room with individual camera/mic
        // This publishes our stream and allows us to receive guest streams
        await webrtcService.joinRoom(localStream);
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
