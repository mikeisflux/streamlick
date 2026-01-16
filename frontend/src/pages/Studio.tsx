import { useRef, useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { audioProcessorService } from '../services/audio-processor.service';
import { audioMixerService } from '../services/audio-mixer.service';
import { broadcastService } from '../services/broadcast.service';
import { canvasStreamService } from '../services/canvas-stream.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { useAuthStore } from '../store/authStore';
import toast from 'react-hot-toast';
import { HotkeyReference } from '../components/HotkeyReference';
import { HotkeyFeedback, useHotkeyFeedback } from '../components/HotkeyFeedback';
import { LeftSidebar } from '../components/studio/LeftSidebar';
import { RightSidebar } from '../components/studio/RightSidebar';
import { BottomControlBar } from '../components/studio/BottomControlBar';
import { DeviceSelectors } from '../components/studio/DeviceSelectors';
import { StudioCanvas, LayoutSelector, PreviewArea, CanvasSettingsModal, CountdownOverlay, CompositePreview } from '../components/studio/canvas';
import { StudioHeader } from '../components/studio/StudioHeader';
import { StudioDrawers } from '../components/studio/StudioDrawers';
import { StudioModals } from '../components/studio/StudioModals';
import {
  useMediaDevices,
  useSceneManagement,
  useClipRecording,
  useStudioHotkeys,
  useBroadcast,
  useParticipants,
  useWebRTC,
  useChatOverlay,
  useCaptions,
  useBackgroundRemoval,
  useVerticalSimulcast,
  useAnalytics,
  useScreenShare,
  useMediaClips,
  useAnalyticsDashboard,
  useDrawers,
  useModals,
  useStudioInitialization,
  useSidebarPersistence,
  useSidebarVideoSync,
  useFeatureToggles,
  useTeleprompter,
  useAutoMuteDuringVideos,
  useStudioHandlers,
  usePreviewStream,
  // NOTE: useGuestStreams (P2P) removed - now using LiveKit SFU via webrtcService
} from '../hooks/studio';
import { webrtcService } from '../services/webrtc.service';
import { compositeService } from '../services/composite.service';
import { useCanvasSettings } from '../hooks/studio/useCanvasSettings';
import { socketService } from '../services/socket.service';

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const { user } = useAuthStore();
  const { messages: hotkeyMessages } = useHotkeyFeedback();

  // Countdown state
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // Background Effects state
  const [backgroundEffect, setBackgroundEffect] = useState<{type: 'none' | 'blur' | 'greenscreen' | 'virtual'}>({ type: 'none' });

  // Green Room state - host can enter green room when not on stage
  const [isInGreenRoom, setIsInGreenRoom] = useState(false);

  // Composite Preview state - show server composite output instead of local canvas
  const [showCompositePreview, setShowCompositePreview] = useState(false);
  const [compositeStreamId, setCompositeStreamId] = useState<string | null>(null);

  // Refs
  const micButtonRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLDivElement>(null);
  const speakerButtonRef = useRef<HTMLDivElement>(null);

  const { broadcast, isLive, setBroadcast } = useStudioStore();
  const { localStream, rawStream, audioEnabled, videoEnabled, startCamera, stopCamera, toggleAudio, toggleVideo } = useMedia();

  // Auto-mute during video playback
  useAutoMuteDuringVideos(localStream, audioEnabled);

  // Preview stream - send canvas output to guests in greenroom
  usePreviewStream(broadcastId);

  // Feature toggles
  const {
    captionsEnabled,
    setCaptionsEnabled,
    clipRecordingEnabled,
    setClipRecordingEnabled,
    captionLanguage,
    setCaptionLanguage,
    backgroundRemovalEnabled,
    setBackgroundRemovalEnabled,
    backgroundRemovalOptions,
    setBackgroundRemovalOptions,
    verticalSimulcastEnabled,
    setVerticalSimulcastEnabled,
    verticalResolution,
    setVerticalResolution,
    analyticsEnabled,
    setAnalyticsEnabled,
  } = useFeatureToggles();

  // Media devices
  const {
    audioDevices,
    videoDevices,
    speakerDevices,
    selectedAudioDevice,
    selectedVideoDevice,
    selectedSpeakerDevice,
    speakerMuted,
    showMicSelector,
    showCameraSelector,
    showSpeakerSelector,
    setShowMicSelector,
    setShowCameraSelector,
    setShowSpeakerSelector,
    setSpeakerMuted,
    loadDevices,
    handleAudioDeviceChange: handleAudioDeviceChangeRaw,
    handleVideoDeviceChange: handleVideoDeviceChangeRaw,
    handleSpeakerDeviceChange,
    toggleSpeaker,
  } = useMediaDevices();

  // Wrap device change handlers to include localStream
  const handleAudioDeviceChange = (deviceId: string) => handleAudioDeviceChangeRaw(deviceId, localStream);
  const handleVideoDeviceChange = (deviceId: string) => handleVideoDeviceChangeRaw(deviceId, localStream);

  // Initialization
  const { isLoading, destinations, selectedDestinations, setSelectedDestinations } = useStudioInitialization({
    broadcastId,
    startCamera: async () => { await startCamera(); },
    stopCamera,
    loadDevices,
  });

  // Destination privacy and scheduling settings - load from localStorage
  const [destinationSettings, setDestinationSettings] = useState<{
    privacy: Record<string, string>;
    schedule: Record<string, string>;
    title: Record<string, string>;
    description: Record<string, string>;
  }>(() => {
    if (!broadcastId) return { privacy: {}, schedule: {}, title: {}, description: {} };
    try {
      const saved = localStorage.getItem(`destinationSettings_${broadcastId}`);
      if (!saved) return { privacy: {}, schedule: {}, title: {}, description: {} };

      const parsed = JSON.parse(saved);

      // CRITICAL FIX: Sanitize loaded settings to remove corrupted/placeholder data
      // Remove any "Loading" placeholders or corrupted values from malware
      const sanitize = (obj: Record<string, string>) => {
        const clean: Record<string, string> = {};
        for (const [key, value] of Object.entries(obj)) {
          // Skip "Loading" placeholders and obviously corrupted data
          if (value === 'Loading' || typeof value !== 'string' || value.length > 500) {
            console.warn(`[Studio] Removed corrupted destination setting: ${key}=${value}`);
            continue;
          }
          clean[key] = value;
        }
        return clean;
      };

      return {
        privacy: sanitize(parsed.privacy || {}),
        schedule: sanitize(parsed.schedule || {}),
        title: sanitize(parsed.title || {}),
        description: sanitize(parsed.description || {}),
      };
    } catch (error) {
      console.error('Failed to load destination settings from localStorage:', error);
      return { privacy: {}, schedule: {}, title: {}, description: {} };
    }
  });

  // Save destination settings to localStorage when they change
  useEffect(() => {
    if (!broadcastId) return;

    // Don't save if any values are still "Loading" placeholders
    const hasLoadingPlaceholder =
      Object.values(destinationSettings.title).some(v => v === 'Loading') ||
      Object.values(destinationSettings.description).some(v => v === 'Loading');

    if (hasLoadingPlaceholder) {
      return;
    }

    try {
      localStorage.setItem(`destinationSettings_${broadcastId}`, JSON.stringify(destinationSettings));
    } catch (error) {
      console.error('Failed to save destination settings to localStorage:', error);
    }
  }, [destinationSettings, broadcastId]);

  // Countdown socket listeners
  useEffect(() => {
    const handleCountdownTick = (data: { secondsRemaining: number }) => {
      setCountdownSeconds(data.secondsRemaining);
    };

    const handleCountdownComplete = () => {
      setCountdownSeconds(null);
    };

    socketService.on('countdown-tick', handleCountdownTick);
    socketService.on('countdown-complete', handleCountdownComplete);

    return () => {
      socketService.off('countdown-tick', handleCountdownTick);
      socketService.off('countdown-complete', handleCountdownComplete);
    };
  }, []);

  // Sidebar management
  const {
    leftSidebarOpen,
    rightSidebarOpen,
    activeRightTab,
    leftSidebarRef,
    rightSidebarRef,
    handleLeftSidebarToggle,
    handleRightSidebarToggle,
  } = useSidebarPersistence();

  const { sidebarVideoRef } = useSidebarVideoSync(localStream);

  // WebRTC - pass host's user ID as participant ID for LiveKit identity matching
  const { isInitializing, initializeWebRTC } = useWebRTC(broadcastId, localStream, user?.id);

  // Auto-initialize WebRTC when studio loads (so we can receive guest streams in greenroom)
  const webrtcInitializedRef = useRef(false);
  useEffect(() => {
    if (!broadcastId || !localStream || webrtcInitializedRef.current || isInitializing) return;

    console.log('[Studio] Auto-initializing WebRTC for Ant Media SFU...');
    webrtcInitializedRef.current = true;
    initializeWebRTC().catch((error) => {
      console.error('[Studio] Failed to auto-initialize WebRTC:', error);
      webrtcInitializedRef.current = false; // Allow retry
    });
  }, [broadcastId, localStream, initializeWebRTC, isInitializing]);

  // Start server-side composite after WebRTC is initialized
  // This makes the broadcast independent of the host browser
  const compositeStartedRef = useRef(false);
  useEffect(() => {
    if (!broadcastId || !webrtcInitializedRef.current || compositeStartedRef.current) return;

    const startComposite = async () => {
      try {
        console.log('[Studio] Starting server-side composite...');
        compositeStartedRef.current = true;
        const streamId = await compositeService.start(broadcastId, 3); // Default to Group layout
        setCompositeStreamId(streamId);
        console.log('[Studio] Server-side composite started, streamId:', streamId);
      } catch (error) {
        console.error('[Studio] Failed to start server composite:', error);
        compositeStartedRef.current = false;
        setCompositeStreamId(null);
        // Don't show error to user - fall back to local compositing
      }
    };

    // Small delay to ensure WebRTC is fully connected
    const timer = setTimeout(startComposite, 2000);
    return () => clearTimeout(timer);
  }, [broadcastId]);

  // Cleanup composite on unmount
  useEffect(() => {
    return () => {
      if (compositeStartedRef.current) {
        compositeService.stop().catch((error) => {
          console.error('[Studio] Failed to stop composite on unmount:', error);
        });
      }
    };
  }, []);

  // Chat overlay
  const {
    showChatOnStream,
    setShowChatOnStream,
    chatOverlayPosition,
    chatOverlaySize,
    isDraggingChat,
    isResizingChat,
    chatOverlayRef,
    handleChatOverlayDragStart,
    handleChatOverlayResizeStart,
  } = useChatOverlay();

  // Participants
  const {
    remoteParticipants,
    chatMessages,
    viewerCounts,
    handlePromoteToLive,
    handleDemoteToBackstage,
    handleMuteParticipant,
    handleUnmuteParticipant,
    handleKickParticipant,
    handleBanParticipant,
    handleVolumeChange,
    setRemoteParticipants,
  } = useParticipants({ broadcastId, showChatOnStream });

  // Pending streams - stored when stream arrives before participant data
  const pendingStreamsRef = useRef<Map<string, MediaStream>>(new Map());

  // LiveKit SFU Guest Streams - receive video from guests via SFU
  // NOTE: Replaced P2P useGuestStreams with LiveKit SFU
  useEffect(() => {
    if (!broadcastId) return;

    // Set up callback to receive guest streams from LiveKit
    const handleRemoteStream = (streamId: string, stream: MediaStream) => {
      console.log('[Studio] Received stream from LiveKit SFU:', streamId, {
        streamId: stream.id,
        tracks: stream.getTracks().map(t => ({
          kind: t.kind,
          id: t.id,
          enabled: t.enabled,
          muted: t.muted,
          readyState: t.readyState,
        })),
        audioTracks: stream.getAudioTracks().length,
        videoTracks: stream.getVideoTracks().length,
      });

      // Now that we pass StreamLick participant ID to LiveKit, streamId should match
      setRemoteParticipants((prev: Map<string, any>) => {
        const updated = new Map(prev);

        // First try to find participant by exact ID match (should work with our fix)
        let participantId = streamId;
        let participant = updated.get(participantId);

        if (participant) {
          console.log('[Studio] Matched stream to participant by ID:', participantId, {
            hadStream: !!participant.stream,
            audioEnabled: participant.audioEnabled,
            videoEnabled: participant.videoEnabled,
          });
          updated.set(participantId, { ...participant, stream });
        } else {
          // Race condition: stream arrived before participant data from socket
          // Store as pending and it will be attached when participant joins
          console.log('[Studio] Stream arrived before participant, storing as pending:', streamId);
          pendingStreamsRef.current.set(streamId, stream);
        }

        return updated;
      });
    };

    const handleParticipantLeft = (streamId: string) => {
      console.log('[Studio] Stream removed from LiveKit:', streamId);
      // Remove from pending if it was there
      pendingStreamsRef.current.delete(streamId);

      setRemoteParticipants((prev: Map<string, any>) => {
        const updated = new Map(prev);
        // Find participant by ID (since streamId is now participantId)
        const participant = updated.get(streamId);
        if (participant) {
          updated.set(streamId, { ...participant, stream: null });
        }
        return updated;
      });
    };

    webrtcService.setRemoteStreamCallback(handleRemoteStream);
    webrtcService.setParticipantLeftCallback(handleParticipantLeft);

    console.log('[Studio] Set up LiveKit SFU stream callbacks for broadcast:', broadcastId);

    return () => {
      webrtcService.setRemoteStreamCallback(() => {});
      webrtcService.setParticipantLeftCallback(() => {});
    };
  }, [broadcastId, setRemoteParticipants]);

  // Attach pending streams when participants join
  // This handles the race condition where stream arrives before socket participant event
  useEffect(() => {
    if (pendingStreamsRef.current.size === 0) return;

    setRemoteParticipants((prev: Map<string, any>) => {
      let updated: Map<string, any> | null = null;

      for (const [participantId, stream] of pendingStreamsRef.current.entries()) {
        const participant = prev.get(participantId);
        if (participant && !participant.stream) {
          console.log('[Studio] Attaching pending stream to participant:', participantId);
          if (!updated) updated = new Map(prev);
          updated.set(participantId, { ...participant, stream });
          pendingStreamsRef.current.delete(participantId);
        }
      }

      return updated || prev;
    });
  }, [remoteParticipants, setRemoteParticipants]);

  // Track initial mute state to avoid calling mute API on mount
  // Calling turnOnLocalCamera/unmuteLocalMic when already on can restart the stream
  const initialMuteStateRef = useRef<{ audio: boolean | null; video: boolean | null }>({
    audio: null,
    video: null,
  });

  // Sync host's audio mute state with Ant Media - only on actual state CHANGES
  // Skip initial sync since the stream is already set up correctly
  useEffect(() => {
    if (!webrtcInitializedRef.current) return;

    // On first run, just record the initial state without calling the API
    if (initialMuteStateRef.current.audio === null) {
      initialMuteStateRef.current.audio = audioEnabled;
      console.log('[Studio] Recording initial audio state:', audioEnabled);
      return;
    }

    // Only call API if state actually changed
    if (initialMuteStateRef.current.audio !== audioEnabled) {
      console.log('[Studio] Audio state changed, syncing with Ant Media:', !audioEnabled);
      webrtcService.muteAudio(!audioEnabled);
      initialMuteStateRef.current.audio = audioEnabled;
    }
  }, [audioEnabled]);

  // Sync host's video mute state with Ant Media - only on actual state CHANGES
  useEffect(() => {
    if (!webrtcInitializedRef.current) return;

    // On first run, just record the initial state without calling the API
    if (initialMuteStateRef.current.video === null) {
      initialMuteStateRef.current.video = videoEnabled;
      console.log('[Studio] Recording initial video state:', videoEnabled);
      return;
    }

    // Only call API if state actually changed
    if (initialMuteStateRef.current.video !== videoEnabled) {
      console.log('[Studio] Video state changed, syncing with Ant Media:', !videoEnabled);
      webrtcService.muteVideo(!videoEnabled);
      initialMuteStateRef.current.video = videoEnabled;
    }
  }, [videoEnabled]);

  // Broadcast
  const {
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
  } = useBroadcast({
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
  });

  const { currentCaption } = useCaptions(captionsEnabled, captionLanguage);
  const { processedStream } = useBackgroundRemoval(backgroundRemovalEnabled, localStream, backgroundRemovalOptions);
  const { verticalStream } = useVerticalSimulcast(verticalSimulcastEnabled, localStream, processedStream, verticalResolution);
  const { analyticsMetrics, analyticsInsights } = useAnalytics(analyticsEnabled);
  const { scenes, currentSceneId, handleSceneChange, handleSceneCreate, handleSceneUpdate, handleSceneDelete, handleSceneDuplicate, getCurrentScene, captureCurrentState, updateCurrentSceneWithState } = useSceneManagement();
  const { isSharingScreen, screenShareStream, handleToggleScreenShare } = useScreenShare({
    currentLayout: selectedLayout,
    onLayoutChange: handleLayoutChange,
    isLive,
  });
  const { mediaClips, handlePlayClip } = useMediaClips();
  const { showAnalyticsDashboard, setShowAnalyticsDashboard, analyticsDashboardPosition, analyticsDashboardSize, handleAnalyticsDashboardDragStart, handleAnalyticsDashboardResizeStart } = useAnalyticsDashboard();
  const { showDestinationsDrawer, setShowDestinationsDrawer, showInviteDrawer, setShowInviteDrawer, showBannerDrawer, setShowBannerDrawer, showBrandDrawer, setShowBrandDrawer, showRecordingDrawer, setShowRecordingDrawer } = useDrawers();
  const { showClipManager, setShowClipManager, showProducerMode, setShowProducerMode, showClipDurationSelector, setShowClipDurationSelector, showLanguageSelector, setShowLanguageSelector, showBackgroundSettings, setShowBackgroundSettings, showSceneManager, setShowSceneManager, showChatLayoutCustomizer, setShowChatLayoutCustomizer, chatLayoutConfig, setChatLayoutConfig, showScreenShareManager, setShowScreenShareManager, showBackgroundEffects, setShowBackgroundEffects } = useModals();

  // Teleprompter
  const teleprompterState = useTeleprompter();
  const { showHotkeyReference } = useStudioHotkeys({ audioEnabled, videoEnabled, isLive, isRecording, isSharingScreen, toggleAudio, toggleVideo, handleGoLive, handleEndBroadcast, handleStartRecording, handleStopRecording, handleToggleScreenShare, handleLayoutChange, setShowChatOnStream });
  const { handleCreateClip } = useClipRecording(clipRecordingEnabled, localStream, () => canvasStreamService.getOutputStream());

  // Canvas Settings (persisted to localStorage)
  const canvasSettings = useCanvasSettings();

  // Apply input volume to audio mixer when it changes
  useEffect(() => {
    // Convert from 0-100 to 0-1 range
    const normalizedVolume = Math.max(0, Math.min(100, canvasSettings.inputVolume)) / 100;
    audioMixerService.setMasterVolume(normalizedVolume);
  }, [canvasSettings.inputVolume]);

  // Canvas rendering is handled directly by StudioCanvas component
  // No separate compositor initialization needed - StudioCanvas manages all rendering

  // Broadcast title update handler
  const handleTitleChange = async (newTitle: string) => {
    if (!broadcastId) return;
    try {
      await broadcastService.update(broadcastId, { title: newTitle });
      // Update local broadcast state
      const updatedBroadcast = await broadcastService.getById(broadcastId);
      setBroadcast(updatedBroadcast);
      toast.success('Broadcast title updated');
    } catch (error) {
      console.error('Failed to update title:', error);
      toast.error('Failed to update title');
    }
  };

  // Studio handlers (event handlers, state, and effects)
  const {
    editMode,
    showCanvasSettings,
    setShowCanvasSettings,
    showResetConfirmation,
    setShowResetConfirmation,
    isLocalUserOnStage,
    displayedComment,
    setDisplayedComment,
    handleEditModeToggle,
    handleAddParticipant,
    handleCanvasSettingsClick,
    handleResetStack,
    handleAddToStage,
    handleRemoveFromStage,
  } = useStudioHandlers({
    broadcastId,
    handleLayoutChange,
    handlePromoteToLive,
    handleDemoteToBackstage,
    onShowInviteDrawer: () => setShowInviteDrawer(true),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading studio...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{ backgroundColor: '#1a1a1a' }}>
      {/* Top Bar */}
      <StudioHeader
        broadcastTitle={broadcast?.title || 'Untitled Broadcast'}
        broadcastId={broadcastId || ''}
        isLive={isLive}
        onProducerModeClick={() => setShowProducerMode(true)}
        onResetStackClick={() => setShowResetConfirmation(true)}
        onDestinationsClick={() => setShowDestinationsDrawer(true)}
        onInviteGuestsClick={() => setShowInviteDrawer(true)}
        onSettingsClick={() => setShowCanvasSettings(true)}
        onGoLive={handleGoLive}
        onEndBroadcast={handleEndBroadcast}
        isInitializing={isInitializing}
        onTitleChange={handleTitleChange}
      />

      {/* Body Container */}
      <div className="flex-1 flex overflow-hidden relative">
        <LeftSidebar
          leftSidebarOpen={leftSidebarOpen}
          onToggle={handleLeftSidebarToggle}
          scenes={scenes}
          currentSceneId={currentSceneId}
          onSceneChange={handleSceneChange}
          onSceneCreate={handleSceneCreate}
          onSceneUpdate={handleSceneUpdate}
          onSceneDelete={handleSceneDelete}
          onSceneDuplicate={handleSceneDuplicate}
          captureCurrentState={captureCurrentState}
          updateCurrentSceneWithState={updateCurrentSceneWithState}
          videoRef={sidebarVideoRef}
          localStream={processedStream || localStream}
          videoEnabled={videoEnabled}
          showSceneManager={showSceneManager}
          leftSidebarRef={leftSidebarRef}
        />

        {/* Main Canvas Area */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F5F5' }}>
          {/* Canvas Container - constrained to leave room for Layout Selector and Preview Area */}
          <div className="flex items-center justify-center px-6 pb-20 relative" style={{ minHeight: 0, maxHeight: 'calc(100% - 350px)', flexShrink: 1, paddingTop: '144px' }}>
            {/* Toggle between local canvas and server composite preview */}
            {compositeStreamId && (
              <div className="absolute top-4 right-4 z-20 flex items-center gap-2 bg-black/60 px-3 py-2 rounded-lg">
                <span className="text-white text-xs">
                  {showCompositePreview ? 'Output Preview' : 'Local View'}
                </span>
                <button
                  onClick={() => setShowCompositePreview(!showCompositePreview)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    showCompositePreview ? 'bg-purple-600' : 'bg-gray-600'
                  }`}
                >
                  <div
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      showCompositePreview ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>
            )}

            {/* Show CompositePreview when toggled, otherwise show local StudioCanvas */}
            {showCompositePreview && compositeStreamId ? (
              <CompositePreview
                compositeStreamId={compositeStreamId}
                orientation={canvasSettings.orientation}
              />
            ) : (
            <StudioCanvas
              localStream={processedStream || localStream}
              rawStream={rawStream}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isLocalUserOnStage={isLocalUserOnStage}
              remoteParticipants={remoteParticipants}
              isSharingScreen={isSharingScreen}
              screenShareStream={screenShareStream}
              selectedLayout={selectedLayout}
              chatMessages={chatMessages}
              showChatOnStream={showChatOnStream}
              chatOverlayPosition={chatOverlayPosition}
              chatOverlaySize={chatOverlaySize}
              isDraggingChat={isDraggingChat}
              isResizingChat={isResizingChat}
              chatOverlayRef={chatOverlayRef}
              onChatOverlayDragStart={handleChatOverlayDragStart}
              onChatOverlayResizeStart={handleChatOverlayResizeStart}
              captionsEnabled={captionsEnabled}
              currentCaption={currentCaption}
              editMode={editMode}
              backgroundColor={canvasSettings.canvasBackgroundColor}
              showResolutionBadge={canvasSettings.showResolutionBadge}
              showPositionNumbers={canvasSettings.showPositionNumbers}
              showConnectionQuality={canvasSettings.showConnectionQuality}
              showLowerThirds={canvasSettings.showLowerThirds}
              orientation={canvasSettings.orientation}
              onRemoveFromStage={handleRemoveFromStage}
              teleprompterNotes={teleprompterState.notes}
              teleprompterFontSize={teleprompterState.fontSize}
              teleprompterIsScrolling={teleprompterState.isScrolling}
              teleprompterScrollSpeed={teleprompterState.scrollSpeed}
              teleprompterScrollPosition={teleprompterState.scrollPosition}
              showTeleprompterOnCanvas={teleprompterState.showOnCanvas}
              displayedComment={displayedComment}
              onDismissComment={() => setDisplayedComment(null)}
            />
            )}
            {/* Countdown Overlay */}
            <CountdownOverlay seconds={countdownSeconds} />
          </div>

          {/* Layout Selector - Always visible below canvas */}
          <div className="flex justify-center px-6" style={{ flexShrink: 0, marginTop: '60px' }}>
            <LayoutSelector
              selectedLayout={selectedLayout}
              onLayoutChange={handleLayoutChange}
              editMode={editMode}
              onEditModeToggle={handleEditModeToggle}
              onAddParticipant={handleAddParticipant}
              onSettingsClick={handleCanvasSettingsClick}
            />
          </div>

          {/* Spacer to push Preview Area to bottom */}
          <div style={{ flex: 1, minHeight: 0 }} />

          {/* Preview Area - positioned at bottom, above BottomControlBar */}
          <div style={{ flexShrink: 0, marginBottom: '80px' }}>
            <PreviewArea
              localStream={processedStream || localStream}
              rawStream={rawStream}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isLocalUserOnStage={isLocalUserOnStage}
              backstageParticipants={Array.from(remoteParticipants.values()).filter((p) => p.role !== 'host')}
              greenroomParticipants={[]} // All waiting participants (null/undefined/backstage role) show in preview, promoted to 'guest' when on stage
              screenShareStream={screenShareStream}
              onAddToStage={handleAddToStage}
              onRemoveFromStage={handleRemoveFromStage}
              onInviteGuests={() => setShowInviteDrawer(true)}
              onKickParticipant={handleKickParticipant}
              onBanParticipant={handleBanParticipant}
              onEnterGreenRoom={() => {
                const newState = !isInGreenRoom;
                setIsInGreenRoom(newState);
                if (newState) {
                  socketService.emit('host-enter-greenroom', { broadcastId });
                } else {
                  socketService.emit('host-leave-greenroom', {});
                }
              }}
              isInGreenRoom={isInGreenRoom}
            />
          </div>

          <BottomControlBar
            captionsEnabled={captionsEnabled}
            setCaptionsEnabled={setCaptionsEnabled}
            showLanguageSelector={showLanguageSelector}
            setShowLanguageSelector={setShowLanguageSelector}
            clipRecordingEnabled={clipRecordingEnabled}
            setClipRecordingEnabled={setClipRecordingEnabled}
            setShowClipDurationSelector={setShowClipDurationSelector}
            setShowClipManager={setShowClipManager}
            backgroundRemovalEnabled={backgroundRemovalEnabled}
            setBackgroundRemovalEnabled={setBackgroundRemovalEnabled}
            showBackgroundSettings={showBackgroundSettings}
            setShowBackgroundSettings={setShowBackgroundSettings}
            setShowBackgroundEffects={setShowBackgroundEffects}
            verticalSimulcastEnabled={verticalSimulcastEnabled}
            setVerticalSimulcastEnabled={setVerticalSimulcastEnabled}
            analyticsEnabled={analyticsEnabled}
            setAnalyticsEnabled={setAnalyticsEnabled}
            setShowAnalyticsDashboard={setShowAnalyticsDashboard}
            showChatOnStream={showChatOnStream}
            setShowChatOnStream={setShowChatOnStream}
            audioEnabled={audioEnabled}
            toggleAudio={toggleAudio}
            videoEnabled={videoEnabled}
            toggleVideo={toggleVideo}
            isSharingScreen={isSharingScreen}
            startScreenShare={handleToggleScreenShare}
            stopScreenShare={handleToggleScreenShare}
            setShowScreenShareManager={setShowScreenShareManager}
            speakerMuted={speakerMuted}
            toggleSpeaker={toggleSpeaker}
            showMicSelector={showMicSelector}
            setShowMicSelector={setShowMicSelector}
            showCameraSelector={showCameraSelector}
            setShowCameraSelector={setShowCameraSelector}
            showSpeakerSelector={showSpeakerSelector}
            setShowSpeakerSelector={setShowSpeakerSelector}
            micButtonRef={micButtonRef}
            cameraButtonRef={cameraButtonRef}
            speakerButtonRef={speakerButtonRef}
          />
        </main>

        <RightSidebar
          rightSidebarOpen={rightSidebarOpen}
          activeRightTab={activeRightTab}
          onTabToggle={handleRightSidebarToggle}
          broadcastId={broadcastId}
          currentUserId={broadcast?.userId}
          isLive={isLive}
          onShowBannerDrawer={() => setShowBannerDrawer(true)}
          rightSidebarRef={rightSidebarRef}
          teleprompterState={teleprompterState}
          onCommentClick={setDisplayedComment}
        />
      </div>

      {/* Hotkey Reference */}
      {showHotkeyReference && <HotkeyReference />}

      {/* Hotkey Visual Feedback */}
      <HotkeyFeedback messages={hotkeyMessages} />

      {/* Drawer Panels */}
      <StudioDrawers
        broadcastId={broadcastId}
        showDestinationsDrawer={showDestinationsDrawer}
        setShowDestinationsDrawer={setShowDestinationsDrawer}
        showInviteDrawer={showInviteDrawer}
        setShowInviteDrawer={setShowInviteDrawer}
        showBannerDrawer={showBannerDrawer}
        setShowBannerDrawer={setShowBannerDrawer}
        showBrandDrawer={showBrandDrawer}
        setShowBrandDrawer={setShowBrandDrawer}
        showRecordingDrawer={showRecordingDrawer}
        setShowRecordingDrawer={setShowRecordingDrawer}
        selectedDestinations={selectedDestinations}
        onDestinationSelectionChange={setSelectedDestinations}
        onDestinationSettingsChange={setDestinationSettings}
        currentDestinationSettings={destinationSettings}
      />

      {/* Modals */}
      <StudioModals
        showClipManager={showClipManager}
        setShowClipManager={setShowClipManager}
        broadcastId={broadcastId}
        showProducerMode={showProducerMode}
        setShowProducerMode={setShowProducerMode}
        producerId={broadcast?.userId}
        remoteParticipants={remoteParticipants}
        onPromoteToLive={handlePromoteToLive}
        onDemoteToBackstage={handleDemoteToBackstage}
        onMuteParticipant={handleMuteParticipant}
        onUnmuteParticipant={handleUnmuteParticipant}
        onLayoutChange={handleLayoutChange}
        showResetConfirmation={showResetConfirmation}
        setShowResetConfirmation={setShowResetConfirmation}
        onResetStack={handleResetStack}
        showAnalyticsDashboard={showAnalyticsDashboard}
        setShowAnalyticsDashboard={setShowAnalyticsDashboard}
        analyticsEnabled={analyticsEnabled}
        analyticsMetrics={analyticsMetrics}
        analyticsInsights={analyticsInsights}
        analyticsDashboardPosition={analyticsDashboardPosition}
        analyticsDashboardSize={analyticsDashboardSize}
        onAnalyticsDashboardDragStart={handleAnalyticsDashboardDragStart}
        onAnalyticsDashboardResizeStart={handleAnalyticsDashboardResizeStart}
        showBackgroundSettings={showBackgroundSettings}
        setShowBackgroundSettings={setShowBackgroundSettings}
        backgroundRemovalOptions={backgroundRemovalOptions}
        setBackgroundRemovalOptions={setBackgroundRemovalOptions}
        showClipDurationSelector={showClipDurationSelector}
        setShowClipDurationSelector={setShowClipDurationSelector}
        onCreateClip={handleCreateClip}
        showLanguageSelector={showLanguageSelector}
        setShowLanguageSelector={setShowLanguageSelector}
        captionLanguage={captionLanguage}
        setCaptionLanguage={setCaptionLanguage}
        captionsEnabled={captionsEnabled}
        showChatLayoutCustomizer={showChatLayoutCustomizer}
        setShowChatLayoutCustomizer={setShowChatLayoutCustomizer}
        chatLayoutConfig={chatLayoutConfig}
        setChatLayoutConfig={setChatLayoutConfig}
        showScreenShareManager={showScreenShareManager}
        setShowScreenShareManager={setShowScreenShareManager}
        isHost={user?.id === broadcast?.userId}
        participantId={user?.id || ''}
        participantName={user?.name || 'User'}
        showBackgroundEffects={showBackgroundEffects}
        setShowBackgroundEffects={setShowBackgroundEffects}
        backgroundEffect={backgroundEffect}
        setBackgroundEffect={setBackgroundEffect}
      />

      {/* Canvas Settings Modal */}
      <CanvasSettingsModal
        isOpen={showCanvasSettings}
        onClose={() => setShowCanvasSettings(false)}
        cameraStream={videoEnabled ? localStream : null}
        // General settings
        canvasResolution={canvasSettings.canvasResolution}
        onResolutionChange={canvasSettings.setCanvasResolution}
        canvasBackgroundColor={canvasSettings.canvasBackgroundColor}
        onBackgroundColorChange={canvasSettings.setCanvasBackgroundColor}
        showResolutionBadge={canvasSettings.showResolutionBadge}
        onShowResolutionBadgeChange={canvasSettings.setShowResolutionBadge}
        showPositionNumbers={canvasSettings.showPositionNumbers}
        onShowPositionNumbersChange={canvasSettings.setShowPositionNumbers}
        showConnectionQuality={canvasSettings.showConnectionQuality}
        onShowConnectionQualityChange={canvasSettings.setShowConnectionQuality}
        showLowerThirds={canvasSettings.showLowerThirds}
        onShowLowerThirdsChange={canvasSettings.setShowLowerThirds}
        orientation={canvasSettings.orientation}
        onOrientationChange={canvasSettings.setOrientation}
        appearance={canvasSettings.appearance}
        onAppearanceChange={canvasSettings.setAppearance}
        displayInfoMessages={canvasSettings.displayInfoMessages}
        onDisplayInfoMessagesChange={canvasSettings.setDisplayInfoMessages}
        shiftVideosForBanners={canvasSettings.shiftVideosForBanners}
        onShiftVideosForBannersChange={canvasSettings.setShiftVideosForBanners}
        audioAvatars={canvasSettings.audioAvatars}
        onAudioAvatarsChange={canvasSettings.setAudioAvatars}
        autoAddPresentedMedia={canvasSettings.autoAddPresentedMedia}
        onAutoAddPresentedMediaChange={canvasSettings.setAutoAddPresentedMedia}
        // Camera settings
        videoDevices={videoDevices}
        selectedVideoDevice={selectedVideoDevice}
        onVideoDeviceChange={handleVideoDeviceChange}
        videoQuality={canvasSettings.videoQuality}
        onVideoQualityChange={canvasSettings.setVideoQuality}
        mirrorVideo={canvasSettings.mirrorVideo}
        onMirrorVideoChange={canvasSettings.setMirrorVideo}
        autoAdjustBrightness={canvasSettings.autoAdjustBrightness}
        onAutoAdjustBrightnessChange={canvasSettings.setAutoAdjustBrightness}
        hdMode={canvasSettings.hdMode}
        onHdModeChange={canvasSettings.setHdMode}
        // Audio settings
        audioDevices={audioDevices}
        selectedAudioDevice={selectedAudioDevice}
        onAudioDeviceChange={handleAudioDeviceChange}
        inputVolume={canvasSettings.inputVolume}
        onInputVolumeChange={canvasSettings.setInputVolume}
        echoCancellation={canvasSettings.echoCancellation}
        onEchoCancellationChange={canvasSettings.setEchoCancellation}
        noiseSuppression={canvasSettings.noiseSuppression}
        onNoiseSuppressionChange={canvasSettings.setNoiseSuppression}
        autoAdjustMicrophone={canvasSettings.autoAdjustMicrophone}
        onAutoAdjustMicrophoneChange={canvasSettings.setAutoAdjustMicrophone}
        noiseGateEnabled={canvasSettings.noiseGateEnabled}
        onNoiseGateEnabledChange={canvasSettings.setNoiseGateEnabled}
        noiseGateThreshold={canvasSettings.noiseGateThreshold}
        onNoiseGateThresholdChange={canvasSettings.setNoiseGateThreshold}
        // Visual effects
        selectedBackground={canvasSettings.selectedBackground}
        onBackgroundSelect={canvasSettings.setSelectedBackground}
        backgroundBlur={canvasSettings.backgroundBlur}
        onBackgroundBlurChange={canvasSettings.setBackgroundBlur}
        backgroundBlurStrength={canvasSettings.backgroundBlurStrength}
        onBackgroundBlurStrengthChange={canvasSettings.setBackgroundBlurStrength}
        virtualBackground={canvasSettings.virtualBackground}
        onVirtualBackgroundChange={canvasSettings.setVirtualBackground}
        virtualBackgroundStrength={canvasSettings.virtualBackgroundStrength}
        onVirtualBackgroundStrengthChange={canvasSettings.setVirtualBackgroundStrength}
        backgroundRemoval={canvasSettings.backgroundRemoval}
        onBackgroundRemovalChange={canvasSettings.setBackgroundRemoval}
        backgroundRemovalStrength={canvasSettings.backgroundRemovalStrength}
        onBackgroundRemovalStrengthChange={canvasSettings.setBackgroundRemovalStrength}
        autoEnhanceLighting={canvasSettings.autoEnhanceLighting}
        onAutoEnhanceLightingChange={canvasSettings.setAutoEnhanceLighting}
        colorCorrection={canvasSettings.colorCorrection}
        onColorCorrectionChange={canvasSettings.setColorCorrection}
        // Recording
        recordingQuality={canvasSettings.recordingQuality}
        onRecordingQualityChange={canvasSettings.setRecordingQuality}
        recordLocalCopies={canvasSettings.recordLocalCopies}
        onRecordLocalCopiesChange={canvasSettings.setRecordLocalCopies}
        separateAudioTracks={canvasSettings.separateAudioTracks}
        onSeparateAudioTracksChange={canvasSettings.setSeparateAudioTracks}
        autoSaveRecordings={canvasSettings.autoSaveRecordings}
        onAutoSaveRecordingsChange={canvasSettings.setAutoSaveRecordings}
        // Layout
        autoArrangeParticipants={canvasSettings.autoArrangeParticipants}
        onAutoArrangeParticipantsChange={canvasSettings.setAutoArrangeParticipants}
        rememberLayoutPreferences={canvasSettings.rememberLayoutPreferences}
        onRememberLayoutPreferencesChange={canvasSettings.setRememberLayoutPreferences}
        showLayoutGridLines={canvasSettings.showLayoutGridLines}
        onShowLayoutGridLinesChange={canvasSettings.setShowLayoutGridLines}
        defaultLayout={canvasSettings.defaultLayout}
        onDefaultLayoutChange={canvasSettings.setDefaultLayout}
        // Guest
        guestsCanEnableCamera={canvasSettings.guestsCanEnableCamera}
        onGuestsCanEnableCameraChange={canvasSettings.setGuestsCanEnableCamera}
        guestsCanEnableMicrophone={canvasSettings.guestsCanEnableMicrophone}
        onGuestsCanEnableMicrophoneChange={canvasSettings.setGuestsCanEnableMicrophone}
        guestsCanShareScreen={canvasSettings.guestsCanShareScreen}
        onGuestsCanShareScreenChange={canvasSettings.setGuestsCanShareScreen}
        requireApprovalToJoin={canvasSettings.requireApprovalToJoin}
        onRequireApprovalToJoinChange={canvasSettings.setRequireApprovalToJoin}
        muteGuestsOnEntry={canvasSettings.muteGuestsOnEntry}
        onMuteGuestsOnEntryChange={canvasSettings.setMuteGuestsOnEntry}
        disableGuestCameraOnEntry={canvasSettings.disableGuestCameraOnEntry}
        onDisableGuestCameraOnEntryChange={canvasSettings.setDisableGuestCameraOnEntry}
        showGuestsInBackstageFirst={canvasSettings.showGuestsInBackstageFirst}
        onShowGuestsInBackstageFirstChange={canvasSettings.setShowGuestsInBackstageFirst}
      />

      <DeviceSelectors
        showMicSelector={showMicSelector}
        setShowMicSelector={setShowMicSelector}
        audioDevices={audioDevices}
        selectedAudioDevice={selectedAudioDevice}
        handleAudioDeviceChange={handleAudioDeviceChange}
        loadDevices={loadDevices}
        micButtonRef={micButtonRef}
        showCameraSelector={showCameraSelector}
        setShowCameraSelector={setShowCameraSelector}
        videoDevices={videoDevices}
        selectedVideoDevice={selectedVideoDevice}
        handleVideoDeviceChange={handleVideoDeviceChange}
        cameraButtonRef={cameraButtonRef}
        showSpeakerSelector={showSpeakerSelector}
        setShowSpeakerSelector={setShowSpeakerSelector}
        speakerDevices={speakerDevices}
        selectedSpeakerDevice={selectedSpeakerDevice}
        handleSpeakerDeviceChange={handleSpeakerDeviceChange}
        speakerButtonRef={speakerButtonRef}
      />
    </div>
  );
}
