/**
 * StudioCanvas - Canvas 2D API Rendering System
 *
 * Renders all participants, overlays, and effects to a canvas that:
 * - Displays live canvas in browser (what user sees)
 * - Exports output stream via canvas.captureStream() for media server
 */

import { useRef, useEffect, useState } from 'react';
import { Caption } from '../../../services/caption.service';
import { canvasStreamService } from '../../../services/canvas-stream.service';
import { audioMixerService } from '../../../services/audio-mixer.service';
import { useAudioLevel } from '../../../hooks/studio/useAudioLevel';
import { useCanvasMedia } from '../../../hooks/studio/useCanvasMedia';
import { calculateParticipantPositions } from '../../../hooks/studio/useLayoutCalculations';

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
  rawStream: MediaStream | null;
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

// HTML Preview Video Component - renders a single participant using native HTML video
function HTMLPreviewVideo({
  participantId,
  stream,
  name,
  videoEnabled,
  isSpeaking,
  isLocal,
  avatarUrl,
  style,
}: {
  participantId: string;
  stream: MediaStream | null;
  name: string;
  videoEnabled: boolean;
  isSpeaking: boolean;
  isLocal: boolean;
  avatarUrl?: string | null;
  style: React.CSSProperties;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTrackIdRef = useRef<string | null>(null);
  const playRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Helper to attempt playing video with retry logic
  const attemptPlay = (video: HTMLVideoElement, reason: string) => {
    // Clear any pending retry
    if (playRetryTimeoutRef.current) {
      clearTimeout(playRetryTimeoutRef.current);
      playRetryTimeoutRef.current = null;
    }

    const videoTrack = stream?.getVideoTracks()[0];
    console.log('[HTMLPreviewVideo] Attempting play:', {
      participantId,
      reason,
      trackId: videoTrack?.id,
      trackEnabled: videoTrack?.enabled,
      trackMuted: videoTrack?.muted,
      trackReadyState: videoTrack?.readyState,
      videoPaused: video.paused,
      videoReadyState: video.readyState,
    });

    video.play()
      .then(() => {
        console.log('[HTMLPreviewVideo] Play succeeded:', { participantId });
      })
      .catch((err) => {
        console.warn('[HTMLPreviewVideo] Play failed, will retry:', { participantId, error: err.message });
        // Retry after a short delay
        playRetryTimeoutRef.current = setTimeout(() => {
          if (videoRef.current && stream) {
            // Force re-assign srcObject before retry
            videoRef.current.srcObject = null;
            videoRef.current.srcObject = stream;
            videoRef.current.play().catch((e) => {
              console.error('[HTMLPreviewVideo] Retry play failed:', { participantId, error: e.message });
            });
          }
        }, 500);
      });
  };

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    if (stream && videoEnabled) {
      // Get current video track ID to detect track changes within the same stream
      const videoTrack = stream.getVideoTracks()[0];
      const currentTrackId = videoTrack?.id || null;

      // Update srcObject if stream changed OR if the video track inside changed
      const streamChanged = video.srcObject !== stream;
      const trackChanged = currentTrackId !== lastTrackIdRef.current;

      if (streamChanged || trackChanged) {
        console.log('[HTMLPreviewVideo] Updating video source:', {
          participantId,
          streamChanged,
          trackChanged,
          oldTrackId: lastTrackIdRef.current,
          newTrackId: currentTrackId,
        });
        video.srcObject = stream;
        lastTrackIdRef.current = currentTrackId;
        attemptPlay(video, 'stream/track change');
      }
    } else if (video.srcObject) {
      // Clear srcObject when video is disabled or no stream
      video.srcObject = null;
      lastTrackIdRef.current = null;
    }

    return () => {
      if (playRetryTimeoutRef.current) {
        clearTimeout(playRetryTimeoutRef.current);
      }
    };
  }, [stream, videoEnabled, participantId]);

  // Also listen for track changes on the stream itself
  useEffect(() => {
    if (!stream) return;

    const handleTrackChange = () => {
      const video = videoRef.current;
      if (!video) return;

      const videoTrack = stream.getVideoTracks()[0];
      const currentTrackId = videoTrack?.id || null;

      if (currentTrackId !== lastTrackIdRef.current) {
        console.log('[HTMLPreviewVideo] Track changed via event:', {
          participantId,
          oldTrackId: lastTrackIdRef.current,
          newTrackId: currentTrackId,
        });
        // Force re-assign srcObject to pick up the new track
        video.srcObject = null;
        video.srcObject = stream;
        lastTrackIdRef.current = currentTrackId;
        attemptPlay(video, 'track event');
      }
    };

    stream.addEventListener('addtrack', handleTrackChange);
    stream.addEventListener('removetrack', handleTrackChange);

    return () => {
      stream.removeEventListener('addtrack', handleTrackChange);
      stream.removeEventListener('removetrack', handleTrackChange);
    };
  }, [stream, participantId]);

  // Monitor for stalled/paused video and attempt recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !videoEnabled) return;

    const handleStalled = () => {
      console.warn('[HTMLPreviewVideo] Video stalled, attempting recovery:', { participantId });
      attemptPlay(video, 'stalled event');
    };

    const handlePause = () => {
      // Only auto-resume if we have a valid stream
      if (stream && stream.getVideoTracks().length > 0 && !isLocal) {
        console.warn('[HTMLPreviewVideo] Video paused unexpectedly, attempting resume:', { participantId });
        attemptPlay(video, 'unexpected pause');
      }
    };

    const handleCanPlay = () => {
      // Ensure video is playing when it becomes ready
      if (video.paused && stream) {
        console.log('[HTMLPreviewVideo] Video can play, ensuring playback:', { participantId });
        attemptPlay(video, 'canplay event');
      }
    };

    video.addEventListener('stalled', handleStalled);
    video.addEventListener('pause', handlePause);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('stalled', handleStalled);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, [stream, videoEnabled, participantId, isLocal]);

  // Monitor for frozen video (no frames) and attempt recovery
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !stream || !videoEnabled) return;

    let checkCount = 0;
    const maxChecks = 10; // Check for 5 seconds (500ms * 10)

    const checkForFrames = () => {
      if (!video || !stream) return;

      checkCount++;
      const hasFrames = video.videoWidth > 0 && video.videoHeight > 0;

      if (!hasFrames && checkCount <= maxChecks) {
        console.log('[HTMLPreviewVideo] No video frames yet, retrying...', {
          participantId,
          checkCount,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
          readyState: video.readyState,
          paused: video.paused,
        });

        // Force re-assign srcObject to reset video element
        video.srcObject = null;
        video.srcObject = stream;
        attemptPlay(video, `frame check retry ${checkCount}`);

        // Schedule next check
        setTimeout(checkForFrames, 500);
      } else if (hasFrames) {
        console.log('[HTMLPreviewVideo] Video has frames:', {
          participantId,
          videoWidth: video.videoWidth,
          videoHeight: video.videoHeight,
        });
      }
    };

    // Start checking after initial setup (give it a moment)
    const timeoutId = setTimeout(checkForFrames, 500);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [stream, videoEnabled, participantId]);

  // Determine what to show when video is off
  const showAvatar = !videoEnabled && isLocal && avatarUrl;

  return (
    <div
      className="absolute overflow-hidden rounded-2xl"
      style={{
        ...style,
        backgroundColor: '#1a1a1a',
      }}
    >
      {videoEnabled && stream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
          style={{ transform: isLocal ? 'scaleX(-1)' : 'none' }}
        />
      ) : showAvatar ? (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div
            className="rounded-full overflow-hidden"
            style={{
              width: '50%',
              height: 'auto',
              aspectRatio: '1',
              maxWidth: '200px',
              maxHeight: '200px',
            }}
          >
            <img
              src={avatarUrl}
              alt={name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-gray-800">
          <div className="w-16 h-16 rounded-full bg-gray-600 flex items-center justify-center">
            <span className="text-xl text-white font-semibold">
              {name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      {/* Name tag */}
      <div
        className={`absolute bottom-2 left-2 px-3 py-1.5 rounded-full text-sm font-semibold text-white transition-colors ${
          isSpeaking ? 'bg-green-500' : 'bg-black/70'
        }`}
      >
        {name}
      </div>

      {/* Speaking indicator ring */}
      {isSpeaking && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            border: '3px solid #22c55e',
            boxShadow: '0 0 20px rgba(34, 197, 94, 0.5)',
          }}
        />
      )}
    </div>
  );
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
  captionsEnabled,
  currentCaption,
  editMode = false,
  backgroundColor = '#0F1419',
  teleprompterNotes = '',
  teleprompterFontSize = 24,
  teleprompterScrollPosition = 0,
  showTeleprompterOnCanvas = false,
  displayedComment = null,
  orientation = 'landscape',
}: StudioCanvasProps) {
  const mainVideoRef = useRef<HTMLVideoElement>(null);
  const screenShareVideoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [volume, setVolume] = useState(100);

  // Canvas rendering refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const outputStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const remoteTrackIdsRef = useRef<Map<string, string>>(new Map()); // Track video track IDs for change detection
  const participantCanvasCacheRef = useRef<Map<string, { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; lastFrameTime: number }>>(new Map());
  const participantAudioAddedRef = useRef<Set<string>>(new Set());

  // Use extracted media hook - get both refs (for canvas) and URLs (for HTML preview)
  const { backgroundImageRef, logoImageRef, overlayImageRef, avatarImageRef, videoClipRef, streamBackground, streamLogo, streamOverlay, streamAvatar } = useCanvasMedia();

  // Detect if local user is speaking
  const isLocalSpeaking = useAudioLevel(rawStream || localStream, audioEnabled);
  const isLocalSpeakingRef = useRef(isLocalSpeaking);

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
  const remoteParticipantsRef = useRef(remoteParticipants);

  // Banners state
  const [banners, setBanners] = useState<Banner[]>([]);
  const bannersRef = useRef(banners);

  // Track speaking participants
  const [speakingParticipants, setSpeakingParticipants] = useState<Set<string>>(new Set());
  const speakingParticipantsRef = useRef<Set<string>>(new Set());

  // HTML Preview state - positions for HTML video elements
  const [previewPositions, setPreviewPositions] = useState<Array<{
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    videoEnabled: boolean;
    isLocal: boolean;
    isSpeaking: boolean;
  }>>([]);
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

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
    remoteParticipantsRef.current = remoteParticipants;
    speakingParticipantsRef.current = speakingParticipants;
  }, [isLocalUserOnStage, videoEnabled, selectedLayout, isSharingScreen, isLocalSpeaking, captionsEnabled, currentCaption,
      chatMessages, showChatOnStream, chatOverlayPosition, chatOverlaySize, teleprompterNotes, showTeleprompterOnCanvas,
      teleprompterFontSize, teleprompterScrollPosition, displayedComment, banners, remoteParticipants, speakingParticipants]);

  // Load banners from localStorage
  useEffect(() => {
    const loadBanners = () => {
      const saved = localStorage.getItem('banners');
      if (saved) {
        try { setBanners(JSON.parse(saved)); } catch {}
      }
    };
    loadBanners();

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'banners') loadBanners();
    };
    const handleBannersUpdated = ((e: CustomEvent) => setBanners(e.detail)) as EventListener;

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('bannersUpdated', handleBannersUpdated);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('bannersUpdated', handleBannersUpdated);
    };
  }, []);

  // Track container size for HTML preview scaling
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        setContainerDimensions({
          width: containerRef.current.offsetWidth,
          height: containerRef.current.offsetHeight,
        });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    // Also update on orientation change
    const resizeObserver = new ResizeObserver(updateSize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => {
      window.removeEventListener('resize', updateSize);
      resizeObserver.disconnect();
    };
  }, []);

  // Update HTML preview positions when participants or layout changes
  useEffect(() => {
    const canvasWidth = orientation === 'portrait' ? 1080 : 1920;
    const canvasHeight = orientation === 'portrait' ? 1920 : 1080;
    const scaleX = containerDimensions.width / canvasWidth;
    const scaleY = containerDimensions.height / canvasHeight;

    // Collect participants
    const participants: Array<{
      id: string;
      name: string;
      stream: MediaStream | null;
      videoEnabled: boolean;
      isLocal: boolean;
    }> = [];

    if (isLocalUserOnStage && localStream) {
      participants.push({
        id: 'local',
        name: 'You',
        stream: localStream,
        videoEnabled,
        isLocal: true,
      });
    }

    remoteParticipants.forEach((p, id) => {
      if (p.role === 'guest' && id !== 'screen-share') {
        participants.push({
          id,
          name: p.name || 'Guest',
          stream: p.stream,
          videoEnabled: p.videoEnabled,
          isLocal: false,
        });
      }
    });

    // Calculate positions
    const positions = calculateParticipantPositions(
      canvasWidth,
      canvasHeight,
      participants.length,
      selectedLayout,
      isSharingScreen
    );

    // Scale positions to container and create preview data
    const previewData = participants.map((p, i) => {
      const pos = positions[i] || { x: 0, y: 0, width: 0, height: 0 };
      return {
        id: p.id,
        x: pos.x * scaleX,
        y: pos.y * scaleY,
        width: pos.width * scaleX,
        height: pos.height * scaleY,
        name: p.name,
        videoEnabled: p.videoEnabled,
        isLocal: p.isLocal,
        isSpeaking: p.isLocal ? isLocalSpeaking : speakingParticipants.has(p.id),
      };
    });

    setPreviewPositions(previewData);
  }, [
    isLocalUserOnStage, localStream, videoEnabled, remoteParticipants,
    selectedLayout, isSharingScreen, orientation, containerDimensions,
    isLocalSpeaking, speakingParticipants
  ]);

  // Monitor audio levels for remote participants
  // CRITICAL: Use a ref to persist audio contexts across re-renders
  // This prevents constant recreation of audio contexts which causes flickering
  const audioContextsRef = useRef<Map<string, { context: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; frameId: number; streamId: string }>>(new Map());

  useEffect(() => {
    const currentParticipantIds = new Set<string>();

    remoteParticipants.forEach((p, id) => {
      if (!p.stream || !p.audioEnabled || !p.stream.getAudioTracks().length) {
        // Remove analyzer if audio is disabled
        const existing = audioContextsRef.current.get(id);
        if (existing) {
          cancelAnimationFrame(existing.frameId);
          existing.source.disconnect();
          existing.analyser.disconnect();
          if (existing.context.state !== 'closed') existing.context.close();
          audioContextsRef.current.delete(id);
        }
        setSpeakingParticipants(prev => { const next = new Set(prev); next.delete(id); return next; });
        return;
      }

      currentParticipantIds.add(id);
      const streamId = p.stream.id;

      // CRITICAL: Only create new analyzer if we don't have one or the stream changed
      const existing = audioContextsRef.current.get(id);
      if (existing && existing.streamId === streamId) {
        // Already have a working analyzer for this stream - do nothing
        return;
      }

      // Close old analyzer if exists (stream changed)
      if (existing) {
        cancelAnimationFrame(existing.frameId);
        existing.source.disconnect();
        existing.analyser.disconnect();
        if (existing.context.state !== 'closed') existing.context.close();
        audioContextsRef.current.delete(id);
      }

      try {
        const audioContext = new AudioContext();
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.8;

        const audioTrack = p.stream.getAudioTracks()[0];
        const clonedStream = new MediaStream([audioTrack.clone()]);
        const source = audioContext.createMediaStreamSource(clonedStream);
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        let wasSpeaking = false;

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          const isSpeaking = average > 10;

          if (isSpeaking !== wasSpeaking) {
            wasSpeaking = isSpeaking;
            setSpeakingParticipants(prev => {
              const next = new Set(prev);
              if (isSpeaking) next.add(id);
              else next.delete(id);
              return next;
            });
          }

          const frameId = requestAnimationFrame(checkAudioLevel);
          const entry = audioContextsRef.current.get(id);
          if (entry) entry.frameId = frameId;
        };

        const frameId = requestAnimationFrame(checkAudioLevel);
        audioContextsRef.current.set(id, { context: audioContext, analyser, source, frameId, streamId });
      } catch {}
    });

    // Remove analyzers for participants that left
    audioContextsRef.current.forEach((entry, id) => {
      if (!currentParticipantIds.has(id)) {
        cancelAnimationFrame(entry.frameId);
        entry.source.disconnect();
        entry.analyser.disconnect();
        if (entry.context.state !== 'closed') entry.context.close();
        audioContextsRef.current.delete(id);
      }
    });

    // Only cleanup on unmount - don't cleanup on every remoteParticipants change
    return () => {};
  }, [remoteParticipants]);

  // Cleanup audio contexts on unmount only
  useEffect(() => {
    return () => {
      audioContextsRef.current.forEach(({ context, analyser, source, frameId }) => {
        cancelAnimationFrame(frameId);
        source.disconnect();
        analyser.disconnect();
        if (context.state !== 'closed') context.close();
      });
      audioContextsRef.current.clear();
    };
  }, []);

  // Canvas initialization and render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
    if (!ctx) return;
    canvasCtxRef.current = ctx;

    // Set canvas resolution
    canvas.width = orientation === 'portrait' ? 1080 : 1920;
    canvas.height = orientation === 'portrait' ? 1920 : 1080;

    // Capture canvas stream for media server
    try {
      const canvasStream = canvas.captureStream(30);
      outputStreamRef.current = canvasStream;
      canvasStreamService.setOutputStream(canvasStream);
    } catch {}

    let lastFrameTime = performance.now();
    const videoStableFrames = new Map<string, number>();

    const render = () => {
      if (!ctx || !canvas) return;

      const now = performance.now();
      const elapsed = now - lastFrameTime;

      if (elapsed >= 33) { // 30 FPS
        lastFrameTime = now - (elapsed % 33);

        // Clear canvas
        ctx.fillStyle = backgroundColor;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw background
        if (backgroundImageRef.current) {
          ctx.drawImage(backgroundImageRef.current, 0, 0, canvas.width, canvas.height);
        }

        // Collect on-stage participants
        const onStageRemote = Array.from(remoteParticipantsRef.current.values())
          .filter(p => p.role === 'guest' && p.id !== 'screen-share');

        const allParticipants: Array<{ type: 'local' | 'remote', id: string, video?: HTMLVideoElement, participant?: RemoteParticipant, videoEnabled: boolean }> = [];

        if (isLocalUserOnStageRef.current && mainVideoRef.current) {
          allParticipants.push({ type: 'local', id: 'local', video: mainVideoRef.current, videoEnabled: videoEnabledRef.current });
        }

        onStageRemote.forEach(p => {
          // Get existing video element - creation is handled by useEffect
          const video = remoteVideoElementsRef.current.get(p.id);
          if (video) {
            allParticipants.push({ type: 'remote', id: p.id, video, participant: p, videoEnabled: p.videoEnabled });
          }
        });

        // Calculate positions
        const positions = calculateParticipantPositions(
          canvas.width, canvas.height, allParticipants.length,
          selectedLayoutRef.current, isSharingScreenRef.current || !!screenShareVideoRef.current?.srcObject
        );

        const cornerRadius = 16;

        // Draw participants - SIMPLIFIED: Draw directly from video, no cache
        allParticipants.forEach((p, i) => {
          if (i >= positions.length) return;
          const pos = positions[i];

          // Check if video is ready to draw
          const videoReady = p.video && p.video.readyState >= 2 && p.video.videoWidth > 0 && p.video.videoHeight > 0;

          const shouldDrawAvatar = !p.videoEnabled && p.type === 'local' && avatarImageRef.current;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pos.x, pos.y, pos.width, pos.height, cornerRadius);
          ctx.clip();

          // Draw directly from video element (no cache) - simpler and more reliable
          if (p.videoEnabled && videoReady) {
            try {
              ctx.drawImage(p.video!, pos.x, pos.y, pos.width, pos.height);
            } catch {
              ctx.fillStyle = '#1a1a1a';
              ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
            }
          } else if (shouldDrawAvatar) {
            const size = Math.min(pos.width, pos.height) * 0.5;
            const avatarX = pos.x + (pos.width - size) / 2;
            const avatarY = pos.y + (pos.height - size) / 2;
            ctx.save();
            ctx.beginPath();
            ctx.arc(avatarX + size / 2, avatarY + size / 2, size / 2, 0, Math.PI * 2);
            ctx.clip();
            ctx.drawImage(avatarImageRef.current!, avatarX, avatarY, size, size);
            ctx.restore();
          } else if (p.type === 'remote') {
            // Remote participant waiting for video - draw placeholder
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
            if (!p.videoEnabled) {
              // Video disabled - show darker background
              ctx.fillStyle = '#111';
              ctx.fillRect(pos.x, pos.y, pos.width, pos.height);
            }
          }

          ctx.restore();

          // Draw speaking ring
          const isSpeaking = p.type === 'local' ? isLocalSpeakingRef.current : speakingParticipantsRef.current.has(p.id);
          if (isSpeaking && !p.videoEnabled) {
            const centerX = pos.x + pos.width / 2;
            const centerY = pos.y + pos.height / 2;
            const baseRadius = Math.min(pos.width, pos.height) / 2;
            const radius = baseRadius * (Math.sin(now * 0.003) * 0.1 + 0.9);

            ctx.save();
            for (let j = 0; j < 3; j++) {
              ctx.beginPath();
              ctx.arc(centerX, centerY, radius + j * 8, 0, Math.PI * 2);
              ctx.strokeStyle = `rgba(0, 255, 0, ${0.6 - j * 0.2})`;
              ctx.lineWidth = 4 - j;
              ctx.stroke();
            }
            ctx.restore();
          }

          // Draw name tag
          const name = p.type === 'local' ? 'You' : (p.participant?.name || 'Guest');
          const nameTagHeight = 40;
          const nameTagY = pos.y + pos.height - nameTagHeight - 8;
          ctx.font = '600 20px Inter, system-ui, sans-serif';
          const textWidth = ctx.measureText(name).width;
          const nameTagWidth = Math.min(textWidth + 24, pos.width - 16);
          const nameTagX = pos.x + 8;

          ctx.fillStyle = isSpeaking ? 'rgba(0, 200, 0, 0.85)' : 'rgba(0, 0, 0, 0.75)';
          ctx.beginPath();
          ctx.roundRect(nameTagX, nameTagY, nameTagWidth, nameTagHeight, 20);
          ctx.fill();

          ctx.fillStyle = 'white';
          ctx.textBaseline = 'middle';
          ctx.fillText(name, nameTagX + 12, nameTagY + nameTagHeight / 2, nameTagWidth - 24);
        });

        // Draw screen share (Layout 6)
        if ((selectedLayoutRef.current === 6 || isSharingScreenRef.current) && screenShareVideoRef.current?.srcObject) {
          const video = screenShareVideoRef.current;
          if (video.readyState >= 2) {
            const topBarHeight = canvas.height * 0.12;
            ctx.drawImage(video, 0, topBarHeight, canvas.width, canvas.height - topBarHeight);
          }
        }

        // Draw video clip
        if (videoClipRef.current && videoClipRef.current.readyState >= 2) {
          ctx.drawImage(videoClipRef.current, 0, 0, canvas.width, canvas.height);
        }

        // Draw overlay
        if (overlayImageRef.current) {
          ctx.drawImage(overlayImageRef.current, 0, 0, canvas.width, canvas.height);
        }

        // Draw logo
        if (logoImageRef.current) {
          ctx.drawImage(logoImageRef.current, 20, 20, 150, 150);
        }

        // Draw captions
        if (captionsEnabledRef.current && currentCaptionRef.current) {
          const caption = currentCaptionRef.current;
          ctx.font = 'bold 32px Arial, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'bottom';
          const maxWidth = canvas.width - 40;
          const textMetrics = ctx.measureText(caption.text);
          const textWidth = Math.min(textMetrics.width, maxWidth);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(canvas.width / 2 - textWidth / 2 - 15, canvas.height - 120 - 40 - 15, textWidth + 30, 40 + 30);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(caption.text, canvas.width / 2, canvas.height - 80, maxWidth);
        }

        // Draw banners
        bannersRef.current.filter(b => b.visible).forEach(banner => {
          let x = 0, y = 0;
          const bannerHeight = 80;
          const bannerWidth = banner.type === 'lower-third' ? 400 : canvas.width * 0.8;

          switch (banner.position) {
            case 'top-left': x = 20; y = 100; break;
            case 'top-center': x = (canvas.width - bannerWidth) / 2; y = 100; break;
            case 'top-right': x = canvas.width - bannerWidth - 20; y = 100; break;
            case 'bottom-left': x = 20; y = canvas.height - bannerHeight - 20; break;
            case 'bottom-center': x = (canvas.width - bannerWidth) / 2; y = canvas.height - bannerHeight - 20; break;
            case 'bottom-right': x = canvas.width - bannerWidth - 20; y = canvas.height - bannerHeight - 20; break;
          }

          ctx.fillStyle = banner.backgroundColor || 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(x, y, bannerWidth, bannerHeight);
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
          const maxMessages = Math.floor((chatSize.height - 20) / 40);
          const recentMessages = chatMessagesRef.current.slice(-maxMessages);

          ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          ctx.fillRect(chatPos.x, chatPos.y, chatSize.width, chatSize.height);

          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          recentMessages.forEach((msg, i) => {
            const y = chatPos.y + 10 + i * 40;
            ctx.fillStyle = '#4a9eff';
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillText(msg.author + ':', chatPos.x + 10, y, chatSize.width - 20);
            ctx.fillStyle = '#ffffff';
            ctx.font = '16px Arial, sans-serif';
            ctx.fillText(msg.message, chatPos.x + 10, y + 20, chatSize.width - 20);
          });
        }

        // Draw teleprompter
        if (showTeleprompterOnCanvasRef.current && teleprompterNotesRef.current) {
          const fontSize = teleprompterFontSizeRef.current || 24;
          const scrollPos = teleprompterScrollPositionRef.current || 0;
          const teleprompterWidth = 600;
          const teleprompterHeight = 200;
          const x = (canvas.width - teleprompterWidth) / 2;
          const y = canvas.height - teleprompterHeight - 150;

          ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
          ctx.fillRect(x, y, teleprompterWidth, teleprompterHeight);

          ctx.save();
          ctx.beginPath();
          ctx.rect(x, y, teleprompterWidth, teleprompterHeight);
          ctx.clip();
          ctx.font = `${fontSize}px Arial, sans-serif`;
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';

          teleprompterNotesRef.current.split('\n').forEach((line, i) => {
            const lineY = y + 10 - scrollPos + i * fontSize * 1.4;
            if (lineY > y - fontSize && lineY < y + teleprompterHeight) {
              ctx.fillText(line, x + 10, lineY, teleprompterWidth - 20);
            }
          });
          ctx.restore();
        }

        // Draw displayed comment
        if (displayedCommentRef.current) {
          const comment = displayedCommentRef.current;
          const commentWidth = 400;
          const commentHeight = 120;
          const x = canvas.width - commentWidth - 20;
          const y = 200;

          const platformColors: Record<string, string> = {
            youtube: '#FF0000', facebook: '#1877F2', twitch: '#9146FF',
            linkedin: '#0A66C2', x: '#000000', rumble: '#85C742'
          };

          ctx.fillStyle = 'rgba(0, 0, 0, 0.8)';
          ctx.fillRect(x, y, commentWidth, commentHeight);
          ctx.fillStyle = platformColors[comment.platform] || '#666666';
          ctx.fillRect(x, y, commentWidth, 8);

          ctx.font = 'bold 16px Arial, sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
          ctx.fillText(comment.authorName, x + 10, y + 15, commentWidth - 20);
          ctx.font = '14px Arial, sans-serif';
          ctx.fillStyle = '#cccccc';
          ctx.fillText(comment.message, x + 10, y + 40, commentWidth - 20);
          ctx.font = '12px Arial, sans-serif';
          ctx.fillStyle = '#888888';
          ctx.fillText(comment.platform.toUpperCase(), x + 10, y + commentHeight - 25, commentWidth - 20);
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      canvasStreamService.setOutputStream(null);
      outputStreamRef.current = null;
    };
  }, [backgroundColor, orientation]);

  // Set local video srcObject
  useEffect(() => {
    const video = mainVideoRef.current;
    if (!video || !localStream) return;
    video.srcObject = localStream;
    video.play().catch(() => {});
  }, [localStream, isLocalUserOnStage]);

  // Set screen share srcObject
  useEffect(() => {
    if (screenShareVideoRef.current && screenShareStream) {
      screenShareVideoRef.current.srcObject = screenShareStream;
      screenShareVideoRef.current.play().catch(() => {});
    }
  }, [screenShareStream]);

  // Manage remote video elements
  // CRITICAL: Don't cleanup on every remoteParticipants change - only cleanup specific items that are no longer needed
  useEffect(() => {
    const currentIds = Array.from(remoteParticipants.keys());
    const existingIds = Array.from(remoteVideoElementsRef.current.keys());

    currentIds.forEach(id => {
      const p = remoteParticipants.get(id);
      if (!p?.stream || p.role !== 'guest' || id === 'screen-share') return;

      // Check if we need to add audio to mixer
      const alreadyAdded = participantAudioAddedRef.current.has(id);
      console.log('[StudioCanvas] Checking participant audio:', id, {
        alreadyAdded,
        audioEnabled: p.audioEnabled,
        hasStream: !!p.stream,
        audioTracksInStream: p.stream?.getAudioTracks().length,
      });

      if (!alreadyAdded && p.audioEnabled) {
        const audioTrack = p.stream.getAudioTracks()[0];
        console.log('[StudioCanvas] Audio track for participant:', id, {
          hasAudioTrack: !!audioTrack,
          trackEnabled: audioTrack?.enabled,
          trackMuted: audioTrack?.muted,
          trackReadyState: audioTrack?.readyState,
        });
        if (audioTrack) {
          try {
            audioMixerService.addStream(`participant-${id}`, new MediaStream([audioTrack]));
            participantAudioAddedRef.current.add(id);
            console.log('[StudioCanvas] Added participant audio to mixer:', id);
          } catch (err) {
            console.error('[StudioCanvas] Failed to add participant audio to mixer:', id, err);
          }
        } else {
          console.warn('[StudioCanvas] No audio track found for participant:', id);
        }
      } else if (!alreadyAdded && !p.audioEnabled) {
        console.log('[StudioCanvas] Skipping audio add - audioEnabled is false:', id);
      }

      // Get current video track ID to detect track changes
      const currentTrack = p.stream.getVideoTracks()[0];
      const currentTrackId = currentTrack?.id || null;
      const lastTrackId = remoteTrackIdsRef.current.get(id);

      if (remoteVideoElementsRef.current.has(id)) {
        const video = remoteVideoElementsRef.current.get(id)!;

        // Check if the video track has changed (even if stream object is same)
        if (currentTrackId && currentTrackId !== lastTrackId) {
          console.log('[StudioCanvas] Video track changed for participant:', id, {
            oldTrackId: lastTrackId,
            newTrackId: currentTrackId,
          });
          // Force re-assign srcObject to pick up the new track
          video.srcObject = null;
          video.srcObject = p.stream;
          remoteTrackIdsRef.current.set(id, currentTrackId);
          video.play().catch(() => {});
          return;
        }

        // If track hasn't changed, check if video is working
        const hasValidVideo = video.videoWidth > 0 && video.videoHeight > 0;
        const hasSrcObject = video.srcObject !== null;
        const isPlaying = video.readyState >= 2 && !video.paused;

        // If video has a srcObject and is playing (or at least has data), leave it alone
        if (hasSrcObject && (isPlaying || hasValidVideo)) {
          if (video.paused) video.play().catch(() => {});
          return;
        }

        // Only set srcObject if we don't have one at all
        if (!hasSrcObject && p.stream) {
          video.srcObject = p.stream;
          if (currentTrackId) remoteTrackIdsRef.current.set(id, currentTrackId);
          video.play().catch(() => {});
        }
        return;
      }

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = p.stream;
      if (currentTrackId) remoteTrackIdsRef.current.set(id, currentTrackId);
      video.play().catch(() => {});
      remoteVideoElementsRef.current.set(id, video);
    });

    // Only remove video elements for participants that actually left or are no longer guests
    existingIds.forEach(id => {
      const p = remoteParticipants.get(id);
      if (!currentIds.includes(id) || (p && p.role !== 'guest')) {
        remoteVideoElementsRef.current.get(id)?.srcObject && (remoteVideoElementsRef.current.get(id)!.srcObject = null);
        remoteVideoElementsRef.current.delete(id);
        remoteTrackIdsRef.current.delete(id);
        if (participantAudioAddedRef.current.has(id)) {
          audioMixerService.removeStream(`participant-${id}`);
          participantAudioAddedRef.current.delete(id);
        }
        participantCanvasCacheRef.current.delete(id);
      }
    });

    participantAudioAddedRef.current.forEach(id => {
      const p = remoteParticipants.get(id);
      if (!p || p.role !== 'guest') {
        audioMixerService.removeStream(`participant-${id}`);
        participantAudioAddedRef.current.delete(id);
      }
    });

    // CRITICAL: Don't return a cleanup function here!
    // The cleanup was clearing ALL video elements on every remoteParticipants change,
    // which caused flickering because new video elements need time to start playing.
    // Only cleanup specific items (done above) when they are no longer needed.
    return () => {};
  }, [remoteParticipants]);

  // Cleanup video elements ONLY on component unmount
  useEffect(() => {
    return () => {
      remoteVideoElementsRef.current.forEach(v => { v.srcObject = null; });
      remoteVideoElementsRef.current.clear();
      remoteTrackIdsRef.current.clear();
      participantAudioAddedRef.current.forEach(id => audioMixerService.removeStream(`participant-${id}`));
      participantAudioAddedRef.current.clear();
      participantCanvasCacheRef.current.clear();
    };
  }, []);

  const handleFullscreen = () => {
    if (containerRef.current) {
      document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
    }
  };

  const aspectRatio = orientation === 'portrait' ? '9 / 16' : '16 / 9';

  // Get participant streams for HTML preview
  const getParticipantStream = (id: string): MediaStream | null => {
    if (id === 'local') return localStream;
    return remoteParticipants.get(id)?.stream || null;
  };

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
        overflow: 'hidden',
      }}
    >
      {/* Hidden canvas for output stream capture */}
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
      />

      {/* HTML Video Preview Layer - This is what the user sees (no flickering) */}
      <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'inherit' }}>
        {/* Background image */}
        {streamBackground && (
          <img
            src={streamBackground}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
            style={{ zIndex: 0 }}
          />
        )}

        {/* Participant videos */}
        {previewPositions.map((p) => (
          <HTMLPreviewVideo
            key={p.id}
            participantId={p.id}
            stream={getParticipantStream(p.id)}
            name={p.name}
            videoEnabled={p.videoEnabled}
            isSpeaking={p.isSpeaking}
            isLocal={p.isLocal}
            avatarUrl={p.isLocal ? streamAvatar : undefined}
            style={{
              left: p.x,
              top: p.y,
              width: p.width,
              height: p.height,
              zIndex: 1,
            }}
          />
        ))}

        {/* Screen share overlay */}
        {isSharingScreen && screenShareStream && (
          <video
            autoPlay
            playsInline
            muted
            ref={(el) => {
              if (el && el.srcObject !== screenShareStream) {
                el.srcObject = screenShareStream;
                el.play().catch(() => {});
              }
            }}
            className="absolute bg-black rounded-lg"
            style={{
              left: 0,
              top: containerDimensions.height * 0.12,
              width: containerDimensions.width,
              height: containerDimensions.height * 0.88,
              zIndex: 2,
            }}
          />
        )}

        {/* Overlay image (transparent overlay on top of videos) */}
        {streamOverlay && (
          <img
            src={streamOverlay}
            alt=""
            className="absolute inset-0 w-full h-full object-cover pointer-events-none"
            style={{ zIndex: 10 }}
          />
        )}

        {/* Logo */}
        {streamLogo && (
          <img
            src={streamLogo}
            alt=""
            className="absolute"
            style={{
              top: containerDimensions.height * (20 / 1080),
              left: containerDimensions.width * (20 / 1920),
              width: containerDimensions.width * (150 / 1920),
              height: containerDimensions.height * (150 / 1080),
              objectFit: 'contain',
              zIndex: 11,
            }}
          />
        )}

        {/* Banners */}
        {banners.filter(b => b.visible).map((banner) => {
          const canvasWidth = orientation === 'portrait' ? 1080 : 1920;
          const canvasHeight = orientation === 'portrait' ? 1920 : 1080;
          const scaleX = containerDimensions.width / canvasWidth;
          const scaleY = containerDimensions.height / canvasHeight;
          const bannerHeight = 80 * scaleY;
          const bannerWidth = (banner.type === 'lower-third' ? 400 : canvasWidth * 0.8) * scaleX;

          let x = 0, y = 0;
          switch (banner.position) {
            case 'top-left': x = 20 * scaleX; y = 100 * scaleY; break;
            case 'top-center': x = (containerDimensions.width - bannerWidth) / 2; y = 100 * scaleY; break;
            case 'top-right': x = containerDimensions.width - bannerWidth - 20 * scaleX; y = 100 * scaleY; break;
            case 'bottom-left': x = 20 * scaleX; y = containerDimensions.height - bannerHeight - 20 * scaleY; break;
            case 'bottom-center': x = (containerDimensions.width - bannerWidth) / 2; y = containerDimensions.height - bannerHeight - 20 * scaleY; break;
            case 'bottom-right': x = containerDimensions.width - bannerWidth - 20 * scaleX; y = containerDimensions.height - bannerHeight - 20 * scaleY; break;
          }

          return (
            <div
              key={banner.id}
              className="absolute"
              style={{
                left: x,
                top: y,
                width: bannerWidth,
                height: bannerHeight,
                backgroundColor: banner.backgroundColor || 'rgba(0, 0, 0, 0.7)',
                zIndex: 15,
                padding: `${10 * scaleY}px ${15 * scaleX}px`,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  color: banner.textColor || '#ffffff',
                  fontSize: `${24 * scaleY}px`,
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {banner.title}
              </div>
              {banner.subtitle && (
                <div
                  style={{
                    color: banner.textColor || '#ffffff',
                    fontSize: `${18 * scaleY}px`,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginTop: `${4 * scaleY}px`,
                  }}
                >
                  {banner.subtitle}
                </div>
              )}
            </div>
          );
        })}

        {/* Captions */}
        {captionsEnabled && currentCaption && (
          <div
            className="absolute left-1/2 transform -translate-x-1/2"
            style={{
              bottom: containerDimensions.height * (80 / 1080),
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              padding: `${15 * (containerDimensions.height / 1080)}px`,
              maxWidth: containerDimensions.width - 40,
              zIndex: 16,
            }}
          >
            <span
              style={{
                color: '#ffffff',
                fontSize: `${32 * (containerDimensions.height / 1080)}px`,
                fontWeight: 'bold',
              }}
            >
              {currentCaption.text}
            </span>
          </div>
        )}

        {/* Chat overlay */}
        {showChatOnStream && chatMessages.length > 0 && (
          <div
            className="absolute"
            style={{
              left: chatOverlayPosition.x * (containerDimensions.width / 1920),
              top: chatOverlayPosition.y * (containerDimensions.height / 1080),
              width: chatOverlaySize.width * (containerDimensions.width / 1920),
              height: chatOverlaySize.height * (containerDimensions.height / 1080),
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              zIndex: 17,
              padding: '10px',
              overflow: 'hidden',
            }}
          >
            {chatMessages.slice(-Math.floor((chatOverlaySize.height - 20) / 40)).map((msg, i) => (
              <div key={i} style={{ marginBottom: '8px' }}>
                <span style={{ color: '#4a9eff', fontWeight: 'bold', fontSize: '14px' }}>{msg.author}: </span>
                <span style={{ color: '#ffffff', fontSize: '14px' }}>{msg.message}</span>
              </div>
            ))}
          </div>
        )}

        {/* Displayed comment */}
        {displayedComment && (
          <div
            className="absolute"
            style={{
              right: 20 * (containerDimensions.width / 1920),
              top: 200 * (containerDimensions.height / 1080),
              width: 400 * (containerDimensions.width / 1920),
              backgroundColor: 'rgba(0, 0, 0, 0.8)',
              zIndex: 18,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: 8 * (containerDimensions.height / 1080),
                backgroundColor: {
                  youtube: '#FF0000', facebook: '#1877F2', twitch: '#9146FF',
                  linkedin: '#0A66C2', x: '#000000', rumble: '#85C742'
                }[displayedComment.platform] || '#666666',
              }}
            />
            <div style={{ padding: '10px' }}>
              <div style={{ color: '#ffffff', fontWeight: 'bold', fontSize: '16px' }}>{displayedComment.authorName}</div>
              <div style={{ color: '#cccccc', fontSize: '14px', marginTop: '8px' }}>{displayedComment.message}</div>
              <div style={{ color: '#888888', fontSize: '12px', marginTop: '8px' }}>{displayedComment.platform.toUpperCase()}</div>
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleFullscreen}
        className="absolute bottom-2 right-2 bg-black/50 hover:bg-black/70 text-white p-2 rounded text-lg opacity-0 group-hover:opacity-100 transition-opacity"
        title="Fullscreen"
        style={{ zIndex: 50 }}
      >
        [ ]
      </button>

      <div
        className="absolute bottom-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ zIndex: 50 }}
      >
        <div className="bg-black/70 rounded-lg p-4 flex flex-col items-center gap-2">
          <div className="text-white text-sm font-medium">Volume</div>
          <div className="flex items-center gap-3">
            <span className="text-white text-xs">0</span>
            <input type="range" min="0" max="100" value={volume} onChange={e => {
              const newVolume = parseInt(e.target.value);
              setVolume(newVolume);
              audioMixerService.setMasterVolume(newVolume / 100);
            }} className="w-32 h-2" />
            <span className="text-white text-xs">100</span>
          </div>
          <div className="text-white text-sm">{volume}%</div>
        </div>
      </div>

      {/* Hidden video elements for canvas rendering */}
      {localStream && isLocalUserOnStage && (
        <video ref={mainVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      )}
      {screenShareStream && (
        <video ref={screenShareVideoRef} autoPlay playsInline style={{ display: 'none' }} />
      )}
    </div>
  );
}
