import { useEffect, useState, useCallback, useRef, useMemo, memo } from 'react';
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
import { StreamHealthMonitor } from '../components/StreamHealthMonitor';
import { BitrateControl } from '../components/BitrateControl';
import { HotkeyReference } from '../components/HotkeyReference';
import { HotkeyFeedback, useHotkeyFeedback } from '../components/HotkeyFeedback';
import { MediaLibrary } from '../components/MediaLibrary';
import { BackgroundEffects, BackgroundEffect } from '../components/BackgroundEffects';
import { SceneManager, Scene } from '../components/SceneManager';
import { LowerThird } from '../components/LowerThird';
import { Drawer } from '../components/Drawer';
import { DestinationsPanel } from '../components/DestinationsPanel';
import { InviteGuestsPanel } from '../components/InviteGuestsPanel';
import { BannerEditorPanel } from '../components/BannerEditorPanel';
import { BrandSettingsPanel } from '../components/BrandSettingsPanel';
import { ParticipantsPanel } from '../components/ParticipantsPanel';
import { RecordingControls } from '../components/RecordingControls';
import { StylePanel } from '../components/StylePanel';
import { NotesPanel } from '../components/NotesPanel';
import { MediaAssetsPanel } from '../components/MediaAssetsPanel';
import { PrivateChatPanel } from '../components/PrivateChatPanel';
import { CommentsPanel } from '../components/CommentsPanel';
import { ClipManager } from '../components/ClipManager';
import { ProducerMode } from '../components/ProducerMode';
import { clipPlayerService } from '../services/clip-player.service';
import { backgroundProcessorService } from '../services/background-processor.service';
import { clipRecordingService } from '../services/clip-recording.service';
import { captionService, Caption, POPULAR_LANGUAGES } from '../services/caption.service';
import { backgroundRemovalService, BackgroundOptions } from '../services/background-removal.service';
import { verticalCompositorService } from '../services/vertical-compositor.service';
import { analyticsService, EngagementMetrics, StreamInsight } from '../services/analytics.service';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';
import api from '../services/api';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage'; // host=always live, guest=live, backstage=waiting
}

// Memoized Caption Overlay Component to prevent re-renders
const CaptionOverlayMemo = memo(({ caption }: { caption: Caption | null }) => {
  if (!caption) return null;

  return (
    <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 max-w-4xl px-4 pointer-events-none">
      <div
        className={`px-6 py-3 rounded-lg text-center transition-opacity duration-300 ${
          caption.isFinal ? 'bg-black/90' : 'bg-black/70'
        }`}
        style={{
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}
      >
        <p
          className={`text-white font-semibold leading-tight ${
            caption.isFinal ? 'text-lg' : 'text-base opacity-80'
          }`}
          style={{
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          }}
        >
          {caption.text}
        </p>
        {!caption.isFinal && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>
    </div>
  );
});

CaptionOverlayMemo.displayName = 'CaptionOverlayMemo';

export function Studio() {
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
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [showChatOnStream, setShowChatOnStream] = useState(true);
  const [showHotkeyReference, setShowHotkeyReference] = useState(false);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const [mediaClips, setMediaClips] = useState<any[]>([]);
  const [participantVolumes, setParticipantVolumes] = useState<Map<string, number>>(new Map());
  const [selectedParticipant, setSelectedParticipant] = useState<string | null>(null);
  const [backgroundEffect, setBackgroundEffect] = useState<BackgroundEffect>({ type: 'none' });
  const { messages: hotkeyMessages, showFeedback } = useHotkeyFeedback();

  // New component state
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
  const [viewerCounts, setViewerCounts] = useState({
    total: 0,
    youtube: 0,
    facebook: 0,
    twitch: 0,
    x: 0,
    rumble: 0,
    linkedin: 0,
  });
  const [showLowerThird, setShowLowerThird] = useState(false);
  const [lowerThirdText, setLowerThirdText] = useState({ name: '', title: '' });
  const [showChatLayoutCustomizer, setShowChatLayoutCustomizer] = useState(false);
  const [showChatModeration, setShowChatModeration] = useState(false);
  const [showSceneManager, setShowSceneManager] = useState(false);

  // Drawer panel state
  const [showDestinationsDrawer, setShowDestinationsDrawer] = useState(false);
  const [showInviteDrawer, setShowInviteDrawer] = useState(false);
  const [showBannerDrawer, setShowBannerDrawer] = useState(false);
  const [showBrandDrawer, setShowBrandDrawer] = useState(false);
  const [showParticipantsDrawer, setShowParticipantsDrawer] = useState(false);
  const [showRecordingDrawer, setShowRecordingDrawer] = useState(false);

  // Sidebar and panel state for new layout
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(() => localStorage.getItem('scenesPanelOpen') === 'true');
  const [rightSidebarOpen, setRightSidebarOpen] = useState(() => localStorage.getItem('tabbedPanelsOpen') === 'true');
  const [activeRightTab, setActiveRightTab] = useState<'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | null>(() => {
    const saved = localStorage.getItem('activeRightTab');
    return saved as 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording' | null;
  });

  // Mutual exclusivity: only one sidebar can be open at a time
  const handleLeftSidebarToggle = () => {
    if (!leftSidebarOpen && rightSidebarOpen) {
      setRightSidebarOpen(false);
      setActiveRightTab(null);
    }
    setLeftSidebarOpen(!leftSidebarOpen);
  };

  const handleRightSidebarToggle = (tab: 'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording') => {
    if (leftSidebarOpen) {
      setLeftSidebarOpen(false);
    }

    // If clicking the same tab, close the sidebar
    if (activeRightTab === tab && rightSidebarOpen) {
      setRightSidebarOpen(false);
      setActiveRightTab(null);
    } else {
      // Otherwise, open sidebar and switch to the clicked tab
      setRightSidebarOpen(true);
      setActiveRightTab(tab);
    }
  };
  const [selectedLayout, setSelectedLayout] = useState<number>(9);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');
  const [selectedSpeakerDevice, setSelectedSpeakerDevice] = useState<string>('');
  const [speakerDevices, setSpeakerDevices] = useState<MediaDeviceInfo[]>([]);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [showMicSelector, setShowMicSelector] = useState(false);
  const [showCameraSelector, setShowCameraSelector] = useState(false);
  const [showSpeakerSelector, setShowSpeakerSelector] = useState(false);

  // Killer features state
  const [showClipManager, setShowClipManager] = useState(false);
  const [showProducerMode, setShowProducerMode] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [clipRecordingEnabled, setClipRecordingEnabled] = useState(false);
  const [showClipDurationSelector, setShowClipDurationSelector] = useState(false);

  // AI Captions state
  const [currentCaption, setCurrentCaption] = useState<Caption | null>(null);
  const [captionLanguage, setCaptionLanguage] = useState('en-US');
  const [showLanguageSelector, setShowLanguageSelector] = useState(false);

  // Smart Background Removal state
  const [backgroundRemovalEnabled, setBackgroundRemovalEnabled] = useState(false);
  const [backgroundRemovalOptions, setBackgroundRemovalOptions] = useState<BackgroundOptions>({
    type: 'blur',
    blurAmount: 15,
    color: '#1a1a1a',
    edgeSoftness: 0.3,
  });
  const [processedStream, setProcessedStream] = useState<MediaStream | null>(null);
  const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);

  // Vertical Simulcast state
  const [verticalSimulcastEnabled, setVerticalSimulcastEnabled] = useState(false);
  const [verticalStream, setVerticalStream] = useState<MediaStream | null>(null);
  const [verticalResolution, setVerticalResolution] = useState<'1080x1920' | '720x1280' | '540x960'>('1080x1920');
  const [showVerticalSettings, setShowVerticalSettings] = useState(false);

  // Analytics state
  const [analyticsEnabled, setAnalyticsEnabled] = useState(false);
  const [showAnalyticsDashboard, setShowAnalyticsDashboard] = useState(false);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<EngagementMetrics | null>(null);
  const [analyticsInsights, setAnalyticsInsights] = useState<StreamInsight[]>([]);

  // Analytics Dashboard position and size state
  const [analyticsDashboardPosition, setAnalyticsDashboardPosition] = useState({ x: 100, y: 50 });
  const [analyticsDashboardSize, setAnalyticsDashboardSize] = useState({ width: 800, height: 600 });
  const [isDraggingAnalytics, setIsDraggingAnalytics] = useState(false);
  const [isResizingAnalytics, setIsResizingAnalytics] = useState(false);

  // Chat overlay position and size state
  const [chatOverlayPosition, setChatOverlayPosition] = useState({ x: 0, y: 0 });
  const [chatOverlaySize, setChatOverlaySize] = useState({ width: 320, height: 384 });
  const [isDraggingChat, setIsDraggingChat] = useState(false);
  const [isResizingChat, setIsResizingChat] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const chatOverlayRef = useRef<HTMLDivElement>(null);
  const chatDragOffsetRef = useRef({ x: 0, y: 0 });
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const sidebarVideoRef = useRef<HTMLVideoElement>(null);
  const leftSidebarRef = useRef<HTMLElement>(null);
  const rightSidebarRef = useRef<HTMLElement>(null);
  const micButtonRef = useRef<HTMLDivElement>(null);
  const cameraButtonRef = useRef<HTMLDivElement>(null);
  const speakerButtonRef = useRef<HTMLDivElement>(null);

  // Drawer state consolidation
  const [activeDrawer, setActiveDrawer] = useState<'destinations' | 'invite' | 'banners' | 'brand' | null>(null);

  const { broadcast, isLive, setIsLive, setBroadcast } = useStudioStore();
  const {
    localStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    stopCamera,
    startScreenShare,
    stopScreenShare,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  useEffect(() => {
    if (!broadcastId) return;

    const init = async () => {
      try {
        // Load broadcast
        const broadcastData = await broadcastService.getById(broadcastId);
        setBroadcast(broadcastData);

        // Load destinations
        const destResponse = await api.get('/destinations');
        setDestinations(destResponse.data.filter((d: any) => d.isActive));

        // Start camera FIRST to request permissions
        await startCamera();

        // Load available devices AFTER permissions are granted
        await loadDevices();

        // Connect socket
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
      webrtcService.close();
    };
  }, [broadcastId]);

  // Register hotkeys
  useEffect(() => {
    hotkeyService.initialize();

    // Toggle audio (M)
    hotkeyService.register({
      key: 'm',
      description: 'Toggle microphone',
      action: () => {
        toggleAudio();
        const message = audioEnabled ? 'Microphone muted' : 'Microphone unmuted';
        showFeedback(message, audioEnabled ? '🔇' : '🎤');
        toast.success(message);
      },
    });

    // Toggle video (V)
    hotkeyService.register({
      key: 'v',
      description: 'Toggle camera',
      action: () => {
        toggleVideo();
        const message = videoEnabled ? 'Camera off' : 'Camera on';
        showFeedback(message, videoEnabled ? '📵' : '📹');
        toast.success(message);
      },
    });

    // Go live (Ctrl+L)
    hotkeyService.register({
      key: 'l',
      ctrl: true,
      description: 'Go live',
      action: () => {
        if (!isLive) {
          handleGoLive();
        }
      },
      enabled: !isLive,
    });

    // End broadcast (Ctrl+E)
    hotkeyService.register({
      key: 'e',
      ctrl: true,
      description: 'End broadcast',
      action: () => {
        if (isLive) {
          handleEndBroadcast();
        }
      },
      enabled: isLive,
    });

    // Toggle recording (R)
    hotkeyService.register({
      key: 'r',
      description: 'Toggle recording',
      action: () => {
        if (isRecording) {
          showFeedback('Stopping recording', '⏹️');
          handleStopRecording();
        } else {
          showFeedback('Starting recording', '⏺️');
          handleStartRecording();
        }
      },
    });

    // Toggle screen share (S)
    hotkeyService.register({
      key: 's',
      description: 'Toggle screen share',
      action: () => {
        showFeedback(isSharingScreen ? 'Stopping screen share' : 'Starting screen share', '🖥️');
        handleToggleScreenShare();
      },
    });

    // Layout shortcuts (1-4)
    hotkeyService.register({
      key: '1',
      description: 'Switch to grid layout',
      action: () => {
        showFeedback('Grid layout', '▦');
        handleLayoutChange('grid');
      },
    });

    hotkeyService.register({
      key: '2',
      description: 'Switch to spotlight layout',
      action: () => {
        showFeedback('Spotlight layout', '◉');
        handleLayoutChange('spotlight');
      },
    });

    hotkeyService.register({
      key: '3',
      description: 'Switch to sidebar layout',
      action: () => {
        showFeedback('Sidebar layout', '▥');
        handleLayoutChange('sidebar');
      },
    });

    hotkeyService.register({
      key: '4',
      description: 'Switch to picture-in-picture layout',
      action: () => {
        showFeedback('Picture-in-picture layout', '⧉');
        handleLayoutChange('pip');
      },
    });

    // Toggle chat on stream (C)
    hotkeyService.register({
      key: 'c',
      description: 'Toggle chat on stream',
      action: () => {
        setShowChatOnStream((prev) => {
          const newValue = !prev;
          compositorService.setShowChat(newValue);
          const message = newValue ? 'Chat visible on stream' : 'Chat hidden from stream';
          showFeedback(message, '💬');
          toast.success(message);
          return newValue;
        });
      },
    });

    // Show hotkey reference (?)
    hotkeyService.register({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: () => {
        setShowHotkeyReference((prev) => !prev);
      },
    });

    return () => {
      hotkeyService.cleanup();
      hotkeyService.unregisterAll();
    };
  }, [
    audioEnabled,
    videoEnabled,
    isLive,
    isRecording,
    isSharingScreen,
    toggleAudio,
    toggleVideo,
    showFeedback,
  ]);

  // Load media clips and register hotkeys
  useEffect(() => {
    const loadMediaClips = async () => {
      try {
        const response = await api.get('/media-clips');
        const clips = response.data.clips || [];
        setMediaClips(clips);

        // Register hotkeys for clips that have them
        clips.forEach((clip: any) => {
          if (clip.hotkey) {
            hotkeyService.register({
              key: clip.hotkey.toLowerCase(),
              description: `Play ${clip.name}`,
              action: () => {
                handlePlayClip(clip);
                showFeedback(`Playing: ${clip.name}`, getClipIcon(clip.type));
              },
            });
          }
        });
      } catch (error) {
        console.error('Failed to load media clips:', error);
      }
    };

    loadMediaClips();

    return () => {
      // Unregister clip hotkeys on cleanup
      mediaClips.forEach((clip: any) => {
        if (clip.hotkey) {
          hotkeyService.unregister({ key: clip.hotkey.toLowerCase() });
        }
      });
    };
  }, []);

  // Save sidebar state to localStorage
  useEffect(() => {
    localStorage.setItem('scenesPanelOpen', leftSidebarOpen.toString());
  }, [leftSidebarOpen]);

  useEffect(() => {
    localStorage.setItem('tabbedPanelsOpen', rightSidebarOpen.toString());
  }, [rightSidebarOpen]);

  useEffect(() => {
    if (activeRightTab) {
      localStorage.setItem('activeRightTab', activeRightTab);
    } else {
      localStorage.removeItem('activeRightTab');
    }
  }, [activeRightTab]);

  // Click outside to close sidebars
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check if clicking outside left sidebar
      if (leftSidebarOpen && leftSidebarRef.current && !leftSidebarRef.current.contains(target)) {
        // Also check if not clicking the toggle button
        const toggleButton = document.querySelector('[aria-label="Open Scenes Panel"]');
        if (!toggleButton || !toggleButton.contains(target)) {
          setLeftSidebarOpen(false);
        }
      }

      // Check if clicking outside right sidebar
      if (rightSidebarOpen && rightSidebarRef.current && !rightSidebarRef.current.contains(target)) {
        setRightSidebarOpen(false);
        setActiveRightTab(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [leftSidebarOpen, rightSidebarOpen]);

  const getClipIcon = (type: string): string => {
    switch (type) {
      case 'video': return '🎬';
      case 'audio': return '🔊';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  // Initialize WebRTC
  const initializeWebRTC = useCallback(async () => {
    if (!broadcastId || !localStream) return;

    setIsInitializing(true);
    try {
      // Initialize WebRTC device
      await webrtcService.initialize(broadcastId);

      // Create send transport
      await webrtcService.createSendTransport();

      // Produce video and audio tracks
      const videoTrack = localStream.getVideoTracks()[0];
      const audioTrack = localStream.getAudioTracks()[0];

      if (videoTrack) {
        await webrtcService.produceMedia(videoTrack);
      }

      if (audioTrack) {
        await webrtcService.produceMedia(audioTrack);
      }

      toast.success('WebRTC initialized');
    } catch (error) {
      console.error('WebRTC initialization error:', error);
      toast.error('Failed to initialize WebRTC');
    } finally {
      setIsInitializing(false);
    }
  }, [broadcastId, localStream]);

  // Handle new participant joined
  useEffect(() => {
    const handleParticipantJoined = async ({ participantId, socketId }: any) => {
      console.log('New participant joined:', participantId);
      toast.success('A participant joined');

      // In a full implementation, we'd consume their media here
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.set(participantId, {
          id: participantId,
          name: `Guest ${updated.size + 1}`,
          stream: null,
          audioEnabled: true,
          videoEnabled: true,
          role: 'backstage', // New participants start in backstage by default
        });
        return updated;
      });
    };

    const handleParticipantLeft = ({ participantId }: any) => {
      console.log('Participant left:', participantId);
      toast.success('A participant left');

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
          updated.set(participantId, participant);
        }
        return updated;
      });
    };

    const handleChatMessage = (message: ChatMessage) => {
      console.log('Chat message received:', message);
      setChatMessages((prev) => [...prev, message]);

      // Add to compositor if chat display is enabled
      if (showChatOnStream) {
        compositorService.addChatMessage(message);
      }
    };

    const handleParticipantPromoted = ({ participantId, role }: any) => {
      console.log('Participant promoted:', participantId, role);
      toast.success('Participant moved to live!');
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.role = role;
        }
        return updated;
      });
    };

    const handleParticipantDemoted = ({ participantId, role }: any) => {
      console.log('Participant demoted:', participantId, role);
      toast.success('Participant moved to backstage');
      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        const participant = updated.get(participantId);
        if (participant) {
          participant.role = role;
        }
        return updated;
      });
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
    socketService.on('participant-promoted', handleParticipantPromoted);
    socketService.on('participant-demoted', handleParticipantDemoted);
    socketService.on('viewer-count-update', handleViewerCountUpdate);

    return () => {
      socketService.off('participant-joined', handleParticipantJoined);
      socketService.off('participant-left', handleParticipantLeft);
      socketService.off('media-state-changed', handleMediaStateChanged);
      socketService.off('chat-message', handleChatMessage);
      socketService.off('participant-promoted', handleParticipantPromoted);
      socketService.off('participant-demoted', handleParticipantDemoted);
      socketService.off('viewer-count-update', handleViewerCountUpdate);
    };
  }, [showChatOnStream]);

  const handleGoLive = async () => {
    if (!broadcastId) return;

    if (selectedDestinations.length === 0) {
      toast.error('Please select at least one destination');
      return;
    }

    try {
      // Initialize WebRTC if not already done
      if (!webrtcService.getDevice()) {
        await initializeWebRTC();
      }

      // Initialize compositor with only LIVE participants (exclude backstage)
      const participantStreams = [
        {
          id: 'local',
          name: 'You',
          stream: localStream!,
          isLocal: true,
          audioEnabled,
          videoEnabled,
        },
        ...Array.from(remoteParticipants.values())
          .filter((p) => p.role === 'host' || p.role === 'guest') // Only live participants
          .map((p) => ({
            id: p.id,
            name: p.name,
            stream: p.stream!,
            isLocal: false,
            audioEnabled: p.audioEnabled,
            videoEnabled: p.videoEnabled,
          })),
      ].filter((p) => p.stream);

      await compositorService.initialize(participantStreams);
      compositorService.setLayout({ type: currentLayout });

      // Get composite stream and produce it via WebRTC
      const compositeStream = compositorService.getOutputStream();
      if (!compositeStream) {
        throw new Error('Failed to get composite stream');
      }

      // Produce composite video and audio tracks
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

      // Start broadcast
      await broadcastService.start(broadcastId);
      setIsLive(true);

      // Start RTMP streaming with composite producers
      const destinationsToStream = destinations
        .filter((d) => selectedDestinations.includes(d.id))
        .map((d) => ({
          id: d.id,
          platform: d.platform,
          rtmpUrl: d.rtmpUrl,
          streamKey: 'encrypted-key', // In production, decrypt on backend
        }));

      socketService.emit('start-rtmp', {
        broadcastId,
        destinations: destinationsToStream,
        compositeProducers: {
          videoProducerId: compositeVideoProducerId,
          audioProducerId: compositeAudioProducerId,
        },
      });

      // Start chat polling
      socketService.emit('start-chat', { broadcastId });

      // Enable chat display on compositor
      compositorService.setShowChat(showChatOnStream);

      toast.success('You are now live!');
    } catch (error) {
      console.error('Go live error:', error);
      toast.error('Failed to go live');
    }
  };

  const handleEndBroadcast = async () => {
    if (!broadcastId) return;

    try {
      // Stop recording if active
      if (isRecording) {
        await handleStopRecording();
      }

      // Stop chat polling
      socketService.emit('stop-chat', { broadcastId });

      // Stop compositor
      compositorService.stop();

      // Stop RTMP streaming
      socketService.emit('stop-rtmp', { broadcastId });
      await broadcastService.end(broadcastId);
      setIsLive(false);
      toast.success('Broadcast ended');
    } catch (error) {
      toast.error('Failed to end broadcast');
    }
  };

  const handleStartRecording = async () => {
    try {
      const compositeStream = compositorService.getOutputStream();
      if (!compositeStream) {
        toast.error('No composite stream available');
        return;
      }

      await recordingService.startRecording(compositeStream);
      setIsRecording(true);
      toast.success('Recording started');

      // Update duration every second
      const interval = setInterval(() => {
        setRecordingDuration(recordingService.getDuration());
      }, 1000);

      // Store interval for cleanup
      (window as any).__recordingInterval = interval;
    } catch (error) {
      console.error('Recording start error:', error);
      toast.error('Failed to start recording');
    }
  };

  const handleStopRecording = async () => {
    try {
      const blob = await recordingService.stopRecording();
      setIsRecording(false);
      setRecordingDuration(0);

      // Clear interval
      if ((window as any).__recordingInterval) {
        clearInterval((window as any).__recordingInterval);
      }

      // Upload recording to backend
      if (broadcast?.title) {
        await recordingService.uploadRecording(blob, broadcastId!, broadcast.title);
        toast.success('Recording saved successfully');
      } else {
        // Fallback to download
        const filename = `broadcast-${broadcastId}-${Date.now()}.webm`;
        recordingService.downloadRecording(blob, filename);
        toast.success('Recording downloaded');
      }
    } catch (error) {
      console.error('Recording stop error:', error);
      toast.error('Failed to stop recording');
    }
  };

  const handleLayoutChange = (layout: 'grid' | 'spotlight' | 'sidebar' | 'pip') => {
    setCurrentLayout(layout);
    compositorService.setLayout({ type: layout });
    toast.success(`Layout changed to ${layout}`);
  };

  const handlePromoteToLive = (participantId: string) => {
    socketService.emit('promote-to-live', { participantId });
  };

  const handleDemoteToBackstage = (participantId: string) => {
    socketService.emit('demote-to-backstage', { participantId });
  };

  const handleToggleScreenShare = async () => {
    try {
      if (isSharingScreen) {
        // Stop screen sharing
        stopScreenShare();
        setIsSharingScreen(false);
        setScreenShareStream(null);

        // Remove screen share from compositor
        compositorService.removeParticipant('screen-share');

        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const stream = await startScreenShare();
        setIsSharingScreen(true);
        setScreenShareStream(stream);

        // Add screen share to compositor
        await compositorService.addParticipant({
          id: 'screen-share',
          name: 'Screen Share',
          stream,
          isLocal: true,
          audioEnabled: false,
          videoEnabled: true,
        });

        // Produce screen share tracks via WebRTC
        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          await webrtcService.produceMedia(videoTrack);
        }

        // Handle screen share stopped by user (clicking browser's stop button)
        videoTrack.onended = () => {
          setIsSharingScreen(false);
          setScreenShareStream(null);
          compositorService.removeParticipant('screen-share');
          toast.success('Screen sharing stopped');
        };

        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
      setIsSharingScreen(false);
      setScreenShareStream(null);
    }
  };

  const handleToggleAudio = () => {
    toggleAudio();
    socketService.updateMediaState(audioEnabled, videoEnabled);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    socketService.updateMediaState(audioEnabled, videoEnabled);
  };

  const handlePlayClip = async (clip: any) => {
    try {
      // Get the compositor canvas for video overlay
      const canvas = compositorService.getCanvas() || undefined;

      if (clip.type === 'video') {
        await clipPlayerService.playVideoClip(clip, canvas, compositorService);
        toast.success(`Playing video: ${clip.name}`);
      } else if (clip.type === 'audio') {
        await clipPlayerService.playAudioClip(clip);
        toast.success(`Playing audio: ${clip.name}`);
      } else if (clip.type === 'image') {
        const duration = clip.duration || 5000; // Default 5 seconds
        clipPlayerService.showImageClip(clip, duration, canvas, compositorService);
        toast.success(`Showing image: ${clip.name}`);
      }
    } catch (error) {
      console.error('Failed to play clip:', error);
      toast.error('Failed to play media clip');
    }
  };

  const handleVolumeChange = (participantId: string, volume: number) => {
    setParticipantVolumes((prev) => {
      const updated = new Map(prev);
      updated.set(participantId, volume);
      return updated;
    });

    // Emit socket event to update participant volume
    socketService.emit('set-participant-volume', {
      broadcastId,
      participantId,
      volume,
    });

    // Update audio mixer service
    // audioMixerService.setParticipantVolume(participantId, volume / 100);
  };

  const handleMuteParticipant = (participantId: string) => {
    socketService.emit('mute-participant', {
      broadcastId,
      participantId,
    });

    toast.success('Participant muted');
  };

  const handleUnmuteParticipant = (participantId: string) => {
    socketService.emit('unmute-participant', {
      broadcastId,
      participantId,
    });

    toast.success('Participant unmuted');
  };

  const handleKickParticipant = (participantId: string, participantName: string) => {
    if (!confirm(`Kick ${participantName} from the broadcast?`)) return;

    socketService.emit('kick-participant', {
      broadcastId,
      participantId,
    });

    setRemoteParticipants((prev) => {
      const updated = new Map(prev);
      updated.delete(participantId);
      return updated;
    });

    toast.success(`${participantName} has been kicked`);
  };

  const handleBanParticipant = async (participantId: string, participantName: string) => {
    if (!confirm(`Ban ${participantName} permanently? They will not be able to rejoin this broadcast.`)) return;

    try {
      // Save ban to backend
      await api.post(`/broadcasts/${broadcastId}/ban`, {
        participantId,
      });

      socketService.emit('ban-participant', {
        broadcastId,
        participantId,
      });

      setRemoteParticipants((prev) => {
        const updated = new Map(prev);
        updated.delete(participantId);
        return updated;
      });

      toast.success(`${participantName} has been banned`);
    } catch (error) {
      console.error('Failed to ban participant:', error);
      toast.error('Failed to ban participant');
    }
  };

  // Scene Management Handlers
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

  // Device Management Handlers
  const loadDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter((d) => d.kind === 'audioinput');
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');
      const audioOutputs = devices.filter((d) => d.kind === 'audiooutput');

      setAudioDevices(audioInputs);
      setVideoDevices(videoInputs);
      setSpeakerDevices(audioOutputs);

      // Set default devices if not already set
      if (!selectedAudioDevice && audioInputs.length > 0) {
        setSelectedAudioDevice(audioInputs[0].deviceId);
      }
      if (!selectedVideoDevice && videoInputs.length > 0) {
        setSelectedVideoDevice(videoInputs[0].deviceId);
      }
      if (!selectedSpeakerDevice && audioOutputs.length > 0) {
        setSelectedSpeakerDevice(audioOutputs[0].deviceId);
      }
    } catch (error) {
      console.error('Failed to enumerate devices:', error);
      toast.error('Failed to load media devices');
    }
  };

  const handleAudioDeviceChange = async (deviceId: string) => {
    try {
      setSelectedAudioDevice(deviceId);

      // Stop current audio track
      if (localStream) {
        localStream.getAudioTracks().forEach(track => track.stop());
      }

      // Get new audio stream with selected device
      const newAudioStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
      });

      // Replace audio track in local stream
      const newAudioTrack = newAudioStream.getAudioTracks()[0];
      if (localStream) {
        const oldAudioTrack = localStream.getAudioTracks()[0];
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
        }
        localStream.addTrack(newAudioTrack);
      }

      toast.success('Microphone changed successfully');
    } catch (error) {
      console.error('Failed to change audio device:', error);
      toast.error('Failed to change microphone');
    }
  };

  const handleVideoDeviceChange = async (deviceId: string) => {
    try {
      setSelectedVideoDevice(deviceId);

      // Stop current video track
      if (localStream) {
        localStream.getVideoTracks().forEach(track => track.stop());
      }

      // Wait a bit for the camera to be fully released
      await new Promise(resolve => setTimeout(resolve, 100));

      // Get new video stream with selected device
      const newVideoStream = await navigator.mediaDevices.getUserMedia({
        video: {
          deviceId: { exact: deviceId },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          frameRate: { ideal: 30 },
        },
      });

      // Replace video track in local stream
      const newVideoTrack = newVideoStream.getVideoTracks()[0];
      if (localStream) {
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
        }
        localStream.addTrack(newVideoTrack);
      }

      toast.success('Camera changed successfully');
    } catch (error) {
      console.error('Failed to change video device:', error);
      toast.error('Failed to change camera. Make sure it\'s not being used by another application.');
    }
  };

  const handleSpeakerDeviceChange = async (deviceId: string) => {
    try {
      setSelectedSpeakerDevice(deviceId);

      // Set the audio output device for all audio/video elements
      const audioElements = document.querySelectorAll('audio, video');
      for (const element of audioElements) {
        if (typeof (element as any).setSinkId !== 'undefined') {
          await (element as any).setSinkId(deviceId);
        }
      }

      toast.success('Speaker changed successfully');
    } catch (error) {
      console.error('Failed to change speaker device:', error);
      toast.error('Failed to change speaker');
    }
  };

  const toggleSpeaker = () => {
    setSpeakerMuted(!speakerMuted);
    const audioElements = document.querySelectorAll('audio, video');
    audioElements.forEach((element: any) => {
      element.muted = !speakerMuted;
    });
  };

  // Chat Overlay Drag/Resize Handlers
  const handleChatOverlayDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingChat(true);
    chatDragOffsetRef.current = {
      x: e.clientX - chatOverlayPosition.x,
      y: e.clientY - chatOverlayPosition.y,
    };
  };

  const handleChatOverlayResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingChat(true);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Analytics Dashboard Drag/Resize Handlers
  const handleAnalyticsDashboardDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAnalytics(true);
    setDragStartPos({
      x: e.clientX - analyticsDashboardPosition.x,
      y: e.clientY - analyticsDashboardPosition.y,
    });
  };

  const handleAnalyticsDashboardResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizingAnalytics(true);
    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
    });
  };

  // Mouse move handler for dragging and resizing
  useEffect(() => {
    let animationFrameId: number;

    const handleMouseMove = (e: MouseEvent) => {
      if (isDraggingChat) {
        // Use requestAnimationFrame and direct DOM manipulation to avoid re-renders
        if (animationFrameId) {
          cancelAnimationFrame(animationFrameId);
        }
        animationFrameId = requestAnimationFrame(() => {
          const newX = e.clientX - chatDragOffsetRef.current.x;
          const newY = e.clientY - chatDragOffsetRef.current.y;

          if (chatOverlayRef.current) {
            chatOverlayRef.current.style.transform = `translate(${newX}px, ${newY}px)`;
          }
        });
      } else if (isResizingChat) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setChatOverlaySize((prev) => ({
          width: Math.max(200, prev.width + deltaX),
          height: Math.max(150, prev.height + deltaY),
        }));
        setDragStartPos({ x: e.clientX, y: e.clientY });
      } else if (isDraggingAnalytics) {
        setAnalyticsDashboardPosition({
          x: e.clientX - dragStartPos.x,
          y: e.clientY - dragStartPos.y,
        });
      } else if (isResizingAnalytics) {
        const deltaX = e.clientX - dragStartPos.x;
        const deltaY = e.clientY - dragStartPos.y;
        setAnalyticsDashboardSize((prev) => ({
          width: Math.max(400, prev.width + deltaX),
          height: Math.max(300, prev.height + deltaY),
        }));
        setDragStartPos({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      if (isDraggingChat && chatOverlayRef.current) {
        // Save the final position to state when dragging ends
        const transform = chatOverlayRef.current.style.transform;
        const match = transform.match(/translate\((-?\d+)px,\s*(-?\d+)px\)/);
        if (match) {
          setChatOverlayPosition({
            x: parseInt(match[1]),
            y: parseInt(match[2]),
          });
        }
        // Reset transform
        chatOverlayRef.current.style.transform = '';
      }

      setIsDraggingChat(false);
      setIsResizingChat(false);
      setIsDraggingAnalytics(false);
      setIsResizingAnalytics(false);

      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };

    if (isDraggingChat || isResizingChat || isDraggingAnalytics || isResizingAnalytics) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [isDraggingChat, isResizingChat, isDraggingAnalytics, isResizingAnalytics, dragStartPos, chatOverlayPosition, analyticsDashboardPosition]);

  // Get layout styles based on selected layout
  const getLayoutStyles = (layoutId: number | 'screenshare') => {
    // Screen share layout overrides all other layouts
    if (layoutId === 'screenshare') {
      return {
        container: 'flex gap-2 p-2',
        sidebar: 'flex flex-col gap-2',
        sidebarWidth: 'w-[20%]',
        mainVideo: 'flex-1',
        screenShare: 'flex-1 w-[80%]',
      };
    }

    switch (layoutId) {
      case 1: // Grid 2x2
        return {
          container: 'grid grid-cols-2 grid-rows-2 gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
        };
      case 2: // Spotlight (one large, thumbnails on right)
        return {
          container: 'flex gap-2 p-2',
          mainVideo: 'flex-1',
          sidebar: 'flex flex-col gap-2 w-1/4',
        };
      case 3: // Sidebar left (narrow left, wide right)
        return {
          container: 'flex gap-2 p-2',
          sidebar: 'flex flex-col gap-2 w-1/4',
          mainVideo: 'flex-1',
        };
      case 4: // Picture-in-picture
        return {
          container: 'relative',
          mainVideo: 'absolute inset-0',
          pip: 'absolute bottom-4 right-4 w-1/4 h-1/4',
        };
      case 5: // Vertical split 50/50
        return {
          container: 'flex gap-2 p-2',
          mainVideo: 'flex-1',
        };
      case 6: // Horizontal split 50/50
        return {
          container: 'flex flex-col gap-2 p-2',
          mainVideo: 'flex-1',
        };
      case 7: // Grid 3x3
        return {
          container: 'grid grid-cols-3 grid-rows-3 gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
        };
      case 8: // Grid 2x2 (larger)
        return {
          container: 'grid grid-cols-2 grid-rows-2 gap-4 p-4',
          mainVideo: 'col-span-1 row-span-1',
        };
      case 9: // Full screen (single)
      default:
        return {
          container: 'relative',
          mainVideo: 'absolute inset-0',
        };
    }
  };

  // Layout Icon Renderer
  const renderLayoutIcon = (layoutId: number) => {
    const iconProps = { className: "w-8 h-8", fill: "currentColor", viewBox: "0 0 24 24" };

    switch (layoutId) {
      case 1: // Grid 2x2
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="9" height="9" rx="1" />
            <rect x="13" y="2" width="9" height="9" rx="1" />
            <rect x="2" y="13" width="9" height="9" rx="1" />
            <rect x="13" y="13" width="9" height="9" rx="1" />
          </svg>
        );
      case 2: // Spotlight (one large, thumbnails on right)
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="13" height="20" rx="1" />
            <rect x="17" y="2" width="5" height="6" rx="1" />
            <rect x="17" y="9" width="5" height="6" rx="1" />
            <rect x="17" y="16" width="5" height="6" rx="1" />
          </svg>
        );
      case 3: // Sidebar left
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="7" height="20" rx="1" />
            <rect x="11" y="2" width="11" height="20" rx="1" />
          </svg>
        );
      case 4: // Picture-in-picture
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="20" rx="1" />
            <rect x="13" y="13" width="7" height="7" rx="1" fill="white" />
          </svg>
        );
      case 5: // Vertical split
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="9" height="20" rx="1" />
            <rect x="13" y="2" width="9" height="20" rx="1" />
          </svg>
        );
      case 6: // Horizontal split
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="9" rx="1" />
            <rect x="2" y="13" width="20" height="9" rx="1" />
          </svg>
        );
      case 7: // Grid 3x3
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="6" height="6" rx="1" />
            <rect x="9" y="2" width="6" height="6" rx="1" />
            <rect x="16" y="2" width="6" height="6" rx="1" />
            <rect x="2" y="9" width="6" height="6" rx="1" />
            <rect x="9" y="9" width="6" height="6" rx="1" />
            <rect x="16" y="9" width="6" height="6" rx="1" />
            <rect x="2" y="16" width="6" height="6" rx="1" />
            <rect x="9" y="16" width="6" height="6" rx="1" />
            <rect x="16" y="16" width="6" height="6" rx="1" />
          </svg>
        );
      case 8: // Corner layout (4 corners)
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="8" height="8" rx="1" />
            <rect x="14" y="2" width="8" height="8" rx="1" />
            <rect x="2" y="14" width="8" height="8" rx="1" />
            <rect x="14" y="14" width="8" height="8" rx="1" />
          </svg>
        );
      case 9: // Full screen single
        return (
          <svg {...iconProps}>
            <rect x="2" y="2" width="20" height="20" rx="1" />
          </svg>
        );
      default:
        return <span className="text-white text-xs">{layoutId}</span>;
    }
  };

  // Clip Recording Handlers
  const handleCreateClip = async (duration: 30 | 60) => {
    try {
      if (!clipRecordingService.isActive()) {
        toast.error('Clip recording buffer not active');
        return;
      }

      const bufferDuration = clipRecordingService.getBufferDuration();
      if (bufferDuration < duration) {
        toast.error(`Not enough buffer (${bufferDuration}s available, ${duration}s requested)`);
        return;
      }

      setShowClipDurationSelector(false);
      toast.loading('Creating clip...', { id: 'clip-creation' });

      const clipData = await clipRecordingService.createClip(duration);

      // Save to file system
      clipRecordingService.saveClip(clipData, `streamlick-clip-${duration}s-${Date.now()}.webm`);

      toast.success(`${duration}s clip saved!`, { id: 'clip-creation' });
    } catch (error) {
      console.error('Failed to create clip:', error);
      toast.error('Failed to create clip', { id: 'clip-creation' });
    }
  };

  // Manage clip recording buffer lifecycle
  useEffect(() => {
    if (clipRecordingEnabled && localStream && compositorService.getOutputStream()) {
      const stream = compositorService.getOutputStream() || localStream;
      clipRecordingService.startBuffer(stream, { bufferDuration: 60 })
        .then(() => {
          toast.success('Clip recording buffer started (60s rolling buffer)');
        })
        .catch((error) => {
          console.error('Failed to start clip buffer:', error);
          toast.error('Failed to start clip recording buffer');
          setClipRecordingEnabled(false);
        });
    } else if (!clipRecordingEnabled && clipRecordingService.isActive()) {
      clipRecordingService.stopBuffer();
      toast.success('Clip recording buffer stopped');
    }

    return () => {
      if (clipRecordingService.isActive()) {
        clipRecordingService.stopBuffer();
      }
    };
  }, [clipRecordingEnabled, localStream]);

  // Manage AI captions lifecycle
  useEffect(() => {
    if (captionsEnabled) {
      if (!captionService.isSupported()) {
        toast.error('Speech recognition not supported in this browser');
        setCaptionsEnabled(false);
        return;
      }

      captionService.onCaption((caption: Caption) => {
        setCurrentCaption(caption);

        // Clear interim captions after 3 seconds
        if (!caption.isFinal) {
          setTimeout(() => {
            setCurrentCaption((prev) => {
              if (prev && !prev.isFinal && prev.text === caption.text) {
                return null;
              }
              return prev;
            });
          }, 3000);
        } else {
          // Clear final captions after 5 seconds
          setTimeout(() => {
            setCurrentCaption((prev) => {
              if (prev && prev.isFinal && prev.text === caption.text) {
                return null;
              }
              return prev;
            });
          }, 5000);
        }
      });

      captionService.onError((error: string) => {
        console.error('Caption error:', error);
        if (error !== 'no-speech' && error !== 'aborted') {
          toast.error(`Caption error: ${error}`);
        }
      });

      captionService.start({ language: captionLanguage });
      toast.success(`AI Captions started (${POPULAR_LANGUAGES.find(l => l.code === captionLanguage)?.name})`);
    } else if (!captionsEnabled && captionService.active()) {
      captionService.stop();
      setCurrentCaption(null);
      toast.success('AI Captions stopped');
    }

    return () => {
      if (captionService.active()) {
        captionService.stop();
      }
    };
  }, [captionsEnabled, captionLanguage]);

  // Update video srcObject when localStream changes (prevents video element recreation)
  useEffect(() => {
    if (mainVideoRef.current && localStream) {
      mainVideoRef.current.srcObject = localStream;
    }
    if (sidebarVideoRef.current && localStream) {
      sidebarVideoRef.current.srcObject = localStream;
    }
  }, [localStream]);

  // Update screen share video srcObject
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream]);

  // Manage Smart Background Removal lifecycle
  useEffect(() => {
    if (backgroundRemovalEnabled && localStream) {
      const startBackgroundRemoval = async () => {
        try {
          // Load model if not already loaded
          if (!backgroundRemovalService.isModelLoaded()) {
            toast.loading('Loading AI background model...', { id: 'bg-model' });
            await backgroundRemovalService.loadModel();
            toast.success('Background removal ready', { id: 'bg-model' });
          }

          // Start background removal
          const outputStream = await backgroundRemovalService.start(
            localStream,
            backgroundRemovalOptions
          );
          setProcessedStream(outputStream);
          toast.success(`Background ${backgroundRemovalOptions.type} enabled`);
        } catch (error) {
          console.error('Failed to start background removal:', error);
          toast.error('Failed to enable background removal');
          setBackgroundRemovalEnabled(false);
        }
      };

      startBackgroundRemoval();
    } else if (!backgroundRemovalEnabled && backgroundRemovalService.isActive()) {
      backgroundRemovalService.stop();
      setProcessedStream(null);
      toast.success('Background removal stopped');
    }

    return () => {
      if (backgroundRemovalService.isActive()) {
        backgroundRemovalService.stop();
      }
    };
  }, [backgroundRemovalEnabled, localStream, backgroundRemovalOptions]);

  // Manage Vertical Simulcast lifecycle
  useEffect(() => {
    if (verticalSimulcastEnabled && localStream) {
      const startVerticalSimulcast = async () => {
        try {
          // Get the source stream (processed or original)
          const sourceStream = processedStream || compositorService.getOutputStream() || localStream;

          // Start vertical compositor
          const outputStream = await verticalCompositorService.start(sourceStream, {
            outputWidth: parseInt(verticalResolution.split('x')[0]),
            outputHeight: parseInt(verticalResolution.split('x')[1]),
            cropMode: 'center',
            smoothing: 0.15,
          });

          setVerticalStream(outputStream);
          toast.success(`Vertical simulcast enabled (${verticalResolution} 9:16)`);
        } catch (error) {
          console.error('Failed to start vertical simulcast:', error);
          toast.error('Failed to enable vertical simulcast');
          setVerticalSimulcastEnabled(false);
        }
      };

      startVerticalSimulcast();
    } else if (!verticalSimulcastEnabled && verticalCompositorService.active()) {
      verticalCompositorService.stop();
      setVerticalStream(null);
      toast.success('Vertical simulcast stopped');
    }

    return () => {
      if (verticalCompositorService.active()) {
        verticalCompositorService.stop();
      }
    };
  }, [verticalSimulcastEnabled, localStream, processedStream, verticalResolution]);

  // Manage Analytics lifecycle
  useEffect(() => {
    if (analyticsEnabled) {
      analyticsService.startTracking();
      toast.success('Analytics tracking started');

      // Update metrics every 10 seconds
      const metricsInterval = setInterval(() => {
        setAnalyticsMetrics(analyticsService.getEngagementMetrics());
        setAnalyticsInsights(analyticsService.generateInsights());
      }, 10000);

      return () => {
        clearInterval(metricsInterval);
        analyticsService.stopTracking();
      };
    } else if (!analyticsEnabled && analyticsService.active()) {
      analyticsService.stopTracking();
      toast.success('Analytics tracking stopped');
    }
  }, [analyticsEnabled]);

  // Simulate viewer events for analytics (demo purposes)
  useEffect(() => {
    if (!analyticsEnabled) return;

    // Simulate a viewer joining
    const viewerId = `viewer-${Math.random().toString(36).substr(2, 9)}`;
    analyticsService.recordViewerJoin(viewerId, { source: 'demo' });

    // Simulate random engagement events
    const engagementInterval = setInterval(() => {
      if (Math.random() > 0.7) {
        analyticsService.recordEngagement(viewerId, 'chat', { message: 'Demo engagement' });
      }
    }, 15000);

    return () => {
      clearInterval(engagementInterval);
      analyticsService.recordViewerLeave(viewerId);
    };
  }, [analyticsEnabled]);

  // Chat Layout Handlers
  // Lower Third Handlers
  const handleShowLowerThird = (name: string, title: string) => {
    setLowerThirdText({ name, title });
    setShowLowerThird(true);
  };

  const handleHideLowerThird = () => {
    setShowLowerThird(false);
  };

  const allParticipants = [
    {
      id: 'local',
      name: 'You',
      stream: localStream,
      isLocal: true,
      isMuted: !audioEnabled,
      role: 'host' as const, // Local user is always the host
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white text-xl">Loading studio...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden flex flex-col" style={{
      backgroundColor: '#1a1a1a'
    }}>
      {/* Top Bar - 60px fixed height */}
      <header style={{
        height: '60px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '24px',
        paddingRight: '24px',
        zIndex: 1000,
        flexShrink: 0
      }}>
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-4">
            <h1 style={{ width: '140px', fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>
              Streamlick
            </h1>
            {isLive && (
              <div className="flex items-center gap-2">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-red-500 text-sm font-semibold">LIVE</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="text-white text-sm">{broadcast?.title || 'Untitled Broadcast'}</span>
            <button
              onClick={() => setShowProducerMode(true)}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
              title="Producer Mode"
            >
              Producer Mode
            </button>
            <button
              onClick={() => setShowInviteDrawer(true)}
              className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Invite Guests
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="text-gray-300 hover:text-white"
              title="Settings"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
            {!isLive ? (
              <Button onClick={handleGoLive} variant="primary" size="lg" disabled={isInitializing}>
                {isInitializing ? 'Initializing...' : 'Go Live'}
              </Button>
            ) : (
              <Button onClick={handleEndBroadcast} variant="danger" size="lg">
                End Broadcast
              </Button>
            )}
          </div>
        </div>
      </header>


      {/* Body Container - Contains main content + right sidebar, with left sidebar overlaying */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar - Scenes (280px width) - Always rendered, slides in/out with transform, overlays content */}
        <aside
          ref={leftSidebarRef}
          className="flex flex-col overflow-hidden border-r absolute left-0 top-0 bottom-0 z-[850]"
          style={{
            width: '280px',
            backgroundColor: '#f5f5f5',
            borderColor: '#e0e0e0',
            transform: leftSidebarOpen ? 'translateX(0)' : 'translateX(-280px)',
            transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: leftSidebarOpen ? '4px 0 12px rgba(0, 0, 0, 0.1)' : 'none'
          }}
          aria-expanded={leftSidebarOpen}
          aria-label="Scenes Panel"
        >
        <div
          className="sticky top-0 flex items-center justify-between px-4 border-b bg-white"
          style={{ height: '56px', borderColor: '#e0e0e0' }}
        >
          <h3 className="text-sm font-semibold text-gray-800">Scenes</h3>
          <button
            onClick={handleLeftSidebarToggle}
            className="text-gray-600 hover:text-gray-900"
            aria-label="Close Scenes Panel"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              style={{
                transform: leftSidebarOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
              }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {/* Scene Manager Component Would Go Here */}
          {showSceneManager && (
            <SceneManager
              scenes={scenes}
              currentSceneId={currentSceneId}
              onSceneChange={handleSceneChange}
              onSceneCreate={handleSceneCreate}
              onSceneUpdate={handleSceneUpdate}
              onSceneDelete={handleSceneDelete}
              onSceneDuplicate={handleSceneDuplicate}
            />
          )}

          {/* Default scene card */}
          <div
            className="bg-white rounded shadow hover:shadow-md transition-shadow cursor-pointer border"
            style={{ height: '180px', borderColor: '#e0e0e0' }}
          >
            <div className="h-full flex flex-col p-3">
              <div className="flex-1 bg-black rounded mb-2 relative overflow-hidden">
                {localStream && videoEnabled && (
                  <video
                    ref={sidebarVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ willChange: 'auto' }}
                  />
                )}
              </div>
              <p className="text-xs text-gray-700 font-medium">Default Scene</p>
            </div>
          </div>
        </div>
      </aside>

        {/* Main Canvas Area */}
        <main
          className="flex-1 flex flex-col overflow-hidden"
          style={{ backgroundColor: '#1a1a1a' }}
        >
        {/* Canvas Container - 16:9 aspect ratio, max-width 1920px */}
        <div className="flex-1 flex items-center justify-center p-6">
          <div
            className="relative bg-black"
            style={{
              width: '100%',
              maxWidth: '1920px',
              aspectRatio: '16 / 9'
            }}
          >
            {/* Main Video Preview with Dynamic Layout */}
            <div
              className={`absolute inset-0 overflow-hidden ${getLayoutStyles(isSharingScreen || screenShareStream ? 'screenshare' : selectedLayout).container}`}
              style={{ backgroundColor: '#000000' }}
            >
              {/* Screen Share Layout - Active when screen sharing */}
              {(isSharingScreen || screenShareStream) ? (
                <>
                  {/* Left Sidebar - Participant Thumbnails (20%) */}
                  <div className={`${getLayoutStyles('screenshare').sidebar} ${getLayoutStyles('screenshare').sidebarWidth} gap-2`}>
                    {/* Host Video */}
                    <div className="relative bg-black rounded overflow-hidden flex-1">
                      {localStream && videoEnabled ? (
                        <video
                          ref={mainVideoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full h-full object-cover"
                          style={{ willChange: 'auto' }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <div className="text-center">
                            <svg className="w-8 h-8 text-gray-600 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                            </svg>
                          </div>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                        <span className="text-white text-xs font-medium">You</span>
                      </div>
                    </div>

                    {/* Remote Participants - Up to 4 slots */}
                    {Array.from(remoteParticipants.values())
                      .filter((p) => p.id !== 'screen-share')
                      .slice(0, 4)
                      .map((participant) => (
                        <div key={participant.id} className="relative bg-gray-900 rounded overflow-hidden flex-1">
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
                            <div className="w-full h-full flex items-center justify-center">
                              <svg className="w-8 h-8 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                            <span className="text-white text-xs font-medium truncate">{participant.name}</span>
                          </div>
                        </div>
                      ))}
                  </div>

                  {/* Right Side - Screen Share (80%) */}
                  <div className={`relative bg-black rounded overflow-hidden ${getLayoutStyles('screenshare').screenShare}`}>
                    {screenShareStream ? (
                      <video
                        ref={screenShareVideoRef}
                        autoPlay
                        playsInline
                        className="w-full h-full object-contain"
                        style={{ willChange: 'auto', backgroundColor: '#000' }}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-16 h-16 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                          </svg>
                          <p className="text-gray-500 text-sm">Screen Share</p>
                        </div>
                      </div>
                    )}
                    <div className="absolute top-2 left-2 bg-blue-600 px-3 py-1 rounded text-white text-xs font-semibold">
                      🖥️ Screen Sharing
                    </div>
                  </div>
                </>
              ) : (
                <>
                  {/* Normal Layout - When not screen sharing */}
                  {/* Main Video */}
                  <div className={`relative bg-black rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}>
                {localStream && videoEnabled ? (
                  <video
                    ref={mainVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ willChange: 'auto' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-16 h-16 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <p className="text-gray-500 text-sm">Camera Off</p>
                    </div>
                  </div>
                )}
                {/* Video Label */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white text-xs font-medium">You (Host)</span>
                  </div>
                </div>
              </div>

              {/* Additional video slots for grid layouts */}
              {(selectedLayout === 1 || selectedLayout === 8) && (
                <>
                  {[1, 2, 3].map((slot) => (
                    <div key={slot} className={`relative bg-gray-900 rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}>
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-12 h-12 text-gray-700 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-gray-600 text-xs">Empty Slot</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* 3x3 Grid Layout */}
              {selectedLayout === 7 && (
                <>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
                    <div key={slot} className={`relative bg-gray-900 rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}>
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-gray-700 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <p className="text-gray-600 text-xs">Empty</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}

              {/* Sidebar layout with thumbnails (2) */}
              {selectedLayout === 2 && (
                <div className={getLayoutStyles(selectedLayout).sidebar}>
                  {[1, 2, 3].map((slot) => (
                    <div key={slot} className="relative bg-gray-900 rounded overflow-hidden flex-1">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-gray-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Vertical split 50/50 (5) */}
              {selectedLayout === 5 && (
                <div className="relative bg-gray-900 rounded overflow-hidden flex-1">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-700 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-gray-600 text-xs">Empty Slot</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Sidebar left layout (3) */}
              {selectedLayout === 3 && (
                <div className={getLayoutStyles(selectedLayout).sidebar} style={{ order: -1 }}>
                  {[1, 2, 3].map((slot) => (
                    <div key={slot} className="relative bg-gray-900 rounded overflow-hidden flex-1">
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg className="w-8 h-8 text-gray-700 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Horizontal split layout (6) */}
              {selectedLayout === 6 && (
                <div className="relative bg-gray-900 rounded overflow-hidden flex-1">
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg className="w-12 h-12 text-gray-700 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <p className="text-gray-600 text-xs">Empty Slot</p>
                    </div>
                  </div>
                </div>
              )}
                </>
              )}

              {/* Resolution Badge - Centered Top (only show when not screen sharing) */}
              {!isSharingScreen && !screenShareStream && (
                <div
                  className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    backdropFilter: 'blur(8px)'
                  }}
                >
                  1080p HD
                </div>
              )}

              {/* On-Screen Chat Overlay - Draggable & Resizable */}
              {showChatOnStream && (
                <div
                  ref={chatOverlayRef}
                  className="absolute bg-black/80 backdrop-blur-sm rounded-lg overflow-hidden"
                  style={{
                    left: chatOverlayPosition.x ? `${chatOverlayPosition.x}px` : 'auto',
                    top: chatOverlayPosition.y ? `${chatOverlayPosition.y}px` : 'auto',
                    right: chatOverlayPosition.x ? 'auto' : '16px',
                    bottom: chatOverlayPosition.y ? 'auto' : '80px',
                    width: `${chatOverlaySize.width}px`,
                    height: `${chatOverlaySize.height}px`,
                    cursor: isDraggingChat ? 'grabbing' : 'default',
                    willChange: isDraggingChat ? 'transform' : 'auto',
                  }}
                >
                  {/* Drag Handle */}
                  <div
                    onMouseDown={handleChatOverlayDragStart}
                    className="bg-gray-800/50 px-3 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-gray-700"
                  >
                    <span className="text-white text-xs font-semibold">Live Chat</span>
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
                    </svg>
                  </div>

                  {/* Chat Messages */}
                  <div className="p-3 overflow-y-auto" style={{ height: `calc(100% - 50px)` }}>
                    <div className="space-y-2">
                      {chatMessages.slice(-10).map((msg, i) => (
                        <div key={i} className="text-white text-sm">
                          <span className="font-semibold">{msg.author}:</span> {msg.message}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Resize Handle */}
                  <div
                    onMouseDown={handleChatOverlayResizeStart}
                    className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
                    style={{
                      background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%)',
                    }}
                  />
                </div>
              )}

              {/* AI Caption Overlay */}
              {captionsEnabled && <CaptionOverlayMemo caption={currentCaption} />}
            </div>
          </div>
        </div>

        {/* Layout Bar - 72px height */}
        <div
          className="flex items-center justify-center gap-2 border-t px-4 overflow-x-auto"
          style={{
            height: '72px',
            backgroundColor: '#2d2d2d',
            borderColor: '#404040'
          }}
        >
          {/* 9 Layout Buttons */}
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((layoutId) => (
            <button
              key={layoutId}
              onClick={() => setSelectedLayout(layoutId)}
              className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0 text-white"
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: selectedLayout === layoutId ? '#0066ff' : '#3d3d3d'
              }}
              title={`Layout ${layoutId}`}
            >
              {renderLayoutIcon(layoutId)}
            </button>
          ))}
        </div>

        {/* Bottom Control Bar - 80px height */}
        <div
          className="flex items-center justify-between px-6 border-t"
          style={{
            height: '80px',
            backgroundColor: '#2d2d2d',
            borderColor: '#404040'
          }}
        >
          {/* Left Section */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowDestinationsDrawer(true)}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Destinations
            </button>
            <button
              onClick={() => setShowBannerDrawer(true)}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Banners
            </button>
            <button
              onClick={() => setShowBrandDrawer(true)}
              className="px-4 py-2 rounded bg-gray-700 hover:bg-gray-600 text-white text-sm transition-colors"
            >
              Brand
            </button>

            {/* Killer Features */}
            <div className="h-8 w-px bg-gray-600" />
            {/* AI Captions with language selector */}
            <div className="relative flex items-center">
              <button
                onClick={() => setCaptionsEnabled(!captionsEnabled)}
                className={`p-2 rounded-l ${
                  captionsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title={captionsEnabled ? 'Stop AI Captions' : 'Start AI Captions'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                </svg>
              </button>
              <button
                onClick={() => setShowLanguageSelector(!showLanguageSelector)}
                className={`p-2 pr-3 rounded-r border-l border-gray-600 ${
                  captionsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title="Select Language"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setClipRecordingEnabled(!clipRecordingEnabled)}
              className={`p-2 rounded ${
                clipRecordingEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title={clipRecordingEnabled ? 'Stop Clip Buffer' : 'Start Clip Buffer (60s rolling)'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </button>
            {clipRecordingEnabled && (
              <button
                onClick={() => setShowClipDurationSelector(true)}
                className="px-3 py-2 rounded bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors animate-pulse"
                title="Create instant clip"
              >
                ✂️ Create Clip
              </button>
            )}
            <button
              onClick={() => setShowClipManager(true)}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Clip Manager"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
            {/* Smart Background Removal with settings dropdown */}
            <div className="relative flex items-center">
              <button
                onClick={() => setBackgroundRemovalEnabled(!backgroundRemovalEnabled)}
                className={`p-2 rounded-l ${
                  backgroundRemovalEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title={backgroundRemovalEnabled ? 'Disable Background Removal' : 'Enable Smart Background Removal'}
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => setShowBackgroundSettings(!showBackgroundSettings)}
                className={`p-2 pr-3 rounded-r border-l border-gray-600 ${
                  backgroundRemovalEnabled ? 'bg-purple-600 hover:bg-purple-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title="Background Removal Settings"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => setVerticalSimulcastEnabled(!verticalSimulcastEnabled)}
              className={`p-2 rounded ${
                verticalSimulcastEnabled ? 'bg-pink-600 hover:bg-pink-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title={verticalSimulcastEnabled ? 'Disable Vertical Simulcast' : 'Enable Vertical Simulcast (9:16)'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
            <button
              onClick={() => {
                setAnalyticsEnabled(!analyticsEnabled);
                if (!analyticsEnabled) {
                  setShowAnalyticsDashboard(true);
                }
              }}
              className={`p-2 rounded ${
                analyticsEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title={analyticsEnabled ? 'Disable Analytics' : 'Enable Analytics Dashboard'}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </button>
          </div>

          {/* Center Section - Media Controls */}
          <div className="flex items-center gap-3">
            {/* Microphone with device selector */}
            <div ref={micButtonRef} className="relative flex items-center">
              <button
                onClick={toggleAudio}
                className={`p-3 rounded-l-full ${
                  audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                } text-white transition-colors`}
                title={audioEnabled ? 'Mute' : 'Unmute'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowMicSelector(!showMicSelector);
                  setShowCameraSelector(false);
                  setShowSpeakerSelector(false);
                }}
                className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
                  audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
                } text-white transition-colors`}
                title="Select Microphone"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {/* Speaker with device selector */}
            <div ref={speakerButtonRef} className="relative flex items-center">
              <button
                onClick={toggleSpeaker}
                className={`p-3 rounded-l-full ${
                  speakerMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title={speakerMuted ? 'Unmute Speaker' : 'Mute Speaker'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  {speakerMuted ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  )}
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowSpeakerSelector(!showSpeakerSelector);
                  setShowMicSelector(false);
                  setShowCameraSelector(false);
                }}
                className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
                  speakerMuted ? 'bg-red-600 hover:bg-red-700' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title="Select Speaker"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            {/* Camera with device selector */}
            <div ref={cameraButtonRef} className="relative flex items-center">
              <button
                onClick={toggleVideo}
                className={`p-3 rounded-l-full ${
                  videoEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } text-white transition-colors`}
                title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
              <button
                onClick={() => {
                  setShowCameraSelector(!showCameraSelector);
                  setShowMicSelector(false);
                  setShowSpeakerSelector(false);
                }}
                className={`p-3 pr-4 rounded-r-full border-l border-gray-600 ${
                  videoEnabled ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } text-white transition-colors`}
                title="Select Camera"
              >
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <button
              onClick={isSharingScreen ? stopScreenShare : startScreenShare}
              className={`p-3 rounded-full ${
                isSharingScreen ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title={isSharingScreen ? 'Stop Screen Share' : 'Share Screen'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Right Section - Removed buttons moved to header */}
          <div className="flex items-center gap-3">
          </div>
        </div>
        </main>

        {/* Right Sidebar - Persistent Buttons (64px) + Expandable Panel (320px total when open) - Always rendered */}
        <aside
          ref={rightSidebarRef}
          className="flex overflow-hidden border-l flex-shrink-0"
          style={{
            width: rightSidebarOpen ? '320px' : '64px',
            backgroundColor: '#f8f8f8',
            borderColor: '#e0e0e0',
            zIndex: 800,
            transition: 'width 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          aria-expanded={rightSidebarOpen}
          aria-label="Tabbed Panels"
        >
        {/* Persistent Button Bar - Always Visible */}
        <div
          className="flex flex-col border-r"
          style={{
            width: '64px',
            backgroundColor: '#f8f8f8',
            borderColor: '#e0e0e0'
          }}
        >
          <button
            onClick={() => handleRightSidebarToggle('comments')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Comments Panel"
            aria-expanded={activeRightTab === 'comments'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'comments' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            <span className="text-xs font-medium">Chat</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('banners')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Banners Panel"
            aria-expanded={activeRightTab === 'banners'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'banners' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Banner</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('media')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Media Panel"
            aria-expanded={activeRightTab === 'media'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'media' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Media</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('style')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Style Panel"
            aria-expanded={activeRightTab === 'style'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'style' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            <span className="text-xs font-medium">Style</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('notes')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Notes Panel"
            aria-expanded={activeRightTab === 'notes'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'notes' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            <span className="text-xs font-medium">Notes</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('people')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="People Panel"
            aria-expanded={activeRightTab === 'people'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'people' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            <span className="text-xs font-medium">People</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('chat')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Private Chat Panel"
            aria-expanded={activeRightTab === 'chat'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'chat' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
            <span className="text-xs font-medium">Private</span>
          </button>

          <button
            onClick={() => handleRightSidebarToggle('recording')}
            className="flex flex-col items-center justify-center py-4 border-b transition-colors hover:bg-gray-100"
            aria-label="Recording Panel"
            aria-expanded={activeRightTab === 'recording'}
            style={{
              borderBottomColor: '#e0e0e0',
              ...(activeRightTab === 'recording' ? {
                backgroundColor: '#e6f2ff',
                color: '#0066ff',
                borderLeft: '4px solid #0066ff'
              } : {
                color: '#666666'
              })
            }}
          >
            <svg className="w-5 h-5 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <span className="text-xs font-medium">Record</span>
          </button>
        </div>

        {/* Expandable Content Panel - Shows when rightSidebarOpen is true */}
        {rightSidebarOpen && activeRightTab && (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div
              className="flex items-center justify-between px-4 border-b bg-white"
              style={{ height: '56px', borderColor: '#e0e0e0' }}
            >
              <h3 className="text-sm font-semibold text-gray-800 capitalize">{activeRightTab}</h3>
              <button
                onClick={() => {
                  setRightSidebarOpen(false);
                  setActiveRightTab(null);
                }}
                className="text-gray-600 hover:text-gray-900"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Panel Content */}
            <div className="flex-1 overflow-y-auto">
              {activeRightTab === 'comments' && <CommentsPanel broadcastId={broadcastId} />}
              {activeRightTab === 'banners' && (
                <div className="p-4">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3">Banners</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Manage your stream banners and overlays. Click the button below for the full banner editor.
                  </p>
                  <button
                    onClick={() => setShowBannerDrawer(true)}
                    className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
                  >
                    Open Banner Editor
                  </button>
                </div>
              )}
              {activeRightTab === 'media' && <MediaAssetsPanel broadcastId={broadcastId} />}
              {activeRightTab === 'style' && <StylePanel broadcastId={broadcastId} />}
              {activeRightTab === 'notes' && <NotesPanel broadcastId={broadcastId} />}
              {activeRightTab === 'people' && <ParticipantsPanel />}
              {activeRightTab === 'chat' && <PrivateChatPanel broadcastId={broadcastId} currentUserId={broadcast?.userId} />}
              {activeRightTab === 'recording' && (
                <RecordingControls
                  broadcastId={broadcastId}
                />
              )}
            </div>
          </div>
        )}
        </aside>
      </div>
      {/* End Body Container */}

      {/* Toggle Button for Left Sidebar (when collapsed) */}
      {!leftSidebarOpen && (
        <button
          onClick={handleLeftSidebarToggle}
          className="fixed top-1/2 transform -translate-y-1/2 rounded-r bg-gray-700 hover:bg-gray-600 text-white shadow-lg flex items-center justify-center"
          style={{
            left: 0,
            width: '32px',
            height: '80px',
            zIndex: 900,
            transition: 'background-color 300ms cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          aria-label="Open Scenes Panel"
          aria-expanded="false"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            style={{
              transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)'
            }}
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Hotkey Reference */}
      {showHotkeyReference && <HotkeyReference />}

      {/* Hotkey Visual Feedback */}
      <HotkeyFeedback messages={hotkeyMessages} />

      {/* Media Library Modal */}
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
              <MediaLibrary onTriggerClip={handlePlayClip} />
            </div>
          </div>
        </div>
      )}

      {/* Scene Manager */}
      {showSceneManager && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Scene Manager</h2>
              <button
                onClick={() => setShowSceneManager(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
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
          </div>
        </div>
      )}

      {/* Chat Layout Customizer */}
      {showChatLayoutCustomizer && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Chat Layout Customizer</h2>
              <button
                onClick={() => setShowChatLayoutCustomizer(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-gray-300 text-center py-8">
                <h3 className="text-lg font-semibold mb-2">Chat Layout Customizer</h3>
                <p className="text-sm text-gray-500">Customize chat appearance and position on stream</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chat Moderation */}
      {showChatModeration && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-gray-700">
              <h2 className="text-2xl font-bold text-white">Chat Moderation</h2>
              <button
                onClick={() => setShowChatModeration(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <div className="text-gray-300 text-center py-8">
                <h3 className="text-lg font-semibold mb-2">Chat Moderation</h3>
                <p className="text-sm text-gray-500">Manage chat messages and moderate users</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Lower Third Overlay */}
      {showLowerThird && (
        <LowerThird
          data={{
            id: Date.now().toString(),
            name: lowerThirdText.name,
            title: lowerThirdText.title,
            duration: 5000,
            style: 'modern',
            position: 'left',
          }}
          onComplete={handleHideLowerThird}
        />
      )}

      {/* Slide-Out Drawer Panels */}
      <Drawer
        isOpen={showDestinationsDrawer}
        onClose={() => setShowDestinationsDrawer(false)}
        title="Streaming Destinations"
        size="lg"
      >
        <DestinationsPanel broadcastId={broadcastId} />
      </Drawer>

      <Drawer
        isOpen={showInviteDrawer}
        onClose={() => setShowInviteDrawer(false)}
        title="Invite Guests"
        size="md"
      >
        <InviteGuestsPanel broadcastId={broadcastId || ''} />
      </Drawer>

      <Drawer
        isOpen={showBannerDrawer}
        onClose={() => setShowBannerDrawer(false)}
        title="Banner & Overlay Editor"
        size="xl"
      >
        <BannerEditorPanel />
      </Drawer>

      <Drawer
        isOpen={showBrandDrawer}
        onClose={() => setShowBrandDrawer(false)}
        title="Brand Settings"
        size="lg"
      >
        <BrandSettingsPanel />
      </Drawer>

      <Drawer
        isOpen={showParticipantsDrawer}
        onClose={() => setShowParticipantsDrawer(false)}
        title="Manage Participants"
        size="md"
      >
        <ParticipantsPanel />
      </Drawer>

      <Drawer
        isOpen={showRecordingDrawer}
        onClose={() => setShowRecordingDrawer(false)}
        title="Recording Controls"
        size="md"
      >
        <RecordingControls broadcastId={broadcastId} />
      </Drawer>

      {/* Clip Manager Modal */}
      {showClipManager && (
        <ClipManager
          broadcastId={broadcastId}
          onClose={() => setShowClipManager(false)}
        />
      )}

      {/* Producer Mode Modal */}
      {showProducerMode && (
        <ProducerMode
          broadcastId={broadcastId}
          producerId={broadcast?.userId}
          onClose={() => setShowProducerMode(false)}
        />
      )}

      {/* Analytics Dashboard Modal */}
      {showAnalyticsDashboard && analyticsEnabled && (
        <div className="fixed inset-0 bg-black/50 z-50 pointer-events-none">
          <div
            className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
            style={{
              position: 'absolute',
              left: `${analyticsDashboardPosition.x}px`,
              top: `${analyticsDashboardPosition.y}px`,
              width: `${analyticsDashboardSize.width}px`,
              height: `${analyticsDashboardSize.height}px`,
            }}
          >
            {/* Header */}
            <div
              className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-800 cursor-move"
              onMouseDown={handleAnalyticsDashboardDragStart}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Analytics Dashboard</h2>
                  <p className="text-sm text-gray-400">Real-time stream insights & AI recommendations</p>
                </div>
              </div>
              <button
                onClick={() => setShowAnalyticsDashboard(false)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Total Viewers</div>
                  <div className="text-3xl font-bold text-white">{analyticsMetrics?.totalViewers || 0}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Current Viewers</div>
                  <div className="text-3xl font-bold text-green-400">{analyticsMetrics?.currentViewers || 0}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Peak Viewers</div>
                  <div className="text-3xl font-bold text-blue-400">{analyticsMetrics?.peakViewers || 0}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="text-sm text-gray-400 mb-1">Avg Watch Time</div>
                  <div className="text-3xl font-bold text-purple-400">
                    {Math.round((analyticsMetrics?.averageWatchTime || 0) / 60)}m
                  </div>
                </div>
              </div>

              {/* AI Insights */}
              {analyticsInsights && analyticsInsights.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI Insights & Recommendations
                  </h3>
                  <div className="space-y-3">
                    {analyticsInsights.map((insight, index) => (
                      <div
                        key={index}
                        className={`p-3 rounded-lg border ${
                          insight.type === 'warning'
                            ? 'bg-red-900/20 border-red-500'
                            : insight.type === 'success'
                            ? 'bg-green-900/20 border-green-500'
                            : 'bg-blue-900/20 border-blue-500'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <div className="flex-shrink-0">
                            {insight.type === 'warning' && (
                              <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                              </svg>
                            )}
                            {insight.type === 'success' && (
                              <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                            {insight.type === 'info' && (
                              <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <h4 className="font-semibold text-white mb-1">{insight.message}</h4>
                            <p className="text-sm text-gray-300">{insight.suggestion}</p>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                              <span className="px-2 py-1 bg-gray-700 rounded">{insight.category}</span>
                              <span>Severity: {insight.severity}/10</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Engagement Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Engagement Rate</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                          style={{ width: `${Math.min(((analyticsMetrics?.engagementRate || 0) / 3) * 100, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {((analyticsMetrics?.engagementRate || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Interactions per viewer
                  </p>
                </div>

                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <h3 className="text-lg font-semibold text-white mb-4">Drop-off Rate</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-yellow-500 to-red-500"
                          style={{ width: `${(analyticsMetrics?.dropOffRate || 0) * 100}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-2xl font-bold text-white">
                      {((analyticsMetrics?.dropOffRate || 0) * 100).toFixed(0)}%
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 mt-2">
                    Viewers who left
                  </p>
                </div>
              </div>

              {/* Heatmap Placeholder */}
              <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">Viewer Activity Heatmap</h3>
                <div className="h-32 bg-gray-700 rounded-lg flex items-center justify-center">
                  <div className="text-gray-400 text-sm">Heatmap visualization (requires charting library)</div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Shows when viewers joined/left during the stream
                </p>
              </div>
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex items-center justify-between relative">
              <div className="text-sm text-gray-400">
                Tracking duration: {Math.round(analyticsService.getStreamDuration() / 60)} minutes
              </div>
              <button
                onClick={() => setShowAnalyticsDashboard(false)}
                className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
              >
                Close
              </button>
              {/* Resize Handle */}
              <button
                onMouseDown={handleAnalyticsDashboardResizeStart}
                className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize text-gray-500 hover:text-gray-300 flex items-center justify-center"
                title="Resize"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
                  <path d="M16 16V10h-2v4h-4v2h6zM0 0v6h2V2h4V0H0z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Background Removal Settings Dropdown */}
      {showBackgroundSettings && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowBackgroundSettings(false)}
          />
          <div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl z-50"
            style={{ width: '380px', maxHeight: '500px' }}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Background Removal Settings</h3>
              <p className="text-xs text-gray-500 mt-1">Customize your virtual background effect</p>
            </div>
            <div className="overflow-y-auto max-h-96 p-4">
              <div className="space-y-4">
                {/* Background Type */}
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-2">
                    Effect Type
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="backgroundType"
                        checked={backgroundRemovalOptions.type === 'blur'}
                        onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'blur' })}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">Blur Background</p>
                        <p className="text-xs text-gray-500">Blur everything behind you</p>
                      </div>
                    </label>
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                      <input
                        type="radio"
                        name="backgroundType"
                        checked={backgroundRemovalOptions.type === 'color'}
                        onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'color' })}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">Solid Color</p>
                        <p className="text-xs text-gray-500">Replace with a solid color</p>
                      </div>
                    </label>
                    <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors opacity-50">
                      <input
                        type="radio"
                        name="backgroundType"
                        checked={backgroundRemovalOptions.type === 'image'}
                        onChange={() => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'image' })}
                        className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                        disabled
                      />
                      <div className="ml-3 flex-1">
                        <p className="text-sm font-medium text-gray-900">Custom Image</p>
                        <p className="text-xs text-gray-500">Coming soon</p>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Blur Amount */}
                {backgroundRemovalOptions.type === 'blur' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2">
                      Blur Intensity: {backgroundRemovalOptions.blurAmount}px
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="50"
                      step="1"
                      value={backgroundRemovalOptions.blurAmount || 15}
                      onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, blurAmount: parseInt(e.target.value) })}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
                    />
                    <div className="flex justify-between text-xs text-gray-500 mt-1">
                      <span>Subtle (5px)</span>
                      <span>Extreme (50px)</span>
                    </div>
                  </div>
                )}

                {/* Color Picker */}
                {backgroundRemovalOptions.type === 'color' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-900 mb-2">
                      Background Color
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={backgroundRemovalOptions.color || '#1a1a1a'}
                        onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, color: e.target.value })}
                        className="w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer"
                      />
                      <div className="flex-1">
                        <input
                          type="text"
                          value={backgroundRemovalOptions.color || '#1a1a1a'}
                          onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, color: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                          placeholder="#1a1a1a"
                        />
                        <p className="text-xs text-gray-500 mt-1">Hex color code</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Edge Softness */}
                <div>
                  <label className="block text-xs font-semibold text-gray-900 mb-2">
                    Edge Smoothing: {Math.round((backgroundRemovalOptions.edgeSoftness || 0.3) * 100)}%
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={backgroundRemovalOptions.edgeSoftness || 0.3}
                    onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, edgeSoftness: parseFloat(e.target.value) })}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider-purple"
                  />
                  <div className="flex justify-between text-xs text-gray-500 mt-1">
                    <span>Sharp</span>
                    <span>Soft</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">Higher values create smoother edges around your silhouette</p>
                </div>

                {/* Info Box */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <svg className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-xs font-semibold text-purple-900">Performance Tip</p>
                      <p className="text-xs text-purple-700 mt-1">Background removal uses AI and may impact performance on slower devices. Toggle off if experiencing lag.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50">
              <div>
                <h2 className="text-xl font-bold text-gray-900">Studio Settings</h2>
                <p className="text-sm text-gray-600 mt-1">Configure your audio and video devices</p>
              </div>
              <button
                onClick={() => setShowSettings(false)}
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
                              onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'blur' })}
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
                              onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'color' })}
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
                              onChange={(e) => setBackgroundRemovalOptions({ ...backgroundRemovalOptions, type: 'image' })}
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
                              onChange={(e) => setVerticalResolution('1080x1920')}
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
                              onChange={(e) => setVerticalResolution('720x1280')}
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
                              onChange={(e) => setVerticalResolution('540x960')}
                              className="w-4 h-4 text-pink-600"
                            />
                            <span className="text-sm text-gray-700">540x960 (SD)</span>
                          </label>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                          Higher resolutions look better but require more processing power
                        </p>
                      </div>

                      {/* Info Box */}
                      <div className="bg-pink-50 border border-pink-200 rounded-lg p-3">
                        <div className="flex gap-2">
                          <svg className="w-5 h-5 text-pink-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <div className="text-xs text-gray-700">
                            <p className="font-medium mb-1">How it works:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              <li>Auto-crops 16:9 to 9:16 format</li>
                              <li>Centers on action with smooth panning</li>
                              <li>Perfect for vertical social media</li>
                            </ul>
                          </div>
                        </div>
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

                      {/* Info Box */}
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                        <div className="flex gap-2">
                          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                          <div className="text-xs text-gray-700">
                            <p className="font-medium mb-1">AI-Powered Insights:</p>
                            <ul className="list-disc list-inside space-y-0.5">
                              <li>Viewer engagement analysis</li>
                              <li>Drop-off rate detection</li>
                              <li>Content pacing recommendations</li>
                              <li>Real-time heatmaps</li>
                            </ul>
                          </div>
                        </div>
                      </div>
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
                  navigator.mediaDevices.enumerateDevices().then((devices) => {
                    setAudioDevices(devices.filter((d) => d.kind === 'audioinput'));
                    setVideoDevices(devices.filter((d) => d.kind === 'videoinput'));
                  });
                }}
                className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
              >
                Refresh Devices
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clip Duration Selector Popup */}
      {showClipDurationSelector && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="text-2xl">✂️</span>
                <h2 className="text-xl font-bold text-gray-900">Create Instant Clip</h2>
              </div>
              <button
                onClick={() => setShowClipDurationSelector(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <p className="text-sm text-gray-600 mb-6">
              Select clip duration to capture the last 30 or 60 seconds from the rolling buffer.
            </p>

            {/* Buffer Status */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <div className="flex items-center gap-2 text-sm text-blue-800">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>
                  Buffer: {clipRecordingService.getBufferDuration()}s available
                </span>
              </div>
            </div>

            {/* Duration Buttons */}
            <div className="grid grid-cols-2 gap-4 mb-6">
              <button
                onClick={() => handleCreateClip(30)}
                disabled={clipRecordingService.getBufferDuration() < 30}
                className={`py-6 px-4 rounded-lg border-2 transition-all ${
                  clipRecordingService.getBufferDuration() >= 30
                    ? 'border-green-500 bg-green-50 hover:bg-green-100 hover:border-green-600'
                    : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">30s</div>
                  <div className="text-xs text-gray-600">Last 30 seconds</div>
                </div>
              </button>

              <button
                onClick={() => handleCreateClip(60)}
                disabled={clipRecordingService.getBufferDuration() < 60}
                className={`py-6 px-4 rounded-lg border-2 transition-all ${
                  clipRecordingService.getBufferDuration() >= 60
                    ? 'border-purple-500 bg-purple-50 hover:bg-purple-100 hover:border-purple-600'
                    : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                }`}
              >
                <div className="text-center">
                  <div className="text-3xl font-bold text-gray-900 mb-1">60s</div>
                  <div className="text-xs text-gray-600">Last 60 seconds</div>
                </div>
              </button>
            </div>

            {/* Footer Note */}
            <p className="text-xs text-gray-500 text-center">
              Clips are automatically saved to your downloads folder
            </p>
          </div>
        </div>
      )}

      {/* Language Selector Popup */}
      {showLanguageSelector && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowLanguageSelector(false)}
          />
          <div
            className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl z-50"
            style={{ width: '400px', maxHeight: '500px' }}
          >
            <div className="p-4 border-b border-gray-200">
              <h3 className="text-sm font-semibold text-gray-900">Select Caption Language</h3>
              <p className="text-xs text-gray-500 mt-1">Choose language for real-time transcription</p>
            </div>
            <div className="overflow-y-auto max-h-96 p-2">
              {POPULAR_LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => {
                    setCaptionLanguage(lang.code);
                    setShowLanguageSelector(false);
                    if (captionsEnabled) {
                      captionService.changeLanguage(lang.code);
                      toast.success(`Language changed to ${lang.name}`);
                    }
                  }}
                  className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors rounded ${
                    captionLanguage === lang.code ? 'bg-blue-50 border border-blue-200' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">{lang.flag}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{lang.name}</p>
                      <p className="text-xs text-gray-500">{lang.code}</p>
                    </div>
                    {captionLanguage === lang.code && (
                      <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
