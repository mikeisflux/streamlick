import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { broadcastService } from '../services/broadcast.service';
import { socketService } from '../services/socket.service';
import { webrtcService } from '../services/webrtc.service';
import { compositorService } from '../services/compositor.service';
import { recordingService } from '../services/recording.service';
import { hotkeyService } from '../services/hotkey.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { ParticipantVideo } from '../components/ParticipantVideo';
import { VideoGrid } from '../components/VideoGrid';
import { ChatOverlay, ChatMessage } from '../components/ChatOverlay';
import { ChatLayoutCustomizer } from '../components/ChatLayoutCustomizer';
import { ChatModeration } from '../components/ChatModeration';
import { StreamHealthMonitor } from '../components/StreamHealthMonitor';
import { BitrateControl } from '../components/BitrateControl';
import { HotkeyReference } from '../components/HotkeyReference';
import { HotkeyFeedback, useHotkeyFeedback } from '../components/HotkeyFeedback';
import { MediaLibrary } from '../components/MediaLibrary';
import { BackgroundEffects, BackgroundEffect } from '../components/BackgroundEffects';
import { DraggableParticipant } from '../components/DraggableParticipant';
import { SceneManager, Scene } from '../components/SceneManager';
import { ViewerCount } from '../components/ViewerCount';
import { LowerThird } from '../components/LowerThird';
import { ScreenShareManager } from '../components/ScreenShareManager';
import { PlatformLogos } from '../components/PlatformLogos';
import { clipPlayerService } from '../services/clip-player.service';
import { backgroundProcessorService } from '../services/background-processor.service';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';
import api from '../services/api';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

type PanelType = 'destinations' | 'participants' | 'scenes' | 'chat' | 'settings' | 'media' | null;

export function ProducerStudio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isInitializing, setIsInitializing] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [destinations, setDestinations] = useState<any[]>([]);
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentLayout, setCurrentLayout] = useState<'grid' | 'spotlight' | 'sidebar' | 'pip'>('grid');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChatOnStream, setShowChatOnStream] = useState(true);
  const [showHotkeyReference, setShowHotkeyReference] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaClips, setMediaClips] = useState<any[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<Map<string, number>>(new Map());
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [backgroundEffect, setBackgroundEffect] = useState<BackgroundEffect>({ type: 'none' });
  const { messages: hotkeyMessages, showFeedback } = useHotkeyFeedback();

  // Slide-out panel state
  const [leftPanel, setLeftPanel] = useState<PanelType>('participants');
  const [rightPanel, setRightPanel] = useState<PanelType>('chat');
  const [bottomPanel, setBottomPanel] = useState<boolean>(false);

  // Scene management
  const [scenes, setScenes] = useState<Scene[]>([
    {
      id: 'default',
      name: 'Main Scene',
      layout: 'grid',
      participants: [],
      overlays: [],
    },
  ]);
  const [currentSceneId, setCurrentSceneId] = useState('default');

  // Viewer counts
  const [viewerCounts, setViewerCounts] = useState({
    total: 0,
    youtube: 0,
    facebook: 0,
    twitch: 0,
    x: 0,
    rumble: 0,
    linkedin: 0,
  });

  // Lower third
  const [showLowerThird, setShowLowerThird] = useState(false);
  const [lowerThirdText, setLowerThirdText] = useState({ name: '', title: '' });

  // Chat layout
  const [chatLayout, setChatLayout] = useState({ position: 'bottom-left', size: 'medium' });
  const [showChatLayoutCustomizer, setShowChatLayoutCustomizer] = useState(false);
  const [showChatModeration, setShowChatModeration] = useState(false);
  const [showSceneManager, setShowSceneManager] = useState(false);

  const { broadcast, isLive, setIsLive, setBroadcast } = useStudioStore();
  const {
    localStream,
    screenStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  // Initialize studio
  useEffect(() => {
    if (!broadcastId) return;

    const init = async () => {
      try {
        const broadcastData = await broadcastService.getById(broadcastId);
        setBroadcast(broadcastData);

        const destResponse = await api.get('/destinations');
        setDestinations(destResponse.data.filter((d: any) => d.isActive));

        await startCamera();

        const token = localStorage.getItem('accessToken');
        if (token) {
          socketService.connect(token);
          socketService.joinStudio(broadcastId, 'host-id');
        }

        setIsLoading(false);
      } catch (error) {
        toast.error('Failed to initialize studio');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      stopCamera();
      socketService.leaveStudio();
    };
  }, [broadcastId]);

  // Socket event handlers
  useEffect(() => {
    const handleParticipantJoined = async ({ participantId, socketId }: any) => {
      console.log('New participant joined:', participantId);
      toast.success('Participant joined');

      try {
        const stream = await webrtcService.consumeMedia(participantId);
        setRemoteParticipants((prev) => {
          const updated = new Map(prev);
          updated.set(participantId, {
            id: participantId,
            name: `Guest ${participantId.slice(0, 4)}`,
            stream,
            audioEnabled: true,
            videoEnabled: true,
            role: 'backstage',
          });
          return updated;
        });
      } catch (error) {
        console.error('Failed to consume participant media:', error);
      }
    };

    const handleParticipantLeft = ({ participantId }: any) => {
      console.log('Participant left:', participantId);
      toast.info('Participant left');
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });
    };

    const handleMediaStateChanged = ({ participantId, audio, video }: any) => {
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.audioEnabled = audio;
          participant.videoEnabled = video;
        }
        return updated;
      });
    };

    const handleChatMessage = (message: ChatMessage) => {
      console.log('Chat message received:', message);
      setChatMessages((prev) => [...prev, message].slice(-100));
    };

    const handleViewerCountUpdate = (counts: any) => {
      setViewerCounts({
        total: counts.total || 0,
        youtube: counts.youtube || 0,
        facebook: counts.facebook || 0,
        twitch: counts.twitch || 0,
        x: counts.x || 0,
        rumble: counts.rumble || 0,
        linkedin: counts.linkedin || 0,
      });
    };

    socketService.on('participant-joined', handleParticipantJoined);
    socketService.on('participant-left', handleParticipantLeft);
    socketService.on('media-state-changed', handleMediaStateChanged);
    socketService.on('chat-message', handleChatMessage);
    socketService.on('viewer-count-update', handleViewerCountUpdate);

    return () => {
      socketService.off('participant-joined', handleParticipantJoined);
      socketService.off('participant-left', handleParticipantLeft);
      socketService.off('media-state-changed', handleMediaStateChanged);
      socketService.off('chat-message', handleChatMessage);
      socketService.off('viewer-count-update', handleViewerCountUpdate);
    };
  }, [showChatOnStream]);

  // Panel toggle functions
  const toggleLeftPanel = (panel: PanelType) => {
    setLeftPanel(leftPanel === panel ? null : panel);
  };

  const toggleRightPanel = (panel: PanelType) => {
    setRightPanel(rightPanel === panel ? null : panel);
  };

  // Scene handlers
  const handleSceneChange = (sceneId: string, transition?: any) => {
    setCurrentSceneId(sceneId);
    toast.success(`Switched to scene: ${scenes.find(s => s.id === sceneId)?.name || sceneId}`);
  };

  const handleSceneCreate = (scene: Scene) => {
    setScenes(prev => [...prev, scene]);
    toast.success(`Created scene: ${scene.name}`);
  };

  const handleSceneUpdate = (sceneId: string, updates: Partial<Scene>) => {
    setScenes(prev => prev.map(s => s.id === sceneId ? { ...s, ...updates } : s));
  };

  const handleSceneDelete = (sceneId: string) => {
    if (scenes.length <= 1) {
      toast.error('Cannot delete the last scene');
      return;
    }
    setScenes(prev => prev.filter(s => s.id !== sceneId));
    if (currentSceneId === sceneId) {
      setCurrentSceneId(scenes[0].id);
    }
    toast.success('Scene deleted');
  };

  const handleSceneDuplicate = (sceneId: string) => {
    const scene = scenes.find(s => s.id === sceneId);
    if (!scene) return;
    const newScene = {
      ...scene,
      id: `${scene.id}-copy-${Date.now()}`,
      name: `${scene.name} (Copy)`,
    };
    setScenes(prev => [...prev, newScene]);
    toast.success(`Duplicated scene: ${scene.name}`);
  };

  const handleGoLive = async () => {
    if (!broadcastId) return;

    try {
      setIsInitializing(true);

      if (!localStream) {
        throw new Error('No local stream available');
      }

      const compositeStream = await compositorService.createCompositeStream({
        localStream,
        remoteStreams: Array.from(remoteParticipants.values())
          .filter(p => p.role === 'host' || p.role === 'guest')
          .map(p => p.stream)
          .filter(Boolean) as MediaStream[],
        layout: currentLayout,
      });

      const compositeVideoTrack = compositeStream.getVideoTracks()[0];
      const compositeAudioTrack = compositeStream.getAudioTracks()[0];

      let compositeVideoProducerId: string | undefined;
      let compositeAudioProducerId: string | undefined;

      if (compositeVideoTrack) {
        compositeVideoProducerId = await webrtcService.produceMedia(compositeVideoTrack);
        console.log('Composite video producer created:', compositeVideoProducerId);
      }

      if (compositeAudioTrack) {
        compositeAudioProducerId = await webrtcService.produceMedia(compositeAudioTrack);
        console.log('Composite audio producer created:', compositeAudioProducerId);
      }

      await broadcastService.start(broadcastId);
      setIsLive(true);

      const destinationsToStream = destinations
        .filter((d) => selectedDestinations.includes(d.id))
        .map((d) => ({
          id: d.id,
          platform: d.platform,
          rtmpUrl: d.rtmpUrl,
          streamKey: d.streamKey,
        }));

      socketService.emit('start-rtmp', {
        broadcastId,
        destinations: destinationsToStream,
        compositeProducers: {
          videoProducerId: compositeVideoProducerId,
          audioProducerId: compositeAudioProducerId,
        },
      });

      toast.success('You are now live! 🎉');
    } catch (error) {
      console.error('Failed to go live:', error);
      toast.error('Failed to go live');
    } finally {
      setIsInitializing(false);
    }
  };

  const handleEndBroadcast = async () => {
    if (!broadcastId) return;

    try {
      socketService.emit('stop-rtmp', { broadcastId });
      await broadcastService.end(broadcastId);
      setIsLive(false);
      toast.success('Broadcast ended');
    } catch (error) {
      toast.error('Failed to end broadcast');
    }
  };

  const handleToggleAudio = () => toggleAudio();
  const handleToggleVideo = () => toggleVideo();

  const allParticipants = [
    {
      id: 'local',
      name: 'You',
      stream: localStream,
      isLocal: true,
      isMuted: !audioEnabled,
      role: 'host' as const,
    },
    ...Array.from(remoteParticipants.values()).map((p) => ({
      id: p.id,
      name: p.name,
      stream: p.stream,
      isLocal: false,
      isMuted: !p.audioEnabled,
      role: p.role,
    })),
  ];

  const liveParticipants = allParticipants.filter((p) => p.role === 'host' || p.role === 'guest');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading Producer Studio...</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-900 flex flex-col overflow-hidden">
      {/* Top Control Bar */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between z-30">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <div>
            <h1 className="text-lg font-bold text-white">{broadcast?.title || 'Producer Studio'}</h1>
            <div className="flex items-center gap-3 mt-0.5">
              {isLive && (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
                    </span>
                    <span className="text-red-500 text-xs font-semibold">LIVE</span>
                  </div>
                  <ViewerCount counts={viewerCounts} />
                </>
              )}
            </div>
          </div>
        </div>

        {/* Top Control Buttons */}
        <div className="flex items-center gap-2">
          {!isLive ? (
            <Button onClick={handleGoLive} variant="primary" size="sm" disabled={isInitializing}>
              {isInitializing ? 'Initializing...' : '🔴 Go Live'}
            </Button>
          ) : (
            <Button onClick={handleEndBroadcast} variant="danger" size="sm">
              ⏹️ End
            </Button>
          )}
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex relative overflow-hidden">
        {/* Left Slide-Out Panel */}
        <aside
          className={`bg-gray-800 border-r border-gray-700 transition-all duration-300 ease-in-out z-20 overflow-y-auto ${
            leftPanel ? 'w-80' : 'w-0'
          }`}
          style={{ flexShrink: 0 }}
        >
          {leftPanel === 'destinations' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Stream Destinations</h3>
              <div className="space-y-2">
                {destinations.length === 0 ? (
                  <p className="text-sm text-gray-500">No destinations configured</p>
                ) : (
                  destinations.map((dest) => (
                    <label
                      key={dest.id}
                      className="flex items-center gap-2 text-sm text-gray-300 hover:bg-gray-700 p-2 rounded cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDestinations.includes(dest.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDestinations([...selectedDestinations, dest.id]);
                          } else {
                            setSelectedDestinations(selectedDestinations.filter(id => id !== dest.id));
                          }
                        }}
                        disabled={isLive}
                        className="rounded border-gray-600"
                      />
                      <span>{dest.platform}</span>
                      {dest.displayName && <span className="text-gray-500">- {dest.displayName}</span>}
                    </label>
                  ))
                )}
              </div>
            </div>
          )}

          {leftPanel === 'participants' && (
            <div className="p-4">
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Participants ({allParticipants.length})
              </h3>
              <div className="space-y-2">
                {allParticipants.map((p) => (
                  <div key={p.id} className="bg-gray-700 rounded p-2 text-sm text-white flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{p.name}</span>
                      {p.role === 'host' && <span className="text-xs bg-primary-600 px-1.5 py-0.5 rounded">Host</span>}
                      {p.isMuted && <span className="text-red-500 text-xs">🔇</span>}
                    </div>
                    {p.role !== 'host' && p.role === 'guest' && (
                      <span className="text-xs text-green-400">● LIVE</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {leftPanel === 'scenes' && (
            <div className="p-4 h-full overflow-y-auto">
              <SceneManager
                scenes={scenes}
                currentSceneId={currentSceneId}
                onSceneChange={handleSceneChange}
                onSceneCreate={handleSceneCreate}
                onSceneUpdate={handleSceneUpdate}
                onSceneDelete={handleSceneDelete}
                onSceneDuplicate={handleSceneDuplicate}
              />
            </div>
          )}

          {leftPanel === 'media' && (
            <div className="p-4">
              <MediaLibrary onTriggerClip={(clip) => console.log('Trigger clip:', clip)} />
            </div>
          )}

          {leftPanel === 'settings' && (
            <div className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Background Effects</h3>
                <BackgroundEffects
                  currentEffect={backgroundEffect}
                  onEffectChange={(effect) => {
                    setBackgroundEffect(effect);
                    if (localStream) {
                      backgroundProcessorService.updateEffect(effect);
                      toast.success(`Background: ${effect.type}`);
                    }
                  }}
                />
              </div>
              {broadcastId && <StreamHealthMonitor broadcastId={broadcastId} isLive={isLive} />}
              {broadcastId && <BitrateControl broadcastId={broadcastId} isLive={isLive} />}
            </div>
          )}
        </aside>

        {/* Center Canvas */}
        <main className="flex-1 flex flex-col bg-black relative">
          {/* Main Preview */}
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="w-full h-full max-w-7xl mx-auto rounded-lg overflow-hidden bg-gray-900">
              {liveParticipants.length > 0 ? (
                <VideoGrid participantCount={liveParticipants.length}>
                  {liveParticipants.map((participant) => (
                    <ParticipantVideo
                      key={participant.id}
                      stream={participant.stream}
                      name={participant.name}
                      isMuted={participant.isMuted}
                      isLocal={participant.isLocal}
                      className="aspect-video"
                    />
                  ))}
                </VideoGrid>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">
                  No active participants
                </div>
              )}
            </div>
          </div>

          {/* Bottom Control Dock */}
          <div className="bg-gray-800/95 backdrop-blur border-t border-gray-700 py-3 px-4">
            <div className="flex items-center justify-center gap-3">
              <button
                onClick={handleToggleAudio}
                className={`p-3 rounded-full transition-all ${
                  audioEnabled
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
                title={audioEnabled ? 'Mute' : 'Unmute'}
              >
                {audioEnabled ? '🎤' : '🔇'}
              </button>
              <button
                onClick={handleToggleVideo}
                className={`p-3 rounded-full transition-all ${
                  videoEnabled
                    ? 'bg-gray-700 hover:bg-gray-600 text-white'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
                title={videoEnabled ? 'Stop Video' : 'Start Video'}
              >
                {videoEnabled ? '📹' : '📵'}
              </button>
              <div className="w-px h-8 bg-gray-700 mx-2"></div>
              <button
                onClick={() => console.log('Share screen')}
                className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
                title="Share Screen"
              >
                🖥️
              </button>
              <button
                onClick={() => setShowMediaLibrary(true)}
                className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
                title="Media Library"
              >
                🎬
              </button>
              <button
                onClick={() => handleShowLowerThird('Guest Name', 'Guest Title')}
                className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-all"
                title="Lower Third"
              >
                📝
              </button>
            </div>
          </div>
        </main>

        {/* Right Slide-Out Panel */}
        <aside
          className={`bg-gray-800 border-l border-gray-700 transition-all duration-300 ease-in-out z-20 overflow-y-auto ${
            rightPanel ? 'w-80' : 'w-0'
          }`}
          style={{ flexShrink: 0 }}
        >
          {rightPanel === 'chat' && (
            <div className="h-full">
              <ChatOverlay messages={chatMessages} showPlatformIcons={true} maxMessages={100} />
            </div>
          )}
        </aside>

        {/* Left Panel Toggle Buttons */}
        <div className="absolute left-0 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 bg-gray-800 rounded-r-lg border-r border-t border-b border-gray-700 p-1">
          <button
            onClick={() => toggleLeftPanel('participants')}
            className={`p-2 rounded transition-colors ${
              leftPanel === 'participants' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Participants"
          >
            👥
          </button>
          <button
            onClick={() => toggleLeftPanel('destinations')}
            className={`p-2 rounded transition-colors ${
              leftPanel === 'destinations' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Destinations"
          >
            📡
          </button>
          <button
            onClick={() => toggleLeftPanel('scenes')}
            className={`p-2 rounded transition-colors ${
              leftPanel === 'scenes' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Scenes"
          >
            🎬
          </button>
          <button
            onClick={() => toggleLeftPanel('media')}
            className={`p-2 rounded transition-colors ${
              leftPanel === 'media' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Media Library"
          >
            🎵
          </button>
          <button
            onClick={() => toggleLeftPanel('settings')}
            className={`p-2 rounded transition-colors ${
              leftPanel === 'settings' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Settings"
          >
            ⚙️
          </button>
        </div>

        {/* Right Panel Toggle Buttons */}
        <div className="absolute right-0 top-1/2 -translate-y-1/2 z-30 flex flex-col gap-1 bg-gray-800 rounded-l-lg border-l border-t border-b border-gray-700 p-1">
          <button
            onClick={() => toggleRightPanel('chat')}
            className={`p-2 rounded transition-colors ${
              rightPanel === 'chat' ? 'bg-primary-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            title="Chat"
          >
            💬
          </button>
        </div>
      </div>

      {/* Modals */}
      {showMediaLibrary && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Media Library</h2>
              <button
                onClick={() => setShowMediaLibrary(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <MediaLibrary onTriggerClip={(clip) => console.log('Play clip:', clip)} />
            </div>
          </div>
        </div>
      )}

      {showLowerThird && (
        <LowerThird
          name={lowerThirdText.name}
          title={lowerThirdText.title}
          onHide={() => setShowLowerThird(false)}
        />
      )}

      <HotkeyFeedback messages={hotkeyMessages} />
      {showHotkeyReference && <HotkeyReference />}
    </div>
  );

  function handleShowLowerThird(name: string, title: string) {
    setLowerThirdText({ name, title });
    setShowLowerThird(true);
  }
}
