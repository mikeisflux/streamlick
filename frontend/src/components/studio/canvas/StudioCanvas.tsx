import { useRef, useEffect, useState } from 'react';
import { CaptionOverlay } from './CanvasOverlay';
import { ParticipantBox } from './ParticipantBox';
import { TeleprompterOverlay } from './TeleprompterOverlay';
import { CommentOverlay } from './CommentOverlay';
import { Caption } from '../../../services/caption.service';
import { mediaStorageService } from '../../../services/media-storage.service';

interface Banner {
  id: string;
  type: 'lower-third' | 'text-overlay' | 'cta' | 'countdown';
  title: string;
  subtitle?: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  backgroundColor: string;
  textColor: string;
  visible: boolean;
}

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

interface Comment {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
  authorName: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
}

interface StudioCanvasProps {
  localStream: MediaStream | null;
  videoEnabled: boolean;
  audioEnabled: boolean;
  isLocalUserOnStage: boolean;
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
  onRemoveFromStage?: (participantId: string) => void;
  teleprompterNotes?: string;
  teleprompterFontSize?: number;
  teleprompterIsScrolling?: boolean;
  teleprompterScrollSpeed?: number;
  teleprompterScrollPosition?: number;
  showTeleprompterOnCanvas?: boolean;
  displayedComment?: Comment | null;
  onDismissComment?: () => void;
  orientation?: 'landscape' | 'portrait';
}

export function StudioCanvas({
  localStream,
  videoEnabled,
  audioEnabled,
  isLocalUserOnStage,
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
  onRemoveFromStage,
  teleprompterNotes = '',
  teleprompterFontSize = 24,
  teleprompterIsScrolling = false,
  teleprompterScrollSpeed = 2,
  teleprompterScrollPosition = 0,
  showTeleprompterOnCanvas = false,
  displayedComment = null,
  onDismissComment = () => {},
  orientation = 'landscape',
}: StudioCanvasProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);

  // Load banners from localStorage
  const [banners, setBanners] = useState<Banner[]>([]);

  // Load style settings from localStorage
  const [styleSettings, setStyleSettings] = useState({
    cameraFrame: 'rounded' as 'none' | 'rounded' | 'circle' | 'square',
    borderWidth: 2,
    primaryColor: '#0066ff',
    mirrorVideo: false,
  });

  // Load stream background from localStorage - initialize immediately to avoid flash
  const [streamBackground, setStreamBackground] = useState<string | null>(() =>
    localStorage.getItem('streamBackground')
  );

  useEffect(() => {
    const loadBanners = () => {
      const saved = localStorage.getItem('banners');
      if (saved) {
        try {
          setBanners(JSON.parse(saved));
        } catch (e) {
          console.error('Failed to load banners:', e);
        }
      }
    };

    loadBanners();

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'banners') {
        loadBanners();
      }
    };

    // Listen for custom event for same-tab updates
    const handleBannersUpdated = ((e: CustomEvent) => {
      setBanners(e.detail);
    }) as EventListener;

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bannersUpdated', handleBannersUpdated);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannersUpdated', handleBannersUpdated);
    };
  }, []);

  // Load style settings
  useEffect(() => {
    const loadStyleSettings = () => {
      const cameraFrame = (localStorage.getItem('style_cameraFrame') as any) || 'rounded';
      const borderWidth = parseInt(localStorage.getItem('style_borderWidth') || '2');
      const primaryColor = localStorage.getItem('style_primaryColor') || '#0066ff';
      const mirrorVideo = localStorage.getItem('mirrorVideo') === 'true';

      setStyleSettings({
        cameraFrame,
        borderWidth,
        primaryColor,
        mirrorVideo,
      });
    };

    loadStyleSettings();

    // Listen for storage changes from other tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key?.startsWith('style_') || e.key === 'mirrorVideo') {
        loadStyleSettings();
      }
    };

    // Listen for custom event for same-tab updates
    const handleStyleSettingsUpdated = ((e: CustomEvent) => {
      // Load mirror video from localStorage since it's not part of the style event
      const mirrorVideo = localStorage.getItem('mirrorVideo') === 'true';

      setStyleSettings({
        cameraFrame: e.detail.cameraFrame,
        borderWidth: e.detail.borderWidth,
        primaryColor: e.detail.primaryColor,
        mirrorVideo,
      });
    }) as EventListener;

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('styleSettingsUpdated', handleStyleSettingsUpdated);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('styleSettingsUpdated', handleStyleSettingsUpdated);
    };
  }, []);

  // Load stream background - check IndexedDB if stored there
  useEffect(() => {
    const loadBackground = async () => {
      // First check if background is stored in IndexedDB
      const backgroundAssetId = localStorage.getItem('streamBackgroundAssetId');
      if (backgroundAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(backgroundAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamBackground(objectURL);
            console.log('[StudioCanvas] Loaded background from IndexedDB');
            return;
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load background from IndexedDB:', error);
        }
      }

      // Fallback to localStorage URL
      const bg = localStorage.getItem('streamBackground');
      if (bg) {
        setStreamBackground(bg);
      }
    };

    loadBackground();

    // Listen for custom event for background updates
    const handleBackgroundUpdated = ((e: CustomEvent) => {
      setStreamBackground(e.detail.url);
    }) as EventListener;

    window.addEventListener('backgroundUpdated', handleBackgroundUpdated);
    return () => window.removeEventListener('backgroundUpdated', handleBackgroundUpdated);
  }, []);

  // Load stream logo from localStorage - initialize immediately to avoid flash
  const [streamLogo, setStreamLogo] = useState<string | null>(() =>
    localStorage.getItem('streamLogo')
  );

  // Load stream overlay from localStorage - initialize immediately to avoid flash
  const [streamOverlay, setStreamOverlay] = useState<string | null>(() =>
    localStorage.getItem('streamOverlay')
  );

  // Load video clip from localStorage - initialize immediately to avoid flash
  const [videoClip, setVideoClip] = useState<string | null>(() =>
    localStorage.getItem('streamVideoClip')
  );

  // Custom layout positions for edit mode
  interface ParticipantPosition {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }

  const [customLayoutPositions, setCustomLayoutPositions] = useState<Map<string, ParticipantPosition>>(new Map());

  // Load custom layout positions from localStorage
  useEffect(() => {
    const loadCustomLayout = () => {
      const saved = localStorage.getItem(`customLayout_${selectedLayout}`);
      if (saved) {
        try {
          const positions = JSON.parse(saved);
          setCustomLayoutPositions(new Map(positions));
        } catch (e) {
          console.error('Failed to load custom layout:', e);
        }
      } else {
        // Initialize with default positions if no custom layout
        setCustomLayoutPositions(new Map());
      }
    };

    loadCustomLayout();
  }, [selectedLayout]);

  // Save custom layout positions to localStorage
  const saveCustomLayout = () => {
    const positions = Array.from(customLayoutPositions.entries());
    localStorage.setItem(`customLayout_${selectedLayout}`, JSON.stringify(positions));
    console.log('Custom layout saved for layout', selectedLayout);
  };

  // Handle position change for a participant
  const handlePositionChange = (participantId: string, position: { x: number; y: number; width: number; height: number }) => {
    setCustomLayoutPositions(prev => {
      const newMap = new Map(prev);
      newMap.set(participantId, { id: participantId, ...position });
      return newMap;
    });
  };

  // Auto-save when positions change (debounced in real implementation)
  useEffect(() => {
    if (editMode && customLayoutPositions.size > 0) {
      const timeoutId = setTimeout(() => {
        saveCustomLayout();
      }, 500); // Debounce saves

      return () => clearTimeout(timeoutId);
    }
  }, [customLayoutPositions, editMode]);

  useEffect(() => {
    const loadLogo = async () => {
      // First check if logo is stored in IndexedDB
      const logoAssetId = localStorage.getItem('streamLogoAssetId');
      if (logoAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(logoAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamLogo(objectURL);
            console.log('[StudioCanvas] Loaded logo from IndexedDB');
            return;
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load logo from IndexedDB:', error);
        }
      }
      // Fallback to localStorage URL
      const logo = localStorage.getItem('streamLogo');
      if (logo) setStreamLogo(logo);
    };

    const loadOverlay = async () => {
      // First check if overlay is stored in IndexedDB
      const overlayAssetId = localStorage.getItem('streamOverlayAssetId');
      if (overlayAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(overlayAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamOverlay(objectURL);
            console.log('[StudioCanvas] Loaded overlay from IndexedDB');
            return;
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load overlay from IndexedDB:', error);
        }
      }
      // Fallback to localStorage URL
      const overlay = localStorage.getItem('streamOverlay');
      if (overlay) setStreamOverlay(overlay);
    };

    const loadVideoClip = () => {
      const clip = localStorage.getItem('streamVideoClip');
      setVideoClip(clip);
    };

    loadLogo();
    loadOverlay();
    loadVideoClip();

    // Listen for custom event for logo updates
    const handleLogoUpdated = ((e: CustomEvent) => {
      setStreamLogo(e.detail.url);
    }) as EventListener;

    // Listen for custom event for overlay updates
    const handleOverlayUpdated = ((e: CustomEvent) => {
      setStreamOverlay(e.detail.url);
    }) as EventListener;

    // Listen for custom event for video clip updates
    const handleVideoClipUpdated = ((e: CustomEvent) => {
      setVideoClip(e.detail.url);
    }) as EventListener;

    window.addEventListener('logoUpdated', handleLogoUpdated);
    window.addEventListener('overlayUpdated', handleOverlayUpdated);
    window.addEventListener('videoClipUpdated', handleVideoClipUpdated);

    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdated);
      window.removeEventListener('overlayUpdated', handleOverlayUpdated);
      window.removeEventListener('videoClipUpdated', handleVideoClipUpdated);
    };
  }, []);

  // Calculate total participants (local user if on stage + remote on-stage)
  const onStageParticipants = Array.from(remoteParticipants.values()).filter(
    (p) => p.role !== 'backstage' && p.id !== 'screen-share'
  );
  const totalParticipants = (isLocalUserOnStage ? 1 : 0) + onStageParticipants.length;

  // Dynamic grid calculation using the formula: cols = Math.ceil(Math.sqrt(count))
  const calculateDynamicGrid = (participantCount: number) => {
    // Special case for solo layout: use 2x2 grid to keep same size as 4-person layout
    if (participantCount === 1) {
      return { cols: 2, rows: 2 };
    }
    const cols = Math.ceil(Math.sqrt(participantCount));
    const rows = Math.ceil(participantCount / cols);
    return { cols, rows };
  };

  // Layout positioning for each layout type
  // Returns CSS positions as percentages for each participant slot
  const getLayoutPositions = (layoutId: number, participantCount: number) => {
    // Each position: { x, y, width, height } in percentages
    const positions: Array<{ x: number; y: number; width: number; height: number }> = [];
    const gap = 1; // 1% gap between elements

    switch (layoutId) {
      case 1: // Solo - One person fills entire screen (centered, 70% size)
        positions.push({ x: 15, y: 10, width: 70, height: 80 });
        // Additional participants get small thumbnails at bottom
        for (let i = 1; i < participantCount; i++) {
          const thumbWidth = 15;
          const thumbX = 5 + (i - 1) * (thumbWidth + gap);
          positions.push({ x: thumbX, y: 85, width: thumbWidth, height: 12 });
        }
        break;

      case 2: // Cropped - 2x2 tight grid
        const crop2x2 = [
          { x: 1, y: 1, width: 48.5, height: 48.5 },
          { x: 50.5, y: 1, width: 48.5, height: 48.5 },
          { x: 1, y: 50.5, width: 48.5, height: 48.5 },
          { x: 50.5, y: 50.5, width: 48.5, height: 48.5 },
        ];
        for (let i = 0; i < Math.min(participantCount, 4); i++) {
          positions.push(crop2x2[i]);
        }
        break;

      case 3: // Group - Dynamic grid for many participants
        const cols = Math.ceil(Math.sqrt(participantCount));
        const rows = Math.ceil(participantCount / cols);
        const cellWidth = (100 - (cols + 1) * gap) / cols;
        const cellHeight = (100 - (rows + 1) * gap) / rows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % cols;
          const row = Math.floor(i / cols);
          positions.push({
            x: gap + col * (cellWidth + gap),
            y: gap + row * (cellHeight + gap),
            width: cellWidth,
            height: cellHeight,
          });
        }
        break;

      case 4: // Spotlight - Large main speaker with small boxes above
        // Main speaker takes 70% width at bottom
        positions.push({ x: 15, y: 25, width: 70, height: 70 });
        // Small boxes at top (up to 4)
        const topBoxWidth = 18;
        const topBoxHeight = 20;
        const startX = 10;
        for (let i = 1; i < Math.min(participantCount, 5); i++) {
          positions.push({
            x: startX + (i - 1) * (topBoxWidth + gap),
            y: 2,
            width: topBoxWidth,
            height: topBoxHeight,
          });
        }
        break;

      case 5: // News - Side-by-side (50/50)
        positions.push({ x: 1, y: 1, width: 48.5, height: 98 });
        positions.push({ x: 50.5, y: 1, width: 48.5, height: 98 });
        // Additional participants stack on right side
        for (let i = 2; i < participantCount; i++) {
          const slotHeight = 98 / Math.ceil((participantCount - 1));
          positions[i] = {
            x: 50.5,
            y: 1 + (i - 1) * slotHeight,
            width: 48.5,
            height: slotHeight - gap,
          };
        }
        break;

      case 6: // Screen - Large area with tiny participants at top
        // Participants at top row
        const topParticipants = Math.min(participantCount, 4);
        const topWidth = (100 - (topParticipants + 1) * gap) / topParticipants;
        for (let i = 0; i < topParticipants; i++) {
          positions.push({
            x: gap + i * (topWidth + gap),
            y: 1,
            width: topWidth,
            height: 18,
          });
        }
        // Remaining space for screen/content (placeholder for now)
        break;

      case 7: // Picture-in-Picture - Main content with small overlay
        // Main content fills screen
        positions.push({ x: 1, y: 1, width: 98, height: 98 });
        // PiP overlay in bottom-right corner
        if (participantCount > 1) {
          positions.push({ x: 72, y: 70, width: 25, height: 27 });
        }
        // Additional PiPs stack vertically
        for (let i = 2; i < participantCount; i++) {
          positions.push({
            x: 72,
            y: 70 - (i - 1) * 30,
            width: 25,
            height: 27,
          });
        }
        break;

      case 8: // Cinema - Ultra-wide letterbox format
        // Letterbox bars at top and bottom (handled by container)
        const letterboxHeight = 56; // ~16:9 in letterbox
        const letterboxY = (100 - letterboxHeight) / 2;

        if (participantCount === 1) {
          positions.push({ x: 15, y: letterboxY + 5, width: 70, height: letterboxHeight - 10 });
        } else {
          // Side by side in letterbox
          const boxWidth = (100 - 3 * gap) / Math.min(participantCount, 3);
          for (let i = 0; i < Math.min(participantCount, 3); i++) {
            positions.push({
              x: gap + i * (boxWidth + gap),
              y: letterboxY,
              width: boxWidth,
              height: letterboxHeight,
            });
          }
        }
        break;

      default:
        // Fallback to grid
        const defCols = Math.ceil(Math.sqrt(participantCount));
        const defRows = Math.ceil(participantCount / defCols);
        const defCellWidth = (100 - (defCols + 1) * gap) / defCols;
        const defCellHeight = (100 - (defRows + 1) * gap) / defRows;
        for (let i = 0; i < participantCount; i++) {
          const col = i % defCols;
          const row = Math.floor(i / defCols);
          positions.push({
            x: gap + col * (defCellWidth + gap),
            y: gap + row * (defCellHeight + gap),
            width: defCellWidth,
            height: defCellHeight,
          });
        }
    }

    return positions;
  };

  // Simplified auto-layout based on participants and screen share
  const getLayoutStyles = (layoutId: number | 'screenshare') => {
    // When screen is being shared, move participants to left sidebar
    if (layoutId === 'screenshare' || isSharingScreen) {
      return {
        container: 'flex gap-2 p-2',
        sidebar: 'flex flex-col gap-2',
        sidebarWidth: 'w-[25%]',
        mainVideo: 'flex-1',
        screenShare: 'flex-1 w-[75%]',
        useAbsolutePositioning: false,
      };
    }

    // Use absolute positioning for all other layouts
    return {
      container: '', // Don't add 'relative' - let the parent's 'absolute inset-0' work
      mainVideo: '',
      useAbsolutePositioning: true,
    };
  };

  // Set srcObject for screen share video
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
    }
  }, [screenShareStream]);

  // Get position styles for banner overlay
  const getBannerPositionStyles = (position: Banner['position']) => {
    const positions = {
      'top-left': { top: '20px', left: '20px' },
      'top-center': { top: '20px', left: '50%', transform: 'translateX(-50%)' },
      'top-right': { top: '20px', right: '20px' },
      'bottom-left': { bottom: '20px', left: '20px' },
      'bottom-center': { bottom: '20px', left: '50%', transform: 'translateX(-50%)' },
      'bottom-right': { bottom: '20px', right: '20px' },
    };
    return positions[position];
  };

  // Calculate aspect ratio based on orientation
  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  return (
    <div
      className="relative"
      style={{
        width: '100%',
        maxWidth: orientation === 'portrait' ? '563px' : '1001px',
        aspectRatio,
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
          backgroundImage: streamBackground ? `url(${streamBackground})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
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
              {/* Host Video - only shown when local user is on stage */}
              {isLocalUserOnStage && (
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
                    participantId="local-user"
                    onRemoveFromStage={onRemoveFromStage}
                    cameraFrame={styleSettings.cameraFrame}
                    borderWidth={styleSettings.borderWidth}
                    borderColor={styleSettings.primaryColor}
                    mirrorVideo={styleSettings.mirrorVideo}
                    editMode={editMode}
                    position={customLayoutPositions.get('local-user')}
                    onPositionChange={(pos) => handlePositionChange('local-user', pos)}
                  />
                </div>
              )}

              {/* Remote Participants - Up to 4 slots */}
              {Array.from(remoteParticipants.values())
                .filter((p) => p.id !== 'screen-share' && p.role !== 'backstage')
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
                      participantId={participant.id}
                      onRemoveFromStage={onRemoveFromStage}
                      cameraFrame={styleSettings.cameraFrame}
                      borderWidth={styleSettings.borderWidth}
                      borderColor={styleSettings.primaryColor}
                      mirrorVideo={false}
                      editMode={editMode}
                      position={customLayoutPositions.get(participant.id)}
                      onPositionChange={(pos) => handlePositionChange(participant.id, pos)}
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
            {/* Layout-based positioning using absolute positioning */}
            {(() => {
              const layoutPositions = getLayoutPositions(selectedLayout, totalParticipants);
              let participantIndex = 0;

              return (
                <>
                  {/* Render local user first - only when on stage */}
                  {isLocalUserOnStage && layoutPositions[participantIndex] && (
                    <div
                      className="absolute"
                      style={{
                        left: `${layoutPositions[participantIndex].x}%`,
                        top: `${layoutPositions[participantIndex].y}%`,
                        width: `${layoutPositions[participantIndex].width}%`,
                        height: `${layoutPositions[participantIndex].height}%`,
                        transition: 'all 0.3s ease-in-out',
                      }}
                    >
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
                        participantId="local-user"
                        onRemoveFromStage={onRemoveFromStage}
                        cameraFrame={styleSettings.cameraFrame}
                        borderWidth={styleSettings.borderWidth}
                        borderColor={styleSettings.primaryColor}
                        mirrorVideo={styleSettings.mirrorVideo}
                        editMode={editMode}
                        position={customLayoutPositions.get('local-user')}
                        onPositionChange={(pos) => handlePositionChange('local-user', pos)}
                      />
                    </div>
                  )}

                  {/* Render remote participants */}
                  {onStageParticipants.map((participant, index) => {
                    const posIndex = isLocalUserOnStage ? index + 1 : index;
                    const pos = layoutPositions[posIndex];
                    if (!pos) return null;

                    return (
                      <div
                        key={participant.id}
                        className="absolute"
                        style={{
                          left: `${pos.x}%`,
                          top: `${pos.y}%`,
                          width: `${pos.width}%`,
                          height: `${pos.height}%`,
                          transition: 'all 0.3s ease-in-out',
                        }}
                      >
                        <ParticipantBox
                          stream={participant.stream}
                          videoEnabled={participant.videoEnabled}
                          audioEnabled={participant.audioEnabled}
                          name={participant.name}
                          positionNumber={posIndex + 1}
                          isHost={participant.role === 'host'}
                          size="medium"
                          connectionQuality="excellent"
                          showPositionNumber={showPositionNumbers}
                          showConnectionQuality={showConnectionQuality}
                          showLowerThird={showLowerThirds}
                          participantId={participant.id}
                          onRemoveFromStage={onRemoveFromStage}
                          cameraFrame={styleSettings.cameraFrame}
                          borderWidth={styleSettings.borderWidth}
                          borderColor={styleSettings.primaryColor}
                          mirrorVideo={false}
                          editMode={editMode}
                          position={customLayoutPositions.get(participant.id)}
                          onPositionChange={(pos) => handlePositionChange(participant.id, pos)}
                        />
                      </div>
                    );
                  })}
                </>
              );
            })()}
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
              left: chatOverlayPosition.x !== 0 ? `${chatOverlayPosition.x}px` : 'auto',
              top: chatOverlayPosition.y !== 0 ? `${chatOverlayPosition.y}px` : 'auto',
              right: chatOverlayPosition.x === 0 ? '16px' : 'auto',
              bottom: chatOverlayPosition.y === 0 ? '80px' : 'auto',
              width: `${chatOverlaySize.width}px`,
              height: `${chatOverlaySize.height}px`,
              cursor: isDraggingChat ? 'grabbing' : 'default',
              zIndex: 10,
              transition: isDraggingChat ? 'none' : 'none',
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

        {/* Teleprompter Overlay */}
        {showTeleprompterOnCanvas && (
          <TeleprompterOverlay
            notes={teleprompterNotes}
            fontSize={teleprompterFontSize}
            isScrolling={teleprompterIsScrolling}
            scrollSpeed={teleprompterScrollSpeed}
            scrollPosition={teleprompterScrollPosition}
          />
        )}

        {/* Comment Overlay */}
        <CommentOverlay comment={displayedComment} onDismiss={onDismissComment} />

        {/* Banner Overlays */}
        {banners
          .filter((banner) => banner.visible)
          .map((banner) => (
            <div
              key={banner.id}
              className="absolute px-6 py-4 rounded-lg shadow-lg"
              style={{
                ...getBannerPositionStyles(banner.position),
                backgroundColor: banner.backgroundColor,
                color: banner.textColor,
                zIndex: 25,
                maxWidth: '90%',
                pointerEvents: 'none',
              }}
            >
              <div className="font-bold text-lg">{banner.title}</div>
              {banner.subtitle && <div className="text-sm opacity-90 mt-1">{banner.subtitle}</div>}
            </div>
          ))}

        {/* Logo Overlay - Top Left Corner */}
        {streamLogo && (
          <div
            className="absolute"
            style={{
              top: '20px',
              left: '20px',
              zIndex: 20,
              maxWidth: '150px',
              maxHeight: '150px',
            }}
          >
            <img
              src={streamLogo}
              alt="Stream Logo"
              style={{
                width: 'auto',
                height: 'auto',
                maxWidth: '150px',
                maxHeight: '150px',
                objectFit: 'contain',
              }}
            />
          </div>
        )}

        {/* Full Screen Overlay - On top of everything */}
        {streamOverlay && (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 30,
              pointerEvents: 'none',
            }}
          >
            <img
              src={streamOverlay}
              alt="Stream Overlay"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Video Clip Overlay - Plays on top of canvas */}
        {videoClip && (
          <div
            className="absolute inset-0"
            style={{
              zIndex: 35,
              pointerEvents: 'none',
            }}
          >
            <video
              src={videoClip}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              onEnded={() => {
                // Auto-remove video clip when it ends (if not looping)
                setVideoClip(null);
                localStorage.removeItem('streamVideoClip');
                window.dispatchEvent(new CustomEvent('videoClipUpdated', { detail: { url: null } }));
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
