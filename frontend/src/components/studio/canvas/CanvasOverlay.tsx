import { memo, useState, useRef, useEffect } from 'react';
import { Caption } from '../../../services/caption.service';

// Memoized Caption Overlay Component - Draggable and constrained to canvas
export const CaptionOverlay = memo(({ caption }: { caption: Caption | null }) => {
  const [position, setPosition] = useState({ x: 50, y: 85 }); // Start at bottom center (%)
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!overlayRef.current || !overlayRef.current.parentElement) return;

      const parent = overlayRef.current.parentElement;
      const parentRect = parent.getBoundingClientRect();

      // Calculate new position in percentage
      const deltaX = e.clientX - dragStartPos.current.x;
      const deltaY = e.clientY - dragStartPos.current.y;

      const newX = position.x + (deltaX / parentRect.width) * 100;
      const newY = position.y + (deltaY / parentRect.height) * 100;

      // Constrain to parent bounds (0-100%)
      const constrainedX = Math.max(10, Math.min(90, newX));
      const constrainedY = Math.max(5, Math.min(95, newY));

      setPosition({ x: constrainedX, y: constrainedY });
      dragStartPos.current = { x: e.clientX, y: e.clientY };
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, position]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  if (!caption) return null;

  return (
    <div
      ref={overlayRef}
      className="absolute max-w-4xl px-4 cursor-move select-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: 'translate(-50%, -50%)',
        zIndex: 40,
      }}
      onMouseDown={handleMouseDown}
    >
      <div
        className={`px-6 py-3 rounded-lg text-center transition-opacity duration-300 ${
          caption.isFinal ? 'bg-black/90' : 'bg-black/70'
        } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        style={{
          backdropFilter: 'blur(8px)',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
        }}
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
