import { useState, useCallback, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { antMediaService } from '../../services/antmedia.service';
import { compositorService } from '../../services/compositor.service';
import { recordingService } from '../../services/recording.service';
import { useStudioStore } from '../../store/studioStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface UseBroadcastProps {
  broadcastId: string | undefined;
  localStream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  remoteParticipants: Map<string, RemoteParticipant>;
  destinations: any[];
  selectedDestinations: string[];
  showChatOnStream: boolean;
  initializeWebRTC: () => Promise<void>;
  destinationSettings: { privacy: Record<string, string>; schedule: Record<string, string>; title: Record<string, string>; description: Record<string, string> };
}

export function useBroadcast({
  broadcastId,
  localStream,
  audioEnabled,
  videoEnabled,
  remoteParticipants,
  destinations,
  selectedDestinations,
  showChatOnStream,
  initializeWebRTC,
  destinationSettings,
}: UseBroadcastProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentLayout, setCurrentLayout] = useState<'grid' | 'spotlight' | 'sidebar' | 'pip'>('grid');
  const [selectedLayout, setSelectedLayout] = useState<number>(9);

  const { broadcast, setIsLive } = useStudioStore();

  // Use ref to store recording interval ID
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    };
  }, []);

  // Recording functions defined first to avoid circular dependency
  const handleStartRecording = useCallback(async () => {
    try {
      const compositeStream = compositorService.getOutputStream();
      if (!compositeStream) {
        toast.error('No composite stream available');
        return;
      }

      await recordingService.startRecording(compositeStream);
      setIsRecording(true);
      toast.success('Recording started');

      // Clear any existing interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      // Update duration every second
      const interval = setInterval(() => {
        setRecordingDuration(recordingService.getDuration());
      }, 1000);

      // Store interval in ref for cleanup
      recordingIntervalRef.current = interval;
    } catch (error) {
      console.error('Recording start error:', error);
      toast.error('Failed to start recording');
    }
  }, []);

  const handleStopRecording = useCallback(async () => {
    try {
      const blob = await recordingService.stopRecording();
      const duration = recordingDuration;

      setIsRecording(false);
      setRecordingDuration(0);

      // Clear interval
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      // Save recording locally to user's laptop
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const title = broadcast?.title || 'Untitled Broadcast';
      const filename = `${title}-${timestamp}.webm`;

      await recordingService.downloadRecording(blob, filename, {
        title,
        broadcastId,
        duration,
      });

      toast.success(`Recording saved to Downloads: ${filename}`);
    } catch (error) {
      console.error('Recording stop error:', error);
      toast.error('Failed to stop recording');
    }
  }, [broadcast, broadcastId, recordingDuration]);

  const handleGoLive = useCallback(async () => {
    if (!broadcastId) return false;

    // CRITICAL: Deduplicate selected destinations before processing
    const deduplicatedDestinations = Array.from(new Set(selectedDestinations));

    if (deduplicatedDestinations.length !== selectedDestinations.length) {
      console.warn('[useBroadcast] Found duplicate destination IDs before going live:', {
        original: selectedDestinations,
        deduplicated: deduplicatedDestinations,
        duplicateCount: selectedDestinations.length - deduplicatedDestinations.length,
      });
    }

    if (deduplicatedDestinations.length === 0) {
      toast.error('Please select at least one destination');
      return false;
    }

    try {
      // Initialize Ant Media service
      await antMediaService.initialize(broadcastId);

      // Initialize compositor with only LIVE participants (exclude backstage)
      const participantStreams = [
        {
          id: 'local',
          name: 'You',
          stream: localStream!,
          isLocal: true,
          audioEnabled,
          videoEnabled,
        },
        ...Array.from(remoteParticipants.values())
          .filter((p) => p.role === 'host' || p.role === 'guest') // Only live participants
          .map((p) => ({
            id: p.id,
            name: p.name,
            stream: p.stream!,
            isLocal: false,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          })),
      ].filter((p) => p.stream);

      await compositorService.initialize(participantStreams);
      compositorService.setLayout({ type: currentLayout });

      // Get composite stream
      const compositeStream = compositorService.getOutputStream();
      if (!compositeStream) {
        throw new Error('Failed to get composite stream');
      }

      // Prepare destination settings for API
      const apiDestinationSettings: Record<string, { privacyStatus?: string; scheduledStartTime?: string; title?: string; description?: string }> = {};
      deduplicatedDestinations.forEach((destId) => {
        const destTitle = destinationSettings.title[destId];
        const destDescription = destinationSettings.description[destId];

        // Use destination-specific title/description if set, otherwise fall back to broadcast's title/description
        const title = (destTitle && destTitle !== 'Loading') ? destTitle : broadcast?.title;
        const description = (destDescription && destDescription !== 'Loading') ? destDescription : broadcast?.description;

        apiDestinationSettings[destId] = {
          privacyStatus: destinationSettings.privacy[destId] || 'public',
          scheduledStartTime: destinationSettings.schedule[destId] || undefined,
          title,
          description,
        };
      });

      console.log('[useBroadcast] Starting broadcast with:', {
        selectedDestinations: deduplicatedDestinations,
        destinationCount: deduplicatedDestinations.length,
        apiDestinationSettings
      });

      // Start broadcast with destination settings (using deduplicated array)
      // This triggers the 10-second countdown on the backend
      await broadcastService.start(broadcastId, deduplicatedDestinations, apiDestinationSettings);

      // FLOW: 10-second countdown → intro video → user stream
      // Step 1: Display 10-second countdown on canvas
      console.log('[useBroadcast] Starting 10-second countdown on canvas...');
      await compositorService.startCountdown(10);
      console.log('[useBroadcast] Countdown finished!');

      // Wait a bit more for YouTube/Facebook broadcasts to be created
      console.log('[useBroadcast] Waiting for broadcast destinations to be created...');
      await new Promise(resolve => setTimeout(resolve, 2000)); // Additional 2 seconds

      // Step 2: Play intro video AFTER countdown finishes
      console.log('[useBroadcast] Countdown finished! Starting intro video...');
      try {
        await compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');
        console.log('[useBroadcast] Intro video finished, transitioning to user stream');
      } catch (error) {
        console.error('Intro video failed to play:', error);
        // Continue even if intro video fails
      }

      // Step 3: Fetch broadcast destinations with decrypted RTMP URLs and stream keys
      const broadcastDestinationsResponse = await api.get(`/broadcasts/${broadcastId}/destinations`);
      const broadcastDestinations = broadcastDestinationsResponse.data;

      console.log('[useBroadcast] Fetched broadcast destinations:', broadcastDestinations);

      // Step 4: Create Ant Media broadcast and add RTMP endpoints
      const antBroadcast = await antMediaService.createBroadcast(`streamlick-${broadcastId}`);
      console.log('[useBroadcast] Ant Media broadcast created:', antBroadcast.streamId);

      // Add RTMP endpoints for each destination (multi-destination streaming)
      for (const bd of broadcastDestinations) {
        const fullRtmpUrl = bd.streamKey
          ? `${bd.rtmpUrl}/${bd.streamKey}`
          : bd.rtmpUrl;

        console.log('[useBroadcast] Adding RTMP endpoint:', {
          platform: bd.platform,
          destinationId: bd.id,
        });

        await antMediaService.addRtmpEndpoint(antBroadcast.streamId, fullRtmpUrl, bd.id);
      }

      // Step 5: Start publishing composite stream via WebRTC to Ant Media
      console.log('[useBroadcast] Starting WebRTC publish to Ant Media...');
      await antMediaService.startPublishing(
        compositeStream,
        antBroadcast.streamId,
        (info) => {
          console.log('[useBroadcast] Ant Media status:', info);
          if (info === 'publish_started') {
            console.log('[useBroadcast] WebRTC stream is now being forwarded to RTMP destinations');
          }
        },
        (error, message) => {
          console.error('[useBroadcast] Ant Media error:', error, message);
          toast.error(`Streaming error: ${error}`);
        }
      );

      // Start chat polling
      socketService.emit('start-chat', { broadcastId });

      // Enable chat display on compositor
      compositorService.setShowChat(showChatOnStream);

      // Automatically start recording
      try {
        await handleStartRecording();
        console.log('Auto-recording started');
      } catch (error) {
        console.error('Failed to auto-start recording:', error);
        // Don't fail the broadcast if recording fails
      }

      toast.success('You are now live!');
      setIsLive(true);
      return true;
    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to go live');
      return false;
    }
  }, [
    broadcastId,
    localStream,
    audioEnabled,
    videoEnabled,
    remoteParticipants,
    selectedDestinations,
    destinations,
    currentLayout,
    showChatOnStream,
    setIsLive,
    handleStartRecording,
    destinationSettings,
    broadcast,
  ]);

  const handleEndBroadcast = useCallback(async () => {
    if (!broadcastId) return false;

    try {
      // Always stop recording if active (auto-recording should be running)
      if (isRecording) {
        await handleStopRecording();
      }

      // Stop chat polling
      socketService.emit('stop-chat', { broadcastId });

      // Stop compositor
      compositorService.stop();

      // Stop Ant Media streaming and clean up
      await antMediaService.close();

      await broadcastService.end(broadcastId);
      toast.success('Broadcast ended');
      setIsLive(false);
      return true;
    } catch (error) {
      toast.error('Failed to end broadcast');
      return false;
    }
  }, [broadcastId, isRecording, handleStopRecording, setIsLive]);

  const handleLayoutChange = useCallback((layoutId: number) => {
    // Update UI state
    setSelectedLayout(layoutId);

    // Map numeric layout IDs to compositor layout types
    const layoutMap: { [key: number]: 'grid' | 'spotlight' | 'sidebar' | 'pip' } = {
      1: 'grid',      // Solo
      2: 'grid',      // Cropped
      3: 'grid',      // Group
      4: 'spotlight', // Spotlight
      5: 'sidebar',   // News
      6: 'sidebar',   // Screen
      7: 'pip',       // Picture-in-Picture
      8: 'sidebar',   // Cinema
    };

    const layoutType = layoutMap[layoutId] || 'grid';
    // Pass both type and layoutId for precise positioning
    compositorService.setLayout({ type: layoutType, layoutId });

    // Get layout name for toast
    const layoutNames: { [key: number]: string } = {
      1: 'Solo',
      2: 'Cropped',
      3: 'Group',
      4: 'Spotlight',
      5: 'News',
      6: 'Screen',
      7: 'Picture-in-Picture',
      8: 'Cinema'
    };

    toast.success(`Layout changed to ${layoutNames[layoutId] || 'Unknown'}`);
  }, [setSelectedLayout]);

  return {
    isRecording,
    recordingDuration,
    currentLayout,
    setCurrentLayout,
    selectedLayout,
    setSelectedLayout,
    handleGoLive,
    handleEndBroadcast,
    handleStartRecording,
    handleStopRecording,
    handleLayoutChange,
  };
}
