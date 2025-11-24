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
import { canvasStreamService } from '../../../services/canvas-stream.service';
import { webrtcService } from '../../../services/webrtc.service';
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

  // Cached images for canvas rendering
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const overlayImageRef = useRef<HTMLImageElement | null>(null);
  const avatarImageRef = useRef<HTMLImageElement | null>(null);

  // Refs for props (to avoid stale closures in render loop)
  const isLocalUserOnStageRef = useRef(isLocalUserOnStage);
  const videoEnabledRef = useRef(videoEnabled);
  const selectedLayoutRef = useRef(selectedLayout);
  const isSharingScreenRef = useRef(isSharingScreen);
  const captionsEnabledRef = useRef(captionsEnabled);
  const currentCaptionRef = useRef(currentCaption);
  const chatMessagesRef = useRef(chatMessages);
  const showChatOnStreamRef = useRef(showChatOnStream);
  const chatOverlayPositionRef = useRef(chatOverlayPosition);
  const chatOverlaySizeRef = useRef(chatOverlaySize);
  const teleprompterNotesRef = useRef(teleprompterNotes);
  const showTeleprompterOnCanvasRef = useRef(showTeleprompterOnCanvas);
  const teleprompterFontSizeRef = useRef(teleprompterFontSize);
  const teleprompterScrollPositionRef = useRef(teleprompterScrollPosition);
  const displayedCommentRef = useRef(displayedComment);

  // Detect if local user is speaking (for voice animations) - use RAW audio before noise gate
  const isLocalSpeaking = useAudioLevel(rawStream || localStream, audioEnabled);
  const isLocalSpeakingRef = useRef(isLocalSpeaking);

  // Load banners from localStorage
  const [banners, setBanners] = useState<Banner[]>([]);

  // Banners ref
  const bannersRef = useRef(banners);

  // Update refs when props change
  useEffect(() => {
    isLocalUserOnStageRef.current = isLocalUserOnStage;
    videoEnabledRef.current = videoEnabled;
    selectedLayoutRef.current = selectedLayout;
    isSharingScreenRef.current = isSharingScreen;
    isLocalSpeakingRef.current = isLocalSpeaking;
    captionsEnabledRef.current = captionsEnabled;
    currentCaptionRef.current = currentCaption;
    chatMessagesRef.current = chatMessages;
    showChatOnStreamRef.current = showChatOnStream;
    chatOverlayPositionRef.current = chatOverlayPosition;
    chatOverlaySizeRef.current = chatOverlaySize;
    teleprompterNotesRef.current = teleprompterNotes;
    showTeleprompterOnCanvasRef.current = showTeleprompterOnCanvas;
    teleprompterFontSizeRef.current = teleprompterFontSize;
    teleprompterScrollPositionRef.current = teleprompterScrollPosition;
    displayedCommentRef.current = displayedComment;
    bannersRef.current = banners;
  }, [isLocalUserOnStage, videoEnabled, selectedLayout, isSharingScreen, isLocalSpeaking, captionsEnabled, currentCaption,
      chatMessages, showChatOnStream, chatOverlayPosition, chatOverlaySize, teleprompterNotes, showTeleprompterOnCanvas,
      teleprompterFontSize, teleprompterScrollPosition, displayedComment, banners]);

  // Track which remote participants are speaking
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());

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
    // WARNING: DO NOT add willReadFrequently: true - it breaks canvas rendering completely
    // This flag switches from GPU to CPU rendering and causes the entire canvas to stop displaying
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

    // CRITICAL: DO NOT capture stream yet - canvas is blank!
    // Stream will be captured after first frame is rendered
    // This ensures the stream contains actual video data, not blank frames

    // Start rendering loop
    let frameCount = 0;
    let lastFrameTime = performance.now();
    let streamCaptured = false; // Flag to capture stream after first frame

    const render = () => {
      if (!ctx || !canvas) {
        console.error('[StudioCanvas] ❌ Render called but missing ctx or canvas!', { ctx: !!ctx, canvas: !!canvas });
        return;
      }

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      // Target 30 FPS (33ms per frame)
      if (elapsed >= 33) {
        lastFrameTime = now - (elapsed % 33);
        frameCount++;

        // Log first frame and every 30 frames (~1 second)
        if (frameCount === 1 || frameCount % 30 === 0) {
          console.log(`[StudioCanvas] ${frameCount === 1 ? '🎨 FIRST FRAME RENDERED!' : 'Render loop running:'}`, {
            frameCount,
            canvasSize: { width: canvas.width, height: canvas.height },
            backgroundColor,
            hasBackgroundImage: !!backgroundImageRef.current,
            isLocalUserOnStage: isLocalUserOnStageRef.current,
            hasMainVideo: !!mainVideoRef.current,
            videoEnabled: videoEnabledRef.current,
            hasAvatar: !!avatarImageRef.current,
            remoteParticipantCount: remoteParticipants.size,
          });
        }

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background image (full canvas)
        if (backgroundImageRef.current) {
          ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
        }

        // Collect all on-stage participants (local + remote)
        const onStageRemote = Array.from(remoteParticipants.values()).filter(
          (p) => p.role !== 'backstage' && p.id !== 'screen-share'
        );

        const allParticipants: Array<{ type: 'local' | 'remote', id: string, video?: HTMLVideoElement, participant?: any, videoEnabled: boolean }> = [];

        // CRITICAL: Always add local participant - broadcaster should always be visible
        // The isLocalUserOnStage prop is only for managing remote guests, not the broadcaster
        if (mainVideoRef.current) {
          allParticipants.push({
            type: 'local',
            id: 'local',
            video: mainVideoRef.current,
            videoEnabled: videoEnabledRef.current
          });
        }

        // Add remote participants (only those on stage)
        onStageRemote.forEach((participant) => {
          const video = remoteVideoElementsRef.current.get(participant.id);
          if (video) {
            allParticipants.push({
              type: 'remote',
              id: participant.id,
              video,
              participant,
              videoEnabled: participant.videoEnabled
            });
          }
        });

        // Log participant collection every 30 frames
        if (frameCount % 30 === 0) {
          console.log('[StudioCanvas] Participants collected:', {
            participantCount: allParticipants.length,
            participants: allParticipants.map(p => ({
              type: p.type,
              id: p.id,
              hasVideo: !!p.video,
              videoEnabled: p.videoEnabled,
              videoReadyState: p.video?.readyState,
              videoWidth: p.video?.videoWidth,
              videoHeight: p.video?.videoHeight,
            })),
          });
        }

        // Calculate layout based on selected layout and screen share state
        const layout = selectedLayoutRef.current;
        const isScreenSharing = isSharingScreenRef.current;
        const participantCount = allParticipants.length;

        // Layout 6 (Screen Share) takes priority when screen sharing
        const activeLayout = (isScreenSharing || screenShareVideoRef.current?.srcObject) ? 6 : layout;

        // Calculate participant positions based on layout
        interface ParticipantPosition {
          x: number;
          y: number;
          width: number;
          height: number;
        }

        const positions: ParticipantPosition[] = [];

        switch (activeLayout) {
          case 1: // Solo - centered at 50% (matching backup: width: '50%', height: '50%')
            if (participantCount === 1) {
              const width = canvas.width * 0.5;
              const height = canvas.height * 0.5;
              positions.push({
                x: (canvas.width - width) / 2,
                y: (canvas.height - height) / 2,
                width,
                height
              });
            } else {
              // Multiple participants in grid
              const cols = Math.ceil(Math.sqrt(participantCount));
              const rows = Math.ceil(participantCount / cols);
              const boxWidth = canvas.width / cols;
              const boxHeight = canvas.height / rows;
              allParticipants.forEach((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
              });
            }
            break;

          case 2: // Cropped - 2x2 grid
            {
              const cols = 2;
              const rows = 2;
              const boxWidth = canvas.width / cols;
              const boxHeight = canvas.height / rows;
              allParticipants.forEach((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
              });
            }
            break;

          case 3: // Group - auto-calculated equal grid
            {
              const cols = Math.ceil(Math.sqrt(participantCount));
              const rows = Math.ceil(participantCount / cols);
              const boxWidth = canvas.width / cols;
              const boxHeight = canvas.height / rows;
              allParticipants.forEach((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
              });
            }
            break;

          case 4: // Spotlight - one large + small boxes above
            if (participantCount === 1) {
              positions.push({ x: 0, y: 0, width: canvas.width, height: canvas.height });
            } else {
              const topBarHeight = canvas.height * 0.25;
              const mainHeight = canvas.height * 0.75;
              const thumbnailWidth = canvas.width / Math.min(3, participantCount - 1);

              // First participant is main (large)
              positions.push({ x: 0, y: topBarHeight, width: canvas.width, height: mainHeight });

              // Rest are thumbnails in top bar
              for (let i = 1; i < participantCount; i++) {
                positions.push({
                  x: (i - 1) * thumbnailWidth,
                  y: 0,
                  width: thumbnailWidth,
                  height: topBarHeight
                });
              }
            }
            break;

          case 5: // News - side by side
            {
              const boxWidth = canvas.width / 2;
              allParticipants.forEach((_, i) => {
                positions.push({ x: i * boxWidth, y: 0, width: boxWidth, height: canvas.height });
              });
            }
            break;

          case 6: // Screen Share - small thumbnails on top (matching backup: 120px × 90px per tile)
            // Keep thumbnails small and centered, don't expand to fill width
            {
              const topBarHeight = canvas.height * 0.12;
              // Match backup sizes: 120px wide × 90px tall (6.25% × 8.33% of 1920×1080)
              const thumbnailWidth = canvas.width * 0.0625;  // 120px at 1920px width
              const thumbnailHeight = canvas.height * 0.0833; // 90px at 1080px height

              // Center thumbnails horizontally
              const totalWidth = thumbnailWidth * participantCount;
              const startX = (canvas.width - totalWidth) / 2;

              allParticipants.forEach((_, i) => {
                positions.push({
                  x: startX + i * thumbnailWidth,
                  y: (topBarHeight - thumbnailHeight) / 2, // Center vertically in top bar
                  width: thumbnailWidth,
                  height: thumbnailHeight
                });
              });
            }
            break;

          case 7: // Picture-in-Picture - main + corner overlay (matching backup: 240px × 180px)
            if (participantCount === 1) {
              positions.push({ x: 0, y: 0, width: canvas.width, height: canvas.height });
            } else {
              // First participant fullscreen
              positions.push({ x: 0, y: 0, width: canvas.width, height: canvas.height });

              // Others in bottom-right corner (matching backup: 240px × 180px = 12.5% × 16.67%)
              const pipWidth = canvas.width * 0.125;   // 240px at 1920px
              const pipHeight = canvas.height * 0.1667; // 180px at 1080px
              const gap = canvas.width * 0.0052; // ~10px at 1920px
              for (let i = 1; i < participantCount; i++) {
                positions.push({
                  x: canvas.width - pipWidth - gap,
                  y: canvas.height - (pipHeight + gap) * (i),
                  width: pipWidth,
                  height: pipHeight
                });
              }
            }
            break;

          case 8: // Cinema - wide format (matching backup: 160px × 120px when solo)
            if (participantCount === 1) {
              // Solo: small box at top center (matching backup: 160px × 120px = 8.33% × 11.11%)
              const width = canvas.width * 0.0833;   // 160px at 1920px
              const height = canvas.height * 0.1111;  // 120px at 1080px
              const padding = canvas.height * 0.0093; // ~10px at 1080px
              positions.push({
                x: (canvas.width - width) / 2,
                y: padding,
                width,
                height
              });
            } else {
              // Multiple: side by side
              const boxWidth = canvas.width / participantCount;
              allParticipants.forEach((_, i) => {
                positions.push({ x: i * boxWidth, y: 0, width: boxWidth, height: canvas.height });
              });
            }
            break;

          case 9: // Video Grid - auto grid with gaps
            {
              const cols = Math.ceil(Math.sqrt(participantCount));
              const rows = Math.ceil(participantCount / cols);
              const gap = 4;
              const boxWidth = (canvas.width - gap * (cols + 1)) / cols;
              const boxHeight = (canvas.height - gap * (rows + 1)) / rows;
              allParticipants.forEach((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions.push({
                  x: gap + col * (boxWidth + gap),
                  y: gap + row * (boxHeight + gap),
                  width: boxWidth,
                  height: boxHeight
                });
              });
            }
            break;

          default:
            // Fallback to group layout
            {
              const cols = Math.ceil(Math.sqrt(participantCount));
              const rows = Math.ceil(participantCount / cols);
              const boxWidth = canvas.width / cols;
              const boxHeight = canvas.height / rows;
              allParticipants.forEach((_, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                positions.push({ x: col * boxWidth, y: row * boxHeight, width: boxWidth, height: boxHeight });
              });
            }
        }

        // Draw all participants using calculated positions
        allParticipants.forEach((p, index) => {
          if (index >= positions.length) return;

          const pos = positions[index];

          if (p.type === 'local' && !p.videoEnabled) {
            // Draw avatar when camera is off
            if (avatarImageRef.current) {
              const size = Math.min(pos.width, pos.height) * 0.6;
              const avatarX = pos.x + (pos.width - size) / 2;
              const avatarY = pos.y + (pos.height - size) / 2;

              ctx.save();
              ctx.beginPath();
              ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2, 0, Math.PI * 2);
              ctx.closePath();
              ctx.clip();
              ctx.drawImage(avatarImageRef.current, avatarX, avatarY, size, size);
              ctx.restore();
            } else {
              // No avatar - draw placeholder with icon/text
              ctx.fillStyle = '#2a2a2a';
              ctx.fillRect(pos.x, pos.y, pos.width, pos.height);

              // Draw "camera off" icon text
              ctx.fillStyle = '#888';
              ctx.font = 'bold 48px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText('📹', pos.x + pos.width / 2, pos.y + pos.height / 2 - 30);

              ctx.font = '24px Arial';
              ctx.fillText('Camera Off', pos.x + pos.width / 2, pos.y + pos.height / 2 + 30);
            }
          } else if (p.video && p.video.readyState >= 2) {
            // Draw video
            ctx.drawImage(p.video, pos.x, pos.y, pos.width, pos.height);
          } else {
            // Video not ready - draw placeholder
            if (frameCount % 30 === 0 && p.type === 'local') {
              console.error('[StudioCanvas] Local video NOT READY:', {
                hasVideo: !!p.video,
                readyState: p.video?.readyState,
                videoWidth: p.video?.videoWidth,
                videoHeight: p.video?.videoHeight,
                srcObject: !!p.video?.srcObject,
                paused: p.video?.paused,
              });
            }
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
          }

          // Draw pulsating ring when speaking
          const isSpeaking = p.type === 'local' ? isLocalSpeakingRef.current : speakingParticipants.has(p.id);

          if (isSpeaking) {
            // Calculate center of participant box
            const centerX = pos.x + pos.width / 2;
            const centerY = pos.y + pos.height / 2;
            const baseRadius = Math.min(pos.width, pos.height) / 2;

            // Pulsating animation based on time
            const pulseSpeed = 0.003;
            const pulseAmount = Math.sin(now * pulseSpeed) * 0.1 + 0.9; // Oscillates between 0.8 and 1.0
            const radius = baseRadius * pulseAmount;

            // Draw multiple rings for glow effect
            ctx.save();
            for (let i = 0; i < 3; i++) {
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius + i * 8, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 - i * 0.2})`; // Green with decreasing opacity
              ctx.lineWidth = 4 - i;
              ctx.stroke();
            }
            ctx.restore();
          }
        });

        // Draw screen share video (Layout 6 only)
        if (activeLayout === 6 && screenShareVideoRef.current && screenShareVideoRef.current.srcObject) {
          const video = screenShareVideoRef.current;
          if (video.readyState >= 2) {
            const topBarHeight = canvas.height * 0.12;
            const screenShareY = topBarHeight;
            const screenShareHeight = canvas.height - topBarHeight;

            // Draw screen share full width below participant thumbnails
            ctx.drawImage(video, 0, screenShareY, canvas.width, screenShareHeight);
          }
        }

        // DIAGNOSTIC: Log video state every 60 frames
        if (frameCount % 60 === 0) {
          console.log('[StudioCanvas] Participant state:', {
            totalParticipants: allParticipants.length,
            localOnStage: isLocalUserOnStageRef.current,
            localVideoEnabled: videoEnabledRef.current,
            localVideoReady: mainVideoRef.current?.readyState,
            remoteCount: onStageRemote.length,
            layout: activeLayout,
            isScreenSharing: isScreenSharing,
          });
        }

        // Draw overlay image (full-screen, on top of participants)
        if (overlayImageRef.current) {
          ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
        }

        // Draw logo (top-left corner)
        if (logoImageRef.current) {
          const logoSize = 150;
          ctx.drawImage(logoImageRef.current, 20, 20, logoSize, logoSize);
        }

        // Draw captions (bottom center)
        if (captionsEnabledRef.current && currentCaptionRef.current) {
          const caption = currentCaptionRef.current;
          const padding = 20;
          const maxWidth = canvas.width - padding * 2;
          const bottomMargin = 80;

          // Set caption text style
          ctx.font = 'bold 32px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';

          // Measure text for background box
          const textMetrics = ctx.measureText(caption.text);
          const textWidth = Math.min(textMetrics.width, maxWidth);
          const textHeight = 40; // Approximate text height
          const boxPadding = 15;

          // Draw semi-transparent background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(
            canvas.width / 2 - textWidth / 2 - boxPadding,
            canvas.height - bottomMargin - textHeight - boxPadding,
            textWidth + boxPadding * 2,
            textHeight + boxPadding * 2
          );

          // Draw white text with shadow for better readability
          ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
          ctx.shadowBlur = 4;
          ctx.shadowOffsetX = 2;
          ctx.shadowOffsetY = 2;
          ctx.fillStyle = '#ffffff';
          ctx.fillText(caption.text, canvas.width / 2, canvas.height - bottomMargin, maxWidth);

          // Reset shadow
          ctx.shadowColor = 'transparent';
          ctx.shadowBlur = 0;
          ctx.shadowOffsetX = 0;
          ctx.shadowOffsetY = 0;
        }

        // Draw banners (lower thirds, text overlays, CTAs)
        const visibleBanners = bannersRef.current.filter(b => b.visible);
        visibleBanners.forEach((banner) => {
          let x = 0, y = 0;
          const bannerHeight = 80;
          const bannerWidth = banner.type === 'lower-third' ? 400 : canvas.width * 0.8;

          // Position based on banner.position
          switch (banner.position) {
            case 'top-left':
              x = 20; y = 100;
              break;
            case 'top-center':
              x = (canvas.width - bannerWidth) / 2; y = 100;
              break;
            case 'top-right':
              x = canvas.width - bannerWidth - 20; y = 100;
              break;
            case 'bottom-left':
              x = 20; y = canvas.height - bannerHeight - 20;
              break;
            case 'bottom-center':
              x = (canvas.width - bannerWidth) / 2; y = canvas.height - bannerHeight - 20;
              break;
            case 'bottom-right':
              x = canvas.width - bannerWidth - 20; y = canvas.height - bannerHeight - 20;
              break;
          }

          // Draw banner background
          ctx.fillStyle = banner.backgroundColor || 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x, y, bannerWidth, bannerHeight);

          // Draw banner text
          ctx.font = 'bold 24px Arial, sans-serif';
          ctx.fillStyle = banner.textColor || '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(banner.title, x + 15, y + 15, bannerWidth - 30);

          if (banner.subtitle) {
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText(banner.subtitle, x + 15, y + 45, bannerWidth - 30);
          }
        });

        // Draw chat overlay
        if (showChatOnStreamRef.current && chatMessagesRef.current.length > 0) {
          const chatPos = chatOverlayPositionRef.current;
          const chatSize = chatOverlaySizeRef.current;
          const padding = 10;
          const messageHeight = 40;
          const maxMessages = Math.floor((chatSize.height - padding * 2) / messageHeight);
          const recentMessages = chatMessagesRef.current.slice(-maxMessages);

          // Draw chat background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(chatPos.x, chatPos.y, chatSize.width, chatSize.height);

          // Draw chat messages
          ctx.font = '16px Arial, sans-serif';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          recentMessages.forEach((msg, index) => {
            const y = chatPos.y + padding + index * messageHeight;

            // Author name in bold
            ctx.fillStyle = '#4a9eff';
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillText(msg.author + ':', chatPos.x + padding, y, chatSize.width - padding * 2);

            // Message text
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial, sans-serif';
            ctx.fillText(msg.message, chatPos.x + padding, y + 20, chatSize.width - padding * 2);
          });
        }

        // Draw teleprompter
        if (showTeleprompterOnCanvasRef.current && teleprompterNotesRef.current) {
          const fontSize = teleprompterFontSizeRef.current || 24;
          const scrollPos = teleprompterScrollPositionRef.current || 0;
          const teleprompterWidth = 600;
          const teleprompterHeight = 200;
          const x = (canvas.width - teleprompterWidth) / 2;
          const y = canvas.height - teleprompterHeight - 150; // Above captions

          // Semi-transparent background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(x, y, teleprompterWidth, teleprompterHeight);

          // Teleprompter text
          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, teleprompterWidth, teleprompterHeight);
          ctx.clip();

          ctx.font = `${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          const lines = teleprompterNotesRef.current.split('\n');
          const lineHeight = fontSize * 1.4;
          lines.forEach((line, index) => {
            const lineY = y + 10 - scrollPos + index * lineHeight;
            if (lineY > y - lineHeight && lineY < y + teleprompterHeight) {
              ctx.fillText(line, x + 10, lineY, teleprompterWidth - 20);
            }
          });

          ctx.restore();
        }

        // Draw displayed comment (from social media)
        if (displayedCommentRef.current) {
          const comment = displayedCommentRef.current;
          const commentWidth = 400;
          const commentHeight = 120;
          const x = canvas.width - commentWidth - 20;
          const y = 200;

          // Comment background
          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(x, y, commentWidth, commentHeight);

          // Platform badge
          const platformColors: Record<string, string> = {
            youtube: '#FF0000',
            facebook: '#1877F2',
            twitch: '#9146FF',
            linkedin: '#0A66C2',
            x: '#000000',
            rumble: '#85C742'
          };
          ctx.fillStyle = platformColors[comment.platform] || '#666666';
          ctx.fillRect(x, y, commentWidth, 8);

          // Author name
          ctx.font = 'bold 16px Arial, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(comment.authorName, x + 10, y + 15, commentWidth - 20);

          // Comment text
          ctx.font = '14px Arial, sans-serif';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(comment.message, x + 10, y + 40, commentWidth - 20);

          // Platform name
          ctx.font = '12px Arial, sans-serif';
          ctx.fillStyle = '#888888';
          ctx.fillText(comment.platform.toUpperCase(), x + 10, y + commentHeight - 25, commentWidth - 20);
        }

        // Log FPS and rendering state every 60 frames
        if (frameCount % 60 === 0) {
          const fps = 1000 / elapsed;
          console.log('[StudioCanvas] Render state:', {
            fps: fps.toFixed(1),
            hasBackground: !!backgroundImageRef.current,
            hasOverlay: !!overlayImageRef.current,
            hasLogo: !!logoImageRef.current,
            hasAvatar: !!avatarImageRef.current,
          });
        }

        // CRITICAL: Capture stream AFTER first frame is rendered
        // This ensures the stream contains actual video data, not blank frames
        if (frameCount === 1 && !streamCaptured) {
          streamCaptured = true;
          console.log('[StudioCanvas] 🎥 Capturing canvas stream AFTER first frame...');

          try {
            const canvasStream = canvas.captureStream(30);
            outputStreamRef.current = canvasStream;
            canvasStreamService.setOutputStream(canvasStream);

            const videoTrack = canvasStream.getVideoTracks()[0];
            console.log('[StudioCanvas] 📹 Canvas stream captured and registered:', {
              streamId: canvasStream.id,
              videoTracks: canvasStream.getVideoTracks().length,
              audioTracks: canvasStream.getAudioTracks().length,
              videoTrackId: videoTrack?.id,
              videoTrackEnabled: videoTrack?.enabled,
              videoTrackReadyState: videoTrack?.readyState,
              videoTrackMuted: videoTrack?.muted,
            });

            // Set up mute event handler
            if (videoTrack) {
              videoTrack.onmute = async () => {
                console.error('[StudioCanvas] ❌ Canvas video track MUTED! This causes black frames.', {
                  trackId: videoTrack.id,
                  enabled: videoTrack.enabled,
                  readyState: videoTrack.readyState,
                });

                console.log('[StudioCanvas] 🔄 Attempting to recreate canvas stream...');
                try {
                  const newStream = canvas.captureStream(30);
                  outputStreamRef.current = newStream;
                  canvasStreamService.setOutputStream(newStream);

                  const newTrack = newStream.getVideoTracks()[0];
                  console.log('[StudioCanvas] ✅ Canvas stream recreated:', {
                    newTrackId: newTrack?.id,
                    newTrackMuted: newTrack?.muted,
                  });

                  // Replace the track in the active mediasoup producer
                  try {
                    await webrtcService.replaceVideoTrack(newTrack);
                    console.log('[StudioCanvas] ✅ Mediasoup producer track replaced with new canvas track');
                  } catch (replaceErr) {
                    console.error('[StudioCanvas] ❌ Failed to replace mediasoup producer track:', replaceErr);
                  }
                } catch (err) {
                  console.error('[StudioCanvas] ❌ Failed to recreate canvas stream:', err);
                }
              };

              videoTrack.onunmute = () => {
                console.log('[StudioCanvas] ✅ Canvas video track UNMUTED', { trackId: videoTrack.id });
              };
            }
          } catch (error) {
            console.error('[StudioCanvas] Failed to capture canvas stream after first frame:', error);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    // Start render loop
    console.log('[StudioCanvas] 🎬 Starting render loop NOW');
    render();
    console.log('[StudioCanvas] ✅ Render loop started (first frame scheduled)');

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Clear canvas stream from service
      canvasStreamService.setOutputStream(null);
      outputStreamRef.current = null;
    };
  }, [backgroundColor, orientation]);

  // Set video srcObject for local stream
  // CRITICAL: Video element is always rendered when localStream exists
  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video || !localStream) return;

    console.log('[StudioCanvas] Setting video srcObject:', {
      hasVideo: !!video,
      hasStream: !!localStream,
      streamActive: localStream.active,
      videoTracks: localStream.getVideoTracks().length,
      audioTracks: localStream.getAudioTracks().length,
    });

    video.srcObject = localStream;

    // Add event listeners to track video loading
    const handleLoadedMetadata = () => {
      console.log('[StudioCanvas] Video metadata loaded:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };

    const handleCanPlay = () => {
      console.log('[StudioCanvas] Video can play:', {
        readyState: video.readyState,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
      });
    };

    const handleError = (err: Event) => {
      console.error('[StudioCanvas] Video error:', err);
    };

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    video.play().catch(err => console.error('[StudioCanvas] Failed to play local video:', err));

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [localStream]);

  // Set video srcObject for screen share
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
      screenShareVideoRef.current.play().catch(err => console.error('[StudioCanvas] Failed to play screen share:', err));
    }
  }, [screenShareStream]);

  // Manage video elements for remote participants
  useEffect(() => {
    const currentParticipantIds = Array.from(remoteParticipants.keys());
    const existingVideoIds = Array.from(remoteVideoElementsRef.current.keys());

    console.log('[StudioCanvas] Managing remote participant videos:', {
      currentParticipants: currentParticipantIds,
      existingVideos: existingVideoIds,
    });

    // Create video elements for new participants
    currentParticipantIds.forEach((participantId) => {
      const participant = remoteParticipants.get(participantId);
      if (!participant || !participant.stream) return;

      // Skip backstage and screen-share participants
      if (participant.role === 'backstage' || participantId === 'screen-share') return;

      // Skip if video element already exists
      if (remoteVideoElementsRef.current.has(participantId)) {
        // Update srcObject if stream changed
        const existingVideo = remoteVideoElementsRef.current.get(participantId);
        if (existingVideo && existingVideo.srcObject !== participant.stream) {
          console.log('[StudioCanvas] Updating stream for participant:', participantId);
          existingVideo.srcObject = participant.stream;
          existingVideo.play().catch(err => console.error('[StudioCanvas] Failed to play remote video:', participantId, err));
        }
        return;
      }

      // Create new video element
      console.log('[StudioCanvas] Creating video element for participant:', participantId);
      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true; // Muted because audio is handled by audioMixerService
      video.srcObject = participant.stream;
      video.play().catch(err => console.error('[StudioCanvas] Failed to play remote video:', participantId, err));

      remoteVideoElementsRef.current.set(participantId, video);
    });

    // Remove video elements for participants that left
    existingVideoIds.forEach((videoId) => {
      if (!currentParticipantIds.includes(videoId)) {
        console.log('[StudioCanvas] Removing video element for participant:', videoId);
        const video = remoteVideoElementsRef.current.get(videoId);
        if (video) {
          video.srcObject = null;
        }
        remoteVideoElementsRef.current.delete(videoId);
      }
    });

    // Cleanup on unmount
    return () => {
      remoteVideoElementsRef.current.forEach((video) => {
        video.srcObject = null;
      });
      remoteVideoElementsRef.current.clear();
    };
  }, [remoteParticipants]);

  // Load background image
  useEffect(() => {
    if (!streamBackground) {
      backgroundImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      backgroundImageRef.current = img;
      console.log('[StudioCanvas] Background image loaded:', img.width, 'x', img.height);
    };
    img.onerror = (err) => {
      console.error('[StudioCanvas] Failed to load background image:', err);
      backgroundImageRef.current = null;
    };
    img.src = streamBackground;
  }, [streamBackground]);

  // Load logo image
  useEffect(() => {
    if (!streamLogo) {
      logoImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      logoImageRef.current = img;
      console.log('[StudioCanvas] Logo image loaded:', img.width, 'x', img.height);
    };
    img.onerror = (err) => {
      console.error('[StudioCanvas] Failed to load logo image:', err);
      logoImageRef.current = null;
    };
    img.src = streamLogo;
  }, [streamLogo]);

  // Load overlay image (full-screen)
  useEffect(() => {
    if (!streamOverlay) {
      overlayImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      overlayImageRef.current = img;
      console.log('[StudioCanvas] Overlay image loaded:', img.width, 'x', img.height);
    };
    img.onerror = (err) => {
      console.error('[StudioCanvas] Failed to load overlay image:', err);
      overlayImageRef.current = null;
    };
    img.src = streamOverlay;
  }, [streamOverlay]);

  // Load avatar image
  useEffect(() => {
    const avatarUrl = localStorage.getItem('selectedAvatar');
    console.log('[StudioCanvas] Loading avatar from localStorage:', avatarUrl);

    if (!avatarUrl) {
      console.warn('[StudioCanvas] No avatar URL in localStorage');
      avatarImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      avatarImageRef.current = img;
      console.log('[StudioCanvas] ✅ Avatar image loaded successfully:', {
        width: img.width,
        height: img.height,
        url: avatarUrl,
      });
    };
    img.onerror = (err) => {
      console.error('[StudioCanvas] ❌ Failed to load avatar image:', {
        url: avatarUrl,
        error: err,
      });
      avatarImageRef.current = null;
    };

    console.log('[StudioCanvas] Starting avatar image load...');
    img.src = avatarUrl;
  }, []); // Load once on mount

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

  // Calculate aspect ratio based on orientation (10:6 = 5:3 for participant cameras)
  const aspectRatio = orientation === 'portrait' ? '6 / 10' : '10 / 6';

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

  return (
    <div
      ref={containerRef}
      data-studio-canvas-root
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

      {/* On-Screen Chat Overlay - Draggable & Resizable (DOM overlay for preview) */}
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

      {/* Banner Overlays (DOM preview - also rendered on canvas) */}
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

      {/* Logo Overlay - Top Left Corner (DOM preview - also rendered on canvas) */}
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

      {/* Full Screen Overlay - On top of everything (DOM preview - also rendered on canvas) */}
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
            pointerEvents: 'auto',
          }}
        >
          <video
            ref={(el) => {
              if (el && videoClip) {
                console.log('[VideoClip] Playing:', videoClip);

                // IMPORTANT: Mute the preview video to avoid double audio
                // The compositor's video is the one that provides audio for the output stream
                // This is just for visual preview, so it should be silent
                el.muted = true;
                el.volume = 0;
              }
            }}
            src={videoClip}
            autoPlay
            playsInline
            className="w-full h-full object-cover"
            onEnded={() => {
              console.log('[VideoClip] Preview video ended');
              // Auto-remove video clip when it ends
              setVideoClip(null);
              localStorage.removeItem('streamVideoClip');
              localStorage.removeItem('streamVideoClipAssetId');
              localStorage.removeItem('streamVideoClipName');
              window.dispatchEvent(new CustomEvent('videoClipUpdated', { detail: { url: null } }));
            }}
          />

          {/* Close button for video overlay */}
          <button
            onClick={() => {
              setVideoClip(null);
              localStorage.removeItem('streamVideoClip');
              localStorage.removeItem('streamVideoClipAssetId');
              localStorage.removeItem('streamVideoClipName');
              window.dispatchEvent(new CustomEvent('videoClipUpdated', { detail: { url: null } }));
            }}
            className="absolute top-4 right-4 bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg shadow-lg flex items-center gap-2 transition-colors"
            title="Close video overlay"
            style={{ zIndex: 36 }}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span className="text-sm font-medium">Close Video</span>
          </button>
        </div>
      )}

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
      {/* CRITICAL: Always render local video - canvas should always show broadcaster */}
      {/* The isLocalUserOnStage prop is for managing remote guests, not the broadcaster */}
      {localStream && (
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
