import { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { Mic, MicOff, Video, VideoOff, Monitor, Settings } from 'lucide-react';
import { participantAPI } from '../services/api';
import { connectWithInviteToken, joinBroadcast, publishStream } from '../services/socket';
import { AntMediaClient, generateStreamId } from '../services/antmedia';

type Stage = 'loading' | 'lobby' | 'greenroom' | 'live' | 'ended';

export default function GuestJoin() {
  const { token } = useParams<{ token: string }>();
  const [stage, setStage] = useState<Stage>('loading');
  const [participant, setParticipant] = useState<any>(null);
  const [broadcast, setBroadcast] = useState<any>(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const [previewStream, setPreviewStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const antMediaRef = useRef<AntMediaClient | null>(null);
  const previewClientRef = useRef<AntMediaClient | null>(null);

  // Load participant info
  useEffect(() => {
    async function loadParticipant() {
      try {
        const data = await participantAPI.getByToken(token!);
        setParticipant(data);
        setBroadcast(data.broadcast);
        setName(data.name);
        setStage('lobby');
      } catch (err: any) {
        setError(err.message || 'Invalid invite link');
      }
    }

    if (token) {
      loadParticipant();
    }
  }, [token]);

  // Get local media when entering greenroom
  useEffect(() => {
    async function getMedia() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        });
        setLocalStream(stream);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.error('Failed to get media:', err);
        setError('Could not access camera/microphone');
      }
    }

    if (stage === 'greenroom' || stage === 'live') {
      getMedia();
    }

    return () => {
      localStream?.getTracks().forEach(t => t.stop());
    };
  }, [stage]);

  // Connect to socket and Ant Media when joining
  const handleJoin = async () => {
    try {
      // Join via API
      const updatedParticipant = await participantAPI.join(token!, name);
      setParticipant(updatedParticipant);

      // Connect socket with invite token
      const socket = connectWithInviteToken(token!);

      socket.on('connect', () => {
        joinBroadcast(updatedParticipant.broadcast.id);
      });

      socket.on('broadcast-state', (state) => {
        setBroadcast(state.broadcast);
        if (state.broadcast.status === 'LIVE') {
          setStage('live');
        } else if (state.broadcast.status === 'ENDED') {
          setStage('ended');
        }
      });

      socket.on('broadcast-live', () => {
        setStage('live');
      });

      socket.on('broadcast-ended', () => {
        setStage('ended');
      });

      // Move to greenroom
      setStage('greenroom');

    } catch (err: any) {
      setError(err.message || 'Failed to join');
    }
  };

  // Publish stream to Ant Media
  const handlePublish = async () => {
    if (!localStream || !participant || !broadcast) return;

    const streamId = generateStreamId(broadcast.id, participant.id);

    antMediaRef.current = new AntMediaClient({
      streamId,
      mode: 'publish',
      localStream,
      onStateChange: (state) => {
        console.log('Publish state:', state);
        if (state === 'publishing') {
          publishStream(streamId);
        }
      },
      onError: (error) => {
        console.error('Publish error:', error);
      },
    });

    await antMediaRef.current.connect();
  };

  // Subscribe to preview stream
  useEffect(() => {
    if (stage !== 'live' || !broadcast?.previewUrl) return;

    previewClientRef.current = new AntMediaClient({
      streamId: broadcast.previewUrl,
      mode: 'play',
      onRemoteStream: (stream) => {
        setPreviewStream(stream);
        if (previewRef.current) {
          previewRef.current.srcObject = stream;
        }
      },
      onStateChange: (state) => console.log('Preview state:', state),
      onError: (error) => console.error('Preview error:', error),
    });

    previewClientRef.current.connect();

    return () => {
      previewClientRef.current?.disconnect();
    };
  }, [stage, broadcast?.previewUrl]);

  // Toggle controls
  const toggleAudio = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(t => { t.enabled = !isAudioEnabled; });
      setIsAudioEnabled(!isAudioEnabled);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      localStream.getVideoTracks().forEach(t => { t.enabled = !isVideoEnabled; });
      setIsVideoEnabled(!isVideoEnabled);
    }
  };

  // Cleanup
  useEffect(() => {
    return () => {
      antMediaRef.current?.disconnect();
      previewClientRef.current?.disconnect();
    };
  }, []);

  // Loading state
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-dark-400">Loading...</div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 mb-4">{error}</div>
          <a href="/" className="text-brand-400 hover:text-brand-300">
            Go to homepage
          </a>
        </div>
      </div>
    );
  }

  // Ended state
  if (stage === 'ended') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Broadcast Ended</h2>
          <p className="text-dark-400">Thanks for joining!</p>
        </div>
      </div>
    );
  }

  // Lobby - Name entry
  if (stage === 'lobby') {
    return (
      <div className="min-h-screen bg-dark-950 flex items-center justify-center px-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text mb-4">
              Streamlick
            </div>
            <h2 className="text-xl font-semibold">{broadcast?.title}</h2>
            <p className="text-dark-400 mt-2">You've been invited to join this broadcast</p>
          </div>

          <div className="bg-dark-900 rounded-2xl p-6 border border-dark-800">
            <div className="mb-6">
              <label className="block text-sm font-medium mb-2">Your Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
                placeholder="Enter your name"
              />
            </div>

            <button
              onClick={handleJoin}
              disabled={!name.trim()}
              className="w-full py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-semibold transition disabled:opacity-50"
            >
              Join Greenroom
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Greenroom / Live
  return (
    <div className="min-h-screen bg-dark-950 flex flex-col">
      {/* Header */}
      <header className="h-14 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-4">
        <div>
          <h1 className="font-semibold">{broadcast?.title}</h1>
          <div className="text-sm">
            {stage === 'live' ? (
              <span className="flex items-center gap-1 text-red-400">
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE
              </span>
            ) : (
              <span className="text-yellow-400">Greenroom</span>
            )}
          </div>
        </div>
      </header>

      {/* Main */}
      <div className="flex-1 flex">
        {/* Self view */}
        <div className="flex-1 p-4 flex flex-col">
          <div className="flex-1 bg-dark-900 rounded-xl overflow-hidden relative">
            {localStream && isVideoEnabled ? (
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="w-32 h-32 bg-brand-600 rounded-full flex items-center justify-center text-5xl font-bold">
                  {name.charAt(0).toUpperCase()}
                </div>
              </div>
            )}
            <div className="absolute bottom-4 left-4 px-3 py-1.5 bg-black/50 rounded-lg text-sm">
              {name} (You)
            </div>
          </div>

          {/* Controls */}
          <div className="mt-4 flex items-center justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full transition ${
                isAudioEnabled ? 'bg-dark-700 hover:bg-dark-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isAudioEnabled ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full transition ${
                isVideoEnabled ? 'bg-dark-700 hover:bg-dark-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {isVideoEnabled ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
            </button>
            {stage === 'greenroom' && !antMediaRef.current && (
              <button
                onClick={handlePublish}
                className="px-6 py-4 bg-brand-600 hover:bg-brand-700 rounded-full font-medium transition"
              >
                Start Streaming
              </button>
            )}
          </div>
        </div>

        {/* Live Preview (when live) */}
        {stage === 'live' && (
          <div className="w-96 bg-dark-900 border-l border-dark-800 p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Monitor className="w-4 h-4" />
              Live Preview
            </h3>
            <div className="aspect-video bg-dark-800 rounded-lg overflow-hidden">
              {previewStream ? (
                <video
                  ref={previewRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-dark-500">
                  Connecting to preview...
                </div>
              )}
            </div>
            <p className="text-xs text-dark-500 mt-2 text-center">
              This is what viewers see
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
