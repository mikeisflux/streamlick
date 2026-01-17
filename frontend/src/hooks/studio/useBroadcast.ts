/**
 * useBroadcast Hook
 *
 * Handles the broadcast lifecycle:
 * - Going live (streaming to platforms)
 * - Recording
 * - Layout changes
 *
 * Architecture (Streamyard-style Server-Side Composite):
 * - Host sends raw camera/mic to Ant Media SFU
 * - Server-side composite renders all participants with layouts/backgrounds
 * - RTMP forwarding sends composite to YouTube/Facebook/etc
 * - Host browser does NOT stream directly - only sends raw camera
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { compositorService } from '../../services/compositor.service';
import { canvasStreamService } from '../../services/canvas-stream.service';
import { recordingService } from '../../services/recording.service';
import { audioMixerService } from '../../services/audio-mixer.service';
import { compositeService } from '../../services/composite.service';
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
  const [selectedLayout, setSelectedLayout] = useState<number>(1); // Default to Solo layout
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
      // Server composite cleanup happens via compositeService.stop() in handleEndBroadcast
    };
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
   * Go Live - Server-side composite streaming to platforms
   *
   * NEW ARCHITECTURE (Streamyard-style):
   * 1. Ensure server composite is running
   * 2. Add RTMP endpoints to composite stream (server forwards to YouTube/Facebook)
   * 3. Host browser does NOT stream directly - only sends raw camera to SFU
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
      // Verify server composite is running
      if (!compositeService.isRunning()) {
        console.log('[useBroadcast] Server composite not running, starting...');
        await compositeService.start(broadcastId, selectedLayout);
      }

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

      // Add RTMP endpoints to server composite (Streamyard-style)
      // Server composite will forward to all destinations
      console.log('[useBroadcast] Adding RTMP endpoints to server composite...');
      const rtmpResults: { success: string[]; failed: string[] } = { success: [], failed: [] };

      for (const dest of broadcastDestinations) {
        const rtmpUrl = dest.streamKey
          ? `${dest.rtmpUrl}/${dest.streamKey}`
          : dest.rtmpUrl;

        try {
          await compositeService.addRtmpEndpoint(rtmpUrl);
          rtmpResults.success.push(dest.id);
          console.log('[useBroadcast] RTMP endpoint added:', dest.platform);
        } catch (error) {
          console.error('[useBroadcast] Failed to add RTMP endpoint:', dest.platform, error);
          rtmpResults.failed.push(dest.id);
        }
      }

      if (rtmpResults.failed.length > 0) {
        const failedPlatforms = rtmpResults.failed.map(id => {
          const dest = broadcastDestinations.find(d => d.id === id);
          return dest?.platform || id;
        });
        toast.error(`Failed to connect to: ${failedPlatforms.join(', ')}`);
      }

      if (rtmpResults.success.length > 0) {
        // Transition YouTube broadcasts from testing to live
        try {
          await api.post(`/broadcasts/${broadcastId}/transition-youtube-to-live`);
          toast.success('You are now live!');
        } catch (error) {
          console.error('Failed to transition YouTube:', error);
          // Continue anyway
        }

        // Play intro video on local canvas (for host preview)
        try {
          await compositorService.playIntroVideo('/backgrounds/videos/StreamLick.mp4');
        } catch (error) {
          console.error('Intro video failed:', error);
        }

        // Start chat
        socketService.emit('start-chat', { broadcastId });
        compositorService.setShowChat(showChatOnStream);

        // Auto-start local recording (for backup)
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
    selectedDestinations,
    destinations,
    showChatOnStream,
    setIsLive,
    handleStartRecording,
    destinationSettings,
    broadcast,
    selectedLayout,
  ]);

  /**
   * End Broadcast - Stop server-side composite streaming
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

      // Stop compositor (local)
      compositorService.stop();

      // Stop server-side composite (stops RTMP forwarding)
      console.log('[useBroadcast] Stopping server-side composite...');
      await compositeService.stop();

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
   * Layout Change - Updates both local compositor and server composite
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

    // Forward layout change to server-side composite (if running)
    // This keeps the server composite in sync with host's layout selection
    compositeService.setLayout(layoutId).catch((error) => {
      console.warn('[useBroadcast] Failed to sync layout to server composite:', error);
      // Don't show error to user - server composite is optional enhancement
    });

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
