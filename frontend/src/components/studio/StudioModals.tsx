import {
  AnalyticsDashboard,
  MediaLibraryModal,
  ClipManagerModal,
  ProducerModeModal,
  ClipDurationSelector,
  BackgroundSettingsDropdown,
  LanguageSelectorDropdown,
} from './modals';

interface StudioModalsProps {
  // Media Library
  showMediaLibrary: boolean;
  setShowMediaLibrary: (show: boolean) => void;
  onPlayClip: (clipId: string) => void;

  // Clip Manager
  showClipManager: boolean;
  setShowClipManager: (show: boolean) => void;
  broadcastId: string | undefined;

  // Producer Mode
  showProducerMode: boolean;
  setShowProducerMode: (show: boolean) => void;
  producerId: string | undefined;
  remoteParticipants: Map<string, any>;
  onPromoteToLive: (participantId: string) => void;
  onDemoteToBackstage: (participantId: string) => void;
  onMuteParticipant: (participantId: string) => void;
  onUnmuteParticipant: (participantId: string) => void;
  onLayoutChange: (layoutId: number) => void;

  // Reset Stack Confirmation
  showResetConfirmation: boolean;
  setShowResetConfirmation: (show: boolean) => void;
  onResetStack: () => void;

  // Analytics Dashboard
  showAnalyticsDashboard: boolean;
  setShowAnalyticsDashboard: (show: boolean) => void;
  analyticsEnabled: boolean;
  analyticsMetrics: any;
  analyticsInsights: any;
  analyticsDashboardPosition: any;
  analyticsDashboardSize: any;
  onAnalyticsDashboardDragStart: any;
  onAnalyticsDashboardResizeStart: any;

  // Background Settings
  showBackgroundSettings: boolean;
  setShowBackgroundSettings: (show: boolean) => void;
  backgroundRemovalOptions: any;
  setBackgroundRemovalOptions: (options: any) => void;

  // Clip Duration Selector
  showClipDurationSelector: boolean;
  setShowClipDurationSelector: (show: boolean) => void;
  onCreateClip: (duration: 30 | 60) => Promise<void>;

  // Language Selector
  showLanguageSelector: boolean;
  setShowLanguageSelector: (show: boolean) => void;
  captionLanguage: string;
  setCaptionLanguage: (lang: string) => void;
  captionsEnabled: boolean;
}

export function StudioModals({
  showMediaLibrary,
  setShowMediaLibrary,
  onPlayClip,
  showClipManager,
  setShowClipManager,
  broadcastId,
  showProducerMode,
  setShowProducerMode,
  producerId,
  remoteParticipants,
  onPromoteToLive,
  onDemoteToBackstage,
  onMuteParticipant,
  onUnmuteParticipant,
  onLayoutChange,
  showResetConfirmation,
  setShowResetConfirmation,
  onResetStack,
  showAnalyticsDashboard,
  setShowAnalyticsDashboard,
  analyticsEnabled,
  analyticsMetrics,
  analyticsInsights,
  analyticsDashboardPosition,
  analyticsDashboardSize,
  onAnalyticsDashboardDragStart,
  onAnalyticsDashboardResizeStart,
  showBackgroundSettings,
  setShowBackgroundSettings,
  backgroundRemovalOptions,
  setBackgroundRemovalOptions,
  showClipDurationSelector,
  setShowClipDurationSelector,
  onCreateClip,
  showLanguageSelector,
  setShowLanguageSelector,
  captionLanguage,
  setCaptionLanguage,
  captionsEnabled,
}: StudioModalsProps) {
  return (
    <>
      {/* Media Library Modal */}
      {showMediaLibrary && (
        <MediaLibraryModal
          isOpen={showMediaLibrary}
          onClose={() => setShowMediaLibrary(false)}
          onTriggerClip={onPlayClip}
        />
      )}

      {/* Clip Manager Modal */}
      {showClipManager && (
        <ClipManagerModal isOpen={showClipManager} onClose={() => setShowClipManager(false)} broadcastId={broadcastId} />
      )}

      {/* Producer Mode Modal */}
      {showProducerMode && (
        <ProducerModeModal
          isOpen={showProducerMode}
          onClose={() => setShowProducerMode(false)}
          broadcastId={broadcastId}
          producerId={producerId}
          remoteParticipants={remoteParticipants}
          onPromoteToLive={onPromoteToLive}
          onDemoteToBackstage={onDemoteToBackstage}
          onMuteParticipant={onMuteParticipant}
          onUnmuteParticipant={onUnmuteParticipant}
          onLayoutChange={onLayoutChange}
        />
      )}

      {/* Reset Stack Confirmation Modal */}
      {showResetConfirmation && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Reset Stack</h2>
            <p className="text-gray-700 mb-6">
              This will clear all linked files and allow you to start fresh.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowResetConfirmation(false)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300 text-gray-700 font-medium transition-colors"
              >
                No
              </button>
              <button
                onClick={onResetStack}
                className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors"
              >
                Yes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Analytics Dashboard */}
      {showAnalyticsDashboard && analyticsEnabled && (
        <AnalyticsDashboard
          isOpen={showAnalyticsDashboard}
          onClose={() => setShowAnalyticsDashboard(false)}
          metrics={analyticsMetrics}
          insights={analyticsInsights}
          position={analyticsDashboardPosition}
          size={analyticsDashboardSize}
          onDragStart={onAnalyticsDashboardDragStart}
          onResizeStart={onAnalyticsDashboardResizeStart}
        />
      )}

      {/* Background Settings Dropdown */}
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
          onCreateClip={onCreateClip}
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
    </>
  );
}
