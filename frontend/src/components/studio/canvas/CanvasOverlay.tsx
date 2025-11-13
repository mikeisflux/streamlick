import { memo } from 'react';
import { Caption } from '../../../services/caption.service';

// Memoized Caption Overlay Component to prevent re-renders
export const CaptionOverlay = memo(({ caption }: { caption: Caption | null }) => {
  if (!caption) return null;

  return (
    <div className="absolute bottom-16 left-1/2 transform -translate-x-1/2 max-w-4xl px-4 pointer-events-none">
      <div
        className={`px-6 py-3 rounded-lg text-center transition-opacity duration-300 ${
          caption.isFinal ? 'bg-black/90' : 'bg-black/70'
        }`}
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
