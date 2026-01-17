import { useRef, useState, useEffect } from 'react';
import { useDrag } from 'react-dnd';

interface ParticipantPosition {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
}

interface DraggableParticipantProps {
  participant: {
    id: string;
    name: string;
    videoStream?: MediaStream;
    audioEnabled: boolean;
    videoEnabled: boolean;
  };
  position: ParticipantPosition;
  onPositionChange: (id: string, position: Partial<ParticipantPosition>) => void;
  containerWidth: number;
  containerHeight: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

export const DraggableParticipant: React.FC<DraggableParticipantProps> = ({
  participant,
  position,
  onPositionChange,
  containerWidth,
  containerHeight,
  isSelected,
  onSelect,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState<string | null>(null);

  // Setup video stream
  useEffect(() => {
    if (videoRef.current && participant.videoStream) {
      videoRef.current.srcObject = participant.videoStream;
    }
  }, [participant.videoStream]);

  // Drag functionality
  const handleMouseDown = (e: React.MouseEvent) => {
    if (resizeHandle) return;

    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    onSelect(participant.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newX = Math.max(0, Math.min(containerWidth - position.width, startPosX + deltaX));
      const newY = Math.max(0, Math.min(containerHeight - position.height, startPosY + deltaY));

      onPositionChange(participant.id, {
        x: newX,
        y: newY,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Resize functionality
  const handleResizeMouseDown = (e: React.MouseEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    setResizeHandle(handle);
    onSelect(participant.id);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = position.width;
    const startHeight = position.height;
    const startPosX = position.x;
    const startPosY = position.y;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = startWidth;
      let newHeight = startHeight;
      let newX = startPosX;
      let newY = startPosY;

      // Calculate new dimensions based on handle
      if (handle.includes('e')) {
        newWidth = Math.max(100, Math.min(containerWidth - startPosX, startWidth + deltaX));
      }
      if (handle.includes('w')) {
        newWidth = Math.max(100, startWidth - deltaX);
        newX = Math.max(0, startPosX + deltaX);
        if (newX === 0) newWidth = startPosX + startWidth;
      }
      if (handle.includes('s')) {
        newHeight = Math.max(75, Math.min(containerHeight - startPosY, startHeight + deltaY));
      }
      if (handle.includes('n')) {
        newHeight = Math.max(75, startHeight - deltaY);
        newY = Math.max(0, startPosY + deltaY);
        if (newY === 0) newHeight = startPosY + startHeight;
      }

      onPositionChange(participant.id, {
        x: newX,
        y: newY,
        width: newWidth,
        height: newHeight,
      });
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      setResizeHandle(null);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  };

  // Bring to front
  const bringToFront = () => {
    onPositionChange(participant.id, {
      zIndex: position.zIndex + 10,
    });
  };

  return (
    <div
      ref={containerRef}
      className={`absolute overflow-hidden rounded-lg ${
        isSelected ? 'ring-2 ring-blue-500' : ''
      } ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: `${position.width}px`,
        height: `${position.height}px`,
        zIndex: position.zIndex,
      }}
      onMouseDown={handleMouseDown}
      onDoubleClick={bringToFront}
    >
      {/* Video element */}
      <div className="relative w-full h-full bg-gray-900">
        {participant.videoEnabled && participant.videoStream ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
            <div className="text-6xl text-gray-600">
              {participant.name.charAt(0).toUpperCase()}
            </div>
          </div>
        )}

        {/* Overlay controls */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity">
          <div className="absolute bottom-0 left-0 right-0 p-3">
            <div className="flex items-center justify-between">
              <span className="text-white text-sm font-medium truncate">
                {participant.name}
              </span>
              <div className="flex items-center gap-2">
                {!participant.audioEnabled && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                    </svg>
                  </div>
                )}
                {!participant.videoEnabled && (
                  <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center">
                    <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resize handles - only show when selected */}
      {isSelected && (
        <>
          {/* Corner handles */}
          <div
            className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-nw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'nw')}
          />
          <div
            className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-ne-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'ne')}
          />
          <div
            className="absolute -bottom-1 -left-1 w-3 h-3 bg-blue-500 rounded-full cursor-sw-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'sw')}
          />
          <div
            className="absolute -bottom-1 -right-1 w-3 h-3 bg-blue-500 rounded-full cursor-se-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'se')}
          />

          {/* Edge handles */}
          <div
            className="absolute -top-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-500 rounded-full cursor-n-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'n')}
          />
          <div
            className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-2 bg-blue-500 rounded-full cursor-s-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 's')}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -left-1 w-2 h-6 bg-blue-500 rounded-full cursor-w-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'w')}
          />
          <div
            className="absolute top-1/2 -translate-y-1/2 -right-1 w-2 h-6 bg-blue-500 rounded-full cursor-e-resize"
            onMouseDown={(e) => handleResizeMouseDown(e, 'e')}
          />
        </>
      )}
    </div>
  );
};

// Layout presets
export const LAYOUT_PRESETS = {
  solo: (containerWidth: number, containerHeight: number, participantCount: number): ParticipantPosition[] => {
    return [{
      id: '0',
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      zIndex: 1,
    }];
  },

  sideBySide: (containerWidth: number, containerHeight: number, participantCount: number): ParticipantPosition[] => {
    const width = containerWidth / participantCount;
    return Array.from({ length: participantCount }, (_, i) => ({
      id: String(i),
      x: i * width,
      y: 0,
      width,
      height: containerHeight,
      zIndex: i + 1,
    }));
  },

  grid: (containerWidth: number, containerHeight: number, participantCount: number): ParticipantPosition[] => {
    const cols = Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / cols);
    const width = containerWidth / cols;
    const height = containerHeight / rows;

    return Array.from({ length: participantCount }, (_, i) => {
      const row = Math.floor(i / cols);
      const col = i % cols;
      return {
        id: String(i),
        x: col * width,
        y: row * height,
        width,
        height,
        zIndex: i + 1,
      };
    });
  },

  pip: (containerWidth: number, containerHeight: number, participantCount: number): ParticipantPosition[] => {
    const positions: ParticipantPosition[] = [{
      id: '0',
      x: 0,
      y: 0,
      width: containerWidth,
      height: containerHeight,
      zIndex: 1,
    }];

    // Small PIP windows for additional participants
    const pipWidth = 320;
    const pipHeight = 180;
    const padding = 20;

    for (let i = 1; i < participantCount; i++) {
      positions.push({
        id: String(i),
        x: containerWidth - pipWidth - padding,
        y: padding + (i - 1) * (pipHeight + padding),
        width: pipWidth,
        height: pipHeight,
        zIndex: i + 10,
      });
    }

    return positions;
  },

  spotlight: (containerWidth: number, containerHeight: number, participantCount: number): ParticipantPosition[] => {
    const mainHeight = containerHeight * 0.75;
    const thumbnailHeight = containerHeight * 0.25;
    const thumbnailWidth = containerWidth / (participantCount - 1 || 1);

    const positions: ParticipantPosition[] = [{
      id: '0',
      x: 0,
      y: 0,
      width: containerWidth,
      height: mainHeight,
      zIndex: 1,
    }];

    for (let i = 1; i < participantCount; i++) {
      positions.push({
        id: String(i),
        x: (i - 1) * thumbnailWidth,
        y: mainHeight,
        width: thumbnailWidth,
        height: thumbnailHeight,
        zIndex: i + 1,
      });
    }

    return positions;
  },
};
