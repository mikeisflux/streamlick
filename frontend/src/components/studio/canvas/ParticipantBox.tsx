/**
 * ⚠️ CRITICAL WARNING ⚠️
 * ANY VISUAL CHANGE TO THIS COMPONENT MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS
 * IN StudioCanvas.tsx OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview. This includes:
 * - Audio level visualization (glowing borders, animated rings)
 * - Camera frames and borders
 * - Lower thirds
 * - Position numbers
 * - Mute indicators
 * - Avatar display when video is off
 *
 * If you add or modify any visual element here, you MUST update the hidden canvas
 * drawing code in StudioCanvas.tsx to match.
 */

import { RefObject, useState, useEffect, useRef, useCallback } from 'react';

interface ParticipantBoxProps {
  stream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled?: boolean;
  showAudioLevel?: boolean; // Enable audio level visualization
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
  participantId?: string;
  onRemoveFromStage?: (participantId: string) => void;
  // Style settings
  cameraFrame?: 'none' | 'rounded' | 'circle' | 'square';
  borderWidth?: number;
  borderColor?: string;
  mirrorVideo?: boolean;
  // Edit mode
  editMode?: boolean;
  position?: { x: number; y: number; width: number; height: number };
  onPositionChange?: (position: { x: number; y: number; width: number; height: number }) => void;
  // Video element callback for canvas capture
  onVideoRef?: (videoElement: HTMLVideoElement | null) => void;
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
  participantId,
  onRemoveFromStage,
  cameraFrame = 'rounded',
  borderWidth = 0,
  borderColor = '#0066ff',
  mirrorVideo = false,
  editMode = false,
  position,
  onPositionChange,
  onVideoRef,
  showAudioLevel = false,
}: ParticipantBoxProps) {
  const iconSize = size === 'small' ? 'w-6 h-6' : size === 'medium' ? 'w-10 h-10' : 'w-16 h-16';
  const textSize = size === 'small' ? 'text-xs' : 'text-sm';

  // Calculate border radius based on frame type
  const getBorderRadius = () => {
    switch (cameraFrame) {
      case 'circle':
        return '50%';
      case 'rounded':
        return '12px';
      case 'square':
        return '0px';
      case 'none':
      default:
        return '0px';
    }
  };

  // Internal video ref for when no external ref is provided
  const internalVideoRef = useRef<HTMLVideoElement>(null);
  const activeVideoRef = videoRef || internalVideoRef;

  // Avatar state
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);

  // Audio level monitoring state
  const [audioLevel, setAudioLevel] = useState(0);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Load selected avatar from localStorage
  useEffect(() => {
    const storedAvatar = localStorage.getItem('selectedAvatar');
    if (storedAvatar) {
      setSelectedAvatar(storedAvatar);
    }
  }, []);

  // Set srcObject on video element when stream changes
  useEffect(() => {
    if (activeVideoRef.current) {
      if (stream && videoEnabled) {
        activeVideoRef.current.srcObject = stream;
      } else {
        // Clear srcObject when video is disabled to prevent flickering
        activeVideoRef.current.srcObject = null;
      }
    }
  }, [stream, videoEnabled, activeVideoRef]);

  // Notify parent of video element for canvas capture (for remote participants)
  useEffect(() => {
    if (onVideoRef && internalVideoRef.current) {
      onVideoRef(internalVideoRef.current);
    }
    return () => {
      if (onVideoRef) {
        onVideoRef(null);
      }
    };
  }, [onVideoRef]);

  // Set up audio level monitoring when showAudioLevel is enabled
  useEffect(() => {
    if (!showAudioLevel || !stream) {
      setAudioLevel(0);
      return;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack) {
      return;
    }

    // Create audio context and analyser
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.3;

    // Resume audio context if needed
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    // Create audio stream source from the track
    const monitorStream = new MediaStream([audioTrack]);
    const source = audioContext.createMediaStreamSource(monitorStream);
    source.connect(analyser);

    audioContextRef.current = audioContext;
    analyserRef.current = analyser;

    // Animation loop to update audio level
    const updateLevel = () => {
      if (!analyserRef.current) return;

      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
      analyserRef.current.getByteFrequencyData(dataArray);

      // Calculate average level
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const normalizedLevel = average / 255;

      setAudioLevel(normalizedLevel);
      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    updateLevel();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [showAudioLevel, stream]);

  // Drag and resize state
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeHandle, setResizeHandle] = useState<'se' | 'sw' | 'ne' | 'nw' | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  // Handle drag start
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!editMode || !onPositionChange || !position) return;
    e.preventDefault();
    e.stopPropagation();

    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  // Handle resize start
  const handleResizeMouseDown = (e: React.MouseEvent, handle: 'se' | 'sw' | 'ne' | 'nw') => {
    if (!editMode || !onPositionChange || !position) return;
    e.preventDefault();
    e.stopPropagation();

    setIsResizing(true);
    setResizeHandle(handle);
    setDragStart({ x: e.clientX, y: e.clientY });
  };

  // Handle mouse move for dragging and resizing
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!editMode || !onPositionChange || !position) return;

      if (isDragging) {
        const newX = e.clientX - dragStart.x;
        const newY = e.clientY - dragStart.y;

        // Constrain to parent container (assuming 1920x1080 canvas)
        const constrainedX = Math.max(0, Math.min(1920 - position.width, newX));
        const constrainedY = Math.max(0, Math.min(1080 - position.height, newY));

        onPositionChange({
          ...position,
          x: constrainedX,
          y: constrainedY,
        });
      } else if (isResizing && resizeHandle) {
        const deltaX = e.clientX - dragStart.x;
        const deltaY = e.clientY - dragStart.y;

        let newX = position.x;
        let newY = position.y;
        let newWidth = position.width;
        let newHeight = position.height;

        // Handle different resize handles
        if (resizeHandle.includes('e')) {
          newWidth = Math.max(100, position.width + deltaX);
        }
        if (resizeHandle.includes('w')) {
          newWidth = Math.max(100, position.width - deltaX);
          newX = position.x + deltaX;
        }
        if (resizeHandle.includes('s')) {
          newHeight = Math.max(75, position.height + deltaY);
        }
        if (resizeHandle.includes('n')) {
          newHeight = Math.max(75, position.height - deltaY);
          newY = position.y + deltaY;
        }

        // Constrain to canvas
        newX = Math.max(0, Math.min(1920 - newWidth, newX));
        newY = Math.max(0, Math.min(1080 - newHeight, newY));

        onPositionChange({
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight,
        });

        setDragStart({ x: e.clientX, y: e.clientY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
    };

    if (isDragging || isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);

      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, position, editMode, onPositionChange, resizeHandle]);

  // Connection quality color mapping
  const qualityColors = {
    excellent: '#10b981', // green
    good: '#f59e0b', // yellow
    poor: '#ef4444', // red
    disconnected: '#6b7280', // gray
  };

  return (
    <>
      {/* CSS keyframes for audio pulse animation */}
      {showAudioLevel && (
        <style>{`
          @keyframes audioPulse {
            0%, 100% { transform: scale(1); opacity: 0.6; }
            50% { transform: scale(1.1); opacity: 0.3; }
          }
        `}</style>
      )}
      <div
        ref={boxRef}
        className="relative bg-black rounded overflow-hidden h-full w-full group"
        style={{
          cursor: editMode ? (isDragging ? 'grabbing' : 'grab') : 'default',
          outline: editMode ? '2px dashed #8B5CF6' : 'none',
          outlineOffset: '2px',
          // Add audio level border glow when speaking
          border: showAudioLevel && audioLevel > 0.05
            ? `3px solid rgba(59, 130, 246, ${0.5 + audioLevel})`
            : undefined,
          boxShadow: showAudioLevel && audioLevel > 0.05
            ? `0 0 ${10 + audioLevel * 20}px rgba(59, 130, 246, ${audioLevel * 0.8})`
            : undefined,
        }}
        onMouseDown={editMode ? handleMouseDown : undefined}
      >
      {/* Hover Overlay with Remove from Stage Button */}
      {onRemoveFromStage && participantId && !isHost && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center z-20">
          <button
            onClick={() => onRemoveFromStage(participantId)}
            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded shadow-lg"
            title="Remove from Stage"
          >
            Remove from Stage
          </button>
        </div>
      )}

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
        <div className="relative w-full h-full">
          <video
            ref={activeVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{
              willChange: 'auto',
              border: cameraFrame !== 'none' && borderWidth > 0 ? `${borderWidth}px solid ${borderColor}` : 'none',
              borderRadius: getBorderRadius(),
              transform: mirrorVideo ? 'scaleX(-1)' : 'none',
            }}
          />
          {/* Audio glow overlay when speaking with video on */}
          {showAudioLevel && audioLevel > 0.05 && (
            <div
              className="absolute inset-0 pointer-events-none rounded"
              style={{
                boxShadow: `inset 0 0 ${10 + audioLevel * 15}px rgba(59, 130, 246, ${audioLevel * 0.6})`,
              }}
            />
          )}
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-900 relative" style={{ overflow: 'visible' }}>
          {/* Audio visualization rings - extend beyond the tile when speaking */}
          {showAudioLevel && audioLevel > 0.05 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ overflow: 'visible' }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="absolute rounded-full border-2 border-blue-400"
                  style={{
                    // Start at 80px, grow with audio level
                    // Each ring adds 25px, audio adds up to 60px more
                    width: `${80 + i * 25 + audioLevel * 60}px`,
                    height: `${80 + i * 25 + audioLevel * 60}px`,
                    opacity: Math.max(0.2, (1 - i * 0.25) * (audioLevel * 2)),
                    animation: `audioPulse ${0.4 + i * 0.15}s ease-in-out infinite`,
                    borderWidth: `${3 - i * 0.5}px`,
                  }}
                />
              ))}
            </div>
          )}
          {selectedAvatar ? (
            <div className="w-full h-full flex items-center justify-center p-8 z-10">
              <div
                className="w-1/4 aspect-square rounded-full overflow-hidden"
                style={{
                  boxShadow: showAudioLevel && audioLevel > 0.05
                    ? `0 0 ${20 + audioLevel * 40}px rgba(59, 130, 246, ${0.5 + audioLevel})`
                    : 'none',
                }}
              >
                <img
                  src={selectedAvatar}
                  alt={name}
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          ) : (
            <div className="text-center z-10">
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
          )}
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

      {/* Resize Handles - Only visible in edit mode */}
      {editMode && onPositionChange && (
        <>
          {/* Southeast handle */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
            className="absolute bottom-0 right-0 w-4 h-4 bg-purple-600 cursor-se-resize z-30 hover:bg-purple-700"
            style={{ borderRadius: '0 0 4px 0' }}
          />
          {/* Southwest handle */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
            className="absolute bottom-0 left-0 w-4 h-4 bg-purple-600 cursor-sw-resize z-30 hover:bg-purple-700"
            style={{ borderRadius: '0 0 0 4px' }}
          />
          {/* Northeast handle */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
            className="absolute top-0 right-0 w-4 h-4 bg-purple-600 cursor-ne-resize z-30 hover:bg-purple-700"
            style={{ borderRadius: '0 4px 0 0' }}
          />
          {/* Northwest handle */}
          <div
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
            className="absolute top-0 left-0 w-4 h-4 bg-purple-600 cursor-nw-resize z-30 hover:bg-purple-700"
            style={{ borderRadius: '4px 0 0 0' }}
          />
        </>
      )}
    </div>
    </>
  );
}
