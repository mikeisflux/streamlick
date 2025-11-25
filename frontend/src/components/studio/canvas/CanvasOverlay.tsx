/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT DISPLAYS ON THE STUDIOCANVAS.
 * ANY VISUAL CHANGE HERE MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS
 * IN StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview. If you modify caption styling, positioning,
 * or appearance, you MUST update the corresponding drawing code in StudioCanvas.tsx.
 */

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

// Intro Video Overlay Component
// Note: Video is muted because the compositor already plays audio
export const IntroVideoOverlay = memo(({ videoUrl }: { videoUrl: string | null }) => {
  if (!videoUrl) return null;

  return (
    <div className="absolute inset-0 bg-black z-50">
      <video
        src={videoUrl}
        autoPlay
        muted
        playsInline
        className="w-full h-full object-contain"
        style={{ backgroundColor: '#000' }}
      />
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/70 text-sm">
        Playing intro...
      </div>
    </div>
  );
});

IntroVideoOverlay.displayName = 'IntroVideoOverlay';
