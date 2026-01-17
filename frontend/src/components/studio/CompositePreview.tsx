import { useEffect, useRef, useState } from 'react';
import { Maximize2, Minimize2, Volume2, VolumeX } from 'lucide-react';
import { AntMediaClient } from '../../services/antmedia';

interface CompositePreviewProps {
  broadcastId: string;
  compositeStreamId: string | null;
  backgroundColor?: string;
  logoUrl?: string;
}

export function CompositePreview({
  broadcastId,
  compositeStreamId,
  backgroundColor = '#1a1a2e',
  logoUrl,
}: CompositePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const antMediaRef = useRef<AntMediaClient | null>(null);

  const [isConnected, setIsConnected] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to composite stream
  useEffect(() => {
    if (!compositeStreamId) {
      setIsConnected(false);
      return;
    }

    const streamId = `composite_${broadcastId}`;

    antMediaRef.current = new AntMediaClient({
      streamId,
      mode: 'play',
      onStateChange: (state) => {
        console.log('Composite stream state:', state);
        if (state === 'playing') {
          setIsConnected(true);
          setError(null);
        } else if (state === 'closed' || state === 'failed') {
          setIsConnected(false);
        }
      },
      onError: (err) => {
        console.error('Composite stream error:', err);
        setError('Failed to connect to composite stream');
        setIsConnected(false);
      },
      onRemoteStream: (stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      },
    });

    antMediaRef.current.connect();

    return () => {
      antMediaRef.current?.disconnect();
    };
  }, [broadcastId, compositeStreamId]);

  // Handle fullscreen
  const toggleFullscreen = async () => {
    if (!containerRef.current) return;

    if (!document.fullscreenElement) {
      await containerRef.current.requestFullscreen();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Toggle mute
  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video rounded-xl overflow-hidden group"
      style={{ backgroundColor }}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMuted}
        className={`absolute inset-0 w-full h-full object-contain ${
          isConnected ? 'opacity-100' : 'opacity-0'
        } transition-opacity duration-300`}
      />

      {/* Waiting State */}
      {!isConnected && !error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 border-4 border-dark-700 border-t-brand-500 rounded-full animate-spin mb-4" />
          <p className="text-dark-400 text-sm">
            {compositeStreamId
              ? 'Connecting to broadcast preview...'
              : 'Waiting for compositor...'}
          </p>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mb-4">
            <span className="text-3xl">!</span>
          </div>
          <p className="text-red-400 text-sm">{error}</p>
          <button
            onClick={() => {
              setError(null);
              antMediaRef.current?.connect();
            }}
            className="mt-4 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Logo Overlay */}
      {logoUrl && (
        <img
          src={logoUrl}
          alt="Logo"
          className="absolute top-4 right-4 max-w-[120px] max-h-[48px] object-contain"
        />
      )}

      {/* Controls Overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Connection Status */}
            <div className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${
              isConnected ? 'bg-green-500/20 text-green-400' : 'bg-dark-700 text-dark-400'
            }`}>
              <span className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-dark-500'
              }`} />
              {isConnected ? 'Connected' : 'Disconnected'}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Mute Button */}
            <button
              onClick={toggleMute}
              className="p-2 bg-dark-800/80 hover:bg-dark-700 rounded-lg transition"
              title={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4" />
              ) : (
                <Volume2 className="w-4 h-4" />
              )}
            </button>

            {/* Fullscreen Button */}
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-dark-800/80 hover:bg-dark-700 rounded-lg transition"
              title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
