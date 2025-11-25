import { useState, useEffect, useRef, useCallback } from 'react';
import { multiTrackRecordingService, RecordedTrack } from '../services/multitrack-recording.service';
import { studioCanvasOutputService } from '../services/studioCanvasOutput.service';
import toast from 'react-hot-toast';

// Audio channel info from mixer
interface AudioChannelInfo {
  id: string;
  isLocal: boolean;
  volume: number;
  level: number;
  hasCompressor: boolean;
  hasHighpass: boolean;
  hasLowpass: boolean;
}

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'backstage';
  audioEnabled: boolean;
  videoEnabled: boolean;
  status: 'connected' | 'connecting' | 'disconnected';
  stream?: MediaStream | null;
}

interface ProducerModeProps {
  broadcastId?: string;
  producerId?: string;
  onClose?: () => void;
  remoteParticipants?: Map<string, RemoteParticipant>;
  onPromoteToLive?: (participantId: string) => void;
  onDemoteToBackstage?: (participantId: string) => void;
  onMuteParticipant?: (participantId: string) => void;
  onUnmuteParticipant?: (participantId: string) => void;
  onLayoutChange?: (layout: number) => void;
}

export function ProducerMode({
  broadcastId,
  producerId,
  onClose,
  remoteParticipants,
  onPromoteToLive,
  onDemoteToBackstage,
  onMuteParticipant,
  onUnmuteParticipant,
  onLayoutChange,
}: ProducerModeProps) {
  // Convert remote participants map to local state format
  const [participants, setParticipants] = useState<Participant[]>(() => {
    if (remoteParticipants && remoteParticipants.size > 0) {
      return Array.from(remoteParticipants.values()).map(p => ({
        ...p,
        status: 'connected' as const,
      }));
    }

    // Fallback to localStorage or defaults if no remote participants
    const storageKey = `producer_participants_${broadcastId || 'default'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved participants:', e);
      }
    }

    // Default participants for demo
    return [
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
    ];
  });

  // Sync with remote participants when they change
  useEffect(() => {
    if (remoteParticipants && remoteParticipants.size > 0) {
      setParticipants(Array.from(remoteParticipants.values()).map(p => ({
        ...p,
        status: 'connected' as const,
      })));
    }
  }, [remoteParticipants]);

  // Persist participants to localStorage when they change (fallback for demo mode)
  useEffect(() => {
    if (!remoteParticipants || remoteParticipants.size === 0) {
      const storageKey = `producer_participants_${broadcastId || 'default'}`;
      localStorage.setItem(storageKey, JSON.stringify(participants));
    }
  }, [participants, broadcastId, remoteParticipants]);

  const [selectedLayout, setSelectedLayout] = useState(1);
  const [broadcastVolume, setBroadcastVolume] = useState(100);
  const [monitorVolume, setMonitorVolume] = useState(100);
  const [showOverlay, setShowOverlay] = useState(true);

  // Per-participant audio state
  const [participantVolumes, setParticipantVolumes] = useState<Map<string, number>>(new Map());
  const [audioLevels, setAudioLevels] = useState<Map<string, number>>(new Map());
  const [audioChannelInfo, setAudioChannelInfo] = useState<AudioChannelInfo[]>([]);
  const [expandedAudioSettings, setExpandedAudioSettings] = useState<string | null>(null);

  // Multi-track recording state
  const [isMultiTrackRecording, setIsMultiTrackRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [recordedTracks, setRecordedTracks] = useState<RecordedTrack[]>([]);
  const [separateAudioVideo, setSeparateAudioVideo] = useState(true);

  // Draggable and resizable state (reduced size by 20% from max-w-7xl ~1280px to ~1024px)
  const [position, setPosition] = useState({ x: 100, y: 50 });
  const [size, setSize] = useState({ width: 1024, height: 720 }); // 20% smaller than 7xl
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const animationFrameRef = useRef<number | null>(null);

  const toggleParticipantRole = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return;

    // Use the provided handlers if available, otherwise update local state
    if (participant.role === 'backstage' && onPromoteToLive) {
      onPromoteToLive(participantId);
    } else if (participant.role !== 'backstage' && onDemoteToBackstage) {
      onDemoteToBackstage(participantId);
    } else {
      // Fallback to local state for demo mode
      setParticipants(
        participants.map((p) =>
          p.id === participantId
            ? {
                ...p,
                role: p.role === 'backstage' ? 'guest' : 'backstage',
              }
            : p
        )
      );
    }
  };

  const toggleParticipantAudio = (participantId: string) => {
    const participant = participants.find(p => p.id === participantId);
    if (!participant) return;

    // Use the provided handlers if available, otherwise update local state
    if (participant.audioEnabled && onMuteParticipant) {
      onMuteParticipant(participantId);
    } else if (!participant.audioEnabled && onUnmuteParticipant) {
      onUnmuteParticipant(participantId);
    } else {
      // Fallback to local state for demo mode
      setParticipants(
        participants.map((p) =>
          p.id === participantId ? { ...p, audioEnabled: !p.audioEnabled } : p
        )
      );
    }
  };

  const toggleParticipantVideo = (participantId: string) => {
    // Video toggling updates local state and dispatches event for compositor
    setParticipants(
      participants.map((p) =>
        p.id === participantId ? { ...p, videoEnabled: !p.videoEnabled } : p
      )
    );

    // Dispatch event for the compositor to handle video visibility
    const participant = participants.find(p => p.id === participantId);
    if (participant) {
      window.dispatchEvent(new CustomEvent('participantVideoToggle', {
        detail: {
          participantId,
          videoEnabled: !participant.videoEnabled
        }
      }));
    }
  };

  // Multi-track recording handlers
  const startMultiTrackRecording = async () => {
    try {
      // Filter only live participants with streams
      const liveParticipants = participants
        .filter((p) => p.role !== 'backstage' && p.stream)
        .map((p) => ({
          id: p.id,
          name: p.name,
          stream: p.stream!,
        }));

      if (liveParticipants.length === 0) {
        toast.error('No participants available for recording');
        return;
      }

      await multiTrackRecordingService.startRecording(liveParticipants, {
        separateAudioVideo,
        videoBitsPerSecond: 5000000,
        audioBitsPerSecond: 192000,
      });

      setIsMultiTrackRecording(true);
      setRecordingDuration(0);
      toast.success(`Multi-track recording started (${liveParticipants.length} participants)`);
    } catch (error) {
      console.error('Failed to start multi-track recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopMultiTrackRecording = async () => {
    try {
      const tracks = await multiTrackRecordingService.stopRecording();
      setRecordedTracks(tracks);
      setIsMultiTrackRecording(false);
      setRecordingDuration(0);

      const totalSize = tracks.reduce((sum, t) => sum + t.size, 0);
      const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

      toast.success(`Recording stopped. ${tracks.length} tracks ready (${totalSizeMB} MB total)`);
    } catch (error) {
      console.error('Failed to stop multi-track recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  const downloadRecordedTracks = () => {
    if (recordedTracks.length === 0) {
      toast.error('No tracks to download');
      return;
    }

    const sessionName = broadcastId || 'producer-session';
    multiTrackRecordingService.downloadAllTracks(recordedTracks, sessionName);
    toast.success(`Downloaded ${recordedTracks.length} tracks`);
  };

  // Update recording duration every second
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (isMultiTrackRecording) {
      interval = setInterval(() => {
        const duration = multiTrackRecordingService.getDuration();
        setRecordingDuration(duration);
      }, 1000);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isMultiTrackRecording]);

  // Format duration (seconds to HH:MM:SS)
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Poll audio levels for visualization
  useEffect(() => {
    const interval = setInterval(() => {
      const levels = studioCanvasOutputService.getAllAudioLevels();
      setAudioLevels(levels);

      const channelInfo = studioCanvasOutputService.getAudioChannelInfo();
      setAudioChannelInfo(channelInfo);
    }, 100); // 10 FPS for smooth visualization

    return () => clearInterval(interval);
  }, []);

  // Handle broadcast volume change
  const handleBroadcastVolumeChange = useCallback((value: number) => {
    setBroadcastVolume(value);
    studioCanvasOutputService.setBroadcastVolume(value / 100);
  }, []);

  // Handle monitor volume change
  const handleMonitorVolumeChange = useCallback((value: number) => {
    setMonitorVolume(value);
    studioCanvasOutputService.setMonitorVolume(value / 100);
  }, []);

  // Handle per-participant volume change
  const handleParticipantVolumeChange = useCallback((participantId: string, value: number) => {
    setParticipantVolumes(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, value);
      return newMap;
    });
    studioCanvasOutputService.setParticipantVolume(participantId, value / 100);
  }, []);

  // Apply voice preset to participant
  const applyVoicePreset = useCallback((participantId: string) => {
    studioCanvasOutputService.applyVoicePreset(participantId);
    toast.success(`Voice preset applied to ${participants.find(p => p.id === participantId)?.name || 'participant'}`);
  }, [participants]);

  // Apply music preset to participant
  const applyMusicPreset = useCallback((participantId: string) => {
    studioCanvasOutputService.applyMusicPreset(participantId);
    toast.success(`Music preset applied to ${participants.find(p => p.id === participantId)?.name || 'participant'}`);
  }, [participants]);

  // Apply custom audio effects
  const applyAudioEffects = useCallback((participantId: string, effects: {
    gain?: number;
    highpassFreq?: number;
    lowpassFreq?: number;
    compressor?: {
      threshold?: number;
      ratio?: number;
    };
  }) => {
    studioCanvasOutputService.setParticipantAudioEffects(participantId, effects);
  }, []);

  // Drag and resize handlers
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragOffsetRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    };
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Mouse move and up handlers
  useEffect(() => {
    let isAnimating = false;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isAnimating) {
        isAnimating = true;
        // Cancel any pending animation frame before requesting a new one
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          const newX = e.clientX - dragOffsetRef.current.x;
          const newY = e.clientY - dragOffsetRef.current.y;
          setPosition({ x: newX, y: newY });
          isAnimating = false;
          animationFrameRef.current = null;
        });
      } else if (isResizing && !isAnimating) {
        isAnimating = true;
        // Cancel any pending animation frame before requesting a new one
        if (animationFrameRef.current !== null) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        animationFrameRef.current = requestAnimationFrame(() => {
          const deltaX = e.clientX - dragStart.x;
          const deltaY = e.clientY - dragStart.y;
          setSize((prev) => ({
            width: Math.max(800, prev.width + deltaX),
            height: Math.max(600, prev.height + deltaY),
          }));
          setDragStart({ x: e.clientX, y: e.clientY });
          isAnimating = false;
          animationFrameRef.current = null;
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);

      // Cancel any pending animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      // Cancel any pending animation frame on cleanup
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [isDragging, isResizing, dragStart]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 pointer-events-none">
      <div
        ref={modalRef}
        className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto relative"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          maxHeight: '90vh',
          cursor: isDragging ? 'grabbing' : 'default',
        }}
      >
        {/* Header - Draggable */}
        <div
          className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-800 cursor-move flex-shrink-0"
          onMouseDown={handleDragStart}
        >
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

        {/* Main Content - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
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
                            {isMultiTrackRecording && (
                              <span className="flex items-center gap-1 text-xs bg-red-600 text-white px-2 py-0.5 rounded">
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                                REC
                              </span>
                            )}
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
                      onClick={() => {
                        setSelectedLayout(layout);
                        // Call the layout change handler if provided
                        if (onLayoutChange) {
                          onLayoutChange(layout);
                        } else {
                          // Fallback: dispatch event for layout change
                          window.dispatchEvent(new CustomEvent('layoutChange', {
                            detail: { layout }
                          }));
                        }
                      }}
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
                <h3 className="text-lg font-semibold text-white mb-4">🎚️ Audio Mixer</h3>
                <div className="space-y-4">
                  {/* Master Controls */}
                  <div className="border-b border-gray-700 pb-4">
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Broadcast Volume</span>
                        <span className="text-sm text-gray-400">{broadcastVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={broadcastVolume}
                        onChange={(e) => handleBroadcastVolumeChange(parseInt(e.target.value))}
                        className="w-full accent-purple-500"
                      />
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-gray-300">Monitor Volume</span>
                        <span className="text-sm text-gray-400">{monitorVolume}%</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={monitorVolume}
                        onChange={(e) => handleMonitorVolumeChange(parseInt(e.target.value))}
                        className="w-full accent-green-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">What you hear (excludes your mic)</p>
                    </div>
                  </div>

                  {/* Per-Participant Audio */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-300 mb-3">Participant Channels</h4>
                    <div className="space-y-3">
                      {participants
                        .filter((p) => p.role !== 'backstage')
                        .map((participant) => {
                          const level = audioLevels.get(participant.id) || audioLevels.get('local') || 0;
                          const volume = participantVolumes.get(participant.id) ?? 100;
                          const channelInfo = audioChannelInfo.find(c =>
                            c.id === participant.id || (participant.id === '1' && c.isLocal)
                          );

                          return (
                            <div
                              key={participant.id}
                              className="bg-gray-700 rounded-lg p-3"
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-white">{participant.name}</span>
                                  {channelInfo?.isLocal && (
                                    <span className="text-xs bg-purple-600 px-1.5 py-0.5 rounded">You</span>
                                  )}
                                </div>
                                <button
                                  onClick={() => setExpandedAudioSettings(
                                    expandedAudioSettings === participant.id ? null : participant.id
                                  )}
                                  className="text-gray-400 hover:text-white text-xs"
                                >
                                  {expandedAudioSettings === participant.id ? '▼' : '▶'} Effects
                                </button>
                              </div>

                              {/* Audio Level Meter */}
                              <div className="h-2 bg-gray-600 rounded-full mb-2 overflow-hidden">
                                <div
                                  className="h-full transition-all duration-75"
                                  style={{
                                    width: `${level * 100}%`,
                                    backgroundColor: level > 0.8 ? '#EF4444' : level > 0.5 ? '#F59E0B' : '#10B981',
                                  }}
                                />
                              </div>

                              {/* Volume Slider */}
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-400 w-8">{volume}%</span>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={volume}
                                  onChange={(e) => handleParticipantVolumeChange(participant.id, parseInt(e.target.value))}
                                  className="flex-1 accent-blue-500"
                                />
                              </div>

                              {/* Expanded Effects Panel */}
                              {expandedAudioSettings === participant.id && (
                                <div className="mt-3 pt-3 border-t border-gray-600 space-y-3">
                                  {/* Presets */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => applyVoicePreset(participant.id)}
                                      className="flex-1 px-2 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
                                    >
                                      🎤 Voice Preset
                                    </button>
                                    <button
                                      onClick={() => applyMusicPreset(participant.id)}
                                      className="flex-1 px-2 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                                    >
                                      🎵 Music Preset
                                    </button>
                                  </div>

                                  {/* Active Effects Indicators */}
                                  <div className="flex gap-2 text-xs">
                                    {channelInfo?.hasCompressor && (
                                      <span className="bg-green-600 px-2 py-0.5 rounded">Compressor</span>
                                    )}
                                    {channelInfo?.hasHighpass && (
                                      <span className="bg-orange-600 px-2 py-0.5 rounded">Highpass</span>
                                    )}
                                    {channelInfo?.hasLowpass && (
                                      <span className="bg-cyan-600 px-2 py-0.5 rounded">Lowpass</span>
                                    )}
                                    {!channelInfo?.hasCompressor && !channelInfo?.hasHighpass && !channelInfo?.hasLowpass && (
                                      <span className="text-gray-500">No effects active</span>
                                    )}
                                  </div>

                                  {/* Custom Effects Controls */}
                                  <div className="space-y-2">
                                    <div>
                                      <label className="text-xs text-gray-400">Highpass Filter (Hz)</label>
                                      <input
                                        type="range"
                                        min="0"
                                        max="500"
                                        defaultValue="80"
                                        onChange={(e) => applyAudioEffects(participant.id, {
                                          highpassFreq: parseInt(e.target.value)
                                        })}
                                        className="w-full accent-orange-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-400">Lowpass Filter (kHz)</label>
                                      <input
                                        type="range"
                                        min="5000"
                                        max="20000"
                                        defaultValue="12000"
                                        onChange={(e) => applyAudioEffects(participant.id, {
                                          lowpassFreq: parseInt(e.target.value)
                                        })}
                                        className="w-full accent-cyan-500"
                                      />
                                    </div>
                                    <div>
                                      <label className="text-xs text-gray-400">Compressor Threshold (dB)</label>
                                      <input
                                        type="range"
                                        min="-60"
                                        max="0"
                                        defaultValue="-24"
                                        onChange={(e) => applyAudioEffects(participant.id, {
                                          compressor: { threshold: parseInt(e.target.value) }
                                        })}
                                        className="w-full accent-green-500"
                                      />
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
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

              {/* Multi-Track Recording */}
              <div className="bg-gray-800 rounded-lg p-4 border-2 border-purple-600">
                <div className="flex items-center gap-2 mb-4">
                  <h3 className="text-lg font-semibold text-white">🎬 Multi-Track Recording</h3>
                  {isMultiTrackRecording && (
                    <span className="flex items-center gap-1 text-xs text-red-400">
                      <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                      REC
                    </span>
                  )}
                </div>

                {isMultiTrackRecording ? (
                  <>
                    {/* Recording Status */}
                    <div className="bg-red-900/30 border border-red-500 rounded-lg p-3 mb-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white font-semibold">Recording...</span>
                        <span className="text-red-400 font-mono text-lg">
                          {formatDuration(recordingDuration)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-300">
                        {multiTrackRecordingService.getTrackCount()} tracks active
                      </div>
                    </div>

                    {/* Stop Button */}
                    <button
                      onClick={stopMultiTrackRecording}
                      className="w-full px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <rect x="6" y="6" width="12" height="12" rx="1" />
                      </svg>
                      Stop Recording
                    </button>
                  </>
                ) : (
                  <>
                    {/* Settings */}
                    <div className="space-y-3 mb-4">
                      <label className="flex items-center gap-2 cursor-pointer text-sm">
                        <input
                          type="checkbox"
                          checked={separateAudioVideo}
                          onChange={(e) => setSeparateAudioVideo(e.target.checked)}
                          className="w-4 h-4"
                        />
                        <span className="text-white">
                          Separate audio/video files
                        </span>
                      </label>
                      <div className="text-xs text-gray-400">
                        {separateAudioVideo
                          ? 'Each participant: 2 files (audio + video)'
                          : 'Each participant: 1 combined file'}
                      </div>
                    </div>

                    {/* Start Button */}
                    <button
                      onClick={startMultiTrackRecording}
                      disabled={participants.filter((p) => p.role !== 'backstage').length === 0}
                      className="w-full px-4 py-3 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                      Start Recording
                    </button>

                    {/* Download Section */}
                    {recordedTracks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-gray-700">
                        <div className="bg-green-900/30 border border-green-500 rounded-lg p-3 mb-3">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="text-white font-semibold">
                              {recordedTracks.length} tracks ready
                            </span>
                          </div>
                          <div className="text-xs text-gray-300">
                            {(recordedTracks.reduce((sum, t) => sum + t.size, 0) / 1024 / 1024).toFixed(2)} MB total
                          </div>
                        </div>
                        <button
                          onClick={downloadRecordedTracks}
                          className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                          </svg>
                          Download All Tracks
                        </button>
                      </div>
                    )}
                  </>
                )}

                {/* Info */}
                <div className="mt-3 text-xs text-gray-400">
                  💡 Record each participant separately for post-production editing
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      // Open scene manager
                      localStorage.setItem('showSceneManager', 'true');
                      window.dispatchEvent(new CustomEvent('toggleSceneManager', { detail: { show: true } }));
                      toast.success('Opening scene manager...');
                    }}
                    className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded transition-colors"
                  >
                    🎨 Change Scene
                  </button>
                  <button
                    onClick={() => {
                      // Show banner/lower third
                      window.dispatchEvent(new CustomEvent('toggleBannerDrawer', { detail: { show: true } }));
                      toast.success('Opening banner settings...');
                    }}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    📝 Show Lower Third
                  </button>
                  <button
                    onClick={() => {
                      // Play media clip/stinger
                      window.dispatchEvent(new CustomEvent('toggleMediaLibrary', { detail: { show: true } }));
                      toast.success('Opening media library...');
                    }}
                    className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded transition-colors"
                  >
                    🎵 Play Stinger
                  </button>
                  <button
                    onClick={() => {
                      // Emergency cut to logo/splash screen
                      if (confirm('Cut stream to logo screen? This will hide all participants.')) {
                        window.dispatchEvent(new CustomEvent('emergencyCut', { detail: { active: true } }));
                        toast.success('Emergency cut activated');
                      }
                    }}
                    className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded transition-colors"
                  >
                    🚨 Emergency Cut
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex items-center justify-between flex-shrink-0">
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
            onClick={() => {
              // Stop any ongoing recording before closing
              if (isMultiTrackRecording) {
                multiTrackRecordingService.stopRecording().catch(err => console.error('Cleanup error:', err));
              }
              onClose?.();
            }}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Exit Producer Mode
          </button>
        </div>

        {/* Resize Handle */}
        <div
          onMouseDown={handleResizeStart}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize group"
          style={{
            background: 'linear-gradient(135deg, transparent 50%, rgba(147, 51, 234, 0.5) 50%)',
          }}
        >
          <div className="absolute bottom-1 right-1 w-1 h-1 bg-purple-400 rounded-full group-hover:bg-purple-300" />
          <div className="absolute bottom-1 right-2.5 w-1 h-1 bg-purple-400 rounded-full group-hover:bg-purple-300" />
          <div className="absolute bottom-2.5 right-1 w-1 h-1 bg-purple-400 rounded-full group-hover:bg-purple-300" />
        </div>
      </div>
    </div>
  );
}
