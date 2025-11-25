import { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { studioCanvasOutputService } from '../services/studioCanvasOutput.service';
import { broadcastService } from '../services/broadcast.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import toast from 'react-hot-toast';
import { HotkeyReference } from '../components/HotkeyReference';
import { HotkeyFeedback, useHotkeyFeedback } from '../components/HotkeyFeedback';
import { LeftSidebar } from '../components/studio/LeftSidebar';
import { RightSidebar } from '../components/studio/RightSidebar';
import { BottomControlBar } from '../components/studio/BottomControlBar';
import { DeviceSelectors } from '../components/studio/DeviceSelectors';
import { StudioCanvas, LayoutSelector, PreviewArea, CanvasSettingsModal, CountdownOverlay, IntroVideoOverlay } from '../components/studio/canvas';
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
  useStudioHandlers,
} from '../hooks/studio';
import { useCanvasSettings } from '../hooks/studio/useCanvasSettings';
import { socketService } from '../services/socket.service';

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const { messages: hotkeyMessages } = useHotkeyFeedback();

  // Countdown state
  const [countdownSeconds, setCountdownSeconds] = useState<number | null>(null);

  // Intro video state
  const [introVideoUrl, setIntroVideoUrl] = useState<string | null>(null);

  // Refs
  const micButtonRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLDivElement>(null);
  const speakerButtonRef = useRef<HTMLDivElement>(null);

  const { broadcast, isLive, setBroadcast } = useStudioStore();
  const { localStream, audioEnabled, videoEnabled, startCamera, stopCamera, toggleAudio, toggleVideo } = useMedia();

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
      return saved ? JSON.parse(saved) : { privacy: {}, schedule: {}, title: {}, description: {} };
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
      console.log('[Studio] Skipping save - settings contain Loading placeholders');
      return;
    }

    try {
      localStorage.setItem(`destinationSettings_${broadcastId}`, JSON.stringify(destinationSettings));
      console.log('[Studio] Saved destination settings:', destinationSettings);
    } catch (error) {
      console.error('Failed to save destination settings to localStorage:', error);
    }
  }, [destinationSettings, broadcastId]);

  // Countdown socket listeners + compositor event listeners
  useEffect(() => {
    // Socket events from backend
    const handleCountdownTick = (data: { secondsRemaining: number }) => {
      console.log('[Studio] Countdown tick (socket):', data.secondsRemaining);
      setCountdownSeconds(data.secondsRemaining);
    };

    const handleCountdownComplete = () => {
      console.log('[Studio] Countdown complete (socket)');
      setCountdownSeconds(null);
    };

    // Compositor events (for local countdown during go-live)
    const handleCompositorCountdown = ((e: CustomEvent) => {
      console.log('[Studio] Countdown (compositor):', e.detail.seconds);
      setCountdownSeconds(e.detail.seconds);
    }) as EventListener;

    // Compositor intro video events
    const handleCompositorIntroVideo = ((e: CustomEvent) => {
      console.log('[Studio] Intro video (compositor):', e.detail);
      setIntroVideoUrl(e.detail.playing ? e.detail.url : null);
    }) as EventListener;

    socketService.on('countdown-tick', handleCountdownTick);
    socketService.on('countdown-complete', handleCountdownComplete);
    window.addEventListener('compositor-countdown', handleCompositorCountdown);
    window.addEventListener('compositor-intro-video', handleCompositorIntroVideo);

    return () => {
      socketService.off('countdown-tick', handleCountdownTick);
      socketService.off('countdown-complete', handleCountdownComplete);
      window.removeEventListener('compositor-countdown', handleCompositorCountdown);
      window.removeEventListener('compositor-intro-video', handleCompositorIntroVideo);
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

  // WebRTC
  const { isInitializing, initializeWebRTC } = useWebRTC(broadcastId, localStream);

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
  } = useParticipants({ broadcastId, showChatOnStream });

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
  });
  const { mediaClips, showMediaLibrary, setShowMediaLibrary, handlePlayClip } = useMediaClips();
  const { showAnalyticsDashboard, setShowAnalyticsDashboard, analyticsDashboardPosition, analyticsDashboardSize, handleAnalyticsDashboardDragStart, handleAnalyticsDashboardResizeStart } = useAnalyticsDashboard();
  const { showDestinationsDrawer, setShowDestinationsDrawer, showInviteDrawer, setShowInviteDrawer, showBannerDrawer, setShowBannerDrawer, showBrandDrawer, setShowBrandDrawer, showRecordingDrawer, setShowRecordingDrawer } = useDrawers();
  const { showClipManager, setShowClipManager, showProducerMode, setShowProducerMode, showClipDurationSelector, setShowClipDurationSelector, showLanguageSelector, setShowLanguageSelector, showBackgroundSettings, setShowBackgroundSettings, showSceneManager, setShowSceneManager } = useModals();

  // Teleprompter
  const teleprompterState = useTeleprompter();
  const { showHotkeyReference } = useStudioHotkeys({ audioEnabled, videoEnabled, isLive, isRecording, isSharingScreen, toggleAudio, toggleVideo, handleGoLive, handleEndBroadcast, handleStartRecording, handleStopRecording, handleToggleScreenShare, handleLayoutChange, setShowChatOnStream });
  const { handleCreateClip } = useClipRecording(clipRecordingEnabled, localStream, () => studioCanvasOutputService.getOutputStream());

  // Canvas Settings (persisted to localStorage)
  const canvasSettings = useCanvasSettings();

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
            <StudioCanvas
              localStream={processedStream || localStream}
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
            {/* Countdown Overlay */}
            <CountdownOverlay seconds={countdownSeconds} />
            {/* Intro Video Overlay */}
            <IntroVideoOverlay videoUrl={introVideoUrl} />
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
              audioStream={localStream} // Raw stream for audio monitoring (processed stream may not have audio)
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isLocalUserOnStage={isLocalUserOnStage}
              backstageParticipants={Array.from(remoteParticipants.values()).filter((p) => p.role === 'backstage')}
              screenShareStream={screenShareStream}
              onAddToStage={handleAddToStage}
              onRemoveFromStage={handleRemoveFromStage}
              onInviteGuests={() => setShowInviteDrawer(true)}
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
          onShowBannerDrawer={() => setShowBannerDrawer(true)}
          rightSidebarRef={rightSidebarRef}
          teleprompterState={teleprompterState}
          onCommentClick={setDisplayedComment}
          localStream={localStream}
          audioEnabled={audioEnabled}
          videoEnabled={videoEnabled}
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
        showMediaLibrary={showMediaLibrary}
        setShowMediaLibrary={setShowMediaLibrary}
        onPlayClip={handlePlayClip}
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
