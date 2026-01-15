/**
 * GuestStreamPreview Component
 *
 * Shows the live broadcast stream preview with volume control.
 */

import { useRef, useEffect } from 'react';

interface GuestStreamPreviewProps {
  stream: MediaStream | null;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

export function GuestStreamPreview({
  stream,
  volume,
  onVolumeChange,
}: GuestStreamPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTrackIdRef = useRef<string | null>(null);

  // Helper to attempt playing video (no retry - let checkForFrames handle retries)
  const attemptPlay = (video: HTMLVideoElement, reason: string) => {
    const videoTrack = stream?.getVideoTracks()[0];
    console.log('[GuestStreamPreview] Attempting play:', {
      reason,
      trackId: videoTrack?.id,
      trackEnabled: videoTrack?.enabled,
      trackMuted: videoTrack?.muted,
      trackReadyState: videoTrack?.readyState,
      videoPaused: video.paused,
      videoReadyState: video.readyState,
    });

    video.play()
      .then(() => {
        console.log('[GuestStreamPreview] Play succeeded');
      })
      .catch((err) => {
        // Don't retry here - let checkForFrames handle retries to avoid conflicts
        console.warn('[GuestStreamPreview] Play failed:', err.message);
      });
  };

  // Set stream to video element with track change detection
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      const currentTrackId = videoTrack?.id || null;

      const streamChanged = video.srcObject !== stream;
      const trackChanged = currentTrackId !== lastTrackIdRef.current;

      if (streamChanged || trackChanged) {
        console.log('[GuestStreamPreview] Setting broadcast stream:', {
          streamId: stream.id,
          videoTracks: stream.getVideoTracks().length,
          audioTracks: stream.getAudioTracks().length,
          active: stream.active,
          streamChanged,
          trackChanged,
          oldTrackId: lastTrackIdRef.current,
          newTrackId: currentTrackId,
        });

        video.srcObject = stream;
        lastTrackIdRef.current = currentTrackId;
        attemptPlay(video, 'stream/track change');
      }
    } else if (video.srcObject) {
      video.srcObject = null;
      lastTrackIdRef.current = null;
    }
  }, [stream]);

  // Listen for track changes on the stream
  useEffect(() => {
    if (!stream) return;

    const handleTrackChange = () => {
      const video = videoRef.current;
      if (!video) return;

      const videoTrack = stream.getVideoTracks()[0];
      const currentTrackId = videoTrack?.id || null;

      if (currentTrackId !== lastTrackIdRef.current) {
        console.log('[GuestStreamPreview] Track changed via event:', {
          oldTrackId: lastTrackIdRef.current,
          newTrackId: currentTrackId,
        });
        video.srcObject = null;
        video.srcObject = stream;
        lastTrackIdRef.current = currentTrackId;
        attemptPlay(video, 'track event');
      }
    };

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);

    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
    };
  }, [stream]);

  // Monitor for stalled/paused video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    const handleStalled = () => {
      console.warn('[GuestStreamPreview] Video stalled, attempting recovery');
      attemptPlay(video, 'stalled event');
    };

    const handlePause = () => {
      if (stream && stream.getVideoTracks().length > 0) {
        console.warn('[GuestStreamPreview] Video paused unexpectedly, attempting resume');
        attemptPlay(video, 'unexpected pause');
      }
    };

    const handleCanPlay = () => {
      if (video.paused && stream) {
        console.log('[GuestStreamPreview] Video can play, ensuring playback');
        attemptPlay(video, 'canplay event');
      }
    };

    const handleLoadedMetadata = () => {
      console.log('[GuestStreamPreview] Video metadata loaded');
    };

    video.addEventListener('stalled', handleStalled);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, [stream]);

  // Monitor for frozen video (no frames) and attempt recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    let checkCount = 0;
    const maxChecks = 20; // Check for 10 seconds
    let hasResetSrcObject = false; // Only reset once

    const checkForFrames = () => {
      if (!video || !stream) return;

      checkCount++;
      const hasFrames = video.videoWidth > 0 && video.videoHeight > 0;

      if (!hasFrames && checkCount <= maxChecks) {
        console.log('[GuestStreamPreview] No video frames yet, check #' + checkCount, {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
          hasResetSrcObject,
        });

        // Only reset srcObject ONCE after 5 seconds if video still hasn't loaded
        if (checkCount === 10 && video.readyState === 0 && !hasResetSrcObject) {
          console.log('[GuestStreamPreview] Video not loading after 5s, resetting srcObject once');
          hasResetSrcObject = true;
          video.srcObject = null;
          // Small delay before re-assigning to let browser clean up
          setTimeout(() => {
            if (videoRef.current && stream) {
              videoRef.current.srcObject = stream;
              videoRef.current.play().catch(() => {});
            }
          }, 100);
        } else if (video.paused) {
          // Just try to play without resetting srcObject
          video.play().catch(() => {});
        }

        setTimeout(checkForFrames, 500);
      } else if (hasFrames) {
        console.log('[GuestStreamPreview] Video has frames:', {
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      } else {
        console.warn('[GuestStreamPreview] Video still has no frames after max retries');
      }
    };

    const timeoutId = setTimeout(checkForFrames, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [stream]);

  // Update volume - unmute when volume > 0 to allow autoplay to work initially
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
      // Only unmute if volume > 0 (muted attribute allows autoplay, then we unmute)
      videoRef.current.muted = volume === 0;
    }
  }, [volume]);

  return (
    <div className="flex-shrink-0 border-b border-gray-700">
      <div className="bg-black">
        <div className="relative aspect-video">
          {stream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-gray-900">
              <div className="text-center">
                <svg className="w-8 h-8 text-gray-600 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                <p className="text-gray-500 text-xs">Live Stream Preview</p>
              </div>
            </div>
          )}
          <div className="absolute top-2 left-2 bg-red-600 px-2 py-0.5 rounded text-xs text-white font-medium flex items-center gap-1">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></div>
            LIVE
          </div>
        </div>

        {/* Volume Slider */}
        <div className="bg-gray-800 px-3 py-2 flex items-center gap-2">
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
          </svg>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="flex-1 h-1 bg-gray-600 rounded-lg appearance-none cursor-pointer accent-blue-500"
            aria-label="Stream volume"
          />
          <span className="text-xs text-gray-400 w-8">{Math.round(volume * 100)}%</span>
        </div>
      </div>
    </div>
  );
}
