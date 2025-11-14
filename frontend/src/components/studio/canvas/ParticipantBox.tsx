import { RefObject } from 'react';

interface ParticipantBoxProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled?: boolean;
  name: string;
  title?: string;
  positionNumber?: number;
  isHost?: boolean;
  videoRef?: RefObject<HTMLVideoElement>;
  size?: 'small' | 'medium' | 'large';
  connectionQuality?: 'excellent' | 'good' | 'poor' | 'disconnected';
  showPositionNumber?: boolean;
  showConnectionQuality?: boolean;
  showLowerThird?: boolean;
}

export function ParticipantBox({
  stream,
  videoEnabled,
  audioEnabled = true,
  name,
  title,
  positionNumber,
  isHost = false,
  videoRef,
  size = 'large',
  connectionQuality = 'excellent',
  showPositionNumber = true,
  showConnectionQuality = true,
  showLowerThird = true,
}: ParticipantBoxProps) {
  const iconSize = size === 'small' ? 'w-6 h-6' : size === 'medium' ? 'w-10 h-10' : 'w-16 h-16';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';

  // Connection quality color mapping
  const qualityColors = {
    excellent: '#10b981', // green
    good: '#f59e0b', // yellow
    poor: '#ef4444', // red
    disconnected: '#6b7280', // gray
  };

  return (
    <div className="relative bg-black rounded overflow-hidden h-full w-full">
      {/* Position Number Badge - Top Left */}
      {showPositionNumber && positionNumber !== undefined && (
        <div
          className="absolute top-2 left-2 flex items-center justify-center rounded-full font-bold text-white z-10"
          style={{
            width: '28px',
            height: '28px',
            backgroundColor: 'rgba(0, 102, 255, 0.9)',
            fontSize: '14px',
          }}
        >
          {positionNumber}
        </div>
      )}

      {/* Connection Quality Indicator - Top Right */}
      {showConnectionQuality && (
        <div
          className="absolute top-2 right-2 flex items-center justify-center rounded-full z-10"
          style={{
            width: '24px',
            height: '24px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
          }}
          title={`Connection: ${connectionQuality}`}
        >
          <div
            className="rounded-full"
            style={{
              width: '12px',
              height: '12px',
              backgroundColor: qualityColors[connectionQuality],
            }}
          />
        </div>
      )}

      {/* Video or Camera Off Placeholder */}
      {stream && videoEnabled ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ willChange: 'auto' }}
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900">
          <div className="text-center">
            <svg
              className={`${iconSize} text-gray-600 mx-auto mb-2`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
              <line x1="2" y1="2" x2="22" y2="22" stroke="currentColor" strokeWidth={2} />
            </svg>
            <p className={`text-gray-500 ${textSize}`}>Camera Off</p>
          </div>
        </div>
      )}

      {/* Mute Indicator - Bottom Right (40px from bottom) */}
      {!audioEnabled && (
        <div
          className="absolute right-3 flex items-center justify-center rounded-full z-10"
          style={{
            bottom: '52px', // 40px from bottom of lower third (40 + 12)
            width: '32px',
            height: '32px',
            backgroundColor: 'rgba(220, 38, 38, 0.9)', // Red
          }}
          title="Microphone muted"
        >
          <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
            />
          </svg>
        </div>
      )}

      {/* Lower Third Name Display - 40px from bottom */}
      {showLowerThird && (
        <div
          className="absolute left-0 right-0 flex items-center px-3"
          style={{
            bottom: '40px',
            height: '40px',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            borderRadius: '20px',
            marginLeft: '16px',
            marginRight: '16px',
          }}
        >
          <div className="text-white flex-1">
            <div className={`font-semibold truncate ${textSize}`}>
              {name}
              {isHost && <span className="ml-1 text-blue-400">(Host)</span>}
            </div>
            {title && <div className="text-xs text-gray-300 truncate">{title}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
