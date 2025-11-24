/**
 * ⚠️ MANDATORY - KEEP IN SYNC WITH COMPOSITOR SERVICE ⚠️
 *
 * StudioCanvas - Browser preview canvas using HTML/CSS layouts
 *
 * MUST stay in sync with compositor.service.ts (Canvas API output stream)
 * When making changes to:
 * - Layout logic (grid, spotlight, sidebar, pip)
 * - Participant positioning
 * - Audio animations (pulsating rings)
 * - Overlay rendering (backgrounds, logos, lower thirds)
 *
 * ALWAYS update BOTH StudioCanvas.tsx AND compositor.service.ts to maintain
 * visual consistency between preview and output stream!
 */

import { useRef, useEffect, useState } from 'react';
import { CaptionOverlay } from './CanvasOverlay';
import { ParticipantBox } from './ParticipantBox';
import { TeleprompterOverlay } from './TeleprompterOverlay';
import { CommentOverlay } from './CommentOverlay';
import { Caption } from '../../../services/caption.service';
import { compositorService } from '../../../services/compositor.service';
import { mediaStorageService } from '../../../services/media-storage.service';
import { audioMixerService } from '../../../services/audio-mixer.service';
import { useAudioLevel } from '../../../hooks/studio/useAudioLevel';

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
  rawStream: MediaStream | null; // Raw audio before noise gate - for audio level detection
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
  rawStream,
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(100);

  // Canvas rendering
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());

  // Detect if local user is speaking (for voice animations) - use RAW audio before noise gate
  const isLocalSpeaking = useAudioLevel(rawStream || localStream, audioEnabled);

  // Track which remote participants are speaking
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());

  // Load banners from localStorage
  const [banners, setBanners] = useState<Banner[]>([]);

  // Load style settings from localStorage
  const [styleSettings, setStyleSettings] = useState({
    cameraFrame: 'rounded' as 'none' | 'rounded' | 'circle' | 'square',
    borderWidth: 2,
    primaryColor: '#0066ff',
    mirrorVideo: false,
  });

  // Load stream background from localStorage
  const [streamBackground, setStreamBackground] = useState<string | null>(null);

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

  // Load stream background
  useEffect(() => {

    // CRITICAL: Load background immediately on mount to avoid race condition
    const loadInitialBackground = async () => {
      const streamBackgroundAssetId = localStorage.getItem('streamBackgroundAssetId');
      const streamBackground = localStorage.getItem('streamBackground');

      if (streamBackgroundAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(streamBackgroundAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamBackground(objectURL);
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load background from IndexedDB:', error);
        }
      } else if (streamBackground) {
        setStreamBackground(streamBackground);
      }
    };

    loadInitialBackground();

    // Listen for custom event for background updates
    const handleBackgroundUpdated = ((e: CustomEvent) => {
      setStreamBackground(e.detail.url);
    }) as EventListener;

    window.addEventListener('backgroundUpdated', handleBackgroundUpdated);

    return () => {
      window.removeEventListener('backgroundUpdated', handleBackgroundUpdated);
    };
  }, []);

  // Monitor audio levels for remote participants
  useEffect(() => {
    const audioContexts = new Map<string, { context: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; frameId: number }>();

    const setupAudioAnalyzer = (participantId: string, stream: MediaStream, audioEnabled: boolean) => {
      // Clean up existing analyzer if any
      const existing = audioContexts.get(participantId);
      if (existing) {
        cancelAnimationFrame(existing.frameId);
        existing.source.disconnect();
        existing.analyser.disconnect();
        existing.context.close();
        audioContexts.delete(participantId);
      }

      // Don't set up analyzer if audio is disabled or no audio tracks
      if (!audioEnabled || !stream.getAudioTracks().length) {
        setSpeakingParticipants(prev => {
          const next = new Set(prev);
          next.delete(participantId);
          return next;
        });
        return;
      }

      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;

        const audioTrack = stream.getAudioTracks()[0];
        const clonedStream = new MediaStream([audioTrack.clone()]);
        const source = audioContext.createMediaStreamSource(clonedStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const speakingThreshold = 10;

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);

          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) {
            sum += dataArray[i];
          }
          const average = sum / dataArray.length;
          const speaking = average > speakingThreshold;

          setSpeakingParticipants(prev => {
            const next = new Set(prev);
            if (speaking) {
              next.add(participantId);
            } else {
              next.delete(participantId);
            }
            return next;
          });

          const frameId = requestAnimationFrame(checkAudioLevel);
          audioContexts.set(participantId, { context: audioContext, analyser, source, frameId });
        };

        checkAudioLevel();
      } catch (error) {
        console.error(`[StudioCanvas] Failed to create audio analyser for ${participantId}:`, error);
      }
    };

    // Set up analyzers for all remote participants
    remoteParticipants.forEach((participant, id) => {
      if (participant.stream) {
        setupAudioAnalyzer(id, participant.stream, participant.audioEnabled);
      }
    });

    // Cleanup
    return () => {
      audioContexts.forEach(({ context, analyser, source, frameId }) => {
        cancelAnimationFrame(frameId);
        source.disconnect();
        analyser.disconnect();
        if (context.state !== 'closed') {
          context.close();
        }
      });
      audioContexts.clear();
    };
  }, [remoteParticipants]);

  // Load stream logo from localStorage
  const [streamLogo, setStreamLogo] = useState<string | null>(null);

  // Load stream overlay from localStorage
  const [streamOverlay, setStreamOverlay] = useState<string | null>(null);

  // Load video clip from localStorage
  const [videoClip, setVideoClip] = useState<string | null>(null);

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
    // CRITICAL: Load all media immediately on mount from IndexedDB/localStorage
    const loadAllMedia = async () => {
      // Load logo
      const streamLogoAssetId = localStorage.getItem('streamLogoAssetId');
      const streamLogoUrl = localStorage.getItem('streamLogo');

      if (streamLogoAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(streamLogoAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamLogo(objectURL);
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load logo from IndexedDB:', error);
        }
      } else if (streamLogoUrl) {
        setStreamLogo(streamLogoUrl);
      }

      // Load overlay
      const streamOverlayAssetId = localStorage.getItem('streamOverlayAssetId');
      const streamOverlayUrl = localStorage.getItem('streamOverlay');

      if (streamOverlayAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(streamOverlayAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setStreamOverlay(objectURL);
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load overlay from IndexedDB:', error);
        }
      } else if (streamOverlayUrl) {
        setStreamOverlay(streamOverlayUrl);
      }

      // Load video clip
      const streamVideoClipAssetId = localStorage.getItem('streamVideoClipAssetId');
      const streamVideoClipUrl = localStorage.getItem('streamVideoClip');

      if (streamVideoClipAssetId) {
        try {
          const mediaData = await mediaStorageService.getMedia(streamVideoClipAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            setVideoClip(objectURL);
          }
        } catch (error) {
          console.error('[StudioCanvas] Failed to load video clip from IndexedDB:', error);
        }
      } else if (streamVideoClipUrl) {
        setVideoClip(streamVideoClipUrl);
      }
    };

    loadAllMedia();

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

  // Canvas initialization and rendering loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize canvas context
    const ctx = canvas.getContext('2d', {
      alpha: false,
      desynchronized: true,
    });

    if (!ctx) {
      console.error('[StudioCanvas] Failed to get 2D context');
      return;
    }

    canvasCtxRef.current = ctx;

    // Set canvas resolution (1920x1080 for landscape, 1080x1920 for portrait)
    if (orientation === 'portrait') {
      canvas.width = 1080;
      canvas.height = 1920;
    } else {
      canvas.width = 1920;
      canvas.height = 1080;
    }

    console.log('[StudioCanvas] Canvas initialized:', {
      width: canvas.width,
      height: canvas.height,
      orientation,
    });

    // Start rendering loop
    let frameCount = 0;
    let lastFrameTime = performance.now();

    const render = () => {
      if (!ctx || !canvas) return;

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      // Target 30 FPS (33ms per frame)
      if (elapsed >= 33) {
        lastFrameTime = now - (elapsed % 33);
        frameCount++;

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // TODO: Draw background image

        // Draw local participant video if available
        if (mainVideoRef.current && isLocalUserOnStage && videoEnabled) {
          const video = mainVideoRef.current;
          if (video.readyState >= 2) {
            // Video is ready - draw it
            // For now, draw full canvas - will add layouts later
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        }

        // TODO: Draw screen share

        // TODO: Draw remote participants

        // TODO: Draw overlay (full-screen)

        // TODO: Draw logo

        // TODO: Draw banners

        // TODO: Draw chat

        // TODO: Draw captions

        // Log FPS every 60 frames
        if (frameCount % 60 === 0) {
          const fps = 1000 / elapsed;
          console.log('[StudioCanvas] Canvas FPS:', fps.toFixed(1));
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Start render loop
    render();

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
    };
  }, [backgroundColor, orientation]);

  // Set video srcObject for local stream
  useEffect(() => {
    if (mainVideoRef.current && localStream) {
      mainVideoRef.current.srcObject = localStream;
      mainVideoRef.current.play().catch(err => console.error('[StudioCanvas] Failed to play local video:', err));
    }
  }, [localStream]);

  // Set video srcObject for screen share
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
      screenShareVideoRef.current.play().catch(err => console.error('[StudioCanvas] Failed to play screen share:', err));
    }
  }, [screenShareStream]);

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

  // Layout system - implements all 8 layout types
  const getLayoutStyles = (layoutId: number | 'screenshare') => {
    // When screen is being shared, use layout 6 (Screen)
    if (layoutId === 'screenshare' || (isSharingScreen && selectedLayout === 6)) {
      return {
        type: 'screen',
        container: 'flex flex-col gap-1 p-1',
        topBar: 'flex flex-row gap-1',
        topBarHeight: 'h-[12%]', // Smaller participant thumbnails (12% instead of 25%)
        screenShare: 'flex-1 h-[88%]', // Almost fullscreen for shared screen (88% instead of 75%)
      };
    }

    const numericLayoutId = typeof layoutId === 'number' ? layoutId : selectedLayout;

    switch (numericLayoutId) {
      case 1: // Solo - One person fills entire screen
        return {
          type: 'solo',
          container: 'grid gap-2 p-2',
          gridCols: 1,
          gridRows: 1,
          mainVideo: 'col-span-1 row-span-1',
        };

      case 2: // Cropped - 2x2 grid, tight boxes
        return {
          type: 'cropped',
          container: 'grid gap-2 p-2',
          gridCols: 2,
          gridRows: 2,
          mainVideo: 'col-span-1 row-span-1',
        };

      case 3: // Group - Equal-sized grid (auto-calculated)
        const { cols, rows } = calculateDynamicGrid(totalParticipants);
        return {
          type: 'group',
          container: 'grid gap-2 p-2',
          gridCols: cols,
          gridRows: rows,
          mainVideo: 'col-span-1 row-span-1',
        };

      case 4: // Spotlight - One large + small boxes above
        return {
          type: 'spotlight',
          container: 'grid gap-2 p-2',
          gridCols: 3,
          gridRows: 4,
          mainVideo: 'col-span-3 row-span-3', // Bottom 3 rows
          secondaryVideo: 'col-span-1 row-span-1', // Top row slots
        };

      case 5: // News - Side by side (2 columns)
        return {
          type: 'news',
          container: 'grid gap-2 p-2',
          gridCols: 2,
          gridRows: 1,
          mainVideo: 'col-span-1 row-span-1',
        };

      case 6: // Screen - Handled above with screen share
        return {
          type: 'screen',
          container: 'flex flex-col gap-2 p-2',
          topBar: 'flex flex-row gap-2',
          topBarHeight: 'h-[25%]',
          screenShare: 'flex-1 h-[75%]',
        };

      case 7: // Picture-in-Picture - Full screen with overlay
        return {
          type: 'pip',
          container: 'relative p-2',
          mainVideo: 'w-full h-full',
          pipOverlay: 'absolute bottom-4 right-4 w-1/4 h-1/4',
        };

      case 8: // Cinema - Wide format (21:9 aspect)
        return {
          type: 'cinema',
          container: 'grid gap-2 p-2',
          gridCols: totalParticipants > 1 ? 2 : 1,
          gridRows: 1,
          mainVideo: 'col-span-1 row-span-1',
        };

      case 9: // Video Grid - Auto-adjusting grid layout
        const videoGrid = calculateDynamicGrid(totalParticipants);
        return {
          type: 'videogrid',
          container: 'grid gap-4 p-4',
          gridCols: videoGrid.cols,
          gridRows: videoGrid.rows,
          mainVideo: 'col-span-1 row-span-1 w-full h-full',
        };

      case 10: // Advanced Positioning - Draggable participants
        return {
          type: 'draggable',
          container: 'relative w-full h-full',
          mainVideo: 'absolute',
        };

      default:
        // Fallback to group layout
        const fallbackGrid = calculateDynamicGrid(totalParticipants);
        return {
          type: 'group',
          container: 'grid gap-2 p-2',
          gridCols: fallbackGrid.cols,
          gridRows: fallbackGrid.rows,
          mainVideo: 'col-span-1 row-span-1',
        };
    }
  };

  // Set srcObject for screen share video
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
      // Ensure video plays
      screenShareVideoRef.current.play().catch(err =>
        console.error('Failed to play screen share video:', err)
      );
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

  const handleFullscreen = () => {
    if (containerRef.current) {
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else {
        containerRef.current.requestFullscreen();
      }
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolume(newVolume);

    // CRITICAL FIX: Use compositor service to set master volume
    // This controls the Web Audio API mixer which handles ALL audio:
    // - Participant audio (from WebRTC MediaStreams)
    // - Intro/countdown videos
    // - Audio/video clips
    // Setting HTML element .volume property doesn't affect Web Audio API routing
    compositorService.setInputVolume(newVolume);

  };

  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  return (
    <div
      ref={containerRef}
      className="relative group"
      style={{
        width: '100%',
        maxWidth: orientation === 'portrait' ? '563px' : '1001px',
        aspectRatio,
        backgroundColor,
        border: editMode ? '4px solid #8B5CF6' : 'none',
        boxSizing: 'border-box',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Canvas - renders all output */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          backgroundColor: '#000',
        }}
      />

      {/* Fullscreen button - bottom right */}
      <button
        onClick={handleFullscreen}
        className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded text-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Fullscreen"
        style={{ zIndex: 50 }}
      >
        [ ]
      </button>

      {/* Volume control - bottom center */}
      <div
        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ zIndex: 50 }}
      >
        <div className="bg-black/70 rounded-lg p-4 flex flex-col items-center gap-2">
          <div className="text-white text-sm font-medium">Volume</div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xs">0</span>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => handleVolumeChange(parseInt(e.target.value))}
              className="w-32 h-2"
            />
            <span className="text-white text-xs">100</span>
          </div>
          <div className="text-white text-sm">{volume}%</div>
        </div>
      </div>

      {/* Hidden video elements for stream management */}
      {localStream && isLocalUserOnStage && (
        <video
          ref={mainVideoRef}
          autoPlay
          playsInline
          muted
          style={{ display: 'none' }}
        />
      )}
      {screenShareStream && (
        <video
          ref={screenShareVideoRef}
          autoPlay
          playsInline
          style={{ display: 'none' }}
        />
      )}
    </div>
  );
}
