import { useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { compositorService } from '../services/compositor.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { HotkeyReference } from '../components/HotkeyReference';
import { HotkeyFeedback, useHotkeyFeedback } from '../components/HotkeyFeedback';
import { Drawer } from '../components/Drawer';
import { DestinationsPanel } from '../components/DestinationsPanel';
import { InviteGuestsPanel } from '../components/InviteGuestsPanel';
import { BannerEditorPanel } from '../components/BannerEditorPanel';
import { BrandSettingsPanel } from '../components/BrandSettingsPanel';
import { RecordingControls } from '../components/RecordingControls';
import { Button } from '../components/Button';
import { LeftSidebar } from '../components/studio/LeftSidebar';
import { RightSidebar } from '../components/studio/RightSidebar';
import { BottomControlBar } from '../components/studio/BottomControlBar';
import { DeviceSelectors } from '../components/studio/DeviceSelectors';
import { StudioCanvas, LayoutSelector, PreviewArea, CanvasSettingsModal } from '../components/studio/canvas';
import {
  AnalyticsDashboard,
  MediaLibraryModal,
  ClipManagerModal,
  ProducerModeModal,
  ClipDurationSelector,
  BackgroundSettingsDropdown,
  LanguageSelectorDropdown,
} from '../components/studio/modals';
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
} from '../hooks/studio';
import { useCanvasSettings } from '../hooks/studio/useCanvasSettings';

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const { messages: hotkeyMessages } = useHotkeyFeedback();

  // Refs
  const micButtonRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLDivElement>(null);
  const speakerButtonRef = useRef<HTMLDivElement>(null);

  const { broadcast, isLive } = useStudioStore();
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
  });

  const { currentCaption } = useCaptions(captionsEnabled, captionLanguage);
  const { processedStream } = useBackgroundRemoval(backgroundRemovalEnabled, localStream, backgroundRemovalOptions);
  const { verticalStream } = useVerticalSimulcast(verticalSimulcastEnabled, localStream, processedStream, verticalResolution);
  const { analyticsMetrics, analyticsInsights } = useAnalytics(analyticsEnabled);
  const { scenes, currentSceneId, handleSceneChange, handleSceneCreate, handleSceneUpdate, handleSceneDelete, handleSceneDuplicate } = useSceneManagement();
  const { isSharingScreen, screenShareStream, handleToggleScreenShare } = useScreenShare();
  const { mediaClips, showMediaLibrary, setShowMediaLibrary, handlePlayClip } = useMediaClips();
  const { showAnalyticsDashboard, setShowAnalyticsDashboard, analyticsDashboardPosition, analyticsDashboardSize, handleAnalyticsDashboardDragStart, handleAnalyticsDashboardResizeStart } = useAnalyticsDashboard();
  const { showDestinationsDrawer, setShowDestinationsDrawer, showInviteDrawer, setShowInviteDrawer, showBannerDrawer, setShowBannerDrawer, showBrandDrawer, setShowBrandDrawer, showRecordingDrawer, setShowRecordingDrawer } = useDrawers();
  const { showClipManager, setShowClipManager, showProducerMode, setShowProducerMode, showClipDurationSelector, setShowClipDurationSelector, showLanguageSelector, setShowLanguageSelector, showBackgroundSettings, setShowBackgroundSettings, showSceneManager, setShowSceneManager } = useModals();

  // Teleprompter
  const teleprompterState = useTeleprompter();
  const { showHotkeyReference } = useStudioHotkeys({ audioEnabled, videoEnabled, isLive, isRecording, isSharingScreen, toggleAudio, toggleVideo, handleGoLive, handleEndBroadcast, handleStartRecording, handleStopRecording, handleToggleScreenShare, handleLayoutChange, setShowChatOnStream });
  const { handleCreateClip } = useClipRecording(clipRecordingEnabled, localStream, () => compositorService.getOutputStream());

  // Canvas edit mode and settings
  const [editMode, setEditMode] = useState(false);
  const [showCanvasSettings, setShowCanvasSettings] = useState(false);

  // Local user stage status - starts backstage by default
  const [isLocalUserOnStage, setIsLocalUserOnStage] = useState(false);

  // Canvas Settings (persisted to localStorage)
  const canvasSettings = useCanvasSettings();

  const handleEditModeToggle = () => setEditMode(!editMode);
  const handleAddParticipant = () => {
    // TODO: Implement add participant logic
    console.log('Add participant clicked');
  };
  const handleCanvasSettingsClick = () => setShowCanvasSettings(true);

  // Handle adding/removing participants from stage
  // Use existing handlers from useParticipants hook
  const handleAddToStage = (participantId: string) => {
    if (participantId === 'local-user') {
      setIsLocalUserOnStage(true);
    } else {
      handlePromoteToLive(participantId);
    }
  };

  const handleRemoveFromStage = (participantId: string) => {
    if (participantId === 'local-user') {
      setIsLocalUserOnStage(false);
    } else {
      handleDemoteToBackstage(participantId);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading studio...</div>
      </div>
    );
  }

  return (
    <div
      className="h-screen w-screen overflow-hidden flex flex-col"
      style={{
        backgroundColor: '#1a1a1a',
      }}
    >
      {/* Top Bar */}
      <header
        style={{
          height: '60px',
          backgroundColor: '#2d2d2d',
          borderBottom: '1px solid #404040',
          display: 'flex',
          alignItems: 'center',
          paddingLeft: '24px',
          paddingRight: '24px',
          zIndex: 100, // Layer 100: Top navigation bar (always on top)
          flexShrink: 0,
        }}
      >
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <h1 style={{ width: '140px', fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>Streamlick</h1>
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-red-500 text-sm font-semibold">LIVE</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm">{broadcast?.title || 'Untitled Broadcast'}</span>
            <button
              onClick={() => setShowProducerMode(true)}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
              title="Producer Mode"
            >
              Producer Mode
            </button>
            <button
              onClick={() => setShowDestinationsDrawer(true)}
              className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
              title="Destinations"
            >
              Destinations
            </button>
            <button
              onClick={() => setShowInviteDrawer(true)}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Invite Guests
            </button>
            <button
              onClick={() => setShowCanvasSettings(true)}
              className="text-gray-300 hover:text-white"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {!isLive ? (
              <Button onClick={handleGoLive} variant="primary" size="lg" disabled={isInitializing}>
                {isInitializing ? 'Initializing...' : 'Go Live'}
              </Button>
            ) : (
              <Button onClick={handleEndBroadcast} variant="danger" size="lg">
                End Broadcast
              </Button>
            )}
          </div>
        </div>
      </header>

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
          videoRef={sidebarVideoRef}
          localStream={localStream}
          videoEnabled={videoEnabled}
          showSceneManager={showSceneManager}
          leftSidebarRef={leftSidebarRef}
        />

        {/* Main Canvas Area */}
        <main className="flex-1 flex flex-col overflow-hidden" style={{ backgroundColor: '#F5F5F5' }}>
          {/* Canvas Container - constrained to leave room for Layout Selector and Preview Area */}
          <div className="flex items-center justify-center px-6 pb-20" style={{ minHeight: 0, maxHeight: 'calc(100% - 350px)', flexShrink: 1, paddingTop: '144px' }}>
            <StudioCanvas
              localStream={localStream}
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
              onRemoveFromStage={handleRemoveFromStage}
              teleprompterNotes={teleprompterState.notes}
              teleprompterFontSize={teleprompterState.fontSize}
              teleprompterIsScrolling={teleprompterState.isScrolling}
              teleprompterScrollSpeed={teleprompterState.scrollSpeed}
              teleprompterScrollPosition={teleprompterState.scrollPosition}
              showTeleprompterOnCanvas={teleprompterState.showOnCanvas}
            />
          </div>

          {/* Layout Selector - Always visible below canvas */}
          <div className="flex justify-center px-6" style={{ flexShrink: 0, marginTop: '60px' }}>
            <LayoutSelector
              selectedLayout={selectedLayout}
              onLayoutChange={setSelectedLayout}
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
              localStream={localStream}
              videoEnabled={videoEnabled}
              audioEnabled={audioEnabled}
              isLocalUserOnStage={isLocalUserOnStage}
              backstageParticipants={Array.from(remoteParticipants.values()).filter((p) => p.role === 'backstage')}
              screenShareStream={screenShareStream}
              onAddToStage={handleAddToStage}
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
        />
      </div>

      {/* Hotkey Reference */}
      {showHotkeyReference && <HotkeyReference />}

      {/* Hotkey Visual Feedback */}
      <HotkeyFeedback messages={hotkeyMessages} />

      {/* Media Library Modal */}
      {showMediaLibrary && (
        <MediaLibraryModal
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onTriggerClip={handlePlayClip}
        />
      )}

      {/* Drawer Panels */}
      <Drawer
        isOpen={showDestinationsDrawer}
        onClose={() => setShowDestinationsDrawer(false)}
        title="Streaming Destinations"
        size="lg"
      >
        <DestinationsPanel broadcastId={broadcastId} />
      </Drawer>

      <Drawer isOpen={showInviteDrawer} onClose={() => setShowInviteDrawer(false)} title="Invite Guests" size="md">
        <InviteGuestsPanel broadcastId={broadcastId || ''} />
      </Drawer>

      <Drawer
        isOpen={showBannerDrawer}
        onClose={() => setShowBannerDrawer(false)}
        title="Banner & Overlay Editor"
        size="xl"
      >
        <BannerEditorPanel />
      </Drawer>

      <Drawer isOpen={showBrandDrawer} onClose={() => setShowBrandDrawer(false)} title="Brand Settings" size="lg">
        <BrandSettingsPanel />
      </Drawer>

      <Drawer
        isOpen={showRecordingDrawer}
        onClose={() => setShowRecordingDrawer(false)}
        title="Recording Controls"
        size="md"
      >
        <RecordingControls broadcastId={broadcastId} />
      </Drawer>

      {/* Modals */}
      {showClipManager && (
        <ClipManagerModal isOpen={showClipManager} onClose={() => setShowClipManager(false)} broadcastId={broadcastId} />
      )}

      {showProducerMode && (
        <ProducerModeModal
          isOpen={showProducerMode}
          onClose={() => setShowProducerMode(false)}
          broadcastId={broadcastId}
          producerId={broadcast?.userId}
        />
      )}

      {showAnalyticsDashboard && analyticsEnabled && (
        <AnalyticsDashboard
          isOpen={showAnalyticsDashboard}
          onClose={() => setShowAnalyticsDashboard(false)}
          metrics={analyticsMetrics}
          insights={analyticsInsights}
          position={analyticsDashboardPosition}
          size={analyticsDashboardSize}
          onDragStart={handleAnalyticsDashboardDragStart}
          onResizeStart={handleAnalyticsDashboardResizeStart}
        />
      )}

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

      {/* Background Removal Settings Dropdown */}
      <BackgroundSettingsDropdown
        isOpen={showBackgroundSettings}
        onClose={() => setShowBackgroundSettings(false)}
        options={backgroundRemovalOptions}
        setOptions={setBackgroundRemovalOptions}
      />

      {/* Clip Duration Selector Popup */}
      {showClipDurationSelector && (
        <ClipDurationSelector
          isOpen={showClipDurationSelector}
          onClose={() => setShowClipDurationSelector(false)}
          onCreateClip={handleCreateClip}
        />
      )}

      {/* Language Selector Popup */}
      <LanguageSelectorDropdown
        isOpen={showLanguageSelector}
        onClose={() => setShowLanguageSelector(false)}
        currentLanguage={captionLanguage}
        setLanguage={setCaptionLanguage}
        captionsEnabled={captionsEnabled}
      />
    </div>
  );
}
