import { useRef } from 'react';
import { CaptionOverlay } from './CanvasOverlay';
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
}: StudioCanvasProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

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

    switch (layoutId) {
      case 1: // Grid 2x2
        return {
          container: 'grid grid-cols-2 grid-rows-2 gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
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
      case 7: // Grid 3x3
        return {
          container: 'grid grid-cols-3 grid-rows-3 gap-2 p-2',
          mainVideo: 'col-span-1 row-span-1',
        };
      case 8: // Grid 2x2 (larger)
        return {
          container: 'grid grid-cols-2 grid-rows-2 gap-4 p-4',
          mainVideo: 'col-span-1 row-span-1',
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
      className="relative bg-black"
      style={{
        width: '100%',
        maxWidth: '1920px',
        aspectRatio: '16 / 9',
      }}
    >
      {/* Main Video Preview with Dynamic Layout */}
      <div
        className={`absolute inset-0 overflow-hidden ${
          getLayoutStyles(isSharingScreen || screenShareStream ? 'screenshare' : selectedLayout).container
        }`}
        style={{ backgroundColor: '#000000' }}
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
              <div className="relative bg-black rounded overflow-hidden flex-1">
                {localStream && videoEnabled ? (
                  <video
                    ref={mainVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ willChange: 'auto' }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="text-center">
                      <svg
                        className="w-8 h-8 text-gray-600 mx-auto mb-1"
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
                      </svg>
                    </div>
                  </div>
                )}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                  <span className="text-white text-xs font-medium">You</span>
                </div>
              </div>

              {/* Remote Participants - Up to 4 slots */}
              {Array.from(remoteParticipants.values())
                .filter((p) => p.id !== 'screen-share')
                .slice(0, 4)
                .map((participant) => (
                  <div key={participant.id} className="relative bg-gray-900 rounded overflow-hidden flex-1">
                    {participant.stream && participant.videoEnabled ? (
                      <video
                        autoPlay
                        playsInline
                        muted
                        ref={(el) => {
                          if (el && participant.stream) el.srcObject = participant.stream;
                        }}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <svg
                          className="w-8 h-8 text-gray-700"
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
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-1">
                      <span className="text-white text-xs font-medium truncate">{participant.name}</span>
                    </div>
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
            {/* Main Video */}
            <div className={`relative bg-black rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}>
              {localStream && videoEnabled ? (
                <video
                  ref={mainVideoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover"
                  style={{ willChange: 'auto' }}
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
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    <p className="text-gray-500 text-sm">Camera Off</p>
                  </div>
                </div>
              )}
              {/* Video Label */}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                <div className="flex items-center justify-between">
                  <span className="text-white text-xs font-medium">You (Host)</span>
                </div>
              </div>
            </div>

            {/* Additional video slots for grid layouts */}
            {(selectedLayout === 1 || selectedLayout === 8) && (
              <>
                {[1, 2, 3].map((slot) => (
                  <div
                    key={slot}
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

            {/* 3x3 Grid Layout */}
            {selectedLayout === 7 && (
              <>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((slot) => (
                  <div
                    key={slot}
                    className={`relative bg-gray-900 rounded overflow-hidden ${getLayoutStyles(selectedLayout).mainVideo}`}
                  >
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <svg
                          className="w-8 h-8 text-gray-700 mx-auto mb-1"
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
                        <p className="text-gray-600 text-xs">Empty</p>
                      </div>
                    </div>
                  </div>
                ))}
              </>
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

        {/* Resolution Badge - Centered Top (only show when not screen sharing) */}
        {!isSharingScreen && !screenShareStream && (
          <div
            className="absolute top-4 left-1/2 transform -translate-x-1/2 px-4 py-2 rounded-full text-sm font-semibold text-white"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.6)',
              backdropFilter: 'blur(8px)',
            }}
          >
            1080p HD
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
