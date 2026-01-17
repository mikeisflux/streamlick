import { BackgroundOptions } from '../../../services/background-removal.service';
import { EngagementMetrics } from '../../../services/analytics.service';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  handleAudioDeviceChange: (deviceId: string) => void;
  handleVideoDeviceChange: (deviceId: string) => void;
  localStream: MediaStream | null;
  videoEnabled: boolean;
  noiseGateEnabled: boolean;
  setNoiseGateEnabled: (enabled: boolean) => void;
  noiseGateThreshold: number;
  setNoiseGateThreshold: (threshold: number) => void;
  backgroundRemovalEnabled: boolean;
  setBackgroundRemovalEnabled: (enabled: boolean) => void;
  backgroundRemovalOptions: BackgroundOptions;
  setBackgroundRemovalOptions: (options: BackgroundOptions) => void;
  verticalSimulcastEnabled: boolean;
  setVerticalSimulcastEnabled: (enabled: boolean) => void;
  verticalResolution: '1080x1920' | '720x1280' | '540x960';
  setVerticalResolution: (res: '1080x1920' | '720x1280' | '540x960') => void;
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
  analyticsMetrics: EngagementMetrics | null;
  setShowAnalyticsDashboard: (show: boolean) => void;
  loadDevices?: () => Promise<void>;
}

export function SettingsModal({
  isOpen,
  onClose,
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  handleAudioDeviceChange,
  handleVideoDeviceChange,
  localStream,
  videoEnabled,
  noiseGateEnabled,
  setNoiseGateEnabled,
  noiseGateThreshold,
  setNoiseGateThreshold,
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
  analyticsMetrics,
  setShowAnalyticsDashboard,
  loadDevices,
}: SettingsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-[538px] max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Studio Settings</h2>
            <p className="text-sm text-gray-600 mt-1">Configure your audio and video devices</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Video Device */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Camera
              </label>
              <select
                value={selectedVideoDevice}
                onChange={(e) => handleVideoDeviceChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Camera</option>
                {videoDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose which camera to use for your broadcast
              </p>
            </div>

            {/* Audio Input Device */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Microphone
              </label>
              <select
                value={selectedAudioDevice}
                onChange={(e) => handleAudioDeviceChange(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select Microphone</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Choose which microphone to use for your broadcast
              </p>
            </div>

            {/* Background Noise Removal */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Background Noise Removal</h3>
                  <p className="text-xs text-gray-500 mt-1">Professional noise gate for clean audio</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={noiseGateEnabled}
                    onChange={(e) => setNoiseGateEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {noiseGateEnabled && (
                <div className="space-y-4 pl-2">
                  {/* Threshold Slider */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Noise Gate Threshold: {noiseGateThreshold}dB
                    </label>
                    <input
                      type="range"
                      min="-60"
                      max="-20"
                      value={noiseGateThreshold}
                      onChange={(e) => setNoiseGateThreshold(parseInt(e.target.value))}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      style={{
                        background: `linear-gradient(to right, #3b82f6 0%, #3b82f6 ${((noiseGateThreshold + 60) / 40) * 100}%, #e5e7eb ${((noiseGateThreshold + 60) / 40) * 100}%, #e5e7eb 100%)`
                      }}
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>-60dB (Less sensitive)</span>
                      <span>-20dB (More sensitive)</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-2">
                      Lower values reduce more noise but may cut off quiet speech.
                      Recommended: -38dB for most environments.
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Video Preview */}
            {localStream && videoEnabled && (
              <div>
                <label className="block text-sm font-semibold text-gray-900 mb-2">
                  Camera Preview
                </label>
                <div className="bg-black rounded-lg overflow-hidden aspect-video">
                  <video
                    ref={(el) => {
                      if (el && localStream) el.srcObject = localStream;
                    }}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
            )}

            {/* Additional Settings */}
            <div className="border-t border-gray-200 pt-6">
              <h3 className="text-sm font-semibold text-gray-900 mb-4">Stream Quality</h3>
              <div className="space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="quality"
                    value="720p"
                    defaultChecked
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">720p HD</div>
                    <div className="text-xs text-gray-500">Recommended for most streams</div>
                  </div>
                </label>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="quality"
                    value="1080p"
                    className="w-4 h-4 text-blue-600"
                  />
                  <div>
                    <div className="font-medium text-gray-900">1080p Full HD</div>
                    <div className="text-xs text-gray-500">Higher quality, requires more bandwidth</div>
                  </div>
                </label>
              </div>
            </div>

            {/* Smart Background Removal */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Smart Background Removal</h3>
                  <p className="text-xs text-gray-500 mt-1">AI-powered background effects</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backgroundRemovalEnabled}
                    onChange={(e) => setBackgroundRemovalEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {backgroundRemovalEnabled && (
                <div className="space-y-4 pl-2">
                  {/* Background Type */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Background Type
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bgType"
                          value="blur"
                          checked={backgroundRemovalOptions.type === 'blur'}
                          onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'blur' })}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-700">Blur Background</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bgType"
                          value="color"
                          checked={backgroundRemovalOptions.type === 'color'}
                          onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'color' })}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-700">Solid Color</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="bgType"
                          value="image"
                          checked={backgroundRemovalOptions.type === 'image'}
                          onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'image' })}
                          className="w-4 h-4 text-purple-600"
                        />
                        <span className="text-sm text-gray-700">Custom Image</span>
                      </label>
                    </div>
                  </div>

                  {/* Blur Amount */}
                  {backgroundRemovalOptions.type === 'blur' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Blur Amount: {backgroundRemovalOptions.blurAmount}px
                      </label>
                      <input
                        type="range"
                        min="5"
                        max="30"
                        value={backgroundRemovalOptions.blurAmount || 15}
                        onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, blurAmount: parseInt(e.target.value) })}
                        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Background Color */}
                  {backgroundRemovalOptions.type === 'color' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-900 mb-2">
                        Background Color
                      </label>
                      <input
                        type="color"
                        value={backgroundRemovalOptions.color || '#1a1a1a'}
                        onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, color: e.target.value })}
                        className="w-full h-10 rounded cursor-pointer"
                      />
                    </div>
                  )}

                  {/* Edge Softness */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Edge Softness: {Math.round((backgroundRemovalOptions.edgeSoftness || 0.3) * 100)}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={backgroundRemovalOptions.edgeSoftness || 0.3}
                      onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, edgeSoftness: parseFloat(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <p className="text-xs text-gray-500 mt-1">Higher values create smoother edges</p>
                  </div>
                </div>
              )}
            </div>

            {/* Vertical Simulcast */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Vertical Video Simulcast (9:16)</h3>
                  <p className="text-xs text-gray-500 mt-1">Auto-crop for TikTok/Instagram Reels/Shorts</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={verticalSimulcastEnabled}
                    onChange={(e) => setVerticalSimulcastEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-pink-600"></div>
                </label>
              </div>

              {verticalSimulcastEnabled && (
                <div className="space-y-4 pl-2">
                  {/* Resolution Selector */}
                  <div>
                    <label className="block text-sm font-medium text-gray-900 mb-2">
                      Output Resolution
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="verticalRes"
                          value="1080x1920"
                          checked={verticalResolution === '1080x1920'}
                          onChange={() => setVerticalResolution('1080x1920')}
                          className="w-4 h-4 text-pink-600"
                        />
                        <span className="text-sm text-gray-700">1080x1920 (Full HD)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="verticalRes"
                          value="720x1280"
                          checked={verticalResolution === '720x1280'}
                          onChange={() => setVerticalResolution('720x1280')}
                          className="w-4 h-4 text-pink-600"
                        />
                        <span className="text-sm text-gray-700">720x1280 (HD)</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name="verticalRes"
                          value="540x960"
                          checked={verticalResolution === '540x960'}
                          onChange={() => setVerticalResolution('540x960')}
                          className="w-4 h-4 text-pink-600"
                        />
                        <span className="text-sm text-gray-700">540x960 (SD)</span>
                      </label>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Higher resolutions look better but require more processing power
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Advanced Analytics */}
            <div className="border-t border-gray-200 pt-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-semibold text-gray-900">Advanced Analytics & AI</h3>
                  <p className="text-xs text-gray-500 mt-1">Real-time insights and recommendations</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={analyticsEnabled}
                    onChange={(e) => setAnalyticsEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                </label>
              </div>

              {analyticsEnabled && (
                <div className="space-y-4 pl-2">
                  {/* Current Stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Current Viewers</div>
                      <div className="text-2xl font-bold text-gray-900">{analyticsMetrics?.currentViewers || 0}</div>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <div className="text-xs text-gray-500 mb-1">Total Viewers</div>
                      <div className="text-2xl font-bold text-gray-900">{analyticsMetrics?.totalViewers || 0}</div>
                    </div>
                  </div>

                  {/* View Dashboard Button */}
                  <button
                    onClick={() => setShowAnalyticsDashboard(true)}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Open Analytics Dashboard
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
          <button
            onClick={() => {
              // Refresh device list
              if (loadDevices) {
                loadDevices();
              }
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
          >
            Refresh Devices
          </button>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
