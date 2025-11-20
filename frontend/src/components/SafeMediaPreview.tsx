/**
 * SafeMediaPreview Component
 *
 * Reusable component for displaying images and videos with automatic error handling,
 * retry functionality, and fallback UI. Prevents broken image/video previews after
 * server reloads or network issues.
 *
 * Features:
 * - Automatic error detection
 * - Retry mechanism with visual feedback
 * - Loading states
 * - Fallback UI for failed media
 * - CORS handling
 * - Prevents infinite error loops
 */

import { useState } from 'react';

interface SafeMediaPreviewProps {
  src: string;
  alt?: string;
  type: 'image' | 'video';
  className?: string;
  fallbackClassName?: string;
  showRetryButton?: boolean;
  onError?: (error: any) => void;
  onRetry?: () => void;
  // Video-specific props
  muted?: boolean;
  autoPlay?: boolean;
  preload?: 'none' | 'metadata' | 'auto';
}

export function SafeMediaPreview({
  src,
  alt = '',
  type,
  className = '',
  fallbackClassName = '',
  showRetryButton = true,
  onError,
  onRetry,
  muted = true,
  autoPlay = false,
  preload = 'metadata',
}: SafeMediaPreviewProps) {
  const [hasError, setHasError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  const handleError = (e: any) => {
    console.error(`SafeMediaPreview: Failed to load ${type} from ${src}`, e);
    setHasError(true);
    setIsRetrying(false);
    onError?.(e);

    // Hide the broken element to prevent browser broken image icon
    if (e.currentTarget) {
      e.currentTarget.style.display = 'none';
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setHasError(false);
    // Force re-render by changing key
    setRetryKey(prev => prev + 1);
    onRetry?.();

    // Reset retrying state after a short delay
    setTimeout(() => {
      setIsRetrying(false);
    }, 1000);
  };

  // Show error fallback UI
  if (hasError) {
    return (
      <div className={`flex flex-col items-center justify-center bg-red-900/20 border border-red-500/50 ${fallbackClassName || className}`}>
        <span className="text-3xl mb-2">❌</span>
        <span className="text-xs text-red-400 mb-2">Failed to load {type}</span>
        {showRetryButton && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white text-xs rounded transition-colors"
          >
            {isRetrying ? '⏳ Retrying...' : '🔄 Retry'}
          </button>
        )}
      </div>
    );
  }

  // Show retrying state
  if (isRetrying) {
    return (
      <div className={`flex flex-col items-center justify-center bg-blue-900/20 border border-blue-500/50 ${fallbackClassName || className}`}>
        <div className="animate-spin text-2xl mb-2">⏳</div>
        <span className="text-xs text-blue-400">Loading {type}...</span>
      </div>
    );
  }

  // Render image
  if (type === 'image') {
    return (
      <img
        key={retryKey}
        src={src}
        alt={alt}
        className={className}
        onError={handleError}
        crossOrigin="anonymous"
        loading="lazy"
      />
    );
  }

  // Render video
  if (type === 'video') {
    return (
      <video
        key={retryKey}
        src={src}
        className={className}
        muted={muted}
        autoPlay={autoPlay}
        preload={preload}
        onError={handleError}
        crossOrigin="anonymous"
      />
    );
  }

  return null;
}
