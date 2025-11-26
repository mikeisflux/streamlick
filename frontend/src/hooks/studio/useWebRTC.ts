// # WEBCAM-ISSUE - WebRTC initialization and cleanup
import { useState, useCallback, useEffect, useRef } from 'react';
import { webrtcService } from '../../services/webrtc.service';
import { audioMixerService } from '../../services/audio-mixer.service';
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

      // Produce video track from local stream (camera)
      const videoTrack = localStream.getVideoTracks()[0];

      if (videoTrack) {
        await webrtcService.produceMedia(videoTrack);
      }

      // CRITICAL: For monitor mode, use audio mixer output instead of raw microphone
      // This ensures ALL participants hear ALL audio sources:
      // - Microphone (already in mixer)
      // - Video audio from MediaLibrary (already in mixer)
      // - Music and other audio sources (already in mixer)
      const audioMixerOutputStream = audioMixerService.getOutputStream();

      if (audioMixerOutputStream) {
        const audioTrack = audioMixerOutputStream.getAudioTracks()[0];
        if (audioTrack) {
          await webrtcService.produceMedia(audioTrack);
          console.log('[useWebRTC] Sending audio mixer output to WebRTC (monitor mode enabled)');
        } else {
          console.warn('[useWebRTC] No audio track in mixer output stream');
        }
      } else {
        console.warn('[useWebRTC] Audio mixer not initialized, falling back to local stream audio');
        // Fallback to raw microphone if mixer not initialized
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
          await webrtcService.produceMedia(audioTrack);
        }
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
