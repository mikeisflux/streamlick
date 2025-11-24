import { useRef, useEffect, useState } from 'react';
import { useAudioLevel } from '../../../hooks/studio/useAudioLevel';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface PreviewAreaProps {
  localStream: MediaStream | null;
  rawStream: MediaStream | null; // Raw audio before noise gate - for audio level detection
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocalUserOnStage: boolean;
  backstageParticipants: RemoteParticipant[];
  screenShareStream: MediaStream | null;
  onAddToStage?: (participantId: string) => void;
  onRemoveFromStage?: (participantId: string) => void;
  onInviteGuests?: () => void;
}

export function PreviewArea({
  localStream,
  rawStream,
  videoEnabled,
  audioEnabled,
  isLocalUserOnStage,
  backstageParticipants,
  screenShareStream,
  onAddToStage,
  onRemoveFromStage,
  onInviteGuests,
}: PreviewAreaProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  // Detect if local user is speaking (for voice animations) - use RAW audio before noise gate
  const isLocalSpeaking = useAudioLevel(rawStream || localStream, audioEnabled);

  // Load selected avatar from localStorage
  useEffect(() => {
    const storedAvatar = localStorage.getItem('selectedAvatar');
    if (storedAvatar) {
      setSelectedAvatar(storedAvatar);
    }
  }, []);

  // Update local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  return (
    <div
      className="border-t px-4 py-3 overflow-x-auto"
      style={{
        backgroundColor: '#1a1a1a',
        borderColor: '#404040',
        minHeight: '140px',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="text-gray-400 text-xs font-semibold uppercase tracking-wide mb-2">
          Preview / Backstage
        </div>
      </div>

      <div className="flex items-center gap-3 pb-2">
        {/* Your Preview */}
        <div className="flex-shrink-0" style={{ width: '160px', height: '90px' }}>
          <div className={`relative bg-black rounded overflow-hidden h-full border-2 group ${isLocalUserOnStage ? 'border-blue-500' : 'border-yellow-500'}`}>
            {localStream && videoEnabled ? (
              <video
                ref={localVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900">
                {selectedAvatar ? (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <div className="w-3/4 aspect-square rounded-full overflow-hidden">
                      <img
                        src={selectedAvatar}
                        alt="Your avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                    <line x1="5" y1="5" x2="19" y2="19" stroke="currentColor" strokeWidth={2} />
                  </svg>
                )}
              </div>
            )}

            {/* Voice animation rings - overlays entire preview when camera off and speaking */}
            {!videoEnabled && isLocalSpeaking && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-30">
                {/* Pulsating ring for speaking animation */}
                <div
                  className="absolute rounded-full border-2 border-blue-500 animate-ping"
                  style={{
                    width: 'min(70%, 60px)',
                    aspectRatio: '1/1',
                    animationDuration: '1s',
                  }}
                />
                <div
                  className="absolute rounded-full border border-blue-400"
                  style={{
                    width: 'min(65%, 55px)',
                    aspectRatio: '1/1',
                    animation: 'pulse 2s ease-in-out infinite',
                  }}
                />
              </div>
            )}

            {/* Hover Overlay with Add to Stage Button - only shown when backstage */}
            {!isLocalUserOnStage && onAddToStage && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-50 pointer-events-auto">
                <button
                  onClick={() => onAddToStage('local-user')}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded shadow-lg pointer-events-auto"
                  title="Add to Stage"
                >
                  Add to Stage
                </button>
              </div>
            )}

            {/* Hover Overlay with Remove from Stage Button - only shown when on stage */}
            {isLocalUserOnStage && onRemoveFromStage && (
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-50 pointer-events-auto">
                <button
                  onClick={() => onRemoveFromStage('local-user')}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded shadow-lg pointer-events-auto"
                  title="Remove from Stage"
                >
                  Remove from Stage
                </button>
              </div>
            )}

            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 z-0">
              <span className="text-white text-xs font-medium">
                {isLocalUserOnStage ? 'You (Preview)' : 'You (Backstage)'}
              </span>
            </div>
          </div>
        </div>

        {/* Screen Share Preview */}
        {screenShareStream && (
          <div className="flex-shrink-0" style={{ width: '160px', height: '90px' }}>
            <div className="relative bg-black rounded overflow-hidden h-full border-2 border-green-500">
              <video
                autoPlay
                playsInline
                ref={(el) => {
                  if (el && screenShareStream) el.srcObject = screenShareStream;
                }}
                className="w-full h-full object-contain"
                style={{ backgroundColor: '#000' }}
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1">
                <span className="text-white text-xs font-medium">🖥️ Screen Share</span>
              </div>
            </div>
          </div>
        )}

        {/* Backstage Participants */}
        {backstageParticipants.map((participant) => (
          <div key={participant.id} className="flex-shrink-0" style={{ width: '160px', height: '90px' }}>
            <div className="relative bg-black rounded overflow-hidden h-full border-2 border-yellow-500 group">
              {participant.stream && participant.videoEnabled ? (
                <video
                  autoPlay
                  playsInline
                  muted
                  ref={(el) => {
                    if (el && participant.stream) el.srcObject = participant.stream;
                  }}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-900">
                  <svg className="w-8 h-8 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
              )}

              {/* Hover Overlay with Add to Stage Button */}
              {onAddToStage && (
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-50 pointer-events-auto">
                  <button
                    onClick={() => onAddToStage(participant.id)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded shadow-lg pointer-events-auto"
                    title="Add to Stage"
                  >
                    Add to Stage
                  </button>
                </div>
              )}

              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 flex items-center justify-between z-0">
                <span className="text-white text-xs font-medium truncate flex-1">{participant.name}</span>
              </div>
            </div>
          </div>
        ))}

        {/* Invite Tile - shows when no backstage participants */}
        {backstageParticipants.length === 0 && !screenShareStream && onInviteGuests && (
          <div className="flex-shrink-0" style={{ width: '160px', height: '90px' }}>
            <button
              onClick={onInviteGuests}
              className="relative bg-gray-800 rounded overflow-hidden h-full w-full border-2 border-green-500 hover:border-green-400 transition-colors cursor-pointer"
            >
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <svg className="w-8 h-8 text-green-500 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                  <p className="text-green-500 text-xs font-medium">Invite Guests</p>
                </div>
              </div>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
