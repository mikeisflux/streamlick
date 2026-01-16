import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Mic, MicOff, Video, VideoOff, Users, Settings, Layout,
  ArrowLeft, Copy, Radio, Square, Play, UserPlus, Monitor
} from 'lucide-react';
import { broadcastAPI } from '../services/api';
import { useStudioStore, LayoutType } from '../store/studioStore';
import {
  getSocket, joinBroadcast, leaveBroadcast, setLayout as emitSetLayout,
  bringOnStage, removeFromStage, goLive, endBroadcast
} from '../services/socket';
import { AntMediaClient, generateStreamId } from '../services/antmedia';

const LAYOUTS: { value: LayoutType; label: string; icon: string }[] = [
  { value: 'grid', label: 'Grid', icon: '⊞' },
  { value: 'spotlight', label: 'Spotlight', icon: '◐' },
  { value: 'side-by-side', label: 'Side by Side', icon: '⊟' },
  { value: 'picture-in-picture', label: 'Picture in Picture', icon: '◲' },
  { value: 'single', label: 'Single', icon: '□' },
];

export default function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const navigate = useNavigate();

  const {
    broadcast, participants, localStream, isAudioEnabled, isVideoEnabled,
    setBroadcast, setParticipants, updateParticipant, addParticipant, removeParticipant,
    setLocalStream, setAudioEnabled, setVideoEnabled, setLayout, reset
  } = useStudioStore();

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteUrl, setInviteUrl] = useState('');
  const [guestName, setGuestName] = useState('');
  const [showLayoutPanel, setShowLayoutPanel] = useState(false);
  const [isConnecting, setIsConnecting] = useState(true);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const antMediaRef = useRef<AntMediaClient | null>(null);

  // Fetch broadcast data
  const { data: broadcastData, isLoading } = useQuery({
    queryKey: ['broadcast', broadcastId],
    queryFn: () => broadcastAPI.get(broadcastId!),
    enabled: !!broadcastId,
  });

  // Initialize studio
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
      setIsConnecting(false);
    });

    socket.on('broadcast-state', (state) => {
      setBroadcast(state.broadcast);
      setParticipants(state.participants);
    });

    socket.on('participant-joined', (data) => {
      // Refetch participants
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

    socket.on('broadcast-live', (data) => {
      setBroadcast({ ...broadcast!, status: 'LIVE' });
    });

    socket.on('broadcast-ended', () => {
      setBroadcast({ ...broadcast!, status: 'ENDED' });
    });

    return () => {
      leaveBroadcast();
      socket.disconnect();
      reset();
    };
  }, [broadcastData, broadcastId]);

  // Get local media
  useEffect(() => {
    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }

        // Publish to Ant Media
        if (broadcastId) {
          const hostParticipant = participants.find(p => p.role === 'HOST');
          if (hostParticipant) {
            const streamId = generateStreamId(broadcastId, hostParticipant.id);
            antMediaRef.current = new AntMediaClient({
              streamId,
              mode: 'publish',
              localStream: stream,
              onStateChange: (state) => console.log('Stream state:', state),
              onError: (error) => console.error('Stream error:', error),
            });
            antMediaRef.current.connect();
          }
        }
      } catch (error) {
        console.error('Failed to get media:', error);
      }
    }

    getMedia();

    return () => {
      antMediaRef.current?.disconnect();
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, [broadcastId, participants]);

  // Toggle audio/video
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !isAudioEnabled; });
      setAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !isVideoEnabled; });
      setVideoEnabled(!isVideoEnabled);
    }
  };

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

  // Copy invite URL
  const copyInviteUrl = () => {
    navigator.clipboard.writeText(inviteUrl);
  };

  // Handle go live
  const handleGoLive = async () => {
    try {
      await broadcastAPI.goLive(broadcastId!);
      goLive();
    } catch (error) {
      console.error('Failed to go live:', error);
    }
  };

  // Handle end broadcast
  const handleEnd = async () => {
    if (!confirm('Are you sure you want to end this broadcast?')) return;
    try {
      await broadcastAPI.end(broadcastId!);
      endBroadcast();
      navigate('/dashboard');
    } catch (error) {
      console.error('Failed to end broadcast:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-dark-400">Loading studio...</div>
      </div>
    );
  }

  const onStageParticipants = participants.filter(p => p.isOnStage);
  const backstageParticipants = participants.filter(p => !p.isOnStage && p.status !== 'LEFT');

  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="h-14 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/dashboard" className="p-2 hover:bg-dark-800 rounded-lg transition">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="font-semibold">{broadcast?.title || 'Loading...'}</h1>
            <div className="flex items-center gap-2 text-sm">
              {broadcast?.status === 'LIVE' ? (
                <span className="flex items-center gap-1 text-red-400">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  LIVE
                </span>
              ) : (
                <span className="text-dark-400">{broadcast?.status}</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {broadcast?.status === 'GREENROOM' && (
            <button
              onClick={handleGoLive}
              className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg font-medium transition"
            >
              <Radio className="w-4 h-4" />
              Go Live
            </button>
          )}
          {broadcast?.status === 'LIVE' && (
            <button
              onClick={handleEnd}
              className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg font-medium transition"
            >
              <Square className="w-4 h-4" />
              End Broadcast
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Preview area */}
        <div className="flex-1 p-4">
          <div
            className="aspect-video rounded-xl overflow-hidden relative"
            style={{ backgroundColor: broadcast?.backgroundColor || '#1a1a2e' }}
          >
            {/* Live Preview - Shows composite output */}
            <div className="absolute inset-0 flex items-center justify-center">
              {onStageParticipants.length === 0 ? (
                <div className="text-dark-500 text-center">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No participants on stage</p>
                </div>
              ) : (
                <div className="w-full h-full grid grid-cols-2 gap-2 p-2">
                  {onStageParticipants.map((participant) => (
                    <div
                      key={participant.id}
                      className="bg-dark-800 rounded-lg flex items-center justify-center relative"
                    >
                      {participant.role === 'HOST' && localStream && isVideoEnabled ? (
                        <video
                          ref={localVideoRef}
                          autoPlay
                          muted
                          playsInline
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        <div className="w-20 h-20 bg-brand-600 rounded-full flex items-center justify-center text-2xl font-bold">
                          {participant.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/50 rounded text-sm">
                        {participant.name}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Logo */}
            {broadcast?.logoUrl && (
              <img
                src={broadcast.logoUrl}
                alt="Logo"
                className="absolute top-4 right-4 max-w-[150px] max-h-[60px]"
              />
            )}
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`p-3 rounded-full transition ${
                isAudioEnabled ? 'bg-dark-700 hover:bg-dark-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-3 rounded-full transition ${
                isVideoEnabled ? 'bg-dark-700 hover:bg-dark-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isVideoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
            </button>
            <button
              onClick={() => setShowLayoutPanel(!showLayoutPanel)}
              className="p-3 bg-dark-700 hover:bg-dark-600 rounded-full transition"
            >
              <Layout className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-3 bg-dark-700 hover:bg-dark-600 rounded-full transition"
            >
              <UserPlus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-80 bg-dark-900 border-l border-dark-800 flex flex-col">
          {/* Participants */}
          <div className="p-4 border-b border-dark-800">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participants ({participants.length})
            </h3>

            {/* On Stage */}
            {onStageParticipants.length > 0 && (
              <div className="mb-4">
                <div className="text-xs text-dark-500 mb-2">ON STAGE</div>
                <div className="space-y-2">
                  {onStageParticipants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-dark-800 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-sm font-medium">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{p.name}</div>
                          <div className="text-xs text-dark-500">{p.role}</div>
                        </div>
                      </div>
                      {p.role !== 'HOST' && (
                        <button
                          onClick={() => removeFromStage(p.id)}
                          className="text-xs text-dark-400 hover:text-white"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Backstage */}
            {backstageParticipants.length > 0 && (
              <div>
                <div className="text-xs text-dark-500 mb-2">BACKSTAGE</div>
                <div className="space-y-2">
                  {backstageParticipants.map((p) => (
                    <div key={p.id} className="flex items-center justify-between p-2 bg-dark-800/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-sm">
                          {p.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm">{p.name}</div>
                          <div className="text-xs text-dark-500">{p.status}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => bringOnStage(p.id)}
                        className="px-2 py-1 bg-brand-600 hover:bg-brand-700 rounded text-xs"
                      >
                        Add to Stage
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Layout Panel */}
          {showLayoutPanel && (
            <div className="p-4 border-b border-dark-800">
              <h3 className="font-semibold mb-3">Layout</h3>
              <div className="grid grid-cols-2 gap-2">
                {LAYOUTS.map((l) => (
                  <button
                    key={l.value}
                    onClick={() => {
                      setLayout(l.value);
                      emitSetLayout(l.value);
                    }}
                    className={`p-3 rounded-lg text-center transition ${
                      broadcast?.layout === l.value
                        ? 'bg-brand-600'
                        : 'bg-dark-800 hover:bg-dark-700'
                    }`}
                  >
                    <div className="text-2xl mb-1">{l.icon}</div>
                    <div className="text-xs">{l.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
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
                <button
                  onClick={() => {
                    setInviteUrl('');
                    setShowInviteModal(false);
                  }}
                  className="w-full py-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
