import { RefObject } from 'react';

interface BottomControlBarProps {
  // Killer features state and handlers
  captionsEnabled: boolean;
  setCaptionsEnabled: (enabled: boolean) => void;
  showLanguageSelector: boolean;
  setShowLanguageSelector: (show: boolean) => void;
  clipRecordingEnabled: boolean;
  setClipRecordingEnabled: (enabled: boolean) => void;
  setShowClipDurationSelector: (show: boolean) => void;
  setShowClipManager: (show: boolean) => void;
  backgroundRemovalEnabled: boolean;
  setBackgroundRemovalEnabled: (enabled: boolean) => void;
  showBackgroundSettings: boolean;
  setShowBackgroundSettings: (show: boolean) => void;
  verticalSimulcastEnabled: boolean;
  setVerticalSimulcastEnabled: (enabled: boolean) => void;
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
  setShowAnalyticsDashboard: (show: boolean) => void;
  showChatOnStream: boolean;
  setShowChatOnStream: (show: boolean) => void;

  // Media controls
  audioEnabled: boolean;
  toggleAudio: () => void;
  videoEnabled: boolean;
  toggleVideo: () => void;
  isSharingScreen: boolean;
  startScreenShare: () => void;
  stopScreenShare: () => void;
  speakerMuted: boolean;
  toggleSpeaker: () => void;

  // Device selector state
  showMicSelector: boolean;
  setShowMicSelector: (show: boolean) => void;
  showCameraSelector: boolean;
  setShowCameraSelector: (show: boolean) => void;
  showSpeakerSelector: boolean;
  setShowSpeakerSelector: (show: boolean) => void;

  // Refs for positioning
  micButtonRef: RefObject<HTMLDivElement>;
  cameraButtonRef: RefObject<HTMLDivElement>;
  speakerButtonRef: RefObject<HTMLDivElement>;
}

export function BottomControlBar({
  captionsEnabled,
  setCaptionsEnabled,
  showLanguageSelector,
  setShowLanguageSelector,
  clipRecordingEnabled,
  setClipRecordingEnabled,
  setShowClipDurationSelector,
  setShowClipManager,
  backgroundRemovalEnabled,
  setBackgroundRemovalEnabled,
  showBackgroundSettings,
  setShowBackgroundSettings,
  verticalSimulcastEnabled,
  setVerticalSimulcastEnabled,
  analyticsEnabled,
  setAnalyticsEnabled,
  setShowAnalyticsDashboard,
  showChatOnStream,
  setShowChatOnStream,
  audioEnabled,
  toggleAudio,
  videoEnabled,
  toggleVideo,
  isSharingScreen,
  startScreenShare,
  stopScreenShare,
  speakerMuted,
  toggleSpeaker,
  showMicSelector,
  setShowMicSelector,
  showCameraSelector,
  setShowCameraSelector,
  showSpeakerSelector,
  setShowSpeakerSelector,
  micButtonRef,
  cameraButtonRef,
  speakerButtonRef,
}: BottomControlBarProps) {
  return (
    <div
      className="flex items-center justify-center px-6 border-t fixed bottom-0 left-0"
      style={{
        height: '80px',
        backgroundColor: '#2d2d2d',
        borderColor: '#404040',
        right: '64px',
        zIndex: 90, // Layer 90: Bottom control bar (always visible)
      }}
    >
      {/* Centered Section - Killer Features and Media Controls */}
      <div className="flex items-center gap-3">
        {/* AI Captions with language selector */}
        <div className="relative flex items-center">
          <button
            onClick={() => setCaptionsEnabled(!captionsEnabled)}
            className={`p-2 rounded-l ${
              captionsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={captionsEnabled ? 'Stop AI Captions' : 'Start AI Captions'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
          </button>
          <button
            onClick={() => setShowLanguageSelector(!showLanguageSelector)}
            className={`p-2 pr-3 rounded-r border-l border-gray-600 ${
              captionsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title="Select Language"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => setClipRecordingEnabled(!clipRecordingEnabled)}
          className={`p-2 rounded ${
            clipRecordingEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors`}
          title={clipRecordingEnabled ? 'Stop Clip Buffer' : 'Start Clip Buffer (60s rolling)'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
          </svg>
        </button>
        {clipRecordingEnabled && (
          <button
            onClick={() => setShowClipDurationSelector(true)}
            className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors animate-pulse"
            title="Create instant clip"
          >
            ✂️ Create Clip
          </button>
        )}
        <button
          onClick={() => setShowClipManager(true)}
          className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
          title="Clip Manager"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </button>
        {/* Smart Background Removal with settings dropdown */}
        <div className="relative flex items-center">
          <button
            onClick={() => setBackgroundRemovalEnabled(!backgroundRemovalEnabled)}
            className={`p-2 rounded-l ${
              backgroundRemovalEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={backgroundRemovalEnabled ? 'Disable Background Removal' : 'Enable Smart Background Removal'}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => setShowBackgroundSettings(!showBackgroundSettings)}
            className={`p-2 pr-3 rounded-r border-l border-gray-600 ${
              backgroundRemovalEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title="Background Removal Settings"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={() => setVerticalSimulcastEnabled(!verticalSimulcastEnabled)}
          className={`p-2 rounded ${
            verticalSimulcastEnabled ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors`}
          title={verticalSimulcastEnabled ? 'Disable Vertical Simulcast' : 'Enable Vertical Simulcast (9:16)'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
        </button>
        <button
          onClick={() => {
            setAnalyticsEnabled(!analyticsEnabled);
            if (!analyticsEnabled) {
              setShowAnalyticsDashboard(true);
            }
          }}
          className={`p-2 rounded ${
            analyticsEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors`}
          title={analyticsEnabled ? 'Disable Analytics' : 'Enable Analytics Dashboard'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </button>
        <button
          onClick={() => setShowChatOnStream(!showChatOnStream)}
          className={`p-2 rounded ${
            showChatOnStream ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors`}
          title={showChatOnStream ? 'Hide Live Chat Overlay' : 'Show Live Chat Overlay'}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>

        {/* Divider */}
        <div className="h-8 w-px bg-gray-600" />

        {/* Media Controls */}
        {/* Microphone with device selector */}
        <div ref={micButtonRef} className="relative flex items-center">
          <button
            onClick={toggleAudio}
            className={`p-3 rounded-l-full ${
              audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } text-white transition-colors`}
            title={audioEnabled ? 'Mute' : 'Unmute'}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            onClick={() => {
              setShowMicSelector(!showMicSelector);
              setShowCameraSelector(false);
              setShowSpeakerSelector(false);
            }}
            className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
              audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
            } text-white transition-colors`}
            title="Select Microphone"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {/* Speaker with device selector */}
        <div ref={speakerButtonRef} className="relative flex items-center">
          <button
            onClick={toggleSpeaker}
            className={`p-3 rounded-l-full ${
              speakerMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title={speakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              {speakerMuted ? (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
              ) : (
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              )}
            </svg>
          </button>
          <button
            onClick={() => {
              setShowSpeakerSelector(!showSpeakerSelector);
              setShowMicSelector(false);
              setShowCameraSelector(false);
            }}
            className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
              speakerMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
            } text-white transition-colors`}
            title="Select Speaker"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        {/* Camera with device selector */}
        <div ref={cameraButtonRef} className="relative flex items-center">
          <button
            onClick={toggleVideo}
            className={`p-3 rounded-l-full ${
              videoEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            } text-white transition-colors`}
            title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
          <button
            onClick={() => {
              setShowCameraSelector(!showCameraSelector);
              setShowMicSelector(false);
              setShowSpeakerSelector(false);
            }}
            className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
              videoEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            } text-white transition-colors`}
            title="Select Camera"
          >
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
        <button
          onClick={isSharingScreen ? stopScreenShare : startScreenShare}
          className={`p-3 rounded-full ${
            isSharingScreen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
          } text-white transition-colors`}
          title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
