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

  // Set stream to video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream) return;

    console.log('[GuestStreamPreview] Setting broadcast stream:', {
      streamId: stream.id,
      videoTracks: stream.getVideoTracks().length,
      audioTracks: stream.getAudioTracks().length,
      active: stream.active,
    });

    video.srcObject = stream;

    const handleLoadedMetadata = () => {
      console.log('[GuestStreamPreview] Video metadata loaded');
    };

    const handleCanPlay = () => {
      console.log('[GuestStreamPreview] Video can play');
      video.play().catch((err) => {
        console.warn('[GuestStreamPreview] Play on canplay failed:', err);
      });
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);

    video.play().catch((err) => {
      console.warn('[GuestStreamPreview] Auto-play failed:', err);
    });

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [stream]);

  // Update volume
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume;
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
