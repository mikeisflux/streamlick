import { useRef, useEffect, useState } from 'react';
import { compositorService } from '../../../services/compositor.service';

interface CompositorPreviewProps {
  orientation?: 'landscape' | 'portrait';
}

/**
 * CompositorPreview - Displays the actual compositor canvas output
 * This shows what's being streamed (countdown, intro video, composed stream)
 * CRITICAL: This must be shown when broadcasting, NOT the StudioCanvas participant boxes
 */
export function CompositorPreview({ orientation = 'landscape' }: CompositorPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasInserted = useRef(false);
  const [volume, setVolume] = useState(100);
  const [showVolumeSlider, setShowVolumeSlider] = useState(false);

  useEffect(() => {
    // Get the compositor canvas
    const compositorCanvas = compositorService.getCanvas();

    console.log('[CompositorPreview] useEffect triggered', {
      hasCanvas: !!compositorCanvas,
      hasContainer: !!containerRef.current,
      alreadyInserted: canvasInserted.current
    });

    if (!compositorCanvas || !containerRef.current || canvasInserted.current) {
      return;
    }

    console.log('[CompositorPreview] Displaying compositor canvas in UI');

    // Insert the compositor canvas into the DOM
    containerRef.current.appendChild(compositorCanvas);
    canvasInserted.current = true;

    // Style the canvas to fit the container
    compositorCanvas.style.width = '100%';
    compositorCanvas.style.height = '100%';
    compositorCanvas.style.objectFit = 'contain';
    compositorCanvas.style.backgroundColor = '#000';

    console.log('[CompositorPreview] Compositor canvas added to DOM:', {
      width: compositorCanvas.width,
      height: compositorCanvas.height,
      displayed: true
    });

    // Cleanup function
    return () => {
      if (compositorCanvas && containerRef.current && compositorCanvas.parentNode === containerRef.current) {
        console.log('[CompositorPreview] Removing compositor canvas from DOM');
        containerRef.current.removeChild(compositorCanvas);
        canvasInserted.current = false;
      }
    };
  }, []);

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);

    // CRITICAL FIX: Use compositor service to set master volume
    // This controls the Web Audio API mixer which handles ALL audio:
    // - Participant audio (from WebRTC MediaStreams)
    // - Intro/countdown videos
    // - Audio/video clips
    // Setting HTML element .volume property doesn't affect Web Audio API routing
    compositorService.setInputVolume(newVolume);

    console.log(`[CompositorPreview] Master volume set to ${newVolume}%`);
  };

  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  return (
    <div
      ref={containerRef}
      className="relative group"
      style={{
        width: '100%',
        maxWidth: orientation === 'portrait' ? '563px' : '1001px',
        aspectRatio,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Canvas will be inserted here */}
      {!canvasInserted.current && (
        <div className="text-white text-sm">Loading compositor...</div>
      )}

      {/* Fullscreen button - bottom right */}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded text-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Fullscreen"
      >
        [ ]
      </button>

      {/* Volume control - center */}
      <div
        className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        onMouseEnter={() => setShowVolumeSlider(true)}
        onMouseLeave={() => setShowVolumeSlider(false)}
      >
        <div className="bg-black/70 rounded-lg p-4 flex flex-col items-center gap-2">
          <div className="text-white text-sm font-medium">Volume</div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xs">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="w-32 h-2"
            />
            <span className="text-white text-xs">100</span>
          </div>
          <div className="text-white text-sm">{volume}%</div>
        </div>
      </div>
    </div>
  );
}
