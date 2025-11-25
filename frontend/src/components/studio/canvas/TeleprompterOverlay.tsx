/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT DISPLAYS ON THE STUDIOCANVAS.
 *
 * NOTE: The teleprompter is intentionally NOT included in the hidden canvas broadcast
 * output because it is meant only for the host to read, not for viewers.
 *
 * However, if this behavior changes and you want the teleprompter to appear in the
 * broadcast, you MUST add corresponding drawing code to the hidden canvas in
 * StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 */

import { useEffect, useRef, memo } from 'react';

interface TeleprompterOverlayProps {
  notes: string;
  fontSize: number;
  isScrolling: boolean;
  scrollSpeed: number;
  scrollPosition: number;
}

export const TeleprompterOverlay = memo(function TeleprompterOverlay({
  notes,
  fontSize,
  isScrolling,
  scrollSpeed,
  scrollPosition,
}: TeleprompterOverlayProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  // Apply scroll position directly to DOM to avoid re-renders
  useEffect(() => {
    if (contentRef.current) {
      // Use transform instead of triggering layout
      contentRef.current.style.transform = `translateY(-${scrollPosition}px)`;
      contentRef.current.style.willChange = isScrolling ? 'transform' : 'auto';
    }
  }, [scrollPosition, isScrolling]);

  if (!notes) {
    return null;
  }

  return (
    <div
      className="absolute inset-0 pointer-events-none flex items-start justify-center overflow-hidden"
      style={{
        zIndex: 15, // Above video but below controls
        paddingTop: '20%', // Position text in upper-middle area for eye contact
      }}
    >
      {/* Semi-transparent background for better readability */}
      <div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* Scrolling text content */}
      <div
        className="relative w-full max-w-4xl px-8 transition-transform"
        ref={contentRef}
        style={{
          transitionDuration: isScrolling ? '0ms' : '300ms',
          transitionTimingFunction: 'linear',
        }}
      >
        <div
          className="text-white text-center"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
            fontFamily: 'system-ui, -apple-system, sans-serif',
            fontWeight: 500,
            textShadow: '2px 2px 4px rgba(0,0,0,0.8), 0 0 10px rgba(0,0,0,0.5)',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {notes}
        </div>
      </div>

      {/* Reading guide line - horizontal line to help maintain focus */}
      <div
        className="absolute left-0 right-0 pointer-events-none"
        style={{
          top: '25%',
          height: '3px',
          background: 'linear-gradient(90deg, transparent 10%, rgba(59, 130, 246, 0.6) 50%, transparent 90%)',
          boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)',
        }}
      />

      {/* Scrolling indicator */}
      {isScrolling && (
        <div
          className="absolute bottom-8 right-8 flex items-center gap-2 px-3 py-2 rounded-lg"
          style={{
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            backdropFilter: 'blur(4px)',
          }}
        >
          <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          <span className="text-white text-sm font-medium">Scrolling</span>
        </div>
      )}
    </div>
  );
});
