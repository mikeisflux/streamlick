import { useState, useCallback, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { mediaServerSocketService } from '../../services/media-server-socket.service';
import { webrtcService } from '../../services/webrtc.service';
import { compositorService } from '../../services/compositor.service';
import { canvasStreamService } from '../../services/canvas-stream.service';
import { audioMixerService } from '../../services/audio-mixer.service';
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
  const [selectedLayout, setSelectedLayout] = useState<number>(1); // Default to Solo layout (layout 1)

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
      // Get canvas stream from StudioCanvas via canvasStreamService
      const compositeStream = canvasStreamService.getOutputStream();
      if (!compositeStream) {
        toast.error('No canvas stream available - please ensure you are on stage');
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
    console.error('🎙️ STOPPING RECORDING - Starting process...');
    try {
      console.error('🎙️ Calling recordingService.stopRecording()...');
      const blob = await recordingService.stopRecording();
      console.error('🎙️ Recording stopped, blob size:', blob.size, 'bytes');
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

      console.error('🎙️ Calling downloadRecording() with filename:', filename);
      await recordingService.downloadRecording(blob, filename, {
        title,
        broadcastId,
        duration,
      });
      console.error('🎙️ Download completed successfully');

      toast.success(`Recording saved to Downloads: ${filename}`);
    } catch (error) {
      console.error('🎙️ Recording stop error:', error);
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

    // CRITICAL: Filter out any destination IDs that don't correspond to actually connected destinations
    // This prevents sending unchecked or stale destination IDs from localStorage
    // Note: destinations array already contains only connected destinations from the API
    const connectedDestinationIds = destinations.map(dest => dest.id);

    const validDestinations = deduplicatedDestinations.filter(destId =>
      connectedDestinationIds.includes(destId)
    );

    if (validDestinations.length !== deduplicatedDestinations.length) {
      console.warn('[useBroadcast] Filtered out invalid/disconnected destination IDs:', {
        selected: deduplicatedDestinations,
        connected: connectedDestinationIds,
        valid: validDestinations,
        removed: deduplicatedDestinations.filter(id => !connectedDestinationIds.includes(id)),
      });
    }

    if (validDestinations.length === 0) {
      toast.error('Please select at least one connected destination');
      return false;
    }

    try {
      // Initialize WebRTC device and transport WITHOUT producing individual tracks
      // (compositor will handle all video/audio)
      if (!webrtcService.getDevice()) {
        console.error('🌐 Initializing WebRTC for compositor (no individual tracks)...');
        await webrtcService.initialize(broadcastId);
        await webrtcService.createSendTransport();
        console.error('🌐 WebRTC initialized - ready for compositor tracks');
      }

      // Initialize compositor with only LIVE participants (exclude backstage)
      const participantStreams = [
        {
          id: 'local',
          name: 'You',
          stream: localStream!,
          isLocal: true,
          audioEnabled,
          videoEnabled,
          avatarUrl: localStorage.getItem('selectedAvatar') || undefined, // Pass avatar URL for live stream
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
            avatarUrl: undefined, // Remote participants don't have avatars yet
          })),
      ].filter((p) => p.stream);

      // DEBUG: Log participant video state
      console.error('🎥 GO LIVE - Compositor Initialization:', {
        localVideoEnabled: videoEnabled,
        localAudioEnabled: audioEnabled,
        localStreamHasVideo: localStream?.getVideoTracks().length,
        localStreamHasAudio: localStream?.getAudioTracks().length,
        videoTrackEnabled: localStream?.getVideoTracks()[0]?.enabled,
        videoTrackReadyState: localStream?.getVideoTracks()[0]?.readyState,
        audioTrackEnabled: localStream?.getAudioTracks()[0]?.enabled,
        participantCount: participantStreams.length,
      });

      // REMOVED: compositor initialization - now using StudioCanvas for all rendering
      // await compositorService.initialize(participantStreams);
      // compositorService.setLayout({ type: currentLayout });

      // Get canvas stream from StudioCanvas (VIDEO ONLY - canvas.captureStream() doesn't include audio)
      const canvasVideoStream = canvasStreamService.getOutputStream();
      if (!canvasVideoStream) {
        throw new Error('Failed to get canvas stream - StudioCanvas may not be initialized');
      }

      // Get audio from the audio mixer
      const audioMixerStream = audioMixerService.getOutputStream();
      if (!audioMixerStream) {
        throw new Error('Failed to get audio mixer stream - audio may not be initialized');
      }

      const mixedAudioTrack = audioMixerStream.getAudioTracks()[0];
      if (!mixedAudioTrack) {
        throw new Error('No audio track in mixer stream');
      }

      // Combine canvas video with mixed audio to create the final composite stream
      const compositeStream = canvasStreamService.combineWithAudio(mixedAudioTrack);
      if (!compositeStream) {
        throw new Error('Failed to combine video and audio streams');
      }

      // Produce composite video and audio tracks
      const compositeVideoTrack = compositeStream.getVideoTracks()[0];
      const compositeAudioTrack = compositeStream.getAudioTracks()[0];

      console.error('🎬 Canvas Stream Info:', {
        hasVideoTrack: !!compositeVideoTrack,
        hasAudioTrack: !!compositeAudioTrack,
        videoTrackEnabled: compositeVideoTrack?.enabled,
        videoTrackReadyState: compositeVideoTrack?.readyState,
        videoTrackId: compositeVideoTrack?.id,
        audioTrackEnabled: compositeAudioTrack?.enabled,
        audioTrackReadyState: compositeAudioTrack?.readyState,
        audioTrackId: compositeAudioTrack?.id,
      });

      let compositeVideoProducerId: string | undefined;
      let compositeAudioProducerId: string | undefined;

      if (compositeVideoTrack) {
        compositeVideoProducerId = await webrtcService.produceMedia(compositeVideoTrack);
        console.error('✅ Canvas video producer created:', compositeVideoProducerId);
      } else {
        console.error('❌ No canvas video track available!');
      }

      if (compositeAudioTrack) {
        compositeAudioProducerId = await webrtcService.produceMedia(compositeAudioTrack);
        console.error('✅ Canvas audio producer created:', compositeAudioProducerId);
      } else {
        console.error('❌ No canvas audio track available!');
      }

      // Prepare destination settings for API (using only valid, connected destinations)
      const apiDestinationSettings: Record<string, { privacyStatus?: string; scheduledStartTime?: string; title?: string; description?: string }> = {};
      validDestinations.forEach((destId) => {
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

      // Start broadcast with destination settings (using only valid, connected destinations)
      // This triggers the 30-second countdown on the backend and creates YouTube/Facebook broadcasts
      await broadcastService.start(broadcastId, validDestinations, apiDestinationSettings);

      // CRITICAL: Set isLive=true NOW so countdown is visible!
      setIsLive(true);
      toast.success('Preparing broadcast...');

      // NEW FLOW: Fetch destinations → Start RTMP → 30s countdown → Transition YouTube → Intro video

      // Step 1: Wait for YouTube/Facebook broadcasts to be created (happens async on backend)
      // Then poll until destinations are ready (with timeout)

      let broadcastDestinations: any[] = [];
      let attempts = 0;
      const maxAttempts = 10; // 10 attempts x 1 second = 10 seconds max wait

      while (attempts < maxAttempts && broadcastDestinations.length === 0) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second between attempts
        attempts++;

        const response = await api.get(`/broadcasts/${broadcastId}/destinations`);
        broadcastDestinations = response.data;

        if (broadcastDestinations.length > 0) {
          break;
        }
      }

      if (broadcastDestinations.length === 0) {
        throw new Error('No broadcast destinations were created. Please try again.');
      }


      // Step 3: Start RTMP streaming IMMEDIATELY (before countdown)
      // This connects to YouTube/Facebook and starts sending video in "testing" mode
      const destinationsToStream = broadcastDestinations.map((bd: any) => ({
        id: bd.id,
        platform: bd.platform,
        rtmpUrl: bd.rtmpUrl,
        streamKey: bd.streamKey,
      }));

      const rtmpPayload = {
        broadcastId,
        destinations: destinationsToStream,
        compositeProducers: {
          videoProducerId: compositeVideoProducerId,
          audioProducerId: compositeAudioProducerId,
        },
      };

      console.error('📡 Sending start-rtmp to media server:', {
        broadcastId,
        destinationCount: destinationsToStream.length,
        videoProducerId: compositeVideoProducerId,
        audioProducerId: compositeAudioProducerId,
        hasVideoProducer: !!compositeVideoProducerId,
        hasAudioProducer: !!compositeAudioProducerId,
      });

      mediaServerSocketService.emit('start-rtmp', rtmpPayload);

      toast.success('Connected to platforms, starting countdown...');

      // Step 4: Display 30-second countdown on canvas (stream is already flowing to YouTube)
      console.error('🎬 ABOUT TO START COUNTDOWN - Compositor state:', {
        isCompositing: (compositorService as any).isCompositing,
        frameCount: (compositorService as any).frameCount,
        outputStream: !!(compositorService as any).outputStream,
      });
      await compositorService.startCountdown(30);

      // Step 5: Play intro video IMMEDIATELY after countdown (no delay!)
      // This ensures viewers see content right away
      try {
        await compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');
      } catch (error) {
        console.error('Intro video failed to play:', error);
        // Continue even if intro video fails - user stream will show immediately
      }

      // Step 6: Transition YouTube broadcasts from "testing" to "live" (in background)
      // Do this AFTER intro starts so there's no delay between countdown and intro
      api.post(`/broadcasts/${broadcastId}/transition-youtube-to-live`)
        .then(() => {
          toast.success('You are now live!');
        })
        .catch((error) => {
          console.error('[useBroadcast] Failed to transition YouTube to live:', error);
          toast.error('Warning: YouTube transition may have failed');
          // Continue anyway - stream is already connected
        });

      // Start chat polling
      socketService.emit('start-chat', { broadcastId});

      // Enable chat display on compositor
      compositorService.setShowChat(showChatOnStream);

      // Automatically start recording
      try {
        await handleStartRecording();
      } catch (error) {
        console.error('Failed to auto-start recording:', error);
        // Don't fail the broadcast if recording fails
      }

      // isLive already set to true above (before intro video)
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
    initializeWebRTC,
    setIsLive,
    handleStartRecording,
    destinationSettings,
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

      // Stop RTMP streaming
      mediaServerSocketService.emit('stop-rtmp', { broadcastId });
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
    compositorService.setLayout({ type: layoutType });

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
