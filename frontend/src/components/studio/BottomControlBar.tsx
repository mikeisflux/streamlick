import { useState, useRef, useEffect } from 'react';
import {
  Mic, MicOff, Video, VideoOff, Monitor, MonitorOff,
  Volume2, VolumeX, Layout, MessageSquare, Circle
} from 'lucide-react';
import { LayoutType } from '../../store/studioStore';

interface BottomControlBarProps {
  // Media state
  audioEnabled: boolean;
  videoEnabled: boolean;
  isSharingScreen: boolean;
  speakerMuted: boolean;

  // Media controls
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onToggleScreenShare: () => void;
  onToggleSpeaker: () => void;

  // Layout
  currentLayout: LayoutType;
  onLayoutChange: (layout: LayoutType) => void;

  // Features
  isRecording: boolean;
  onToggleRecording: () => void;
  showChatOverlay: boolean;
  onToggleChatOverlay: () => void;

  // Device selection
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
}

const LAYOUTS: { value: LayoutType; label: string; icon: string }[] = [
  { value: 'grid', label: 'Grid', icon: '⊞' },
  { value: 'spotlight', label: 'Spotlight', icon: '◐' },
  { value: 'side-by-side', label: 'Side by Side', icon: '⊟' },
  { value: 'picture-in-picture', label: 'Picture in Picture', icon: '◲' },
  { value: 'single', label: 'Single', icon: '□' },
];

export function BottomControlBar({
  audioEnabled,
  videoEnabled,
  isSharingScreen,
  speakerMuted,
  onToggleAudio,
  onToggleVideo,
  onToggleScreenShare,
  onToggleSpeaker,
  currentLayout,
  onLayoutChange,
  isRecording,
  onToggleRecording,
  showChatOverlay,
  onToggleChatOverlay,
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  onAudioDeviceChange,
  onVideoDeviceChange,
}: BottomControlBarProps) {
  const [showMicSelector, setShowMicSelector] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showLayoutSelector, setShowLayoutSelector] = useState(false);

  const micRef = useRef<HTMLDivElement>(null);
  const cameraRef = useRef<HTMLDivElement>(null);
  const layoutRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (micRef.current && !micRef.current.contains(e.target as Node)) {
        setShowMicSelector(false);
      }
      if (cameraRef.current && !cameraRef.current.contains(e.target as Node)) {
        setShowCameraSelector(false);
      }
      if (layoutRef.current && !layoutRef.current.contains(e.target as Node)) {
        setShowLayoutSelector(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div
      className="fixed bottom-0 left-0 right-[64px] h-20 bg-dark-900 border-t border-dark-800 flex items-center justify-center px-6 z-40"
    >
      <div className="flex items-center gap-4">
        {/* Left Section - Features */}
        <div className="flex items-center gap-2">
          {/* Layout Selector */}
          <div ref={layoutRef} className="relative">
            <button
              onClick={() => setShowLayoutSelector(!showLayoutSelector)}
              className="flex items-center gap-2 px-4 py-2.5 bg-dark-700 hover:bg-dark-600 rounded-lg transition"
              title="Change Layout"
            >
              <Layout className="w-5 h-5" />
              <span className="text-sm">{LAYOUTS.find(l => l.value === currentLayout)?.label}</span>
              <svg className="w-3 h-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showLayoutSelector && (
              <div className="absolute bottom-full left-0 mb-2 w-48 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden">
                {LAYOUTS.map((layout) => (
                  <button
                    key={layout.value}
                    onClick={() => {
                      onLayoutChange(layout.value);
                      setShowLayoutSelector(false);
                    }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition ${
                      currentLayout === layout.value
                        ? 'bg-brand-600 text-white'
                        : 'hover:bg-dark-700'
                    }`}
                  >
                    <span className="text-xl">{layout.icon}</span>
                    <span className="text-sm">{layout.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recording Toggle */}
          <button
            onClick={onToggleRecording}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition ${
              isRecording
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-dark-700 hover:bg-dark-600'
            }`}
            title={isRecording ? 'Stop Recording' : 'Start Recording'}
          >
            <Circle className={`w-4 h-4 ${isRecording ? 'fill-current animate-pulse' : ''}`} />
            <span className="text-sm">{isRecording ? 'Recording' : 'Record'}</span>
          </button>

          {/* Chat Overlay Toggle */}
          <button
            onClick={onToggleChatOverlay}
            className={`p-2.5 rounded-lg transition ${
              showChatOverlay
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-dark-700 hover:bg-dark-600'
            }`}
            title={showChatOverlay ? 'Hide Chat Overlay' : 'Show Chat Overlay'}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
        </div>

        {/* Divider */}
        <div className="h-10 w-px bg-dark-700" />

        {/* Center Section - Media Controls */}
        <div className="flex items-center gap-3">
          {/* Microphone */}
          <div ref={micRef} className="relative flex items-center">
            <button
              onClick={onToggleAudio}
              className={`p-3 rounded-l-full transition ${
                audioEnabled
                  ? 'bg-dark-700 hover:bg-dark-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setShowMicSelector(!showMicSelector);
                setShowCameraSelector(false);
              }}
              className={`p-3 pr-4 rounded-r-full border-l border-dark-600 transition ${
                audioEnabled
                  ? 'bg-dark-700 hover:bg-dark-600'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title="Select Microphone"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showMicSelector && audioDevices.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-xs text-dark-400 uppercase border-b border-dark-700">
                  Select Microphone
                </div>
                {audioDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      onAudioDeviceChange(device.deviceId);
                      setShowMicSelector(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition truncate ${
                      selectedAudioDevice === device.deviceId
                        ? 'bg-brand-600 text-white'
                        : 'hover:bg-dark-700'
                    }`}
                  >
                    {device.label || 'Unknown Microphone'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Speaker */}
          <button
            onClick={onToggleSpeaker}
            className={`p-3 rounded-full transition ${
              speakerMuted
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-dark-700 hover:bg-dark-600'
            }`}
            title={speakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
          >
            {speakerMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>

          {/* Camera */}
          <div ref={cameraRef} className="relative flex items-center">
            <button
              onClick={onToggleVideo}
              className={`p-3 rounded-l-full transition ${
                videoEnabled
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
            >
              {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => {
                setShowCameraSelector(!showCameraSelector);
                setShowMicSelector(false);
              }}
              className={`p-3 pr-4 rounded-r-full border-l border-dark-600 transition ${
                videoEnabled
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
              title="Select Camera"
            >
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {showCameraSelector && videoDevices.length > 0 && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden">
                <div className="px-3 py-2 text-xs text-dark-400 uppercase border-b border-dark-700">
                  Select Camera
                </div>
                {videoDevices.map((device) => (
                  <button
                    key={device.deviceId}
                    onClick={() => {
                      onVideoDeviceChange(device.deviceId);
                      setShowCameraSelector(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left text-sm transition truncate ${
                      selectedVideoDevice === device.deviceId
                        ? 'bg-brand-600 text-white'
                        : 'hover:bg-dark-700'
                    }`}
                  >
                    {device.label || 'Unknown Camera'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Screen Share */}
          <button
            onClick={onToggleScreenShare}
            className={`p-3 rounded-full transition ${
              isSharingScreen
                ? 'bg-brand-600 hover:bg-brand-700'
                : 'bg-dark-700 hover:bg-dark-600'
            }`}
            title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
          >
            {isSharingScreen ? <MonitorOff className="w-5 h-5" /> : <Monitor className="w-5 h-5" />}
          </button>
        </div>
      </div>
    </div>
  );
}
