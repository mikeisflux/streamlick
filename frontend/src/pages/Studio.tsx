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


      {/* Left Sidebar - Scenes (280px width) */}
      {leftSidebarOpen && (
        <aside
          className="flex flex-col overflow-hidden border-r"
          style={{
            width: '280px',
            backgroundColor: '#f5f5f5',
            borderColor: '#e0e0e0'
          }}
        >
          <div
            className="sticky top-0 flex items-center justify-between px-4 border-b bg-white"
            style={{ height: '56px', borderColor: '#e0e0e0' }}
          >
            <h3 className="text-sm font-semibold text-gray-800">Scenes</h3>
            <button
              onClick={() => setLeftSidebarOpen(false)}
              className="text-gray-600 hover:text-gray-900"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
                onSceneChange={setCurrentSceneId}
                onScenesUpdate={setScenes}
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
                      ref={(el) => {
                        if (el && localStream) el.srcObject = localStream;
                      }}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-full object-cover"
                    />
                  )}
                </div>
                <p className="text-xs text-gray-700 font-medium">Default Scene</p>
              </div>
            </div>
          </div>
        </aside>
      )}

      {/* Main Canvas Area */}
      <main
        className="flex flex-col overflow-hidden"
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
            {/* Main Video Preview */}
            <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: '#000000' }}>
              {localStream && videoEnabled ? (
                <video
                  ref={(el) => {
                    if (el && localStream) el.srcObject = localStream;
                  }}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
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

              {/* Resolution Badge - Centered Top */}
              <div
                className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold text-white"
                style={{
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(8px)'
                }}
              >
                1080p HD
              </div>

              {/* On-Screen Chat Overlay */}
              {showChatOnStream && (
                <div className="absolute bottom-20 right-4 w-80 bg-black/80 backdrop-blur-sm rounded-lg p-3 max-h-96 overflow-y-auto">
                  <div className="space-y-2">
                    {chatMessages.slice(-5).map((msg, i) => (
                      <div key={i} className="text-white text-sm">
                        <span className="font-semibold">{msg.userName}:</span> {msg.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* User Label Overlay */}
              {localStream && (
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-white text-sm font-medium">You (Host)</span>
                      <span className="bg-blue-500 text-white text-xs px-2 py-0.5 rounded">720p</span>
                    </div>
                  </div>
                </div>
              )}
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
              className="rounded hover:bg-gray-600 transition-all flex items-center justify-center flex-shrink-0"
              style={{
                width: '56px',
                height: '56px',
                backgroundColor: selectedLayout === layoutId ? '#0066ff' : '#3d3d3d'
              }}
              title={`Layout ${layoutId}`}
            >
              <span className="text-white text-xs">{layoutId}</span>
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
            <button
              onClick={() => setCaptionsEnabled(!captionsEnabled)}
              className={`p-2 rounded ${
                captionsEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title="AI Captions"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
              </svg>
            </button>
            <button
              onClick={() => setClipRecordingEnabled(!clipRecordingEnabled)}
              className={`p-2 rounded ${
                clipRecordingEnabled ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-700 hover:bg-gray-600'
              } text-white transition-colors`}
              title="Clip Recording"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </button>
            <button
              onClick={() => setShowClipManager(true)}
              className="p-2 rounded bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Clip Manager"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
              </svg>
            </button>
          </div>

          {/* Center Section - Media Controls */}
          <div className="flex items-center gap-3">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full ${
                audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } text-white transition-colors`}
              title={audioEnabled ? 'Mute' : 'Unmute'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
            <button
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Speaker"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              </svg>
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full ${
                videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600 hover:bg-red-700'
              } text-white transition-colors`}
              title={videoEnabled ? 'Stop Camera' : 'Start Camera'}
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </button>
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

          {/* Right Section */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowProducerMode(true)}
              className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
              title="Producer Mode"
            >
              Producer Mode
            </button>
            <button
              onClick={() => setShowInviteDrawer(true)}
              className="px-6 py-3 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
            >
              Invite Guests
            </button>
            <button
              onClick={() => setShowSettings(true)}
              className="p-3 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              title="Settings"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </button>
          </div>
        </div>
      </main>

      {/* Right Sidebar - Tabbed Panels (320px width) */}
      {rightSidebarOpen && (
        <aside
          className="flex flex-col overflow-hidden border-l"
          style={{
            width: '320px',
            backgroundColor: '#ffffff',
            borderColor: '#e0e0e0',
            zIndex: 800
          }}
        >
          {/* Tab Headers */}
          <div className="border-b flex overflow-x-auto flex-shrink-0" style={{ borderColor: '#e0e0e0' }}>
            <button
              onClick={() => setActiveRightTab('chat')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'chat'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'chat' ? { borderColor: '#0066ff' } : {}}
            >
              Chat
            </button>
            <button
              onClick={() => setActiveRightTab('people')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'people'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'people' ? { borderColor: '#0066ff' } : {}}
            >
              People
            </button>
            <button
              onClick={() => setActiveRightTab('recording')}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors ${
                activeRightTab === 'recording'
                  ? 'text-gray-900 border-b-2'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
              style={activeRightTab === 'recording' ? { borderColor: '#0066ff' } : {}}
            >
              Recording
            </button>
            <button
              onClick={() => setRightSidebarOpen(false)}
              className="ml-auto p-3 text-gray-500 hover:text-gray-900"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto">
            {activeRightTab === 'chat' && (
              <div className="p-4">
                <ChatOverlay messages={chatMessages} showPlatformIcons={true} maxMessages={100} />
              </div>
            )}
            {activeRightTab === 'people' && (
              <ParticipantsPanel />
            )}
            {activeRightTab === 'recording' && (
              <RecordingControls
                isRecording={isRecording}
                duration={recordingDuration}
                onStart={handleStartRecording}
                onStop={handleStopRecording}
              />
            )}
          </div>
        </aside>
      )}

      {/* Toggle Buttons (when sidebars are collapsed) */}
      {!leftSidebarOpen && (
        <button
          onClick={() => setLeftSidebarOpen(true)}
          className="fixed left-2 top-1/2 transform -translate-y-1/2 p-2 rounded-r bg-gray-700 hover:bg-gray-600 text-white shadow-lg z-50"
          style={{ zIndex: 900 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      )}
      {!rightSidebarOpen && (
        <button
          onClick={() => setRightSidebarOpen(true)}
          className="fixed right-2 top-1/2 transform -translate-y-1/2 p-2 rounded-l bg-gray-700 hover:bg-gray-600 text-white shadow-lg z-50"
          style={{ zIndex: 900 }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
    </div>
  );
}
