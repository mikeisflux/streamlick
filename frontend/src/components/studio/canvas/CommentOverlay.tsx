/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT DISPLAYS ON THE STUDIOCANVAS.
 * ANY VISUAL CHANGE HERE MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS
 * IN StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview. If you modify comment overlay styling, positioning,
 * platform colors, or appearance, you MUST update the corresponding drawing code in StudioCanvas.tsx.
 */

import { useState, useEffect, useRef } from 'react';

interface Comment {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
  authorName: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
}

interface CommentOverlayProps {
  comment: Comment | null;
  onDismiss: () => void;
  autoHideAfter?: number; // milliseconds, default 10 seconds
}

export function CommentOverlay({ comment, onDismiss, autoHideAfter = 10000 }: CommentOverlayProps) {
  const [isVisible, setIsVisible] = useState(false);
  const timersRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    if (comment) {
      setIsVisible(true);

      // Auto-hide after specified time
      const timer = setTimeout(() => {
        setIsVisible(false);
        const dismissTimer = setTimeout(onDismiss, 300); // Wait for fade out animation
        timersRef.current.push(dismissTimer);
      }, autoHideAfter);
      timersRef.current.push(timer);

      return () => {
        // Clear all timers on cleanup
        timersRef.current.forEach(t => clearTimeout(t));
        timersRef.current = [];
      };
    } else {
      setIsVisible(false);
    }
  }, [comment, autoHideAfter, onDismiss]);

  const platformIcons: Record<string, string> = {
    youtube: '📺',
    facebook: '👥',
    twitch: '🎮',
    linkedin: '💼',
    x: '𝕏',
    rumble: '🎬',
  };

  const platformColors: Record<string, string> = {
    youtube: '#FF0000',
    facebook: '#1877F2',
    twitch: '#9146FF',
    linkedin: '#0A66C2',
    x: '#000000',
    rumble: '#85C742',
  };

  if (!comment) return null;

  return (
    <div
      className="absolute left-1/2 transition-all duration-300"
      style={{
        bottom: '80px',
        transform: `translateX(-50%) ${isVisible ? 'translateY(0)' : 'translateY(20px)'}`,
        opacity: isVisible ? 1 : 0,
        zIndex: 20,
        maxWidth: '90%',
      }}
    >
      <div
        className="relative px-6 py-4 rounded-xl shadow-2xl"
        style={{
          backgroundColor: 'rgba(255, 255, 255, 0.95)',
          backdropFilter: 'blur(10px)',
          border: `3px solid ${platformColors[comment.platform]}`,
          minWidth: '400px',
          maxWidth: '800px',
        }}
      >
        {/* Close Button */}
        <button
          onClick={() => {
            setIsVisible(false);
            const timer = setTimeout(onDismiss, 300);
            timersRef.current.push(timer);
          }}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-gray-200 hover:bg-gray-300 transition-colors"
          title="Dismiss comment"
        >
          <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Platform Badge */}
        <div
          className="absolute -top-3 left-6 px-3 py-1 rounded-full text-white text-xs font-bold flex items-center gap-1"
          style={{ backgroundColor: platformColors[comment.platform] }}
        >
          <span>{platformIcons[comment.platform]}</span>
          <span>{comment.platform.toUpperCase()}</span>
        </div>

        {/* Comment Content */}
        <div className="flex items-start gap-4 mt-2">
          {/* Avatar */}
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 text-white font-bold text-lg"
            style={{ backgroundColor: platformColors[comment.platform] }}
          >
            {comment.authorAvatar ? (
              <img src={comment.authorAvatar} alt={comment.authorName} className="w-full h-full rounded-full" />
            ) : (
              comment.authorName.charAt(0).toUpperCase()
            )}
          </div>

          {/* Message */}
          <div className="flex-1 min-w-0">
            <div className="font-bold text-gray-900 text-lg mb-1">{comment.authorName}</div>
            <div className="text-gray-800 text-base leading-relaxed">{comment.message}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
