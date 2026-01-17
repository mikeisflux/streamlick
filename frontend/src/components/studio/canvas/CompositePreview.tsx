/**
 * CompositePreview - Displays the server-side composite stream
 *
 * IMPORTANT: NO CLIENT-SIDE CANVAS RENDERING
 * ==========================================
 * This component ONLY subscribes to and displays the server-side composite.
 * ALL compositing (combining participant videos) happens on the Ant Media Server
 * via the Media Push Plugin running streamlick_composite.html in headless Chrome.
 *
 * DO NOT add any canvas.drawImage() or local video compositing here.
 * DO NOT try to composite videos in the browser.
 *
 * This shows the host exactly what viewers will see on YouTube/streaming platforms.
 * The composite is rendered on the server, making it independent of the host's browser.
 *
 * See: .claude/ARCHITECTURE_NO_CLIENT_COMPOSITING.md for full details.
 */

import { useRef, useEffect, useState } from 'react';

interface CompositePreviewProps {
  compositeStreamId: string | null;
  orientation?: 'landscape' | 'portrait';
  showControls?: boolean;
}

export function CompositePreview({
  compositeStreamId,
  orientation = 'landscape',
  showControls = true,
}: CompositePreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Subscribe to composite stream when compositeStreamId changes
  useEffect(() => {
    if (!compositeStreamId) {
      setIsLoading(false);
      setError('No composite stream available');
      return;
    }

    let adaptor: any = null;
    let cleanup = false;

    const subscribeToStream = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Import WebRTCAdaptor dynamically
        const { WebRTCAdaptor } = await import('@antmedia/webrtc_adaptor');

        if (cleanup) return;

        adaptor = new WebRTCAdaptor({
          websocket_url: 'wss://media.streamlick.com:5443/LiveApp/websocket',
          mediaConstraints: { video: false, audio: false },
          peerconnection_config: {
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
          },
          sdp_constraints: {
            OfferToReceiveAudio: true,
            OfferToReceiveVideo: true
          },
          callback: (info: string, obj: any) => {
            console.log('[CompositePreview] Callback:', info, obj);

            if (info === 'initialized') {
              console.log('[CompositePreview] Initialized, playing stream:', compositeStreamId);
              adaptor.play(compositeStreamId);
            } else if (info === 'newStreamAvailable') {
              console.log('[CompositePreview] Stream available');
              if (videoRef.current && obj.stream) {
                videoRef.current.srcObject = obj.stream;
                videoRef.current.play().catch((e) => {
                  console.error('[CompositePreview] Play error:', e);
                });
                setIsLoading(false);
              }
            } else if (info === 'play_started') {
              console.log('[CompositePreview] Play started');
              setIsLoading(false);
            }
          },
          callbackError: (error: string, message: string) => {
            console.error('[CompositePreview] Error:', error, message);
            setError(`${error}: ${message}`);
            setIsLoading(false);
          }
        });
      } catch (err: any) {
        console.error('[CompositePreview] Failed to subscribe:', err);
        setError(err.message || 'Failed to subscribe to composite stream');
        setIsLoading(false);
      }
    };

    subscribeToStream();

    return () => {
      cleanup = true;
      if (adaptor) {
        try {
          adaptor.stop(compositeStreamId);
          adaptor.closeWebSocket();
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, [compositeStreamId]);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
        setIsFullscreen(false);
      } else {
        containerRef.current.requestFullscreen();
        setIsFullscreen(true);
      }
    }
  };

  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  return (
    <div
      ref={containerRef}
      className="relative group bg-black rounded-lg overflow-hidden"
      style={{
        width: '100%',
        height: '100%',
        maxWidth: orientation === 'portrait' ? '563px' : '1001px',
        maxHeight: '100%',
        aspectRatio,
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain bg-black"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
            <p className="text-white text-sm">Loading composite preview...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/70">
          <div className="text-center px-4">
            <svg className="w-12 h-12 text-red-500 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-white text-sm">{error}</p>
            <p className="text-gray-400 text-xs mt-2">Server composite may not be running</p>
          </div>
        </div>
      )}

      {/* No stream placeholder */}
      {!compositeStreamId && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <svg className="w-16 h-16 text-gray-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <p className="text-gray-400">Composite preview will appear here</p>
            <p className="text-gray-500 text-sm mt-1">Start broadcasting to see the output</p>
          </div>
        </div>
      )}

      {/* Live indicator */}
      {compositeStreamId && !isLoading && !error && (
        <div className="absolute top-3 left-3 flex items-center gap-2 bg-black/60 px-3 py-1.5 rounded-full">
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-white text-xs font-semibold">LIVE PREVIEW</span>
        </div>
      )}

      {/* Controls */}
      {showControls && (
        <button
          onClick={handleFullscreen}
          className="absolute bottom-3 right-3 bg-black/60 hover:bg-black/80 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
          title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5v-4m0 4h-4m4 0l-5-5" />
            </svg>
          )}
        </button>
      )}
    </div>
  );
}
