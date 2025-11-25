/**
 * ⚠️ NOTE ABOUT CANVAS SYNC ⚠️
 * This component is the PREVIEW/BACKSTAGE area that appears BELOW the main StudioCanvas.
 * It is NOT part of the broadcast output - it is only visible to the producer.
 *
 * Therefore, this component does NOT need to be synced with the hidden canvas.
 * However, the audio level visualization pattern used here WAS copied to ParticipantBox.tsx
 * and StudioCanvas.tsx hidden canvas to maintain visual consistency for on-stage participants.
 *
 * If you modify the audio visualization here, consider whether the same changes should
 * be applied to ParticipantBox.tsx and the hidden canvas in StudioCanvas.tsx.
 */

import { useRef, useEffect, useState, useCallback } from 'react';

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
  audioStream?: MediaStream | null; // Separate audio stream for monitoring (raw mic input)
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocalUserOnStage: boolean;
  backstageParticipants: RemoteParticipant[];
  screenShareStream: MediaStream | null;
  onAddToStage?: (participantId: string) => void;
  onRemoveFromStage?: (participantId: string) => void;
  onInviteGuests?: () => void;
  onRenameParticipant?: (participantId: string, newName: string) => void;
}

export function PreviewArea({
  localStream,
  audioStream,
  videoEnabled,
  audioEnabled,
  isLocalUserOnStage,
  backstageParticipants,
  screenShareStream,
  onAddToStage,
  onRemoveFromStage,
  onInviteGuests,
  onRenameParticipant,
}: PreviewAreaProps) {
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  // Audio monitoring state
  const [localAudioLevel, setLocalAudioLevel] = useState(0);
  const [participantAudioLevels, setParticipantAudioLevels] = useState<Map<string, number>>(new Map());
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load selected avatar from localStorage
  useEffect(() => {
    const storedAvatar = localStorage.getItem('selectedAvatar');
    if (storedAvatar) {
      setSelectedAvatar(storedAvatar);
    }
  }, []);

  // Set up audio monitoring - prefer audioStream prop, fall back to localStream
  useEffect(() => {
    // Use audioStream if provided (raw mic input), otherwise try localStream
    const streamToMonitor = audioStream || localStream;

    if (!streamToMonitor) {
      console.log('[PreviewArea] No stream available for audio monitoring');
      setLocalAudioLevel(0);
      return;
    }

    const audioTrack = streamToMonitor.getAudioTracks()[0];
    if (!audioTrack) {
      console.log('[PreviewArea] No audio track in stream, tracks:', {
        audioTracks: streamToMonitor.getAudioTracks().length,
        videoTracks: streamToMonitor.getVideoTracks().length,
        usingAudioStream: !!audioStream,
      });
      return;
    }

    console.log('[PreviewArea] Setting up audio monitoring:', {
      trackId: audioTrack.id,
      trackLabel: audioTrack.label,
      trackEnabled: audioTrack.enabled,
      trackMuted: audioTrack.muted,
      usingAudioStream: !!audioStream,
    });

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    // Resume audio context if needed
    if (audioContext.state === 'suspended') {
      audioContext.resume().then(() => {
        console.log('[PreviewArea] AudioContext resumed');
      });
    }

    // Create audio stream source from the track
    const monitorStream = new MediaStream([audioTrack]);
    const source = audioContext.createMediaStreamSource(monitorStream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    console.log('[PreviewArea] Audio monitoring started');

    // Animation loop to update audio level
    const updateLevel = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedLevel = average / 255;

      setLocalAudioLevel(normalizedLevel);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      console.log('[PreviewArea] Cleaning up audio monitoring');
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [audioStream, localStream]);

  // Update local video
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  const handleToggleStage = (participantId: string, isOnStage: boolean) => {
    if (isOnStage && onRemoveFromStage) {
      onRemoveFromStage(participantId);
    } else if (!isOnStage && onAddToStage) {
      onAddToStage(participantId);
    }
  };

  const handleStartEdit = (participantId: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingParticipant(participantId);
    setEditName(currentName);
  };

  const handleSaveEdit = (participantId: string) => {
    if (onRenameParticipant && editName.trim()) {
      onRenameParticipant(participantId, editName.trim());
    }
    setEditingParticipant(null);
    setEditName('');
  };

  const handleCancelEdit = () => {
    setEditingParticipant(null);
    setEditName('');
  };

  return (
    <>
      {/* CSS keyframes for pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.1); opacity: 0.3; }
        }
      `}</style>
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
        <div className="flex-shrink-0" style={{ width: '160px', height: '90px', overflow: 'visible' }}>
          <div
            className={`relative bg-black rounded h-full group cursor-pointer transition-all duration-150`}
            style={{
              overflow: 'visible',
              border: localAudioLevel > 0.05
                ? `3px solid rgba(59, 130, 246, ${0.5 + localAudioLevel})`
                : isLocalUserOnStage ? '2px solid #3b82f6' : '2px solid #eab308',
              boxShadow: localAudioLevel > 0.05
                ? `0 0 ${10 + localAudioLevel * 20}px rgba(59, 130, 246, ${localAudioLevel * 0.8})`
                : 'none',
            }}
            onClick={() => handleToggleStage('local-user', isLocalUserOnStage)}
            title={isLocalUserOnStage ? 'Click to go backstage' : 'Click to go on stage'}
          >
            {localStream && videoEnabled ? (
              <div className="relative w-full h-full">
                <video
                  ref={localVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                />
                {/* Audio glow overlay when speaking with video on */}
                {localAudioLevel > 0.05 && (
                  <div
                    className="absolute inset-0 pointer-events-none rounded"
                    style={{
                      boxShadow: `inset 0 0 ${10 + localAudioLevel * 15}px rgba(59, 130, 246, ${localAudioLevel * 0.6})`,
                    }}
                  />
                )}
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-900 relative overflow-visible">
                {/* Audio visualization rings - extend beyond the tile */}
                {localAudioLevel > 0.05 && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ overflow: 'visible' }}>
                    {[0, 1, 2, 3].map((i) => (
                      <div
                        key={i}
                        className="absolute rounded-full border-2 border-blue-400"
                        style={{
                          // Start at 80px (20px beyond ~60px avatar), grow with audio
                          // Each ring adds 25px, audio adds up to 60px more
                          width: `${80 + i * 25 + localAudioLevel * 60}px`,
                          height: `${80 + i * 25 + localAudioLevel * 60}px`,
                          opacity: Math.max(0.2, (1 - i * 0.25) * (localAudioLevel * 2)),
                          animation: `pulse ${0.4 + i * 0.15}s ease-in-out infinite`,
                          borderWidth: `${3 - i * 0.5}px`,
                        }}
                      />
                    ))}
                  </div>
                )}
                {selectedAvatar ? (
                  <div className="w-full h-full flex items-center justify-center p-4 z-10">
                    <div
                      className="w-3/4 aspect-square rounded-full overflow-hidden"
                      style={{
                        boxShadow: localAudioLevel > 0.05
                          ? `0 0 ${20 + localAudioLevel * 40}px rgba(59, 130, 246, ${0.5 + localAudioLevel})`
                          : 'none',
                      }}
                    >
                      <img
                        src={selectedAvatar}
                        alt="Your avatar"
                        className="w-full h-full object-cover"
                      />
                    </div>
                  </div>
                ) : (
                  <svg className="w-8 h-8 text-gray-600 z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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

            {/* Hover indicator */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-white text-xs font-medium px-2 py-1 bg-black/60 rounded">
                {isLocalUserOnStage ? 'Go Backstage' : 'Go Live'}
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 z-10">
              <span className="text-white text-xs font-medium">
                {isLocalUserOnStage ? 'You (Live)' : 'You (Backstage)'}
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
                <span className="text-white text-xs font-medium">Screen Share</span>
              </div>
            </div>
          </div>
        )}

        {/* Backstage Participants */}
        {backstageParticipants.map((participant) => (
          <div key={participant.id} className="flex-shrink-0" style={{ width: '160px', height: '90px' }}>
            <div
              className="relative bg-black rounded overflow-hidden h-full border-2 border-yellow-500 group cursor-pointer"
              onClick={() => handleToggleStage(participant.id, false)}
              title="Click to add to stage"
            >
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

              {/* Pencil edit icon - top left */}
              {onRenameParticipant && editingParticipant !== participant.id && (
                <button
                  onClick={(e) => handleStartEdit(participant.id, participant.name, e)}
                  className="absolute top-1 left-1 w-5 h-5 bg-black/70 hover:bg-black/90 rounded flex items-center justify-center z-20"
                  title="Edit name"
                >
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                  </svg>
                </button>
              )}

              {/* Hover indicator */}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                <span className="text-white text-xs font-medium px-2 py-1 bg-black/60 rounded">
                  Add to Stage
                </span>
              </div>

              {/* Name bar */}
              <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-2 py-1 z-10">
                {editingParticipant === participant.id ? (
                  <div className="flex items-center gap-1 w-full" onClick={(e) => e.stopPropagation()}>
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveEdit(participant.id);
                        if (e.key === 'Escape') handleCancelEdit();
                      }}
                      className="flex-1 bg-gray-700 text-white text-xs px-1 py-0.5 rounded w-full min-w-0"
                      autoFocus
                    />
                    <button
                      onClick={() => handleSaveEdit(participant.id)}
                      className="text-green-400 hover:text-green-300 p-0.5"
                      title="Save"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="text-red-400 hover:text-red-300 p-0.5"
                      title="Cancel"
                    >
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <span className="text-white text-xs font-medium truncate">{participant.name}</span>
                )}
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
    </>
  );
}
