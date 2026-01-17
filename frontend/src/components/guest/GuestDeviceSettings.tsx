/**
 * GuestDeviceSettings Component
 *
 * Device selection panel for camera and microphone.
 */

interface GuestDeviceSettingsProps {
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
}

export function GuestDeviceSettings({
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  onAudioDeviceChange,
  onVideoDeviceChange,
}: GuestDeviceSettingsProps) {
  return (
    <div className="mb-6 space-y-4 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
      <h4 className="font-semibold text-gray-900 mb-3">Device Settings</h4>

      {/* Camera Selector */}
      <div>
        <label htmlFor="camera-select" className="block text-sm font-medium text-gray-700 mb-2">
          Camera
        </label>
        <select
          id="camera-select"
          value={selectedVideoDevice}
          onChange={(e) => onVideoDeviceChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {videoDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId.slice(0, 5)}`}
            </option>
          ))}
        </select>
      </div>

      {/* Microphone Selector */}
      <div>
        <label htmlFor="microphone-select" className="block text-sm font-medium text-gray-700 mb-2">
          Microphone
        </label>
        <select
          id="microphone-select"
          value={selectedAudioDevice}
          onChange={(e) => onAudioDeviceChange(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
        >
          {audioDevices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId.slice(0, 5)}`}
            </option>
          ))}
        </select>
      </div>

      <p className="text-xs text-gray-500 mt-2">
        Test your devices before joining to ensure everything works correctly
      </p>
    </div>
  );
}
