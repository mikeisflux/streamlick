import {
  AnalyticsDashboard,
  ClipManagerModal,
  ProducerModeModal,
  ClipDurationSelector,
  BackgroundSettingsDropdown,
  LanguageSelectorDropdown,
} from './modals';
import { ChatLayoutCustomizer, ChatLayoutConfig } from '../ChatLayoutCustomizer';
import { ScreenShareManager } from '../ScreenShareManager';
import { BackgroundEffects } from '../BackgroundEffects';

interface StudioModalsProps {
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

  // Chat Layout Customizer
  showChatLayoutCustomizer: boolean;
  setShowChatLayoutCustomizer: (show: boolean) => void;
  chatLayoutConfig: ChatLayoutConfig;
  setChatLayoutConfig: (config: ChatLayoutConfig) => void;

  // Screen Share Manager
  showScreenShareManager: boolean;
  setShowScreenShareManager: (show: boolean) => void;
  isHost: boolean;
  participantId: string;
  participantName: string;

  // Background Effects
  showBackgroundEffects: boolean;
  setShowBackgroundEffects: (show: boolean) => void;
  backgroundEffect: any;
  setBackgroundEffect: (effect: any) => void;
}

export function StudioModals({
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
  showChatLayoutCustomizer,
  setShowChatLayoutCustomizer,
  chatLayoutConfig,
  setChatLayoutConfig,
  showScreenShareManager,
  setShowScreenShareManager,
  isHost,
  participantId,
  participantName,
  showBackgroundEffects,
  setShowBackgroundEffects,
  backgroundEffect,
  setBackgroundEffect,
}: StudioModalsProps) {
  return (
    <>
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

      {/* Chat Layout Customizer Modal */}
      {showChatLayoutCustomizer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Chat Layout Customizer</h2>
              <button
                onClick={() => setShowChatLayoutCustomizer(false)}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ChatLayoutCustomizer
                config={chatLayoutConfig}
                onChange={setChatLayoutConfig}
              />
            </div>
          </div>
        </div>
      )}

      {/* Screen Share Manager Modal */}
      {showScreenShareManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Screen Share Manager</h2>
              <button
                onClick={() => setShowScreenShareManager(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <ScreenShareManager
                isHost={isHost}
                participantId={participantId}
                participantName={participantName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Background Effects Modal */}
      {showBackgroundEffects && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-gray-900 rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-white">Background Effects</h2>
              <button
                onClick={() => setShowBackgroundEffects(false)}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <BackgroundEffects
                currentEffect={backgroundEffect}
                onEffectChange={setBackgroundEffect}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
