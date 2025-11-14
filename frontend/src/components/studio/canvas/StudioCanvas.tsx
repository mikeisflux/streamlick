import { useRef } from 'react';
import { CaptionOverlay } from './CanvasOverlay';
import { ParticipantBox } from './ParticipantBox';
import { Caption } from '../../../services/caption.service';

interface RemoteParticipant {
  id: string;
  name: string;
  stream: MediaStream | null;
  audioEnabled: boolean;
  videoEnabled: boolean;
  role: 'host' | 'guest' | 'backstage';
}

interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

interface StudioCanvasProps {
  localStream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  remoteParticipants: Map<string, RemoteParticipant>;
  isSharingScreen: boolean;
  screenShareStream: MediaStream | null;
  selectedLayout: number;
  chatMessages: ChatMessage[];
  showChatOnStream: boolean;
  chatOverlayPosition: { x: number; y: number };
  chatOverlaySize: { width: number; height: number };
  isDraggingChat: boolean;
  isResizingChat: boolean;
  chatOverlayRef: React.RefObject<HTMLDivElement>;
  onChatOverlayDragStart: (e: React.MouseEvent) => void;
  onChatOverlayResizeStart: (e: React.MouseEvent) => void;
  captionsEnabled: boolean;
  currentCaption: Caption | null;
  editMode?: boolean;
  backgroundColor?: string;
  showResolutionBadge?: boolean;
  showPositionNumbers?: boolean;
  showConnectionQuality?: boolean;
  showLowerThirds?: boolean;
}

export function StudioCanvas({
  localStream,
  videoEnabled,
  audioEnabled,
  remoteParticipants,
  isSharingScreen,
  screenShareStream,
  selectedLayout,
  chatMessages,
  showChatOnStream,
  chatOverlayPosition,
  chatOverlaySize,
  isDraggingChat,
  isResizingChat,
  chatOverlayRef,
  onChatOverlayDragStart,
  onChatOverlayResizeStart,
  captionsEnabled,
  currentCaption,
  editMode = false,
  backgroundColor = '#0F1419',
  showResolutionBadge = true,
  showPositionNumbers = true,
  showConnectionQuality = true,
  showLowerThirds = true,
}: StudioCanvasProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

  // Calculate total participants (local + remote on-stage)
  const onStageParticipants = Array.from(remoteParticipants.values()).filter(
    (p) => p.role !== 'backstage' && p.id !== 'screen-share'
  );
  const totalParticipants = 1 + onStageParticipants.length; // 1 for local user

  // Dynamic grid calculation using the formula: cols = Math.ceil(Math.sqrt(count))
  const calculateDynamicGrid = (participantCount: number) => {
    const cols = Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / cols);
    return { cols, rows };
  };

  // Get layout styles based on selected layout
  const getLayoutStyles = (layoutId: number | 'screenshare') => {
    // Screen share layout overrides all other layouts
    if (layoutId === 'screenshare') {
      return {
        container: 'flex gap-2 p-2',
        sidebar: 'flex flex-col gap-2',
        sidebarWidth: 'w-[20%]',
        mainVideo: 'flex-1',
        screenShare: 'flex-1 w-[80%]',
      };
    }

    // Calculate dynamic grid for grid-based layouts
    const { cols, rows } = calculateDynamicGrid(totalParticipants);

    switch (layoutId) {
      case 1: // Dynamic Grid (auto-arranges based on participant count)
        return {
          container: 'grid gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
          gridCols: cols,
          gridRows: rows,
        };
      case 2: // Spotlight (one large, thumbnails on right)
        return {
          container: 'flex gap-2 p-2',
          mainVideo: 'flex-1',
          sidebar: 'flex flex-col gap-2 w-1/4',
        };
      case 3: // Sidebar left (narrow left, wide right)
        return {
          container: 'flex gap-2 p-2',
          sidebar: 'flex flex-col gap-2 w-1/4',
          mainVideo: 'flex-1',
        };
      case 4: // Picture-in-picture
        return {
          container: 'relative',
          mainVideo: 'absolute inset-0',
          pip: 'absolute bottom-4 right-4 w-1/4 h-1/4',
        };
      case 5: // Vertical split 50/50
        return {
          container: 'flex gap-2 p-2',
          mainVideo: 'flex-1',
        };
      case 6: // Horizontal split 50/50
        return {
          container: 'flex flex-col gap-2 p-2',
          mainVideo: 'flex-1',
        };
      case 7: // Dynamic Grid 3x3 (auto-arranges, prefers 3 cols for larger groups)
        return {
          container: 'grid gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
          gridCols: Math.max(3, cols), // Minimum 3 columns for layout 7
          gridRows: Math.ceil(totalParticipants / Math.max(3, cols)),
        };
      case 8: // Dynamic Grid (larger gaps)
        return {
          container: 'grid gap-4 p-4',
          mainVideo: 'col-span-1 row-span-1',
          gridCols: cols,
          gridRows: rows,
        };
      case 9: // Full screen (single)
      default:
        return {
          container: 'relative',
          mainVideo: 'absolute inset-0',
        };
    }
  };

  // Update video srcObject when localStream changes
  if (mainVideoRef.current && localStream) {
    mainVideoRef.current.srcObject = localStream;
  }
  if (screenShareVideoRef.current && screenShareStream) {
    screenShareVideoRef.current.srcObject = screenShareStream;
  }

  return (
    <div
      className="relative"
      style={{
        width: '100%',
        maxWidth: '1178px',
        aspectRatio: '16 / 9',
        backgroundColor,
        border: editMode ? '4px solid #8B5CF6' : 'none',
        boxSizing: 'border-box',
      }}
    >
      {/* Main Video Preview with Dynamic Layout */}
      <div
        className={`absolute inset-0 overflow-hidden ${
          getLayoutStyles(isSharingScreen || screenShareStream ? 'screenshare' : selectedLayout).container
        }`}
        style={{
          backgroundColor,
          ...(getLayoutStyles(selectedLayout).gridCols && {
            gridTemplateColumns: `repeat(${getLayoutStyles(selectedLayout).gridCols}, 1fr)`,
            gridTemplateRows: `repeat(${getLayoutStyles(selectedLayout).gridRows}, 1fr)`,
          }),
        }}
      >
        {/* Screen Share Layout - Active when screen sharing */}
        {isSharingScreen || screenShareStream ? (
          <>
            {/* Left Sidebar - Participant Thumbnails (20%) */}
            <div
              className={`${getLayoutStyles('screenshare').sidebar} ${
                getLayoutStyles('screenshare').sidebarWidth
              } gap-2`}
            >
              {/* Host Video */}
              <div className="flex-1">
                <ParticipantBox
                  stream={localStream}
                  videoEnabled={videoEnabled}
                  audioEnabled={audioEnabled}
                  name="You"
                  positionNumber={1}
                  isHost={true}
                  videoRef={mainVideoRef}
                  size="small"
                  showPositionNumber={showPositionNumbers}
                  showConnectionQuality={showConnectionQuality}
                  showLowerThird={showLowerThirds}
                />
              </div>

              {/* Remote Participants - Up to 4 slots */}
              {Array.from(remoteParticipants.values())
                .filter((p) => p.id !== 'screen-share')
                .slice(0, 4)
                .map((participant, index) => (
                  <div key={participant.id} className="flex-1">
                    <ParticipantBox
                      stream={participant.stream}
                      videoEnabled={participant.videoEnabled}
                      audioEnabled={participant.audioEnabled}
                      name={participant.name}
                      positionNumber={index + 2}
                      size="small"
                      showPositionNumber={showPositionNumbers}
                      showConnectionQuality={showConnectionQuality}
                      showLowerThird={showLowerThirds}
                    />
                  </div>
                ))}
            </div>

            {/* Right Side - Screen Share (80%) */}
            <div
              className={`relative bg-black rounded overflow-hidden ${getLayoutStyles('screenshare').screenShare}`}
            >
              {screenShareStream ? (
                <video
                  ref={screenShareVideoRef}
                  autoPlay
                  playsInline
                  className="w-full h-full object-contain"
                  style={{ willChange: 'auto', backgroundColor: '#000' }}
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-16 h-16 text-gray-600 mx-auto mb-2"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm">Screen Share</p>
                  </div>
                </div>
              )}
              <div className="absolute top-2 left-2 bg-blue-600 px-3 py-1 rounded text-white text-xs font-semibold">
                🖥️ Screen Sharing
              </div>
            </div>
          </>
        ) : (
          <>
            {/* Normal Layout - When not screen sharing */}

            {/* Grid Layouts with Dynamic Participant Rendering (1, 7, 8) */}
            {(selectedLayout === 1 || selectedLayout === 7 || selectedLayout === 8) && (
              <>
                {/* Render local user first */}
                <div className={`${getLayoutStyles(selectedLayout).mainVideo}`}>
                  <ParticipantBox
                    stream={localStream}
                    videoEnabled={videoEnabled}
                    audioEnabled={audioEnabled}
                    name="You"
                    positionNumber={1}
                    isHost={true}
                    videoRef={mainVideoRef}
                    size="medium"
                    connectionQuality="excellent"
                    showPositionNumber={showPositionNumbers}
                    showConnectionQuality={showConnectionQuality}
                    showLowerThird={showLowerThirds}
                  />
                </div>

                {/* Render remote participants */}
                {onStageParticipants.map((participant, index) => (
                  <div key={participant.id} className={`${getLayoutStyles(selectedLayout).mainVideo}`}>
                    <ParticipantBox
                      stream={participant.stream}
                      videoEnabled={participant.videoEnabled}
                      audioEnabled={participant.audioEnabled}
                      name={participant.name}
                      positionNumber={index + 2}
                      isHost={participant.role === 'host'}
                      size="medium"
                      connectionQuality="excellent"
                      showPositionNumber={showPositionNumbers}
                      showConnectionQuality={showConnectionQuality}
                      showLowerThird={showLowerThirds}
                    />
                  </div>
                ))}

                {/* Fill empty slots if needed (for aesthetic purposes) */}
                {totalParticipants < getLayoutStyles(selectedLayout).gridCols! * getLayoutStyles(selectedLayout).gridRows! &&
                  Array.from({
                    length:
                      getLayoutStyles(selectedLayout).gridCols! * getLayoutStyles(selectedLayout).gridRows! -
                      totalParticipants,
                  }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className={`relative bg-gray-900 rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}
                    >
                      <div className="w-full h-full flex items-center justify-center">
                        <div className="text-center">
                          <svg
                            className="w-12 h-12 text-gray-700 mx-auto mb-1"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                            />
                          </svg>
                          <p className="text-gray-600 text-xs">Empty Slot</p>
                        </div>
                      </div>
                    </div>
                  ))}
              </>
            )}

            {/* Non-grid layouts - Original rendering */}
            {selectedLayout !== 1 && selectedLayout !== 7 && selectedLayout !== 8 && (
              <div className={`${getLayoutStyles(selectedLayout).mainVideo}`}>
                <ParticipantBox
                  stream={localStream}
                  videoEnabled={videoEnabled}
                  audioEnabled={audioEnabled}
                  name="You"
                  positionNumber={1}
                  isHost={true}
                  videoRef={mainVideoRef}
                  size="large"
                  showPositionNumber={showPositionNumbers}
                  showConnectionQuality={showConnectionQuality}
                  showLowerThird={showLowerThirds}
                />
              </div>
            )}

            {/* Sidebar layout with thumbnails (2) */}
            {selectedLayout === 2 && (
              <div className={getLayoutStyles(selectedLayout).sidebar}>
                {[1, 2, 3].map((slot) => (
                  <div key={slot} className="relative bg-gray-900 rounded overflow-hidden flex-1">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="w-8 h-8 text-gray-700 mx-auto"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Vertical split 50/50 (5) */}
            {selectedLayout === 5 && (
              <div className="relative bg-gray-900 rounded overflow-hidden flex-1">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-12 h-12 text-gray-700 mx-auto mb-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <p className="text-gray-600 text-xs">Empty Slot</p>
                  </div>
                </div>
              </div>
            )}

            {/* Sidebar left layout (3) */}
            {selectedLayout === 3 && (
              <div className={getLayoutStyles(selectedLayout).sidebar} style={{ order: -1 }}>
                {[1, 2, 3].map((slot) => (
                  <div key={slot} className="relative bg-gray-900 rounded overflow-hidden flex-1">
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="w-8 h-8 text-gray-700 mx-auto"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Horizontal split layout (6) */}
            {selectedLayout === 6 && (
              <div className="relative bg-gray-900 rounded overflow-hidden flex-1">
                <div className="w-full h-full flex items-center justify-center">
                  <div className="text-center">
                    <svg
                      className="w-12 h-12 text-gray-700 mx-auto mb-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                    <p className="text-gray-600 text-xs">Empty Slot</p>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* Resolution Badge - Top Left (only show when not screen sharing and when enabled) */}
        {showResolutionBadge && !isSharingScreen && !screenShareStream && (
          <div
            className="absolute text-sm font-semibold text-white flex items-center justify-center"
            style={{
              top: '16px',
              left: '16px',
              width: '60px',
              height: '32px',
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              borderRadius: '4px',
              zIndex: 5, // Layer 5: Resolution badge (1080p indicator)
            }}
          >
            1080p
          </div>
        )}

        {/* On-Screen Chat Overlay - Draggable & Resizable */}
        {showChatOnStream && (
          <div
            ref={chatOverlayRef}
            className="absolute bg-black/80 backdrop-blur-sm rounded-lg overflow-hidden"
            style={{
              left: chatOverlayPosition.x ? `${chatOverlayPosition.x}px` : 'auto',
              top: chatOverlayPosition.y ? `${chatOverlayPosition.y}px` : 'auto',
              right: chatOverlayPosition.x ? 'auto' : '16px',
              bottom: chatOverlayPosition.y ? 'auto' : '80px',
              width: `${chatOverlaySize.width}px`,
              height: `${chatOverlaySize.height}px`,
              cursor: isDraggingChat ? 'grabbing' : 'default',
              willChange: isDraggingChat ? 'transform' : 'auto',
            }}
          >
            {/* Drag Handle */}
            <div
              onMouseDown={onChatOverlayDragStart}
              className="bg-gray-800/50 px-3 py-2 flex items-center justify-between cursor-grab active:cursor-grabbing border-b border-gray-700"
            >
              <span className="text-white text-xs font-semibold">Live Chat</span>
              <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8h16M4 16h16" />
              </svg>
            </div>

            {/* Chat Messages */}
            <div className="p-3 overflow-y-auto" style={{ height: `calc(100% - 50px)` }}>
              <div className="space-y-2">
                {chatMessages.slice(-10).map((msg, i) => (
                  <div key={i} className="text-white text-sm">
                    <span className="font-semibold">{msg.author}:</span> {msg.message}
                  </div>
                ))}
              </div>
            </div>

            {/* Resize Handle */}
            <div
              onMouseDown={onChatOverlayResizeStart}
              className="absolute bottom-0 right-0 w-4 h-4 cursor-nwse-resize"
              style={{
                background: 'linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.3) 50%)',
              }}
            />
          </div>
        )}

        {/* AI Caption Overlay */}
        {captionsEnabled && <CaptionOverlay caption={currentCaption} />}
      </div>
    </div>
  );
}
