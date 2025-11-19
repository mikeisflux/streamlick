import { useRef, useEffect } from 'react';
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

  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  return (
    <div
      ref={containerRef}
      className="relative"
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
    </div>
  );
}
