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
  role: 'host' | 'guest' | 'backstage'; // host=always live, guest=live, backstage=waiting
}

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
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [activeRightTab, setActiveRightTab] = useState<'comments' | 'banners' | 'media' | 'style' | 'notes' | 'people' | 'chat' | 'recording'>('chat');
  const [selectedLayout, setSelectedLayout] = useState<number>(1);

  // Settings modal state
  const [showSettings, setShowSettings] = useState(false);
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState<string>('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState<string>('');

  // Killer features state
  const [showClipManager, setShowClipManager] = useState(false);
  const [showProducerMode, setShowProducerMode] = useState(false);
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [clipRecordingEnabled, setClipRecordingEnabled] = useState(false);

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

        // Start camera
        await startCamera();

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

        // Remove screen share from compositor
        compositorService.removeParticipant('screen-share');

        toast.success('Screen sharing stopped');
      } else {
        // Start screen sharing
        const stream = await startScreenShare();
        setIsSharingScreen(true);

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
          compositorService.removeParticipant('screen-share');
          toast.success('Screen sharing stopped');
        };

        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
      setIsSharingScreen(false);
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
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading studio...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen overflow-hidden grid" style={{
      gridTemplateRows: '60px 1fr',
      gridTemplateColumns: leftSidebarOpen && rightSidebarOpen
        ? '280px 1fr 320px'
        : leftSidebarOpen
        ? '280px 1fr 0px'
        : rightSidebarOpen
        ? '0px 1fr 320px'
        : '0px 1fr 0px',
      backgroundColor: '#1a1a1a'
    }}>
      {/* Top Bar - 60px fixed height */}
      <header style={{
        gridColumn: '1 / -1',
        height: '60px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '24px',
        paddingRight: '24px',
        zIndex: 1000
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

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-gray-800 border-r border-gray-700 p-4 overflow-y-auto">
          <div className="space-y-6">
            {/* Destinations */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Stream Destinations</h3>
              <div className="space-y-2">
                {destinations.length === 0 ? (
                  <p className="text-sm text-gray-500">No destinations configured</p>
                ) : (
                  destinations.map((dest) => {
                    const platformIcons: Record<string, string> = {
                      youtube: '📺',
                      facebook: '👥',
                      linkedin: '💼',
                      twitch: '🎮',
                      x: '𝕏',
                      rumble: '🎬',
                      custom: '📡',
                    };
                    const icon = platformIcons[dest.platform as keyof typeof platformIcons] || '📡';

                    return (
                      <label
                        key={dest.id}
                        className="flex items-center gap-2 text-sm text-gray-300 hover:bg-gray-700 p-2 rounded transition-colors cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={selectedDestinations.includes(dest.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDestinations([...selectedDestinations, dest.id]);
                            } else {
                              setSelectedDestinations(selectedDestinations.filter((id) => id !== dest.id));
                            }
                          }}
                          className="rounded"
                          disabled={isLive}
                        />
                        <span className="text-base">{icon}</span>
                        <span className="flex-1 truncate">{dest.displayName || dest.platform}</span>
                      </label>
                    );
                  })
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate('/settings?tab=destinations')}
                  className="w-full mt-2"
                >
                  + Add Destination
                </Button>
              </div>
            </div>

            {/* Participants */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Participants ({allParticipants.length})
              </h3>

              {/* Live Participants */}
              <div className="mb-4">
                <div className="text-xs font-semibold text-green-400 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-green-400 rounded-full"></span>
                  LIVE ({allParticipants.filter((p) => p.role === 'host' || p.role === 'guest').length})
                </div>
                <div className="space-y-2">
                  {allParticipants
                    .filter((p) => p.role === 'host' || p.role === 'guest')
                    .map((p) => {
                      const isExpanded = selectedParticipant === p.id;
                      const volume = participantVolumes.get(p.id) || 100;

                      return (
                        <div
                          key={p.id}
                          className="bg-gray-700 rounded overflow-hidden"
                        >
                          {/* Participant Header */}
                          <div className="flex items-center justify-between p-2">
                            <div className="flex items-center gap-2 flex-1">
                              <span className="text-sm text-gray-300">{p.name}</span>
                              {p.role === 'host' && (
                                <span className="text-xs bg-primary-600 px-1.5 py-0.5 rounded text-white">Host</span>
                              )}
                              {p.isMuted && <span className="text-red-500 text-xs">🔇</span>}
                            </div>
                            {p.role === 'guest' && (
                              <button
                                onClick={() => setSelectedParticipant(isExpanded ? null : p.id)}
                                className="text-gray-400 hover:text-white transition-colors p-1"
                                title="Show controls"
                              >
                                {isExpanded ? '▼' : '▶'}
                              </button>
                            )}
                          </div>

                          {/* Participant Controls (Expanded) */}
                          {isExpanded && p.role === 'guest' && (
                            <div className="px-2 pb-2 space-y-2 border-t border-gray-600 pt-2">
                              {/* Volume Control */}
                              <div>
                                <label className="text-xs text-gray-400 block mb-1">
                                  Volume: {volume}%
                                </label>
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={volume}
                                  onChange={(e) => handleVolumeChange(p.id, parseInt(e.target.value))}
                                  className="w-full h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer"
                                />
                              </div>

                              {/* Control Buttons */}
                              <div className="grid grid-cols-2 gap-2">
                                {p.isMuted ? (
                                  <button
                                    onClick={() => handleUnmuteParticipant(p.id)}
                                    className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded transition-colors text-white"
                                  >
                                    🔊 Unmute
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleMuteParticipant(p.id)}
                                    className="text-xs px-2 py-1 bg-yellow-600 hover:bg-yellow-500 rounded transition-colors text-white"
                                  >
                                    🔇 Mute
                                  </button>
                                )}
                                <button
                                  onClick={() => handleDemoteToBackstage(p.id)}
                                  className="text-xs px-2 py-1 bg-gray-600 hover:bg-gray-500 rounded transition-colors text-white"
                                  disabled={isLive}
                                >
                                  ⬇ Backstage
                                </button>
                                <button
                                  onClick={() => handleKickParticipant(p.id, p.name)}
                                  className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-500 rounded transition-colors text-white"
                                >
                                  ⚠️ Kick
                                </button>
                                <button
                                  onClick={() => handleBanParticipant(p.id, p.name)}
                                  className="text-xs px-2 py-1 bg-red-600 hover:bg-red-500 rounded transition-colors text-white"
                                >
                                  🚫 Ban
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Backstage Participants */}
              <div>
                <div className="text-xs font-semibold text-yellow-400 mb-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-yellow-400 rounded-full"></span>
                  BACKSTAGE ({allParticipants.filter((p) => p.role === 'backstage').length})
                </div>
                <div className="space-y-1">
                  {allParticipants
                    .filter((p) => p.role === 'backstage')
                    .map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between text-sm text-gray-300 bg-gray-800 rounded p-2"
                      >
                        <div className="flex items-center gap-2">
                          <span>{p.name}</span>
                          {p.isMuted && <span className="text-red-500 text-xs">🔇</span>}
                        </div>
                        <button
                          onClick={() => handlePromoteToLive(p.id)}
                          className="text-xs px-2 py-1 bg-green-600 hover:bg-green-500 rounded transition-colors"
                        >
                          Go Live
                        </button>
                      </div>
                    ))}
                  {allParticipants.filter((p) => p.role === 'backstage').length === 0 && (
                    <p className="text-xs text-gray-500 italic">No guests waiting</p>
                  )}
                </div>
              </div>
            </div>

            {/* Layout Controls */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Layout</h3>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleLayoutChange('grid')}
                  className={`p-2 rounded text-xs ${
                    currentLayout === 'grid'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!isLive}
                >
                  Grid
                </button>
                <button
                  onClick={() => handleLayoutChange('spotlight')}
                  className={`p-2 rounded text-xs ${
                    currentLayout === 'spotlight'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!isLive}
                >
                  Spotlight
                </button>
                <button
                  onClick={() => handleLayoutChange('sidebar')}
                  className={`p-2 rounded text-xs ${
                    currentLayout === 'sidebar'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!isLive}
                >
                  Sidebar
                </button>
                <button
                  onClick={() => handleLayoutChange('pip')}
                  className={`p-2 rounded text-xs ${
                    currentLayout === 'pip'
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                  disabled={!isLive}
                >
                  PiP
                </button>
              </div>
            </div>

            {/* Recording Controls */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Recording</h3>
              {isRecording && (
                <div className="text-sm text-red-500 mb-2 font-mono">
                  ⏺️ {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                </div>
              )}
              <Button
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                variant={isRecording ? 'danger' : 'secondary'}
                size="sm"
                className="w-full"
                disabled={!isLive}
              >
                {isRecording ? '⏹️ Stop Recording' : '⏺️ Start Recording'}
              </Button>
            </div>

            {/* Chat Display Toggle */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Chat Options</h3>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={showChatOnStream}
                  onChange={(e) => {
                    setShowChatOnStream(e.target.checked);
                    compositorService.setShowChat(e.target.checked);
                  }}
                  className="rounded"
                />
                Show chat on stream
              </label>
              <div className="mt-2 text-xs text-gray-500">
                {chatMessages.length} messages
              </div>
            </div>

            {/* Media Clips */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Media Clips</h3>
              <Button
                onClick={() => setShowMediaLibrary(true)}
                variant="secondary"
                size="sm"
                className="w-full"
              >
                🎬 Open Media Library
              </Button>
              <p className="mt-2 text-xs text-gray-500">
                Add video clips, sound effects, and images to your stream
              </p>
            </div>

            {/* Background Effects */}
            <div>
              <BackgroundEffects
                currentEffect={backgroundEffect}
                onEffectChange={(effect) => {
                  setBackgroundEffect(effect);
                  if (localStream) {
                    backgroundProcessorService.updateEffect(effect);
                    toast.success(`Background effect: ${effect.type}`);
                  }
                }}
              />
            </div>

            {/* Studio Tools */}
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">Studio Tools</h3>
              <div className="space-y-2">
                <Button
                  onClick={() => setShowChatLayoutCustomizer(true)}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  💬 Chat Layout
                </Button>
                <Button
                  onClick={() => setShowChatModeration(true)}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  🛡️ Chat Moderation
                </Button>
                <Button
                  onClick={() => handleShowLowerThird('Guest Name', 'Guest Title')}
                  variant="secondary"
                  size="sm"
                  className="w-full"
                >
                  📝 Lower Third
                </Button>
              </div>
            </div>

            {/* Stream Health Monitor */}
            {broadcastId && (
              <StreamHealthMonitor broadcastId={broadcastId} isLive={isLive} />
            )}

            {/* Bitrate Control */}
            {broadcastId && (
              <BitrateControl broadcastId={broadcastId} isLive={isLive} />
            )}
          </div>
        </aside>

        {/* Video Preview Area */}
        <main className="flex-1 p-6 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Video Grid - Only show LIVE participants */}
            <div className="flex-1 bg-black rounded-lg overflow-hidden p-4">
              {(() => {
                const liveParticipants = allParticipants.filter(
                  (p) => p.role === 'host' || p.role === 'guest'
                );
                return (
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
                );
              })()}
            </div>

            {/* Controls */}
            <div className="mt-6 flex justify-center gap-4">
              <button
                onClick={handleToggleAudio}
                className={`p-4 rounded-full ${
                  audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'
                } text-white transition-colors`}
                title={audioEnabled ? 'Mute' : 'Unmute'}
              >
                {audioEnabled ? '🎤' : '🔇'}
              </button>
              <button
                onClick={handleToggleVideo}
                className={`p-4 rounded-full ${
                  videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'
                } text-white transition-colors`}
                title={videoEnabled ? 'Stop Video' : 'Start Video'}
              >
                {videoEnabled ? '📹' : '📵'}
              </button>
              <button
                onClick={handleToggleScreenShare}
                className={`p-4 rounded-full ${
                  isSharingScreen ? 'bg-primary-600' : 'bg-gray-700 hover:bg-gray-600'
                } text-white transition-colors`}
                title={isSharingScreen ? 'Stop Sharing' : 'Share Screen'}
              >
                🖥️
              </button>
              <button
                onClick={() => navigate('/settings')}
                className="p-4 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                title="Settings"
              >
                ⚙️
              </button>
            </div>
          </div>
        </main>

        {/* Chat Panel */}
        <aside className="w-96 bg-gray-800 border-l border-gray-700 overflow-hidden">
          <ChatOverlay messages={chatMessages} showPlatformIcons={true} maxMessages={100} />
        </aside>
      </div>

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
    </div>
  );
}
