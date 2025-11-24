import { memo, useState, useRef, useEffect } from 'react';
import { Caption } from '../../../services/caption.service';

// Memoized Caption Overlay Component - Draggable, resizable, constrained to canvas
export const CaptionOverlay = memo(({ caption }: { caption: Caption | null }) => {
  const [position, setPosition] = useState({ x: 50, y: 85, width: 600, height: 80 }); // x, y in %, width/height in px
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0, elemX: 0, elemY: 0 });
  const resizeStartSize = useRef({ width: 0, height: 0, startX: 0, startY: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging && !isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!overlayRef.current?.parentElement) return;

      const parent = overlayRef.current.parentElement;
      const parentRect = parent.getBoundingClientRect();

      if (isDragging) {
        // Calculate delta in pixels
        const deltaX = e.clientX - dragStartPos.current.x;
        const deltaY = e.clientY - dragStartPos.current.y;

        // Calculate new position in pixels
        const newXPx = dragStartPos.current.elemX + deltaX;
        const newYPx = dragStartPos.current.elemY + deltaY;

        // Convert to percentage and constrain to bounds
        const newX = (newXPx / parentRect.width) * 100;
        const newY = (newYPx / parentRect.height) * 100;

        // Account for element width/height when constraining
        const elemWidthPercent = (position.width / parentRect.width) * 100;
        const elemHeightPercent = (position.height / parentRect.height) * 100;

        const constrainedX = Math.max(elemWidthPercent / 2, Math.min(100 - elemWidthPercent / 2, newX));
        const constrainedY = Math.max(elemHeightPercent / 2, Math.min(100 - elemHeightPercent / 2, newY));

        setPosition(prev => ({ ...prev, x: constrainedX, y: constrainedY }));
      } else if (isResizing) {
        const deltaX = e.clientX - resizeStartSize.current.startX;
        const deltaY = e.clientY - resizeStartSize.current.startY;

        const newWidth = Math.max(200, Math.min(parentRect.width * 0.9, resizeStartSize.current.width + deltaX));
        const newHeight = Math.max(60, resizeStartSize.current.height + deltaY);

        setPosition(prev => ({ ...prev, width: newWidth, height: newHeight }));
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, position.width, position.height]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!overlayRef.current?.parentElement) return;

    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);

    const parentRect = overlayRef.current.parentElement.getBoundingClientRect();
    const elemXPx = (position.x / 100) * parentRect.width;
    const elemYPx = (position.y / 100) * parentRect.height;

    dragStartPos.current = {
      x: e.clientX,
      y: e.clientY,
      elemX: elemXPx,
      elemY: elemYPx
    };
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    resizeStartSize.current = {
      width: position.width,
      height: position.height,
      startX: e.clientX,
      startY: e.clientY
    };
  };

  if (!caption) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute select-none group"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        width: `${position.width}px`,
        minHeight: `${position.height}px`,
        zIndex: 40,
      }}
    >
      <div
        className={`h-full px-6 py-3 rounded-lg text-center transition-opacity duration-300 ${
          caption.isFinal ? 'bg-black/90' : 'bg-black/70'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}
        onMouseDown={handleMouseDown}
      >
        <p
          className={`text-white font-semibold leading-tight ${
            caption.isFinal ? 'text-lg' : 'text-base opacity-80'
          }`}
          style={{
            textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
          }}
        >
          {caption.text}
        </p>
        {!caption.isFinal && (
          <div className="flex items-center justify-center gap-1 mt-1">
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
            <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
          </div>
        )}
      </div>

      {/* Resize handle - bottom right corner */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.5) 50%)',
        }}
      />
    </div>
  );
});

CaptionOverlay.displayName = 'CaptionOverlay';

// Countdown Overlay Component
export const CountdownOverlay = memo(({ seconds }: { seconds: number | null }) => {
  if (seconds === null || seconds <= 0) return null;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-sm pointer-events-none z-50">
      <div className="text-center">
        <div className="text-9xl font-bold text-white mb-4 animate-pulse" style={{
          textShadow: '0 0 30px rgba(255, 255, 255, 0.5), 0 0 60px rgba(59, 130, 246, 0.5)',
        }}>
          {seconds}
        </div>
        <div className="text-2xl font-semibold text-white/90" style={{
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.8)',
        }}>
          Going live in...
        </div>
      </div>
    </div>
  );
});

CountdownOverlay.displayName = 'CountdownOverlay';
