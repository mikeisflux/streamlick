import { useState } from 'react';

interface ProducerModeProps {
  broadcastId?: string;
  producerId?: string;
  onClose?: () => void;
}

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'backstage';
  audioEnabled: boolean;
  videoEnabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected';
}

export function ProducerMode({ broadcastId, producerId, onClose }: ProducerModeProps) {
  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: '1',
      name: 'Host (You)',
      role: 'host',
      audioEnabled: true,
      videoEnabled: true,
      status: 'connected',
    },
    {
      id: '2',
      name: 'Sarah',
      role: 'guest',
      audioEnabled: true,
      videoEnabled: true,
      status: 'connected',
    },
    {
      id: '3',
      name: 'Mike',
      role: 'backstage',
      audioEnabled: false,
      videoEnabled: false,
      status: 'connected',
    },
  ]);

  const [selectedLayout, setSelectedLayout] = useState(1);
  const [mainAudioVolume, setMainAudioVolume] = useState(100);
  const [showOverlay, setShowOverlay] = useState(true);

  const toggleParticipantRole = (participantId: string) => {
    setParticipants(
      participants.map((p) =>
        p.id === participantId
          ? {
              ...p,
              role: p.role === 'guest' ? 'backstage' : 'guest',
            }
          : p
      )
    );
  };

  const toggleParticipantAudio = (participantId: string) => {
    setParticipants(
      participants.map((p) =>
        p.id === participantId ? { ...p, audioEnabled: !p.audioEnabled } : p
      )
    );
  };

  const toggleParticipantVideo = (participantId: string) => {
    setParticipants(
      participants.map((p) =>
        p.id === participantId ? { ...p, videoEnabled: !p.videoEnabled } : p
      )
    );
  };

  return (
    <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-900 rounded-lg shadow-2xl w-full max-w-7xl max-h-[95vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-600 rounded-lg flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Producer Mode</h2>
              <p className="text-sm text-gray-400">Full production control dashboard</p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column - Participants */}
            <div className="lg:col-span-2 space-y-6">
              {/* Live Participants */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Live Participants
                </h3>
                <div className="space-y-3">
                  {participants
                    .filter((p) => p.role !== 'backstage')
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="bg-gray-700 rounded-lg p-4 flex items-center gap-4"
                      >
                        {/* Video Preview */}
                        <div className="w-32 h-20 bg-black rounded overflow-hidden flex-shrink-0">
                          {participant.videoEnabled ? (
                            <div className="w-full h-full flex items-center justify-center text-white text-xs">
                              📹 Video Feed
                            </div>
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-gray-500">
                              📹 Off
                            </div>
                          )}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-white font-semibold">{participant.name}</h4>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                participant.role === 'host'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-blue-600 text-white'
                              }`}
                            >
                              {participant.role}
                            </span>
                          </div>

                          {/* Controls */}
                          <div className="flex gap-2">
                            <button
                              onClick={() => toggleParticipantAudio(participant.id)}
                              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                participant.audioEnabled
                                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                  : 'bg-red-600 hover:bg-red-700 text-white'
                              }`}
                            >
                              {participant.audioEnabled ? '🎤 Mute' : '🎤 Unmute'}
                            </button>
                            <button
                              onClick={() => toggleParticipantVideo(participant.id)}
                              className={`px-3 py-1.5 rounded text-sm transition-colors ${
                                participant.videoEnabled
                                  ? 'bg-gray-600 hover:bg-gray-500 text-white'
                                  : 'bg-red-600 hover:bg-red-700 text-white'
                              }`}
                            >
                              {participant.videoEnabled ? '📹 Hide' : '📹 Show'}
                            </button>
                            <button
                              onClick={() => toggleParticipantRole(participant.id)}
                              className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white rounded text-sm transition-colors"
                            >
                              📤 To Backstage
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>

              {/* Backstage */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Backstage ({participants.filter((p) => p.role === 'backstage').length})
                </h3>
                <div className="space-y-2">
                  {participants
                    .filter((p) => p.role === 'backstage')
                    .map((participant) => (
                      <div
                        key={participant.id}
                        className="bg-gray-700 rounded p-3 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-gray-600 rounded-full flex items-center justify-center text-white">
                            {participant.name.charAt(0)}
                          </div>
                          <span className="text-white">{participant.name}</span>
                        </div>
                        <button
                          onClick={() => toggleParticipantRole(participant.id)}
                          className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded text-sm transition-colors"
                        >
                          📥 Bring to Stage
                        </button>
                      </div>
                    ))}
                </div>
              </div>
            </div>

            {/* Right Column - Controls */}
            <div className="space-y-6">
              {/* Layout Control */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Layout</h3>
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((layout) => (
                    <button
                      key={layout}
                      onClick={() => setSelectedLayout(layout)}
                      className={`aspect-square rounded flex items-center justify-center text-sm transition-colors ${
                        selectedLayout === layout
                          ? 'bg-blue-600 text-white'
                          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                      }`}
                    >
                      {layout}
                    </button>
                  ))}
                </div>
              </div>

              {/* Audio Control */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Audio Mixer</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-300">Main Output</span>
                      <span className="text-sm text-gray-400">{mainAudioVolume}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={mainAudioVolume}
                      onChange={(e) => setMainAudioVolume(parseInt(e.target.value))}
                      className="w-full"
                    />
                  </div>
                </div>
              </div>

              {/* Overlay Control */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Stream Overlay</h3>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showOverlay}
                    onChange={(e) => setShowOverlay(e.target.checked)}
                    className="w-4 h-4"
                  />
                  <span className="text-white">Show overlay graphics</span>
                </label>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors">
                    🎨 Change Scene
                  </button>
                  <button className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors">
                    📝 Show Lower Third
                  </button>
                  <button className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors">
                    🎵 Play Stinger
                  </button>
                  <button className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors">
                    🚨 Emergency Cut
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <span className="flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              Stream Active
            </span>
            <span>•</span>
            <span>{participants.filter((p) => p.role !== 'backstage').length} Live</span>
            <span>•</span>
            <span>{participants.filter((p) => p.role === 'backstage').length} Backstage</span>
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Exit Producer Mode
          </button>
        </div>
      </div>
    </div>
  );
}
