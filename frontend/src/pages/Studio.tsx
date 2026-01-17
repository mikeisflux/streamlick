import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { broadcastAPI } from '../services/api';
import { useStudioStore, LayoutType } from '../store/studioStore';
import {
  getSocket,
  joinBroadcast,
  leaveBroadcast,
  setLayout as emitSetLayout,
  bringOnStage,
  removeFromStage,
  goLive,
  endBroadcast,
  kickParticipant,
} from '../services/socket';
import { AntMediaClient, generateStreamId } from '../services/antmedia';
import {
  StudioHeader,
  CompositePreview,
  BottomControlBar,
  PreviewStrip,
  RightSidebar,
  RightTab,
} from '../components/studio';

export default function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();

  // Store
  const {
    broadcast,
    participants,
    localStream,
    isAudioEnabled,
    isVideoEnabled,
    setBroadcast,
    setParticipants,
    updateParticipant,
    removeParticipant,
    setLocalStream,
    setAudioEnabled,
    setVideoEnabled,
    setLayout,
    reset,
  } = useStudioStore();

  // Local state
  const [isInitializing, setIsInitializing] = useState(true);
  const [compositeStreamId, setCompositeStreamId] = useState<string | null>(null);
  const [activeRightTab, setActiveRightTab] = useState<RightTab>(null);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [guestName, setGuestName] = useState('');
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [speakerMuted, setSpeakerMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showChatOverlay, setShowChatOverlay] = useState(false);

  // Device state
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
  const [selectedVideoDevice, setSelectedVideoDevice] = useState('');

  // Refs
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const antMediaRef = useRef<AntMediaClient | null>(null);
  const screenShareRef = useRef<MediaStream | null>(null);

  // Fetch broadcast data
  const { data: broadcastData, isLoading } = useQuery({
    queryKey: ['broadcast', broadcastId],
    queryFn: () => broadcastAPI.get(broadcastId!),
    enabled: !!broadcastId,
  });

  // Update title mutation
  const updateTitleMutation = useMutation({
    mutationFn: (title: string) => broadcastAPI.update(broadcastId!, { title }),
    onSuccess: (data) => {
      setBroadcast({ ...broadcast!, title: data.title });
    },
  });

  // Initialize studio when broadcast data is loaded
  useEffect(() => {
    if (!broadcastData) return;

    setBroadcast({
      id: broadcastData.id,
      title: broadcastData.title,
      status: broadcastData.status,
      layout: broadcastData.layout,
      backgroundColor: broadcastData.backgroundColor,
      logoUrl: broadcastData.logoUrl,
      overlayText: broadcastData.overlayText,
      previewUrl: broadcastData.previewUrl,
    });

    setParticipants(broadcastData.participants);

    // Connect socket
    const socket = getSocket();
    socket.connect();

    socket.on('connect', () => {
      joinBroadcast(broadcastId!);
      setIsInitializing(false);
    });

    socket.on('broadcast-state', (state) => {
      setBroadcast(state.broadcast);
      setParticipants(state.participants);
    });

    socket.on('participant-joined', (participant) => {
      setParticipants([...participants, participant]);
    });

    socket.on('participant-updated', (participant) => {
      updateParticipant(participant);
    });

    socket.on('participant-left', (data) => {
      if (data.participantId) {
        removeParticipant(data.participantId);
      }
    });

    socket.on('layout-changed', (data) => {
      setLayout(data.layout);
    });

    socket.on('broadcast-live', () => {
      setBroadcast({ ...broadcast!, status: 'LIVE' });
    });

    socket.on('broadcast-ended', () => {
      setBroadcast({ ...broadcast!, status: 'ENDED' });
    });

    socket.on('composite-ready', (data) => {
      setCompositeStreamId(data.streamId);
    });

    return () => {
      leaveBroadcast();
      socket.disconnect();
      reset();
    };
  }, [broadcastData, broadcastId]);

  // Get devices and local media
  useEffect(() => {
    async function initMedia() {
      try {
        // Get device list
        const devices = await navigator.mediaDevices.enumerateDevices();
        setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
        setVideoDevices(devices.filter(d => d.kind === 'videoinput'));

        // Get user media
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        // Set selected devices
        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];
        if (audioTrack) setSelectedAudioDevice(audioTrack.getSettings().deviceId || '');
        if (videoTrack) setSelectedVideoDevice(videoTrack.getSettings().deviceId || '');

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Publish to Ant Media (host publishes their stream for the compositor)
        if (broadcastId && participants.length > 0) {
          const hostParticipant = participants.find(p => p.role === 'HOST');
          if (hostParticipant) {
            const streamId = generateStreamId(broadcastId, hostParticipant.id);
            antMediaRef.current = new AntMediaClient({
              streamId,
              mode: 'publish',
              localStream: stream,
              onStateChange: (state) => console.log('Host stream state:', state),
              onError: (error) => console.error('Host stream error:', error),
            });
            antMediaRef.current.connect();
          }
        }
      } catch (error) {
        console.error('Failed to get media:', error);
      }
    }

    initMedia();

    return () => {
      antMediaRef.current?.disconnect();
      localStream?.getTracks().forEach(t => t.stop());
      screenShareRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [broadcastId, participants.length]);

  // Media controls
  const toggleAudio = useCallback(() => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => {
        t.enabled = !isAudioEnabled;
      });
      setAudioEnabled(!isAudioEnabled);
    }
  }, [localStream, isAudioEnabled, setAudioEnabled]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => {
        t.enabled = !isVideoEnabled;
      });
      setVideoEnabled(!isVideoEnabled);
    }
  }, [localStream, isVideoEnabled, setVideoEnabled]);

  const toggleSpeaker = useCallback(() => {
    setSpeakerMuted(!speakerMuted);
  }, [speakerMuted]);

  const toggleScreenShare = useCallback(async () => {
    if (isSharingScreen) {
      screenShareRef.current?.getTracks().forEach(t => t.stop());
      screenShareRef.current = null;
      setIsSharingScreen(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenShareRef.current = stream;
        setIsSharingScreen(true);

        stream.getVideoTracks()[0].onended = () => {
          setIsSharingScreen(false);
          screenShareRef.current = null;
        };
      } catch (error) {
        console.error('Screen share failed:', error);
      }
    }
  }, [isSharingScreen]);

  // Device changes
  const handleAudioDeviceChange = useCallback(async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: { deviceId: { exact: deviceId } },
        video: selectedVideoDevice ? { deviceId: { exact: selectedVideoDevice } } : true,
      });

      // Replace audio track
      if (localStream) {
        const oldAudioTrack = localStream.getAudioTracks()[0];
        if (oldAudioTrack) {
          localStream.removeTrack(oldAudioTrack);
          oldAudioTrack.stop();
        }
        const newAudioTrack = newStream.getAudioTracks()[0];
        if (newAudioTrack) {
          localStream.addTrack(newAudioTrack);
        }
      }

      setSelectedAudioDevice(deviceId);
    } catch (error) {
      console.error('Failed to change audio device:', error);
    }
  }, [localStream, selectedVideoDevice]);

  const handleVideoDeviceChange = useCallback(async (deviceId: string) => {
    try {
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: selectedAudioDevice ? { deviceId: { exact: selectedAudioDevice } } : true,
        video: { deviceId: { exact: deviceId } },
      });

      // Replace video track
      if (localStream) {
        const oldVideoTrack = localStream.getVideoTracks()[0];
        if (oldVideoTrack) {
          localStream.removeTrack(oldVideoTrack);
          oldVideoTrack.stop();
        }
        const newVideoTrack = newStream.getVideoTracks()[0];
        if (newVideoTrack) {
          localStream.addTrack(newVideoTrack);
        }
      }

      setSelectedVideoDevice(deviceId);
    } catch (error) {
      console.error('Failed to change video device:', error);
    }
  }, [localStream, selectedAudioDevice]);

  // Layout change
  const handleLayoutChange = useCallback((layout: LayoutType) => {
    setLayout(layout);
    emitSetLayout(layout);
  }, [setLayout]);

  // Background color change
  const handleBackgroundColorChange = useCallback((color: string) => {
    setBroadcast({ ...broadcast!, backgroundColor: color });
    // TODO: Emit to socket for compositor
  }, [broadcast, setBroadcast]);

  // Create invite
  const handleCreateInvite = async () => {
    if (!guestName.trim()) return;
    try {
      const result = await broadcastAPI.invite(broadcastId!, { name: guestName });
      setInviteUrl(result.inviteUrl);
      setGuestName('');
    } catch (error) {
      console.error('Failed to create invite:', error);
    }
  };

  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
  };

  // Go live
  const handleGoLive = async () => {
    try {
      await broadcastAPI.goLive(broadcastId!);
      goLive();
    } catch (error) {
      console.error('Failed to go live:', error);
    }
  };

  // End broadcast
  const handleEndBroadcast = async () => {
    if (!confirm('Are you sure you want to end this broadcast?')) return;
    try {
      await broadcastAPI.end(broadcastId!);
      endBroadcast();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to end broadcast:', error);
    }
  };

  // Participant controls
  const handleBringOnStage = useCallback((participantId: string) => {
    bringOnStage(participantId);
  }, []);

  const handleRemoveFromStage = useCallback((participantId: string) => {
    removeFromStage(participantId);
  }, []);

  const handleMuteParticipant = useCallback((participantId: string, muted: boolean) => {
    // TODO: Emit mute event
    console.log('Mute participant:', participantId, muted);
  }, []);

  const handleKickParticipant = useCallback((participantId: string) => {
    if (confirm('Are you sure you want to kick this participant?')) {
      kickParticipant(participantId);
    }
  }, []);

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-dark-700 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
          <div className="text-dark-400">Loading studio...</div>
        </div>
      </div>
    );
  }

  const isLive = broadcast?.status === 'LIVE';
  const hostParticipant = participants.find(p => p.role === 'HOST') || null;

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col overflow-hidden">
      {/* Header */}
      <StudioHeader
        broadcastTitle={broadcast?.title || 'Untitled Broadcast'}
        isLive={isLive}
        status={broadcast?.status || 'IDLE'}
        participantCount={participants.length}
        onGoLive={handleGoLive}
        onEndBroadcast={handleEndBroadcast}
        onTitleChange={(title) => updateTitleMutation.mutate(title)}
        onSettingsClick={() => setActiveRightTab('style')}
        onInviteClick={() => setShowInviteModal(true)}
        isInitializing={isInitializing}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col pr-16 pb-20">
        {/* Preview Area */}
        <div className="flex-1 p-4">
          <CompositePreview
            broadcastId={broadcastId!}
            compositeStreamId={compositeStreamId}
            backgroundColor={broadcast?.backgroundColor}
            logoUrl={broadcast?.logoUrl ?? undefined}
          />
        </div>

        {/* Backstage/Greenroom Strip */}
        <PreviewStrip
          participants={participants}
          localStream={localStream}
          localVideoEnabled={isVideoEnabled}
          hostParticipant={hostParticipant}
          onAddToStage={handleBringOnStage}
          onRemoveFromStage={handleRemoveFromStage}
          onKickParticipant={handleKickParticipant}
          onInviteClick={() => setShowInviteModal(true)}
        />
      </div>

      {/* Bottom Control Bar */}
      <BottomControlBar
        audioEnabled={isAudioEnabled}
        videoEnabled={isVideoEnabled}
        isSharingScreen={isSharingScreen}
        speakerMuted={speakerMuted}
        onToggleAudio={toggleAudio}
        onToggleVideo={toggleVideo}
        onToggleScreenShare={toggleScreenShare}
        onToggleSpeaker={toggleSpeaker}
        currentLayout={(broadcast?.layout as LayoutType) || 'grid'}
        onLayoutChange={handleLayoutChange}
        isRecording={isRecording}
        onToggleRecording={() => setIsRecording(!isRecording)}
        showChatOverlay={showChatOverlay}
        onToggleChatOverlay={() => setShowChatOverlay(!showChatOverlay)}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        selectedAudioDevice={selectedAudioDevice}
        selectedVideoDevice={selectedVideoDevice}
        onAudioDeviceChange={handleAudioDeviceChange}
        onVideoDeviceChange={handleVideoDeviceChange}
      />

      {/* Right Sidebar */}
      <RightSidebar
        activeTab={activeRightTab}
        onTabChange={setActiveRightTab}
        participants={participants}
        onBringOnStage={handleBringOnStage}
        onRemoveFromStage={handleRemoveFromStage}
        onMuteParticipant={handleMuteParticipant}
        onKickParticipant={handleKickParticipant}
        currentLayout={(broadcast?.layout as LayoutType) || 'grid'}
        backgroundColor={broadcast?.backgroundColor || '#1a1a2e'}
        onLayoutChange={handleLayoutChange}
        onBackgroundColorChange={handleBackgroundColorChange}
      />

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100]">
          <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-md border border-dark-800">
            <h2 className="text-xl font-bold mb-4">Invite Guest</h2>

            {!inviteUrl ? (
              <div>
                <input
                  type="text"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                  placeholder="Guest name"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500 mb-4"
                  autoFocus
                />
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowInviteModal(false)}
                    className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateInvite}
                    disabled={!guestName.trim()}
                    className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition disabled:opacity-50"
                  >
                    Create Link
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-dark-400 mb-4">Share this link with your guest:</p>
                <div className="flex gap-2 mb-4">
                  <input
                    type="text"
                    value={inviteUrl}
                    readOnly
                    className="flex-1 px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg text-sm"
                  />
                  <button
                    onClick={copyInviteUrl}
                    className="px-4 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg transition"
                  >
                    <Copy className="w-5 h-5" />
                  </button>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => setInviteUrl('')}
                    className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                  >
                    Create Another
                  </button>
                  <button
                    onClick={() => {
                      setInviteUrl('');
                      setShowInviteModal(false);
                    }}
                    className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
