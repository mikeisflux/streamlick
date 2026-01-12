/**
 * GuestJoinLobby Component
 *
 * Pre-join screen with name input, video preview, and device settings.
 */

import { useState } from 'react';
import { VideoPreview } from '../VideoPreview';
import { Button } from '../Button';
import { GuestDeviceSettings } from './GuestDeviceSettings';

interface GuestJoinLobbyProps {
  broadcastTitle: string;
  localStream: MediaStream | null;
  guestName: string;
  isJoining: boolean;
  audioEnabled: boolean;
  videoEnabled: boolean;
  audioDevices: MediaDeviceInfo[];
  videoDevices: MediaDeviceInfo[];
  selectedAudioDevice: string;
  selectedVideoDevice: string;
  onNameChange: (name: string) => void;
  onJoin: () => void;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  onAudioDeviceChange: (deviceId: string) => void;
  onVideoDeviceChange: (deviceId: string) => void;
}

export function GuestJoinLobby({
  broadcastTitle,
  localStream,
  guestName,
  isJoining,
  audioEnabled,
  videoEnabled,
  audioDevices,
  videoDevices,
  selectedAudioDevice,
  selectedVideoDevice,
  onNameChange,
  onJoin,
  onToggleAudio,
  onToggleVideo,
  onAudioDeviceChange,
  onVideoDeviceChange,
}: GuestJoinLobbyProps) {
  const [showDeviceSelectors, setShowDeviceSelectors] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 flex items-center justify-center px-4 py-8">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-3xl w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full mb-4">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Broadcast</h1>
          <p className="text-lg text-gray-600">{broadcastTitle}</p>
          <p className="text-sm text-gray-500 mt-2">Set up your camera and microphone before joining</p>
        </div>

        {/* Video Preview */}
        <div className="bg-black rounded-xl overflow-hidden aspect-video mb-6 shadow-lg relative">
          <VideoPreview stream={localStream} muted />
          {!videoEnabled && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <div className="w-24 h-24 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <p className="text-gray-400">Camera is off</p>
              </div>
            </div>
          )}
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-3 mb-6">
          <button
            onClick={onToggleAudio}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md ${
              audioEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
          >
            <span className="text-xl">{audioEnabled ? '🎤' : '🔇'}</span>
            <span className="text-sm">{audioEnabled ? 'Mute' : 'Unmute'}</span>
          </button>
          <button
            onClick={onToggleVideo}
            className={`flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md ${
              videoEnabled
                ? 'bg-gray-100 hover:bg-gray-200 text-gray-900'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
            title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
          >
            <span className="text-xl">{videoEnabled ? '📹' : '📵'}</span>
            <span className="text-sm">{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
          </button>
          <button
            onClick={() => setShowDeviceSelectors(!showDeviceSelectors)}
            className="flex items-center gap-2 px-5 py-3 rounded-lg font-medium transition-all shadow-md bg-gray-100 hover:bg-gray-200 text-gray-900"
            title="Device settings"
          >
            <span className="text-xl">⚙️</span>
            <span className="text-sm">Settings</span>
          </button>
        </div>

        {/* Device Selectors */}
        {showDeviceSelectors && (
          <GuestDeviceSettings
            audioDevices={audioDevices}
            videoDevices={videoDevices}
            selectedAudioDevice={selectedAudioDevice}
            selectedVideoDevice={selectedVideoDevice}
            onAudioDeviceChange={onAudioDeviceChange}
            onVideoDeviceChange={onVideoDeviceChange}
          />
        )}

        {/* Name Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-2">
              Display Name <span className="text-red-500">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={guestName}
              onChange={(e) => onNameChange(e.target.value)}
              placeholder="Enter your full name or brand name"
              className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              onKeyPress={(e) => e.key === 'Enter' && onJoin()}
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">This is how you'll appear to viewers</p>
          </div>

          <Button
            onClick={onJoin}
            disabled={isJoining || !guestName.trim()}
            size="lg"
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isJoining ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Joining Greenroom...
              </span>
            ) : (
              'Enter Greenroom'
            )}
          </Button>

          {/* Consent and Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex gap-3">
              <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">Before you join:</p>
                <ul className="space-y-1 text-blue-800">
                  <li>• Make sure your camera and microphone are working</li>
                  <li>• You'll wait in the greenroom until the host brings you on</li>
                  <li>• By joining, you consent to being recorded and streamed live</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Browser requirements */}
          <p className="text-xs text-gray-500 text-center">
            Best experience on Chrome, Firefox, Safari, or Edge
          </p>
        </div>
      </div>
    </div>
  );
}
