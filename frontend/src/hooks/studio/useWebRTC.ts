import { useState, useCallback, useEffect, useRef } from 'react';
import { webrtcService } from '../../services/webrtc.service';
import toast from 'react-hot-toast';

export function useWebRTC(broadcastId: string | undefined, localStream: MediaStream | null) {
  const [isInitializing, setIsInitializing] = useState(false);
  const isInitializedRef = useRef(false);

  const initializeWebRTC = useCallback(async () => {
    if (!broadcastId || !localStream) return;

    setIsInitializing(true);
    try {
      // Initialize WebRTC device
      await webrtcService.initialize(broadcastId);

      // Create send transport
      await webrtcService.createSendTransport();

      // Produce video and audio tracks
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];

      if (videoTrack) {
        await webrtcService.produceMedia(videoTrack);
      }

      if (audioTrack) {
        await webrtcService.produceMedia(audioTrack);
      }

      isInitializedRef.current = true;
      toast.success('WebRTC initialized');
    } catch (error) {
      console.error('WebRTC initialization error:', error);
      toast.error('Failed to initialize WebRTC');
    } finally {
      setIsInitializing(false);
    }
  }, [broadcastId, localStream]);

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
