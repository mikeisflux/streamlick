import { useState } from 'react';

interface MediaDevice {
  deviceId: string;
  label: string;
}

interface CanvasSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
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
  virtualBackground?: boolean;
  onVirtualBackgroundChange?: (enabled: boolean) => void;
  backgroundRemoval?: boolean;
  onBackgroundRemovalChange?: (enabled: boolean) => void;
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
          width: '900px',
          height: '640px',
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
        </div>
      </div>
    </div>
  );
}

// Camera Settings Tab
function CameraSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Camera Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure camera and video input settings</p>
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
        >
          <option>Default Camera</option>
          <option>HD Webcam</option>
          <option>External Camera</option>
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
        >
          <option>480p</option>
          <option selected>720p</option>
          <option>1080p</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Camera Options</label>
        <div className="space-y-3">
          <ToggleOption label="Mirror my video" defaultChecked={false} />
          <ToggleOption label="Auto-adjust brightness" defaultChecked={true} />
          <ToggleOption label="HD mode" defaultChecked={true} />
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
        >
          <option>Default Microphone</option>
          <option>USB Microphone</option>
          <option>Wireless Headset</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Input Volume</label>
        <input
          type="range"
          min="0"
          max="100"
          defaultValue="75"
          className="w-full"
          style={{ accentColor: '#0066ff' }}
        />
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>0%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Audio Options</label>
        <div className="space-y-3">
          <ToggleOption label="Echo cancellation" defaultChecked={true} />
          <ToggleOption label="Noise suppression" defaultChecked={true} />
          <ToggleOption label="Auto-adjust microphone" defaultChecked={false} />
        </div>
      </div>
    </div>
  );
}

// Visual Effects Settings Tab
function VisualEffectsSettings({ props }: { props: CanvasSettingsModalProps }) {
  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Visual Effects Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure visual effects and filters</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Background Effects</label>
        <div className="space-y-3">
          <ToggleOption label="Background blur" defaultChecked={false} />
          <ToggleOption label="Virtual background" defaultChecked={false} />
          <ToggleOption label="Background removal" defaultChecked={false} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-3">Video Filters</label>
        <div className="space-y-3">
          <ToggleOption label="Auto-enhance lighting" defaultChecked={true} />
          <ToggleOption label="Color correction" defaultChecked={false} />
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
  const hotkeys = [
    { action: 'Toggle Microphone', key: 'Ctrl+D' },
    { action: 'Toggle Camera', key: 'Ctrl+E' },
    { action: 'Start/Stop Recording', key: 'Ctrl+R' },
    { action: 'Go Live', key: 'Ctrl+L' },
    { action: 'Show/Hide Chat', key: 'Ctrl+H' },
    { action: 'Toggle Screenshare', key: 'Ctrl+S' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-xl font-semibold text-white mb-4">Hotkeys Settings</h3>
        <p className="text-sm text-gray-400 mb-6">Configure keyboard shortcuts</p>
      </div>

      <div className="space-y-3">
        {hotkeys.map((hotkey) => (
          <div
            key={hotkey.action}
            className="flex items-center justify-between px-4 py-3 rounded"
            style={{ backgroundColor: '#2d2d2d' }}
          >
            <span className="text-sm text-gray-300">{hotkey.action}</span>
            <code
              className="px-3 py-1 rounded text-sm font-mono"
              style={{ backgroundColor: '#1a1a1a', color: '#ffffff' }}
            >
              {hotkey.key}
            </code>
          </div>
        ))}
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
          <ToggleOption label="Auto-arrange participants" defaultChecked={true} />
          <ToggleOption label="Remember layout preferences" defaultChecked={true} />
          <ToggleOption label="Show layout grid lines (in edit mode)" defaultChecked={false} />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Default Layout</label>
        <select
          className="w-full px-3 py-2 rounded text-sm"
          style={{
            backgroundColor: '#2d2d2d',
            color: '#ffffff',
            border: '1px solid #404040',
          }}
        >
          <option value="1">Grid 2x2</option>
          <option value="2" selected>Spotlight</option>
          <option value="3">Sidebar Left</option>
          <option value="9">Full Screen Single</option>
        </select>
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
