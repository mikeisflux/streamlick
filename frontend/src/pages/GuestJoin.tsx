import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMedia } from '../hooks/useMedia';
import { socketService } from '../services/socket.service';
import { webrtcService } from '../services/webrtc.service';
import { VideoPreview } from '../components/VideoPreview';
import { Button } from '../components/Button';
import api from '../services/api';
import toast from 'react-hot-toast';

export function GuestJoin() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState('');
  const [isJoining, setIsJoining] = useState(false);
  const [broadcastInfo, setBroadcastInfo] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasJoined, setHasJoined] = useState(false);

  const {
    localStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    toggleAudio,
    toggleVideo,
  } = useMedia();

  useEffect(() => {
    const loadInvite = async () => {
      try {
        const response = await api.post(`/participants/join/${token}`, {});
        setBroadcastInfo(response.data.broadcast);
        setIsLoading(false);
      } catch (error) {
        toast.error('Invalid or expired invite link');
        setIsLoading(false);
      }
    };

    loadInvite();
    startCamera();
  }, [token]);

  const handleJoin = async () => {
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    if (!token || !broadcastInfo) return;

    setIsJoining(true);
    try {
      // Update participant with name
      const response = await api.post(`/participants/join/${token}`, {
        name: guestName,
      });

      const participant = response.data.participant;

      // Connect to studio
      socketService.connect('');
      socketService.joinStudio(broadcastInfo.id, participant.id);

      // Initialize WebRTC
      await webrtcService.initialize(broadcastInfo.id);
      await webrtcService.createSendTransport();

      // Produce media
      if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        const audioTrack = localStream.getAudioTracks()[0];

        if (videoTrack) {
          await webrtcService.produceMedia(videoTrack);
        }

        if (audioTrack) {
          await webrtcService.produceMedia(audioTrack);
        }
      }

      setHasJoined(true);
      toast.success('Joined successfully! Waiting for host...');
    } catch (error) {
      toast.error('Failed to join broadcast');
      setIsJoining(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center">
        <div className="text-white text-xl">Loading...</div>
      </div>
    );
  }

  if (!broadcastInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Invalid Invite</h2>
          <p className="text-gray-600 mb-6">
            This invite link is invalid or has expired. Please contact the host for a new link.
          </p>
        </div>
      </div>
    );
  }

  if (hasJoined) {
    return (
      <div className="min-h-screen bg-gray-900 flex flex-col">
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">{broadcastInfo.title}</h1>
              <p className="text-sm text-gray-400 mt-1">Waiting in backstage...</p>
            </div>
          </div>
        </header>

        <main className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-2xl w-full">
            <div className="bg-black rounded-lg overflow-hidden aspect-video mb-6">
              <VideoPreview stream={localStream} muted />
            </div>

            <div className="bg-gray-800 rounded-lg p-6 text-center">
              <h2 className="text-2xl font-bold text-white mb-2">
                You're in the waiting room
              </h2>
              <p className="text-gray-400 mb-6">
                The host will bring you on screen shortly. Make sure your camera and microphone are working.
              </p>

              <div className="flex justify-center gap-4">
                <button
                  onClick={toggleAudio}
                  className={`p-4 rounded-full ${
                    audioEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'
                  } text-white transition-colors`}
                >
                  {audioEnabled ? '🎤' : '🔇'}
                </button>
                <button
                  onClick={toggleVideo}
                  className={`p-4 rounded-full ${
                    videoEnabled ? 'bg-gray-700 hover:bg-gray-600' : 'bg-red-600'
                  } text-white transition-colors`}
                >
                  {videoEnabled ? '📹' : '📵'}
                </button>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Join Broadcast</h1>
          <p className="text-gray-600">{broadcastInfo.title}</p>
        </div>

        {/* Video Preview */}
        <div className="bg-black rounded-lg overflow-hidden aspect-video mb-6">
          <VideoPreview stream={localStream} muted />
        </div>

        {/* Controls */}
        <div className="flex justify-center gap-4 mb-6">
          <button
            onClick={toggleAudio}
            className={`p-4 rounded-full ${
              audioEnabled ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-600'
            } ${audioEnabled ? 'text-gray-900' : 'text-white'} transition-colors`}
          >
            {audioEnabled ? '🎤' : '🔇'}
          </button>
          <button
            onClick={toggleVideo}
            className={`p-4 rounded-full ${
              videoEnabled ? 'bg-gray-200 hover:bg-gray-300' : 'bg-red-600'
            } ${videoEnabled ? 'text-gray-900' : 'text-white'} transition-colors`}
          >
            {videoEnabled ? '📹' : '📵'}
          </button>
        </div>

        {/* Name Input */}
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
              Your Name
            </label>
            <input
              id="name"
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Enter your name"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
            />
          </div>

          <Button
            onClick={handleJoin}
            disabled={isJoining || !guestName.trim()}
            size="lg"
            className="w-full"
          >
            {isJoining ? 'Joining...' : 'Join Broadcast'}
          </Button>

          <p className="text-sm text-gray-500 text-center">
            By joining, you agree to be recorded and streamed live.
          </p>
        </div>
      </div>
    </div>
  );
}
