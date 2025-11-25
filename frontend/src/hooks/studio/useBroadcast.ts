import { useState, useCallback, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { antMediaService } from '../../services/antmedia.service';
import { studioCanvasOutputService } from '../../services/studioCanvasOutput.service';
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
  const [selectedLayout, setSelectedLayout] = useState<number>(1);
  const [activeStreamId, setActiveStreamId] = useState<string | null>(null);
  const [failoverCount, setFailoverCount] = useState(0);

  const { broadcast, setIsLive } = useStudioStore();

  // Refs to store backup stream IDs for cleanup
  const backupStreamIdsRef = useRef<string[]>([]);

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

  // Set up failover callback
  useEffect(() => {
    antMediaService.onFailover((fromStream, toStream, reason) => {
      console.warn(`[useBroadcast] Stream failover: ${fromStream} -> ${toStream} (reason: ${reason})`);
      setActiveStreamId(toStream);
      setFailoverCount((prev) => prev + 1);

      // Notify user about failover
      if (reason.includes('ice_failed') || reason.includes('ice_disconnected')) {
        toast('Connection unstable - switching to backup stream', { icon: '⚠️' });
      } else if (reason.includes('low_bitrate')) {
        toast('Bitrate dropped - switching to backup stream', { icon: '⚠️' });
      } else if (reason.includes('packet_loss')) {
        toast('High packet loss - switching to backup stream', { icon: '⚠️' });
      } else {
        toast('Stream failover in progress...', { icon: '🔄' });
      }
    });
  }, []);

  // Recording functions defined first to avoid circular dependency
  const handleStartRecording = useCallback(async () => {
    try {
      const compositeStream = studioCanvasOutputService.getOutputStream();
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

      await studioCanvasOutputService.initialize(participantStreams);
      studioCanvasOutputService.setLayout({ type: currentLayout });

      // Get composite stream
      const compositeStream = studioCanvasOutputService.getOutputStream();
      if (!compositeStream) {
        throw new Error('Failed to get composite stream');
      }

      // Log composite stream details for debugging
      const videoTracks = compositeStream.getVideoTracks();
      const audioTracks = compositeStream.getAudioTracks();
      console.log('[useBroadcast] Composite stream obtained:', {
        videoTracks: videoTracks.length,
        audioTracks: audioTracks.length,
        videoTrackSettings: videoTracks[0]?.getSettings(),
        videoTrackEnabled: videoTracks[0]?.enabled,
        videoTrackReadyState: videoTracks[0]?.readyState,
        audioTrackEnabled: audioTracks[0]?.enabled,
        audioTrackReadyState: audioTracks[0]?.readyState,
      });

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

      // FLOW: Play intro video (which includes countdown) → user stream
      // The intro video (StreamLick.mp4) contains the countdown - no separate countdown overlay needed
      console.log('[useBroadcast] Starting intro video (includes countdown)...');
      try {
        await studioCanvasOutputService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');
        console.log('[useBroadcast] Intro video finished, transitioning to user stream');
      } catch (error) {
        console.error('Intro video failed to play:', error);
        // Continue even if intro video fails
      }

      // Wait for broadcast destinations to be ready
      console.log('[useBroadcast] Waiting for broadcast destinations to be ready...');
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Step 3: Fetch broadcast destinations with decrypted RTMP URLs and stream keys
      const broadcastDestinationsResponse = await api.get(`/broadcasts/${broadcastId}/destinations`);
      const broadcastDestinations = broadcastDestinationsResponse.data;

      console.log('[useBroadcast] Fetched broadcast destinations:', broadcastDestinations);

      // Step 4: Create Ant Media broadcast with failover support
      const antBroadcast = await antMediaService.createBroadcast(`streamlick-${broadcastId}`);
      console.log('[useBroadcast] Ant Media primary broadcast created:', antBroadcast.streamId);
      setActiveStreamId(antBroadcast.streamId);

      // Create backup streams for failover (2 redundant connections)
      console.log('[useBroadcast] Creating backup streams for failover...');
      const backupStreamIds = await antMediaService.createBackupStreams(`streamlick-${broadcastId}`, 2);
      backupStreamIdsRef.current = backupStreamIds;
      console.log('[useBroadcast] Backup streams created:', backupStreamIds);

      // Deduplicate broadcast destinations by ID
      const seenDestinations = new Set<string>();
      const uniqueDestinations = broadcastDestinations.filter((bd: { id: string }) => {
        if (seenDestinations.has(bd.id)) {
          console.warn('[useBroadcast] Skipping duplicate destination:', bd.id);
          return false;
        }
        seenDestinations.add(bd.id);
        return true;
      });

      console.log('[useBroadcast] Unique destinations:', uniqueDestinations.length, 'of', broadcastDestinations.length);

      // Step 5: Start publishing composite stream via WebRTC to Ant Media FIRST
      // IMPORTANT: RTMP endpoints must be added AFTER stream is active
      // Uses failover architecture with primary + 2 backup connections
      console.log('[useBroadcast] Starting WebRTC publish to Ant Media with failover support...');
      await antMediaService.startPublishing(
        compositeStream,
        antBroadcast.streamId,
        (info, obj) => {
          console.log('[useBroadcast] Ant Media status:', info);
          if (info === 'publish_started') {
            console.log('[useBroadcast] WebRTC stream is now active on Ant Media');
          }
          if (info === 'failover') {
            const failoverInfo = obj as { from: string; to: string; reason: string };
            console.log('[useBroadcast] Failover occurred:', failoverInfo);
          }
        },
        (error, message) => {
          console.error('[useBroadcast] Ant Media error:', error, message);
          toast.error(`Streaming error: ${error}`);
        },
        backupStreamIds // Pass backup stream IDs for failover
      );

      // Step 6: Add RTMP endpoints AFTER WebRTC stream is active
      // This ensures Ant Media has an active stream to forward to RTMP destinations
      console.log('[useBroadcast] Stream active, now adding RTMP endpoints...');
      for (const bd of uniqueDestinations) {
        const fullRtmpUrl = bd.streamKey
          ? `${bd.rtmpUrl}/${bd.streamKey}`
          : bd.rtmpUrl;

        console.log('[useBroadcast] Adding RTMP endpoint:', {
          platform: bd.platform,
          destinationId: bd.id,
          hasStreamKey: !!bd.streamKey,
          rtmpUrlPreview: bd.rtmpUrl?.substring(0, 40) + '...',
        });

        try {
          await antMediaService.addRtmpEndpoint(antBroadcast.streamId, fullRtmpUrl, bd.id);
          console.log('[useBroadcast] RTMP endpoint added successfully for:', bd.platform);
        } catch (error) {
          console.error('[useBroadcast] Failed to add RTMP endpoint:', error);
          // Continue with other destinations
        }
      }

      console.log('[useBroadcast] All RTMP endpoints configured, stream is being forwarded');

      // Start chat polling
      socketService.emit('start-chat', { broadcastId });

      // Enable chat display on compositor
      studioCanvasOutputService.setShowChat(showChatOnStream);

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
      studioCanvasOutputService.stop();

      // Stop Ant Media streaming and clean up (includes all backup streams)
      await antMediaService.close();

      // Clean up backup streams from Ant Media server
      const backupIds = backupStreamIdsRef.current;
      for (const backupId of backupIds) {
        try {
          await antMediaService.deleteBroadcast(backupId);
          console.log('[useBroadcast] Backup stream deleted:', backupId);
        } catch (error) {
          console.warn('[useBroadcast] Failed to delete backup stream:', backupId, error);
        }
      }
      backupStreamIdsRef.current = [];

      // Reset failover state
      setActiveStreamId(null);
      setFailoverCount(0);

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
    studioCanvasOutputService.setLayout({ type: layoutType, layoutId });

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

  // Helper to get current stream health (for UI display)
  const getStreamHealth = useCallback(() => {
    return antMediaService.getStreamHealth();
  }, []);

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
    // Failover status
    activeStreamId,
    failoverCount,
    getStreamHealth,
  };
}
