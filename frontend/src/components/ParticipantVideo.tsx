import { useEffect, useRef } from 'react';

interface ParticipantVideoProps {
  stream: MediaStream | null;
  name: string;
  isMuted?: boolean;
  isLocal?: boolean;
  className?: string;
}

export function ParticipantVideo({
  stream,
  name,
  isMuted = false,
  isLocal = false,
  className = '',
}: ParticipantVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className={`relative bg-gray-900 rounded-lg overflow-hidden ${className}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal || isMuted}
        className="w-full h-full object-cover"
      />

      {/* Participant name overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-3">
        <div className="flex items-center justify-between">
          <span className="text-white text-sm font-medium">
            {name} {isLocal && '(You)'}
          </span>
          {isMuted && (
            <span className="text-red-500 text-sm">🔇</span>
          )}
        </div>
      </div>

      {/* Connection indicator */}
      {!stream && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
            <p className="text-white text-sm">Connecting...</p>
          </div>
        </div>
      )}
    </div>
  );
}
