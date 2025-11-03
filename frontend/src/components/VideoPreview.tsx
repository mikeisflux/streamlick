import { useEffect, useRef } from 'react';

interface VideoPreviewProps {
  stream: MediaStream | null;
  muted?: boolean;
  className?: string;
}

export function VideoPreview({ stream, muted = false, className = '' }: VideoPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted={muted}
      className={`w-full h-full object-cover ${className}`}
    />
  );
}
