/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT CONFIGURES CANVAS SETTINGS INCLUDING RESOLUTION, DEVICE SELECTION,
 * AND VISUAL OPTIONS THAT AFFECT THE STUDIOCANVAS OUTPUT.
 * ANY CHANGE TO SETTINGS THAT AFFECT VISUAL OUTPUT MUST ALSO BE INTEGRATED INTO
 * THE HIDDEN CANVAS IN StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview.
 */

import { useState, useRef, useEffect } from 'react';
import { playTestTone } from '../../../utils/audioTest';
import toast from 'react-hot-toast';

interface MediaDevice {
  deviceId: string;
  label: string;
}

interface CanvasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  // Camera preview
  cameraStream?: MediaStream | null;
  // Virtual backgrounds
  selectedBackground?: string;
  onBackgroundSelect?: (backgroundId: string) => void;
  // General settings
  canvasResolution?: '720p' | '1080p' | '4k';
  onResolutionChange?: (resolution: '720p' | '1080p' | '4k') => void;
  canvasBackgroundColor?: string;
  onBackgroundColorChange?: (color: string) => void;
  showResolutionBadge?: boolean;
  onShowResolutionBadgeChange?: (show: boolean) => void;
  showPositionNumbers?: boolean;
  onShowPositionNumbersChange?: (show: boolean) => void;
  showConnectionQuality?: boolean;
  onShowConnectionQualityChange?: (show: boolean) => void;
  showLowerThirds?: boolean;
  onShowLowerThirdsChange?: (show: boolean) => void;
  orientation?: 'landscape' | 'portrait';
  onOrientationChange?: (orientation: 'landscape' | 'portrait') => void;
  appearance?: 'auto' | 'light' | 'dark';
  onAppearanceChange?: (appearance: 'auto' | 'light' | 'dark') => void;
  displayInfoMessages?: boolean;
  onDisplayInfoMessagesChange?: (display: boolean) => void;
  shiftVideosForBanners?: boolean;
  onShiftVideosForBannersChange?: (shift: boolean) => void;
  audioAvatars?: boolean;
  onAudioAvatarsChange?: (enabled: boolean) => void;
  autoAddPresentedMedia?: boolean;
  onAutoAddPresentedMediaChange?: (enabled: boolean) => void;
  // Camera settings
  videoDevices?: MediaDevice[];
  selectedVideoDevice?: string;
  onVideoDeviceChange?: (deviceId: string) => void;
  videoQuality?: '480p' | '720p' | '1080p';
  onVideoQualityChange?: (quality: '480p' | '720p' | '1080p') => void;
  mirrorVideo?: boolean;
  onMirrorVideoChange?: (mirror: boolean) => void;
  autoAdjustBrightness?: boolean;
  onAutoAdjustBrightnessChange?: (adjust: boolean) => void;
  hdMode?: boolean;
  onHdModeChange?: (hd: boolean) => void;
  // Audio settings
  audioDevices?: MediaDevice[];
  selectedAudioDevice?: string;
  onAudioDeviceChange?: (deviceId: string) => void;
  inputVolume?: number;
  onInputVolumeChange?: (volume: number) => void;
  echoCancellation?: boolean;
  onEchoCancellationChange?: (enabled: boolean) => void;
  noiseSuppression?: boolean;
  onNoiseSuppressionChange?: (enabled: boolean) => void;
  autoAdjustMicrophone?: boolean;
  onAutoAdjustMicrophoneChange?: (adjust: boolean) => void;
  // Visual effects settings
  backgroundBlur?: boolean;
  onBackgroundBlurChange?: (enabled: boolean) => void;
  backgroundBlurStrength?: number;
  onBackgroundBlurStrengthChange?: (strength: number) => void;
  virtualBackground?: boolean;
  onVirtualBackgroundChange?: (enabled: boolean) => void;
  virtualBackgroundStrength?: number;
  onVirtualBackgroundStrengthChange?: (strength: number) => void;
  backgroundRemoval?: boolean;
  onBackgroundRemovalChange?: (enabled: boolean) => void;
  backgroundRemovalStrength?: number;
  onBackgroundRemovalStrengthChange?: (strength: number) => void;
  autoEnhanceLighting?: boolean;
  onAutoEnhanceLightingChange?: (enabled: boolean) => void;
  colorCorrection?: boolean;
  onColorCorrectionChange?: (enabled: boolean) => void;
  // Recording settings
  recordingQuality?: '720p' | '1080p' | '4k';
  onRecordingQualityChange?: (quality: '720p' | '1080p' | '4k') => void;
  recordLocalCopies?: boolean;
  onRecordLocalCopiesChange?: (enabled: boolean) => void;
  separateAudioTracks?: boolean;
  onSeparateAudioTracksChange?: (enabled: boolean) => void;
  autoSaveRecordings?: boolean;
  onAutoSaveRecordingsChange?: (enabled: boolean) => void;
  // Layout settings
  autoArrangeParticipants?: boolean;
  onAutoArrangeParticipantsChange?: (enabled: boolean) => void;
  rememberLayoutPreferences?: boolean;
  onRememberLayoutPreferencesChange?: (enabled: boolean) => void;
  showLayoutGridLines?: boolean;
  onShowLayoutGridLinesChange?: (enabled: boolean) => void;
  defaultLayout?: number;
  onDefaultLayoutChange?: (layoutId: number) => void;
  // Guest settings
  guestsCanEnableCamera?: boolean;
  onGuestsCanEnableCameraChange?: (enabled: boolean) => void;
  guestsCanEnableMicrophone?: boolean;
  onGuestsCanEnableMicrophoneChange?: (enabled: boolean) => void;
  guestsCanShareScreen?: boolean;
  onGuestsCanShareScreenChange?: (enabled: boolean) => void;
  requireApprovalToJoin?: boolean;
  onRequireApprovalToJoinChange?: (enabled: boolean) => void;
  muteGuestsOnEntry?: boolean;
  onMuteGuestsOnEntryChange?: (enabled: boolean) => void;
  disableGuestCameraOnEntry?: boolean;
  onDisableGuestCameraOnEntryChange?: (enabled: boolean) => void;
  showGuestsInBackstageFirst?: boolean;
  onShowGuestsInBackstageFirstChange?: (enabled: boolean) => void;
}

type SettingsTab = 'general' | 'camera' | 'audio' | 'visual-effects' | 'recording' | 'hotkeys' | 'layouts' | 'guests';

export function CanvasSettingsModal(props: CanvasSettingsModalProps) {
  const { isOpen, onClose } = props;
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');

  if (!isOpen) return null;

  const tabs: { id: SettingsTab; label: string; icon: string }[] = [
    { id: 'general', label: 'General', icon: '⚙️' },
    { id: 'camera', label: 'Camera', icon: '📹' },
    { id: 'audio', label: 'Audio', icon: '🎤' },
    { id: 'visual-effects', label: 'Visual Effects', icon: '✨' },
    { id: 'recording', label: 'Recording', icon: '⏺️' },
    { id: 'hotkeys', label: 'Hotkeys', icon: '⌨️' },
    { id: 'layouts', label: 'Layouts', icon: '📐' },
    { id: 'guests', label: 'Guests', icon: '👥' },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
        style={{ backdropFilter: 'blur(4px)' }}
      />

      {/* Modal */}
      <div
        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-lg shadow-xl z-50 flex"
        style={{
          backgroundColor: '#1a1a1a',
          width: '720px',
          height: '512px',
          border: '1px solid #404040',
        }}
      >
        {/* Left Sidebar - Tabs */}
        <div
          className="w-56 border-r flex flex-col"
          style={{ backgroundColor: '#0F1419', borderColor: '#404040' }}
        >
          {/* Header */}
          <div className="px-4 py-5 border-b" style={{ borderColor: '#404040' }}>
            <h2 className="text-lg font-semibold text-white">Canvas Settings</h2>
          </div>

          {/* Tab List */}
          <div className="flex-1 overflow-y-auto py-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="w-full px-4 py-3 text-left flex items-center gap-3 transition-colors"
                style={{
                  backgroundColor: activeTab === tab.id ? '#2d2d2d' : 'transparent',
                  color: activeTab === tab.id ? '#ffffff' : '#9ca3af',
                  borderLeft: activeTab === tab.id ? '3px solid #0066ff' : '3px solid transparent',
                }}
              >
                <span className="text-xl">{tab.icon}</span>
                <span className="text-sm font-medium">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* Close Button at Bottom */}
          <div className="p-4 border-t" style={{ borderColor: '#404040' }}>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 rounded text-sm font-medium transition-colors"
              style={{
                backgroundColor: '#3d3d3d',
                color: '#ffffff',
              }}
            >
              Close
            </button>
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Close Button */}
          <div className="absolute top-4 right-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {activeTab === 'general' && <GeneralSettings props={props} />}
            {activeTab === 'camera' && <CameraSettings props={props} />}
            {activeTab === 'audio' && <AudioSettings props={props} />}
            {activeTab === 'visual-effects' && <VisualEffectsSettings props={props} />}
            {activeTab === 'recording' && <RecordingSettings props={props} />}
            {activeTab === 'hotkeys' && <HotkeysSettings />}
            {activeTab === 'layouts' && <LayoutsSettings props={props} />}
            {activeTab === 'guests' && <GuestsSettings props={props} />}
          </div>
        </div>
      </div>
    </>
  );
}

// General Settings Tab
function GeneralSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">General Settings</h3>
        <p className="text-sm text-gray-400 mb-6">
          Configure general canvas and broadcast settings
        </p>
      </div>

      {/* Canvas Resolution */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Canvas Resolution</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
          value={props.canvasResolution ?? '1080p'}
          onChange={(e) => props.onResolutionChange?.(e.target.value as '720p' | '1080p' | '4k')}
        >
          <option value="720p">720p (HD)</option>
          <option value="1080p">1080p (Full HD)</option>
          <option value="4k">4K (Ultra HD)</option>
        </select>
        <p className="text-xs text-gray-500 mt-2">Higher resolutions require more bandwidth</p>
      </div>

      {/* Canvas Background */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Canvas Background Color</label>
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={props.canvasBackgroundColor ?? '#0F1419'}
            onChange={(e) => props.onBackgroundColorChange?.(e.target.value)}
            className="h-10 w-20 rounded cursor-pointer"
          />
          <input
            type="text"
            value={props.canvasBackgroundColor ?? '#0F1419'}
            onChange={(e) => props.onBackgroundColorChange?.(e.target.value)}
            className="flex-1 px-3 py-2 rounded text-sm font-mono"
            style={{
              backgroundColor: '#2d2d2d',
              color: '#ffffff',
              border: '1px solid #404040',
            }}
          />
        </div>
      </div>

      {/* Orientation */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Orientation</label>
        <div className="flex gap-3">
          <button
            onClick={() => props.onOrientationChange?.('landscape')}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: (props.orientation ?? 'landscape') === 'landscape' ? '#0066ff' : '#2d2d2d',
              color: '#ffffff',
              border: '1px solid ' + ((props.orientation ?? 'landscape') === 'landscape' ? '#0066ff' : '#404040'),
            }}
          >
            Landscape
          </button>
          <button
            onClick={() => props.onOrientationChange?.('portrait')}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: props.orientation === 'portrait' ? '#0066ff' : '#2d2d2d',
              color: '#ffffff',
              border: '1px solid ' + (props.orientation === 'portrait' ? '#0066ff' : '#404040'),
            }}
          >
            Portrait
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Appearance</label>
        <div className="flex gap-3">
          <button
            onClick={() => props.onAppearanceChange?.('auto')}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: (props.appearance ?? 'auto') === 'auto' ? '#0066ff' : '#2d2d2d',
              color: '#ffffff',
              border: '1px solid ' + ((props.appearance ?? 'auto') === 'auto' ? '#0066ff' : '#404040'),
            }}
          >
            Auto
          </button>
          <button
            onClick={() => props.onAppearanceChange?.('light')}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: props.appearance === 'light' ? '#0066ff' : '#2d2d2d',
              color: '#ffffff',
              border: '1px solid ' + (props.appearance === 'light' ? '#0066ff' : '#404040'),
            }}
          >
            Light
          </button>
          <button
            onClick={() => props.onAppearanceChange?.('dark')}
            className="flex-1 px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: props.appearance === 'dark' ? '#0066ff' : '#2d2d2d',
              color: '#ffffff',
              border: '1px solid ' + (props.appearance === 'dark' ? '#0066ff' : '#404040'),
            }}
          >
            Dark
          </button>
        </div>
      </div>

      {/* Display Options */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Display Options</label>
        <div className="space-y-3">
          <ToggleOption
            label="Show resolution badge"
            checked={props.showResolutionBadge ?? true}
            onChange={props.onShowResolutionBadgeChange}
          />
          <ToggleOption
            label="Show position numbers"
            checked={props.showPositionNumbers ?? true}
            onChange={props.onShowPositionNumbersChange}
          />
          <ToggleOption
            label="Show connection quality indicators"
            checked={props.showConnectionQuality ?? true}
            onChange={props.onShowConnectionQualityChange}
          />
          <ToggleOption
            label="Show participant names (lower thirds)"
            checked={props.showLowerThirds ?? true}
            onChange={props.onShowLowerThirdsChange}
          />
          <ToggleOption
            label="Display informative messages on stage"
            checked={props.displayInfoMessages ?? true}
            onChange={props.onDisplayInfoMessagesChange}
          />
          <ToggleOption
            label="Shift videos up for comments/banners"
            checked={props.shiftVideosForBanners ?? false}
            onChange={props.onShiftVideosForBannersChange}
          />
          <ToggleOption
            label="Audio avatars"
            checked={props.audioAvatars ?? false}
            onChange={props.onAudioAvatarsChange}
          />
          <ToggleOption
            label="Automatically add presented media to stage"
            checked={props.autoAddPresentedMedia ?? false}
            onChange={props.onAutoAddPresentedMediaChange}
          />
        </div>
      </div>
    </div>
  );
}

// Camera Settings Tab
function CameraSettings({ props }: { props: CanvasSettingsModalProps }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  // Update video srcObject when stream changes
  useEffect(() => {
    if (videoRef.current && props.cameraStream) {
      videoRef.current.srcObject = props.cameraStream;
    }
  }, [props.cameraStream]);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Camera Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure camera and video input settings</p>
      </div>

      {/* Camera Preview */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Camera Preview</label>
        <div
          className="relative rounded overflow-hidden"
          style={{
            width: '100%',
            maxWidth: '500px',
            aspectRatio: '16 / 9',
            backgroundColor: '#1a1a1a',
          }}
        >
          {props.cameraStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
              style={{ transform: props.mirrorVideo ? 'scaleX(-1)' : 'none' }}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center">
                <svg
                  className="w-16 h-16 text-gray-600 mx-auto mb-2"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                  />
                  <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2} />
                </svg>
                <p className="text-gray-500 text-sm">Camera Off</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Camera Device</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
          value={props.selectedVideoDevice ?? ''}
          onChange={(e) => props.onVideoDeviceChange?.(e.target.value)}
        >
          {props.videoDevices && props.videoDevices.length > 0 ? (
            props.videoDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Camera ${device.deviceId.slice(0, 8)}`}
              </option>
            ))
          ) : (
            <option value="">No cameras found</option>
          )}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Video Quality</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
          value={props.videoQuality ?? '720p'}
          onChange={(e) => props.onVideoQualityChange?.(e.target.value as '480p' | '720p' | '1080p')}
        >
          <option value="480p">480p (Standard Definition)</option>
          <option value="720p">720p (High Definition)</option>
          <option value="1080p">1080p (Full HD)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Camera Options</label>
        <div className="space-y-3">
          <ToggleOption
            label="Mirror my video"
            checked={props.mirrorVideo ?? false}
            onChange={props.onMirrorVideoChange}
          />
          <ToggleOption
            label="Auto-adjust brightness"
            checked={props.autoAdjustBrightness ?? true}
            onChange={props.onAutoAdjustBrightnessChange}
          />
          <ToggleOption
            label="HD mode"
            checked={props.hdMode ?? true}
            onChange={props.onHdModeChange}
          />
        </div>
      </div>
    </div>
  );
}

// Audio Settings Tab
function AudioSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Audio Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure microphone and audio settings</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Microphone Device</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
          value={props.selectedAudioDevice ?? ''}
          onChange={(e) => props.onAudioDeviceChange?.(e.target.value)}
        >
          {props.audioDevices && props.audioDevices.length > 0 ? (
            props.audioDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
              </option>
            ))
          ) : (
            <option value="">No microphones found</option>
          )}
        </select>
        {/* Volume Meter Visualization */}
        <div className="mt-3">
          <div className="flex items-center gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex-1 h-4 rounded-sm"
                style={{
                  backgroundColor:
                    i < Math.floor(((props.inputVolume ?? 75) / 100) * 10)
                      ? i < 7
                        ? '#10b981'
                        : i < 9
                        ? '#f59e0b'
                        : '#ef4444'
                      : '#2d2d2d',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Speaker Device */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Speaker Device</label>
        <div className="flex gap-2">
          <select
            className="flex-1 px-3 py-2 rounded text-sm"
            style={{
              backgroundColor: '#2d2d2d',
              color: '#ffffff',
              border: '1px solid #404040',
            }}
          >
            <option value="">Default - System Speaker</option>
            <option value="speaker1">Built-in Speaker</option>
            <option value="speaker2">External Speaker</option>
          </select>
          <button
            className="px-4 py-2 rounded text-sm font-medium transition-colors"
            style={{
              backgroundColor: '#0066ff',
              color: '#ffffff',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#0052cc';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#0066ff';
            }}
            onClick={async () => {
              try {
                toast.loading('Playing test tone...', { id: 'speaker-test' });
                await playTestTone(1000, 440); // 1 second, 440Hz (A note)
                toast.success('Speaker test complete', { id: 'speaker-test' });
              } catch (error) {
                console.error('Speaker test failed:', error);
                toast.error('Failed to play test tone', { id: 'speaker-test' });
              }
            }}
          >
            Test
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Input Volume: {props.inputVolume ?? 75}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={props.inputVolume ?? 75}
          onChange={(e) => props.onInputVolumeChange?.(Number(e.target.value))}
          className="w-full"
          style={{ accentColor: '#0066ff' }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Audio Options</label>
        <div className="space-y-3">
          <ToggleOption
            label="Echo cancellation"
            checked={props.echoCancellation ?? true}
            onChange={props.onEchoCancellationChange}
          />
          <ToggleOption
            label="Noise suppression"
            checked={props.noiseSuppression ?? true}
            onChange={props.onNoiseSuppressionChange}
          />
          <ToggleOption
            label="Auto-adjust microphone"
            checked={props.autoAdjustMicrophone ?? false}
            onChange={props.onAutoAdjustMicrophoneChange}
          />
        </div>
      </div>
    </div>
  );
}

// Visual Effects Settings Tab
function VisualEffectsSettings({ props }: { props: CanvasSettingsModalProps }) {
  const backgrounds = [
    { id: 'none', name: 'None', icon: '✕' },
    { id: 'blur', name: 'Blur', icon: '◎' },
    { id: 'brick', name: 'Brick Wall', icon: '🧱' },
    { id: 'office', name: 'Office', icon: '🏢' },
    { id: 'sunset', name: 'Sunset Cityscape', icon: '🌆' },
    { id: 'forest', name: 'Forest Night', icon: '🌲' },
    { id: 'branded', name: 'Branded Logo', icon: '⭕' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Visual Effects Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure visual effects and filters</p>
      </div>

      {/* Virtual Backgrounds Grid */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">
          Virtual Backgrounds
          <span className="ml-2 text-xs text-gray-500">ℹ️ Select a background for your camera</span>
        </label>
        <div className="grid grid-cols-4 gap-3">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => props.onBackgroundSelect?.(bg.id)}
              className="relative rounded overflow-hidden transition-all hover:ring-2 hover:ring-blue-500"
              style={{
                aspectRatio: '16 / 9',
                backgroundColor: '#2d2d2d',
                border: (props.selectedBackground ?? 'none') === bg.id ? '2px solid #0066ff' : '2px solid #404040',
              }}
            >
              <div className="w-full h-full flex flex-col items-center justify-center">
                <div className="text-2xl mb-1">{bg.icon}</div>
                <div className="text-xs text-gray-300">{bg.name}</div>
              </div>
              {(props.selectedBackground ?? 'none') === bg.id && (
                <div className="absolute top-1 right-1 w-5 h-5 bg-blue-600 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </button>
          ))}
          {/* Add Custom Background Button */}
          <button
            onClick={() => {
              // TODO: Implement file picker for custom background
              console.log('Add custom background clicked');
            }}
            className="relative rounded overflow-hidden transition-all hover:ring-2 hover:ring-blue-500"
            style={{
              aspectRatio: '16 / 9',
              backgroundColor: '#2d2d2d',
              border: '2px dashed #404040',
            }}
          >
            <div className="w-full h-full flex flex-col items-center justify-center">
              <div className="text-3xl text-gray-500 mb-1">+</div>
              <div className="text-xs text-gray-500">Add Custom</div>
            </div>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          See our <a href="#" className="text-blue-500 hover:underline">virtual background guide</a> for tips
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Background Effects</label>
        <div className="space-y-4">
          <div>
            <ToggleOption
              label="Background blur"
              checked={props.backgroundBlur ?? false}
              onChange={props.onBackgroundBlurChange}
            />
            {props.backgroundBlur && (
              <div className="mt-3 ml-6">
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Blur Strength: {props.backgroundBlurStrength ?? 50}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={props.backgroundBlurStrength ?? 50}
                  onChange={(e) => props.onBackgroundBlurStrengthChange?.(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0066ff' }}
                />
              </div>
            )}
          </div>
          <div>
            <ToggleOption
              label="Virtual background"
              checked={props.virtualBackground ?? false}
              onChange={props.onVirtualBackgroundChange}
            />
            {props.virtualBackground && (
              <div className="mt-3 ml-6">
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Background Opacity: {props.virtualBackgroundStrength ?? 75}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={props.virtualBackgroundStrength ?? 75}
                  onChange={(e) => props.onVirtualBackgroundStrengthChange?.(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0066ff' }}
                />
              </div>
            )}
          </div>
          <div>
            <ToggleOption
              label="Background removal"
              checked={props.backgroundRemoval ?? false}
              onChange={props.onBackgroundRemovalChange}
            />
            {props.backgroundRemoval && (
              <div className="mt-3 ml-6">
                <label className="block text-xs font-medium text-gray-400 mb-2">
                  Edge Refinement: {props.backgroundRemovalStrength ?? 80}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={props.backgroundRemovalStrength ?? 80}
                  onChange={(e) => props.onBackgroundRemovalStrengthChange?.(Number(e.target.value))}
                  className="w-full"
                  style={{ accentColor: '#0066ff' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Video Filters</label>
        <div className="space-y-3">
          <ToggleOption
            label="Auto-enhance lighting"
            checked={props.autoEnhanceLighting ?? false}
            onChange={props.onAutoEnhanceLightingChange}
          />
          <ToggleOption
            label="Color correction"
            checked={props.colorCorrection ?? false}
            onChange={props.onColorCorrectionChange}
          />
        </div>
      </div>
    </div>
  );
}

// Recording Settings Tab
function RecordingSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Recording Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure recording quality and options</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Recording Quality</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
        >
          <option>720p</option>
          <option selected>1080p</option>
          <option>4K</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Recording Options</label>
        <div className="space-y-3">
          <ToggleOption label="Record local copies" defaultChecked={false} />
          <ToggleOption label="Separate audio tracks" defaultChecked={false} />
          <ToggleOption label="Auto-save recordings" defaultChecked={true} />
        </div>
      </div>
    </div>
  );
}

// Hotkeys Settings Tab
function HotkeysSettings() {
  // ACTUAL WORKING HOTKEYS (from useStudioHotkeys.ts)
  const hotkeyGroups = [
    {
      category: 'AUDIO & VIDEO',
      hotkeys: [
        { action: 'Toggle microphone', key: 'M', description: 'Mute/unmute your microphone' },
        { action: 'Toggle camera', key: 'V', description: 'Turn camera on/off' },
      ],
    },
    {
      category: 'STREAMING & RECORDING',
      hotkeys: [
        { action: 'Go live', key: 'Ctrl+L', description: 'Start streaming' },
        { action: 'End broadcast', key: 'Ctrl+E', description: 'Stop streaming' },
        { action: 'Toggle recording', key: 'R', description: 'Start/stop recording' },
      ],
    },
    {
      category: 'SCREEN SHARING',
      hotkeys: [
        { action: 'Toggle screen share', key: 'S', description: 'Start/stop screen sharing' },
      ],
    },
    {
      category: 'LAYOUTS',
      hotkeys: [
        { action: 'Grid layout', key: '1', description: 'Switch to grid layout' },
        { action: 'Spotlight layout', key: '2', description: 'Switch to spotlight layout' },
        { action: 'Sidebar layout', key: '3', description: 'Switch to sidebar layout' },
        { action: 'Picture-in-picture layout', key: '4', description: 'Switch to PIP layout' },
      ],
    },
    {
      category: 'CHAT & DISPLAY',
      hotkeys: [
        { action: 'Toggle chat on stream', key: 'C', description: 'Show/hide chat overlay' },
      ],
    },
    {
      category: 'HELP',
      hotkeys: [
        { action: 'Show keyboard shortcuts', key: 'Shift+?', description: 'Display this help' },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Hotkeys Settings</h3>
        <p className="text-sm text-gray-400 mb-6">
          Configure keyboard shortcuts for faster studio control
        </p>
      </div>

      <div className="space-y-6 max-h-[400px] overflow-y-auto pr-2">
        {hotkeyGroups.map((group) => (
          <div key={group.category}>
            <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              {group.category}
            </h4>
            <div className="space-y-2">
              {group.hotkeys.map((hotkey, index) => (
                <div
                  key={`${group.category}-${index}`}
                  className="flex items-center justify-between px-4 py-2 rounded"
                  style={{ backgroundColor: '#2d2d2d' }}
                >
                  <span className="text-sm text-gray-300">{hotkey.action}</span>
                  <code
                    className="px-3 py-1 rounded text-xs font-mono"
                    style={{
                      backgroundColor: hotkey.key === 'Not set' ? 'transparent' : '#1a1a1a',
                      color: hotkey.key === 'Not set' ? '#666666' : '#ffffff',
                      border: hotkey.key === 'Not set' ? '1px dashed #404040' : 'none',
                    }}
                  >
                    {hotkey.key}
                  </code>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <div className="flex items-start gap-3 p-4 rounded" style={{ backgroundColor: '#1a1a1a' }}>
            <span className="text-2xl">💡</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-300 mb-1">All hotkeys are active and ready to use!</p>
              <p className="text-xs text-gray-500">
                Press <code className="px-2 py-0.5 bg-gray-800 rounded">Shift+?</code> while in the studio to see the hotkey reference overlay.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Layouts Settings Tab
function LayoutsSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Layouts Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Manage custom layouts and grid settings</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Layout Options</label>
        <div className="space-y-3">
          <ToggleOption
            label="Auto-arrange participants"
            checked={props.autoArrangeParticipants ?? true}
            onChange={props.onAutoArrangeParticipantsChange}
          />
          <ToggleOption
            label="Remember layout preferences"
            checked={props.rememberLayoutPreferences ?? true}
            onChange={props.onRememberLayoutPreferencesChange}
          />
          <ToggleOption
            label="Show layout grid lines (in edit mode)"
            checked={props.showLayoutGridLines ?? false}
            onChange={props.onShowLayoutGridLinesChange}
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Default Layout</label>
        <p className="text-xs text-gray-500 mb-3">Choose which layout appears when you start a broadcast</p>
        <select
          value={props.defaultLayout ?? 1}
          onChange={(e) => props.onDefaultLayoutChange?.(Number(e.target.value))}
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
        >
          <option value="1">Solo - One person fills entire screen (Shift+1)</option>
          <option value="2">Cropped - Multiple people in tight boxes (Shift+2)</option>
          <option value="3">Group - All participants equal-sized grid (Shift+3)</option>
          <option value="4">Spotlight - One large speaker with small boxes above (Shift+4)</option>
          <option value="5">News - Person on left, content on right (Shift+5)</option>
          <option value="6">Screen - Large content with tiny participants (Shift+6)</option>
          <option value="7">Picture-in-Picture - Full screen content with person overlay (Shift+7)</option>
          <option value="8">Cinema - Ultra-wide format (Shift+8)</option>
        </select>
      </div>

      <div className="mt-4 p-4 rounded" style={{ backgroundColor: '#1a1a1a' }}>
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-300 mb-2">Quick Layout Switching</p>
            <p className="text-xs text-gray-500 mb-2">
              Use <code className="px-2 py-0.5 bg-gray-800 rounded">Shift+1</code> through <code className="px-2 py-0.5 bg-gray-800 rounded">Shift+8</code> to instantly switch between default layouts.
            </p>
            <p className="text-xs text-gray-500">
              Custom layouts can be accessed by clicking the layout bar buttons under the canvas.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Guests Settings Tab
function GuestsSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Guests Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure guest permissions and defaults</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Guest Permissions</label>
        <div className="space-y-3">
          <ToggleOption label="Guests can enable camera" defaultChecked={true} />
          <ToggleOption label="Guests can enable microphone" defaultChecked={true} />
          <ToggleOption label="Guests can share screen" defaultChecked={false} />
          <ToggleOption label="Require approval to join" defaultChecked={false} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Default Settings for Guests</label>
        <div className="space-y-3">
          <ToggleOption label="Mute guests on entry" defaultChecked={true} />
          <ToggleOption label="Disable guest camera on entry" defaultChecked={false} />
          <ToggleOption label="Show guests in backstage first" defaultChecked={true} />
        </div>
      </div>
    </div>
  );
}

// Reusable Toggle Option Component
function ToggleOption({
  label,
  defaultChecked,
  checked: controlledChecked,
  onChange
}: {
  label: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: (checked: boolean) => void;
}) {
  const [internalChecked, setInternalChecked] = useState(defaultChecked ?? false);

  // Use controlled value if provided, otherwise use internal state
  const checked = controlledChecked !== undefined ? controlledChecked : internalChecked;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newChecked = e.target.checked;
    if (onChange) {
      onChange(newChecked);
    } else {
      setInternalChecked(newChecked);
    }
  };

  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className="text-sm text-gray-300">{label}</span>
      <div className="relative">
        <input
          type="checkbox"
          checked={checked}
          onChange={handleChange}
          className="sr-only peer"
        />
        <div
          className="w-11 h-6 rounded-full peer transition-colors"
          style={{
            backgroundColor: checked ? '#0066ff' : '#3d3d3d',
          }}
        />
        <div
          className="absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform"
          style={{
            transform: checked ? 'translateX(20px)' : 'translateX(0)',
          }}
        />
      </div>
    </label>
  );
}
