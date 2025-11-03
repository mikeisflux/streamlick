import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { broadcastService } from '../services/broadcast.service';
import { socketService } from '../services/socket.service';
import { useMedia } from '../hooks/useMedia';
import { useStudioStore } from '../store/studioStore';
import { VideoPreview } from '../components/VideoPreview';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';

export function Studio() {
  const { broadcastId } = useParams<{ broadcastId: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const { broadcast, isLive, setIsLive, setBroadcast } = useStudioStore();
  const {
    localStream,
    audioEnabled,
    videoEnabled,
    startCamera,
    stopCamera,
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
    };
  }, [broadcastId]);

  const handleGoLive = async () => {
    if (!broadcastId) return;

    try {
      await broadcastService.start(broadcastId);
      setIsLive(true);
      toast.success('You are now live!');
    } catch (error) {
      toast.error('Failed to go live');
    }
  };

  const handleEndBroadcast = async () => {
    if (!broadcastId) return;

    try {
      await broadcastService.end(broadcastId);
      setIsLive(false);
      toast.success('Broadcast ended');
    } catch (error) {
      toast.error('Failed to end broadcast');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading studio...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-white">{broadcast?.title || 'Studio'}</h1>
            {isLive && (
              <div className="flex items-center gap-2 mt-1">
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
                <span className="text-red-500 text-sm font-semibold">LIVE</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {!isLive ? (
              <Button onClick={handleGoLive} variant="primary" size="lg">
                🔴 Go Live
              </Button>
            ) : (
              <Button onClick={handleEndBroadcast} variant="danger" size="lg">
                ⏹️ End Broadcast
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex">
        {/* Sidebar */}
        <aside className="w-64 bg-gray-800 border-r border-gray-700 p-4">
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-2">Participants</h3>
              <div className="space-y-2">
                <div className="bg-gray-700 rounded p-2 text-sm text-white">
                  Host (You)
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Preview Area */}
        <main className="flex-1 p-6">
          <div className="bg-black rounded-lg overflow-hidden aspect-video">
            {localStream ? (
              <VideoPreview stream={localStream} muted />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500">
                No video
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="mt-6 flex justify-center gap-4">
            <button
              onClick={toggleAudio}
              className={`p-4 rounded-full ${
                audioEnabled ? 'bg-gray-700' : 'bg-red-600'
              } text-white hover:opacity-80 transition-opacity`}
            >
              {audioEnabled ? '🎤' : '🔇'}
            </button>
            <button
              onClick={toggleVideo}
              className={`p-4 rounded-full ${
                videoEnabled ? 'bg-gray-700' : 'bg-red-600'
              } text-white hover:opacity-80 transition-opacity`}
            >
              {videoEnabled ? '📹' : '📵'}
            </button>
          </div>
        </main>
      </div>
    </div>
  );
}
