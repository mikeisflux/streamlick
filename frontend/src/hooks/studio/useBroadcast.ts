/**
 * useBroadcast Hook
 *
 * Handles the broadcast lifecycle:
 * - Going live (streaming to platforms)
 * - Recording
 * - Layout changes
 *
 * Architecture (Privacy-First, Zero-Server Media):
 * - Canvas compositing happens in browser (StudioCanvas)
 * - Streaming goes DIRECTLY from browser to platforms via WHIP/RTMP-relay
 * - No media touches our servers - only signaling and metadata
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { compositorService } from '../../services/compositor.service';
import { canvasStreamService } from '../../services/canvas-stream.service';
import { recordingService } from '../../services/recording.service';
import { broadcastOutputService, BroadcastDestination } from '../../services/broadcast-output.service';
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
  destinationSettings: {
    privacy: Record<string, string>;
    schedule: Record<string, string>;
    title: Record<string, string>;
    description: Record<string, string>;
  };
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
  const [streamingStatuses, setStreamingStatuses] = useState<any[]>([]);

  const { broadcast, setIsLive } = useStudioStore();
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      broadcastOutputService.cleanup();
    };
  }, []);

  // Set up status callback for streaming
  useEffect(() => {
    broadcastOutputService.onStatusChange((statuses) => {
      setStreamingStatuses(statuses);
    });
  }, []);

  // Recording functions
  const handleStartRecording = useCallback(async () => {
    try {
      const compositeStream = canvasStreamService.getOutputStream();
      if (!compositeStream) {
        toast.error('No canvas stream available');
        return;
      }

      await recordingService.startRecording(compositeStream);
      setIsRecording(true);
      toast.success('Recording started');

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
      }

      const interval = setInterval(() => {
        setRecordingDuration(recordingService.getDuration());
      }, 1000);
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

      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const title = broadcast?.title || 'Untitled Broadcast';
      const filename = `${title}-${timestamp}.webm`;

      await recordingService.downloadRecording(blob, filename, {
        title,
        broadcastId,
        duration,
      });

      toast.success(`Recording saved: ${filename}`);
    } catch (error) {
      console.error('Recording stop error:', error);
      toast.error('Failed to stop recording');
    }
  }, [broadcast, broadcastId, recordingDuration]);

  /**
   * Go Live - Direct browser-to-platform streaming
   */
  const handleGoLive = useCallback(async () => {
    if (!broadcastId) return false;

    // Deduplicate and validate destinations
    const deduplicatedDestinations = Array.from(new Set(selectedDestinations));
    const connectedDestinationIds = destinations.map((dest) => dest.id);
    const validDestinationIds = deduplicatedDestinations.filter((destId) =>
      connectedDestinationIds.includes(destId)
    );

    if (validDestinationIds.length === 0) {
      toast.error('Please select at least one connected destination');
      return false;
    }

    try {
      // Get canvas stream from StudioCanvas
      const compositeStream = canvasStreamService.getOutputStream();
      if (!compositeStream) {
        throw new Error('No canvas stream available - please ensure you are on stage');
      }

      // Initialize broadcast output with canvas stream
      broadcastOutputService.initialize(compositeStream);

      // Prepare destination settings for backend
      const apiDestinationSettings: Record<string, any> = {};
      validDestinationIds.forEach((destId) => {
        const destTitle = destinationSettings.title[destId];
        const destDescription = destinationSettings.description[destId];

        apiDestinationSettings[destId] = {
          privacyStatus: destinationSettings.privacy[destId] || 'public',
          scheduledStartTime: destinationSettings.schedule[destId] || undefined,
          title: destTitle && destTitle !== 'Loading' ? destTitle : broadcast?.title,
          description: destDescription && destDescription !== 'Loading' ? destDescription : broadcast?.description,
        };
      });

      // Start broadcast on backend (creates YouTube/Facebook broadcasts, gets stream keys)
      await broadcastService.start(broadcastId, validDestinationIds, apiDestinationSettings);
      setIsLive(true);
      toast.success('Preparing broadcast...');

      // Wait for destinations to be created on backend
      let broadcastDestinations: any[] = [];
      let attempts = 0;
      const maxAttempts = 10;

      while (attempts < maxAttempts && broadcastDestinations.length === 0) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;

        const response = await api.get(`/broadcasts/${broadcastId}/destinations`);
        broadcastDestinations = response.data;

        if (broadcastDestinations.length > 0) break;
      }

      if (broadcastDestinations.length === 0) {
        throw new Error('No broadcast destinations were created');
      }

      // Add destinations to broadcast output service
      for (const dest of broadcastDestinations) {
        const destination: BroadcastDestination = {
          id: dest.id,
          platform: dest.platform,
          rtmpUrl: dest.rtmpUrl,
          streamKey: dest.streamKey || '',
        };
        broadcastOutputService.addDestination(destination);
      }

      // Start 30-second countdown on canvas
      toast.success('Starting countdown...');
      await compositorService.startCountdown(30);

      // START STREAMING - Direct from browser to platforms!
      console.log('[useBroadcast] Starting direct browser streaming...');
      const result = await broadcastOutputService.startAll();

      if (result.failed.length > 0) {
        const failedPlatforms = result.failed.map(id => {
          const dest = broadcastDestinations.find(d => d.id === id);
          return dest?.platform || id;
        });
        toast.error(`Failed to connect to: ${failedPlatforms.join(', ')}`);
      }

      if (result.success || broadcastOutputService.getConnectedCount() > 0) {
        // Transition YouTube broadcasts from testing to live
        try {
          await api.post(`/broadcasts/${broadcastId}/transition-youtube-to-live`);
          toast.success('You are now live!');
        } catch (error) {
          console.error('Failed to transition YouTube:', error);
          // Continue anyway
        }

        // Play intro video
        try {
          await compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');
        } catch (error) {
          console.error('Intro video failed:', error);
        }

        // Start chat
        socketService.emit('start-chat', { broadcastId });
        compositorService.setShowChat(showChatOnStream);

        // Auto-start recording
        try {
          await handleStartRecording();
        } catch (error) {
          console.error('Auto-recording failed:', error);
        }

        return true;
      } else {
        throw new Error('Failed to connect to any streaming platform');
      }
    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to go live');
      setIsLive(false);
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
    showChatOnStream,
    setIsLive,
    handleStartRecording,
    destinationSettings,
    broadcast,
  ]);

  /**
   * End Broadcast
   */
  const handleEndBroadcast = useCallback(async () => {
    if (!broadcastId) return false;

    try {
      // Stop recording if active
      if (isRecording) {
        await handleStopRecording();
      }

      // Stop chat
      socketService.emit('stop-chat', { broadcastId });

      // Stop compositor
      compositorService.stop();

      // STOP STREAMING - Direct browser connections
      console.log('[useBroadcast] Stopping direct browser streaming...');
      await broadcastOutputService.stopAll();

      // End broadcast on backend
      await broadcastService.end(broadcastId);
      toast.success('Broadcast ended');
      setIsLive(false);
      return true;
    } catch (error) {
      console.error('End broadcast error:', error);
      toast.error('Failed to end broadcast');
      return false;
    }
  }, [broadcastId, isRecording, handleStopRecording, setIsLive]);

  /**
   * Layout Change
   */
  const handleLayoutChange = useCallback((layoutId: number) => {
    setSelectedLayout(layoutId);

    const layoutMap: { [key: number]: 'grid' | 'spotlight' | 'sidebar' | 'pip' } = {
      1: 'grid',
      2: 'grid',
      3: 'grid',
      4: 'spotlight',
      5: 'sidebar',
      6: 'sidebar',
      7: 'pip',
      8: 'sidebar',
    };

    const layoutType = layoutMap[layoutId] || 'grid';
    compositorService.setLayout({ type: layoutType });

    const layoutNames: { [key: number]: string } = {
      1: 'Solo',
      2: 'Cropped',
      3: 'Group',
      4: 'Spotlight',
      5: 'News',
      6: 'Screen',
      7: 'Picture-in-Picture',
      8: 'Cinema',
    };

    toast.success(`Layout: ${layoutNames[layoutId] || 'Custom'}`);
  }, []);

  return {
    isRecording,
    recordingDuration,
    currentLayout,
    setCurrentLayout,
    selectedLayout,
    setSelectedLayout,
    streamingStatuses,
    handleGoLive,
    handleEndBroadcast,
    handleStartRecording,
    handleStopRecording,
    handleLayoutChange,
  };
}
