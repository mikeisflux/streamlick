import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { broadcastAPI } from '../services/api';
import { broadcastService } from '../services/broadcast.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { StudioHeader } from '../components/studio/StudioHeader';
import { RightSidebar } from '../components/studio/RightSidebar';
import { BottomControlBar } from '../components/studio/BottomControlBar';
import { PreviewArea } from '../components/studio/canvas/PreviewArea';
import { CompositePreview } from '../components/studio/canvas/CompositePreview';
import { LayoutSelector } from '../components/studio/canvas/LayoutSelector';
import {
  getSocket, joinBroadcast, leaveBroadcast,
  setLayout as emitSetLayout, bringOnStage, removeFromStage,
  goLive as emitGoLive, endBroadcast as emitEndBroadcast, publishStream
} from '../services/socket';
import { AntMediaClient, generateStreamId } from '../services/antmedia';

/**
 * Studio Page - Control Panel for Live Streaming
 *
 * This is a CONTROL PANEL that:
 * - Shows the server composite preview (receives only, no local compositing)
 * - Manages participants (bring on/off stage)
 * - Controls layout, branding, and overlays
 * - Handles go-live and end broadcast actions
 *
 * All actual compositing happens on the SERVER, not in the browser.
 */

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  // Studio store
  const {
    broadcast, participants, localStream, isAudioEnabled, isVideoEnabled,
    setBroadcast, setParticipants, updateParticipant, removeParticipant,
    setLocalStream, setAudioEnabled, setVideoEnabled, setLayout, reset
  } = useStudioStore();

  // Local state
  const [isConnecting, setIsConnecting] = useState(true);
  const [compositorConnected, setCompositorConnected] = useState(false);
  const [compositeStreamId, setCompositeStreamId] = useState<string | null>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState('grid');
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightPanel, setActiveRightPanel] = useState<string | null>(null);

  // Media
  const { rawStream, audioEnabled, videoEnabled, startCamera, stopCamera, toggleAudio, toggleVideo } = useMedia();

  // Refs
  const antMediaRef = useRef<AntMediaClient | null>(null);
  const socketConnectedRef = useRef(false);

  // Fetch broadcast data
  const { data: broadcastData, isLoading, refetch } = useQuery({
    queryKey: ['broadcast', broadcastId],
    queryFn: () => broadcastAPI.get(broadcastId!),
    enabled: !!broadcastId,
  });

  // Initialize broadcast and socket connection
  useEffect(() => {
    if (!broadcastData || !broadcastId) return;

    const initializeBroadcast = async () => {
      // If broadcast is IDLE, transition to GREENROOM
      if (broadcastData.status === 'IDLE') {
        try {
          const updated = await broadcastAPI.start(broadcastId);
          setBroadcast({
            id: updated.id,
            title: updated.title,
            status: updated.status,
            layout: updated.layout || 'grid',
            backgroundColor: updated.backgroundColor,
            logoUrl: updated.logoUrl,
            overlayText: updated.overlayText,
            previewUrl: updated.previewUrl,
          });
          setParticipants(updated.participants || []);
          setSelectedLayout(updated.layout || 'grid');
        } catch (error) {
          console.error('Failed to start broadcast:', error);
          // Fall back to current data
          setBroadcast({
            id: broadcastData.id,
            title: broadcastData.title,
            status: broadcastData.status,
            layout: broadcastData.layout || 'grid',
            backgroundColor: broadcastData.backgroundColor,
            logoUrl: broadcastData.logoUrl,
            overlayText: broadcastData.overlayText,
            previewUrl: broadcastData.previewUrl,
          });
          setParticipants(broadcastData.participants || []);
          setSelectedLayout(broadcastData.layout || 'grid');
        }
      } else {
        setBroadcast({
          id: broadcastData.id,
          title: broadcastData.title,
          status: broadcastData.status,
          layout: broadcastData.layout || 'grid',
          backgroundColor: broadcastData.backgroundColor,
          logoUrl: broadcastData.logoUrl,
          overlayText: broadcastData.overlayText,
          previewUrl: broadcastData.previewUrl,
        });
        setParticipants(broadcastData.participants || []);
        setSelectedLayout(broadcastData.layout || 'grid');
      }

      // Connect to socket
      if (!socketConnectedRef.current) {
        const socket = getSocket();
        socket.connect();
        socketConnectedRef.current = true;

        socket.on('connect', () => {
          console.log('[Studio] Socket connected');
          joinBroadcast(broadcastId);
          setIsConnecting(false);
        });

        socket.on('broadcast-state', (data) => {
          console.log('[Studio] Broadcast state:', data);
          setCompositorConnected(data.compositorConnected);
          if (data.broadcast) {
            setBroadcast({
              ...data.broadcast,
              layout: data.broadcast.layout || 'grid',
            });
            setSelectedLayout(data.broadcast.layout || 'grid');
          }
          if (data.participants) {
            setParticipants(data.participants);
          }
        });

        socket.on('compositor-connected', () => {
          console.log('[Studio] Compositor connected');
          setCompositorConnected(true);
          // Set composite stream ID based on broadcast ID
          setCompositeStreamId(`composite-${broadcastId}`);
        });

        socket.on('compositor-disconnected', () => {
          console.log('[Studio] Compositor disconnected');
          setCompositorConnected(false);
          setCompositeStreamId(null);
        });

        socket.on('participant-joined', (data) => {
          console.log('[Studio] Participant joined:', data);
          refetch();
        });

        socket.on('participant-left', (data) => {
          console.log('[Studio] Participant left:', data);
          if (data.participantId) {
            removeParticipant(data.participantId);
          }
        });

        socket.on('participant-updated', (data) => {
          console.log('[Studio] Participant updated:', data);
          updateParticipant(data.id, data);
        });

        socket.on('layout-changed', (data) => {
          console.log('[Studio] Layout changed:', data);
          setLayout(data.layout);
          setSelectedLayout(data.layout);
        });

        socket.on('broadcast-live', (data) => {
          console.log('[Studio] Broadcast went live:', data);
          setBroadcast({ ...broadcast!, status: 'LIVE' });
          toast.success('You are now LIVE!');
        });

        socket.on('broadcast-ended', (data) => {
          console.log('[Studio] Broadcast ended:', data);
          setBroadcast({ ...broadcast!, status: 'ENDED' });
          toast.success('Broadcast ended');
        });

        socket.on('error', (data) => {
          console.error('[Studio] Socket error:', data);
          toast.error(data.message || 'Connection error');
        });
      }
    };

    initializeBroadcast();

    return () => {
      if (socketConnectedRef.current) {
        leaveBroadcast();
        const socket = getSocket();
        socket.off('connect');
        socket.off('broadcast-state');
        socket.off('compositor-connected');
        socket.off('compositor-disconnected');
        socket.off('participant-joined');
        socket.off('participant-left');
        socket.off('participant-updated');
        socket.off('layout-changed');
        socket.off('broadcast-live');
        socket.off('broadcast-ended');
        socket.off('error');
      }
    };
  }, [broadcastData, broadcastId]);

  // Start camera when component mounts
  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, []);

  // Publish local stream to AntMedia when camera starts
  useEffect(() => {
    if (!rawStream || !broadcastId || !user) return;

    const publishToAntMedia = async () => {
      try {
        const streamId = generateStreamId(broadcastId, user.id);
        antMediaRef.current = new AntMediaClient();

        await antMediaRef.current.publish(streamId, rawStream, {
          onPublishStarted: () => {
            console.log('[Studio] Publishing to AntMedia:', streamId);
            publishStream(streamId);
          },
          onPublishEnded: () => {
            console.log('[Studio] Publish ended');
          },
          onError: (error) => {
            console.error('[Studio] AntMedia error:', error);
          }
        });

        setLocalStream(rawStream);
      } catch (error) {
        console.error('[Studio] Failed to publish:', error);
      }
    };

    publishToAntMedia();

    return () => {
      if (antMediaRef.current) {
        antMediaRef.current.stop();
        antMediaRef.current = null;
      }
    };
  }, [rawStream, broadcastId, user]);

  // Handle layout change
  const handleLayoutChange = useCallback((layout: string) => {
    setSelectedLayout(layout);
    emitSetLayout(layout);
  }, []);

  // Handle go live
  const handleGoLive = useCallback(async () => {
    if (!broadcastId) return;
    try {
      emitGoLive();
    } catch (error) {
      console.error('Failed to go live:', error);
      toast.error('Failed to go live');
    }
  }, [broadcastId]);

  // Handle end broadcast
  const handleEndBroadcast = useCallback(async () => {
    if (!broadcastId) return;
    try {
      emitEndBroadcast();
    } catch (error) {
      console.error('Failed to end broadcast:', error);
      toast.error('Failed to end broadcast');
    }
  }, [broadcastId]);

  // Handle add to stage
  const handleAddToStage = useCallback((participantId: string) => {
    bringOnStage(participantId);
  }, []);

  // Handle remove from stage
  const handleRemoveFromStage = useCallback((participantId: string) => {
    removeFromStage(participantId);
  }, []);

  // Handle invite guests
  const handleInviteGuests = useCallback(() => {
    setShowInviteModal(true);
    setActiveRightPanel('people');
    setRightSidebarOpen(true);
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-white">Loading studio...</p>
        </div>
      </div>
    );
  }

  const isLive = broadcast?.status === 'LIVE';
  const isGreenroom = broadcast?.status === 'GREENROOM';

  return (
    <div className="h-screen flex flex-col bg-gray-900 overflow-hidden">
      {/* Header */}
      <StudioHeader
        title={broadcast?.title || 'Studio'}
        isLive={isLive}
        onGoLive={handleGoLive}
        onEndBroadcast={handleEndBroadcast}
        onInviteGuests={handleInviteGuests}
        onOpenDestinations={() => setActiveRightPanel('destinations')}
        canGoLive={isGreenroom && compositorConnected}
      />

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Main Area */}
        <div className="flex-1 flex flex-col">
          {/* Composite Preview - Main Canvas (RECEIVES server composite) */}
          <div className="flex-1 flex items-center justify-center p-4 bg-gray-950">
            <CompositePreview
              compositeStreamId={compositeStreamId}
              orientation="landscape"
              showControls={true}
            />
          </div>

          {/* Layout Selector */}
          <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
            <LayoutSelector
              selectedLayout={selectedLayout}
              onLayoutChange={handleLayoutChange}
            />
          </div>

          {/* Preview Area - Local camera + participants */}
          <PreviewArea
            localStream={rawStream}
            rawStream={rawStream}
            videoEnabled={videoEnabled}
            audioEnabled={audioEnabled}
            isLocalUserOnStage={true}
            backstageParticipants={participants.filter(p => p.status === 'BACKSTAGE' || p.status === 'ONSTAGE').map(p => ({
              id: p.id,
              name: p.name,
              stream: null,
              audioEnabled: p.audioEnabled ?? true,
              videoEnabled: p.videoEnabled ?? true,
              role: p.role === 'HOST' ? 'host' : 'guest',
            }))}
            greenroomParticipants={participants.filter(p => p.status === 'GREENROOM').map(p => ({
              id: p.id,
              name: p.name,
              stream: null,
              audioEnabled: p.audioEnabled ?? true,
              videoEnabled: p.videoEnabled ?? true,
              role: 'guest',
            }))}
            screenShareStream={null}
            onAddToStage={handleAddToStage}
            onRemoveFromStage={handleRemoveFromStage}
            onInviteGuests={handleInviteGuests}
          />
        </div>

        {/* Right Sidebar */}
        {rightSidebarOpen && (
          <RightSidebar
            activePanel={activeRightPanel}
            onPanelChange={setActiveRightPanel}
            broadcastId={broadcastId!}
            participants={participants}
            onAddToStage={handleAddToStage}
            onRemoveFromStage={handleRemoveFromStage}
          />
        )}
      </div>

      {/* Bottom Control Bar */}
      <BottomControlBar
        audioEnabled={audioEnabled}
        videoEnabled={videoEnabled}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleRightSidebar={() => setRightSidebarOpen(!rightSidebarOpen)}
      />
    </div>
  );
}

export default Studio;
