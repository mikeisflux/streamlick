import { RefObject } from 'react';

interface DeviceSelectorsProps {
  // Microphone selector
  showMicSelector: boolean;
  setShowMicSelector: (show: boolean) => void;
  audioDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  handleAudioDeviceChange: (deviceId: string) => void;
  loadDevices: () => Promise<void>;
  micButtonRef: RefObject<HTMLDivElement>;

  // Camera selector
  showCameraSelector: boolean;
  setShowCameraSelector: (show: boolean) => void;
  videoDevices: MediaDeviceInfo[];
  selectedVideoDevice: string;
  handleVideoDeviceChange: (deviceId: string) => void;
  cameraButtonRef: RefObject<HTMLDivElement>;

  // Speaker selector
  showSpeakerSelector: boolean;
  setShowSpeakerSelector: (show: boolean) => void;
  speakerDevices: MediaDeviceInfo[];
  selectedSpeakerDevice: string;
  handleSpeakerDeviceChange: (deviceId: string) => void;
  speakerButtonRef: RefObject<HTMLDivElement>;
}

export function DeviceSelectors({
  showMicSelector,
  setShowMicSelector,
  audioDevices,
  selectedAudioDevice,
  handleAudioDeviceChange,
  loadDevices,
  micButtonRef,
  showCameraSelector,
  setShowCameraSelector,
  videoDevices,
  selectedVideoDevice,
  handleVideoDeviceChange,
  cameraButtonRef,
  showSpeakerSelector,
  setShowSpeakerSelector,
  speakerDevices,
  selectedSpeakerDevice,
  handleSpeakerDeviceChange,
  speakerButtonRef,
}: DeviceSelectorsProps) {
  return (
    <>
      {/* Microphone Device Selector Popup */}
      {showMicSelector && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMicSelector(false)}
          />
          <div
            className="fixed bg-white rounded-lg shadow-2xl z-50 transition-all duration-250 ease-out"
            style={{
              width: '320px',
              maxHeight: '400px',
              bottom: '6rem',
              left: micButtonRef.current
                ? `${micButtonRef.current.getBoundingClientRect().left + micButtonRef.current.getBoundingClientRect().width / 2 - 160}px`
                : '50%',
              transform: !micButtonRef.current ? 'translateX(-50%)' : 'none',
            }}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Select Microphone</h3>
              <p className="text-xs text-gray-500 mt-1">Choose your audio input device</p>
            </div>
            <div className="overflow-y-auto max-h-80">
              {audioDevices.length === 0 ? (
                <div className="p-6 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                  <p className="text-sm text-gray-600">No microphones found</p>
                  <button
                    onClick={loadDevices}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Refresh Devices
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  {audioDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleAudioDeviceChange(device.deviceId);
                        setShowMicSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedAudioDevice === device.deviceId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedAudioDevice === device.deviceId && (
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {device.label || `Microphone ${device.deviceId.substring(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-500">Audio Input</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Camera Device Selector Popup */}
      {showCameraSelector && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowCameraSelector(false)}
          />
          <div
            className="fixed bg-white rounded-lg shadow-2xl z-50 transition-all duration-250 ease-out"
            style={{
              width: '320px',
              maxHeight: '400px',
              bottom: '6rem',
              left: cameraButtonRef.current
                ? `${cameraButtonRef.current.getBoundingClientRect().left + cameraButtonRef.current.getBoundingClientRect().width / 2 - 160}px`
                : '50%',
              transform: !cameraButtonRef.current ? 'translateX(-50%)' : 'none',
            }}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Select Camera</h3>
              <p className="text-xs text-gray-500 mt-1">Choose your video input device</p>
            </div>
            <div className="overflow-y-auto max-h-80">
              {videoDevices.length === 0 ? (
                <div className="p-6 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm text-gray-600">No cameras found</p>
                  <button
                    onClick={loadDevices}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Refresh Devices
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  {videoDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleVideoDeviceChange(device.deviceId);
                        setShowCameraSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedVideoDevice === device.deviceId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedVideoDevice === device.deviceId && (
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {device.label || `Camera ${device.deviceId.substring(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-500">Video Input</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Speaker Device Selector Popup */}
      {showSpeakerSelector && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowSpeakerSelector(false)}
          />
          <div
            className="fixed bg-white rounded-lg shadow-2xl z-50 transition-all duration-250 ease-out"
            style={{
              width: '320px',
              maxHeight: '400px',
              bottom: '6rem',
              left: speakerButtonRef.current
                ? `${speakerButtonRef.current.getBoundingClientRect().left + speakerButtonRef.current.getBoundingClientRect().width / 2 - 160}px`
                : '50%',
              transform: !speakerButtonRef.current ? 'translateX(-50%)' : 'none',
            }}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Select Speaker</h3>
              <p className="text-xs text-gray-500 mt-1">Choose your audio output device</p>
            </div>
            <div className="overflow-y-auto max-h-80">
              {speakerDevices.length === 0 ? (
                <div className="p-6 text-center">
                  <svg className="w-12 h-12 text-gray-400 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  </svg>
                  <p className="text-sm text-gray-600">No speakers found</p>
                  <button
                    onClick={loadDevices}
                    className="mt-3 text-xs text-blue-600 hover:text-blue-700"
                  >
                    Refresh Devices
                  </button>
                </div>
              ) : (
                <div className="py-2">
                  {speakerDevices.map((device) => (
                    <button
                      key={device.deviceId}
                      onClick={() => {
                        handleSpeakerDeviceChange(device.deviceId);
                        setShowSpeakerSelector(false);
                      }}
                      className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${
                        selectedSpeakerDevice === device.deviceId ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedSpeakerDevice === device.deviceId && (
                          <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">
                            {device.label || `Speaker ${device.deviceId.substring(0, 8)}`}
                          </p>
                          <p className="text-xs text-gray-500">Audio Output</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  );
}
