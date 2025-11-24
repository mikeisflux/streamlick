import { useState, useRef } from 'react';
import { useMedia } from '../useMedia';
import { compositorService } from '../../services/compositor.service';
import { webrtcService } from '../../services/webrtc.service';
import { audioMixerService } from '../../services/audio-mixer.service';
import toast from 'react-hot-toast';

interface UseScreenShareProps {
  currentLayout: number;
  onLayoutChange: (layoutId: number) => void;
  isLive?: boolean; // Only produce to WebRTC when live
}

export function useScreenShare({ currentLayout, onLayoutChange, isLive = false }: UseScreenShareProps) {
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const previousLayoutRef = useRef<number | null>(null);
  const producerIdRef = useRef<string | null>(null);
  const cleanupInProgressRef = useRef(false);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const { startScreenShare, stopScreenShare } = useMedia();

  // Centralized cleanup function to prevent race conditions
  async function cleanupScreenShare() {
    // Prevent multiple simultaneous cleanup calls
    if (cleanupInProgressRef.current) return;
    cleanupInProgressRef.current = true;

    try {
      // Clear onended handler to prevent double cleanup
      if (videoTrackRef.current) {
        videoTrackRef.current.onended = null;
        videoTrackRef.current = null;
      }

      stopScreenShare();
      setIsSharingScreen(false);
      setScreenShareStream(null);
      compositorService.removeParticipant('screen-share');

      // Remove screen share audio from mixer (system audio)
      audioMixerService.removeStream('screen-share-audio');
      console.log('[ScreenShare] Removed system audio from mixer');

      // Close WebRTC producer if it exists
      if (producerIdRef.current) {
        try {
          await webrtcService.closeProducer(producerIdRef.current);
        } catch (error) {
          console.error('Failed to close screen share producer:', error);
        }
        producerIdRef.current = null;
      }

      // Restore previous layout
      if (previousLayoutRef.current !== null) {
        onLayoutChange(previousLayoutRef.current);
        previousLayoutRef.current = null;
      }
    } finally {
      cleanupInProgressRef.current = false;
    }
  }

  async function handleToggleScreenShare() {
    try {
      if (isSharingScreen) {
        await cleanupScreenShare();
        toast.success('Screen sharing stopped');
      } else {
        const stream = await startScreenShare();
        setIsSharingScreen(true);
        setScreenShareStream(stream);

        // CRITICAL: Check if screen share has audio tracks (system audio)
        // System audio should be mixed AFTER microphone processing
        const hasAudio = stream.getAudioTracks().length > 0;
        if (hasAudio) {
          console.log('[ScreenShare] System audio detected - adding to mixer (bypasses microphone processing)');

          // Add system audio directly to mixer (NOT through microphone processing)
          const audioTrack = stream.getAudioTracks()[0];
          const systemAudioStream = new MediaStream([audioTrack]);
          audioMixerService.addStream('screen-share-audio', systemAudioStream);

          console.log('[ScreenShare] System audio added to mixer:', {
            trackId: audioTrack.id,
            trackLabel: audioTrack.label,
            trackEnabled: audioTrack.enabled
          });
        } else {
          console.log('[ScreenShare] No system audio in screen share');
        }

        await compositorService.addParticipant({
          id: 'screen-share',
          name: 'Screen Share',
          stream,
          isLocal: true,
          audioEnabled: hasAudio, // Enable audio if screen share has audio tracks
          videoEnabled: true,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          videoTrackRef.current = videoTrack;

          // Only produce to WebRTC if live
          if (isLive) {
            const producerId = await webrtcService.produceMedia(videoTrack);
            producerIdRef.current = producerId;
          }

          // Handle browser-initiated screen share end (user clicks "Stop Sharing" in browser UI)
          videoTrack.onended = async () => {
            await cleanupScreenShare();
            toast.success('Screen sharing stopped');
          };
        }

        // Store current layout and switch to Screen layout (6)
        previousLayoutRef.current = currentLayout;
        onLayoutChange(6);

        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
      setIsSharingScreen(false);
      setScreenShareStream(null);
    }
  }

  return {
    isSharingScreen,
    screenShareStream,
    handleToggleScreenShare,
  };
}
