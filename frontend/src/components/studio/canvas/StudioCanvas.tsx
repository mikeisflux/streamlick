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
  const participantCanvasCacheRef = useRef<Map<string, { canvas: OffscreenCanvas | HTMLCanvasElement; ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D; lastFrameTime: number }>>(new Map());
  const participantAudioAddedRef = useRef<Set<string>>(new Set());

  // Use extracted media hook
  const { backgroundImageRef, logoImageRef, overlayImageRef, avatarImageRef, videoClipRef } = useCanvasMedia();

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

  // Monitor audio levels for remote participants
  useEffect(() => {
    const audioContexts = new Map<string, { context: AudioContext; analyser: AnalyserNode; source: MediaStreamAudioSourceNode; frameId: number }>();

    const setupAudioAnalyzer = (participantId: string, stream: MediaStream, audioEnabled: boolean) => {
      const existing = audioContexts.get(participantId);
      if (existing) {
        cancelAnimationFrame(existing.frameId);
        existing.source.disconnect();
        existing.analyser.disconnect();
        existing.context.close();
        audioContexts.delete(participantId);
      }

      if (!audioEnabled || !stream.getAudioTracks().length) {
        setSpeakingParticipants(prev => { const next = new Set(prev); next.delete(participantId); return next; });
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

        // Track previous speaking state to avoid unnecessary re-renders
        let wasSpeaking = false;

        const checkAudioLevel = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const average = sum / dataArray.length;
          const isSpeaking = average > 10;

          // CRITICAL: Only update state if speaking status actually changed
          // This prevents 60 FPS re-renders which cause flickering
          if (isSpeaking !== wasSpeaking) {
            wasSpeaking = isSpeaking;
            setSpeakingParticipants(prev => {
              const next = new Set(prev);
              if (isSpeaking) next.add(participantId);
              else next.delete(participantId);
              return next;
            });
          }

          const frameId = requestAnimationFrame(checkAudioLevel);
          audioContexts.set(participantId, { context: audioContext, analyser, source, frameId });
        };
        checkAudioLevel();
      } catch {}
    };

    remoteParticipants.forEach((p, id) => { if (p.stream) setupAudioAnalyzer(id, p.stream, p.audioEnabled); });

    return () => {
      audioContexts.forEach(({ context, analyser, source, frameId }) => {
        cancelAnimationFrame(frameId);
        source.disconnect();
        analyser.disconnect();
        if (context.state !== 'closed') context.close();
      });
    };
  }, [remoteParticipants]);

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
          let video = remoteVideoElementsRef.current.get(p.id);
          if (!video && p.stream) {
            video = document.createElement('video');
            video.autoplay = true;
            video.playsInline = true;
            video.muted = true;
            video.srcObject = p.stream;
            video.play().catch(() => {});
            remoteVideoElementsRef.current.set(p.id, video);

            if (p.audioEnabled) {
              const audioTrack = p.stream.getAudioTracks()[0];
              if (audioTrack) {
                try {
                  audioMixerService.addStream(`participant-${p.id}`, new MediaStream([audioTrack]));
                  participantAudioAddedRef.current.add(p.id);
                } catch {}
              }
            }
          }
          if (video) allParticipants.push({ type: 'remote', id: p.id, video, participant: p, videoEnabled: p.videoEnabled });
        });

        // Calculate positions
        const positions = calculateParticipantPositions(
          canvas.width, canvas.height, allParticipants.length,
          selectedLayoutRef.current, isSharingScreenRef.current || !!screenShareVideoRef.current?.srcObject
        );

        const cornerRadius = 16;

        // Helper to get/create cache
        const getCache = (id: string, w: number, h: number) => {
          let cache = participantCanvasCacheRef.current.get(id);
          if (!cache || Math.abs(cache.canvas.width - w) > 10 || Math.abs(cache.canvas.height - h) > 10) {
            const newCanvas = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(Math.round(w), Math.round(h)) : (() => { const c = document.createElement('canvas'); c.width = Math.round(w); c.height = Math.round(h); return c; })();
            const newCtx = newCanvas.getContext('2d');
            if (newCtx) {
              cache = { canvas: newCanvas, ctx: newCtx, lastFrameTime: 0 };
              participantCanvasCacheRef.current.set(id, cache);
            }
          }
          return cache;
        };

        // Draw participants
        allParticipants.forEach((p, i) => {
          if (i >= positions.length) return;
          const pos = positions[i];

          const videoReady = p.video && p.video.readyState >= 3 && p.video.videoWidth > 0 && p.video.videoHeight > 0 && !p.video.paused;
          const currentStable = videoStableFrames.get(p.id) || 0;
          videoStableFrames.set(p.id, videoReady ? Math.min(currentStable + 1, 60) : Math.max(currentStable - 0.5, 0));
          const stableCount = videoStableFrames.get(p.id) || 0;

          const cache = getCache(p.id, pos.width, pos.height);
          const hasCachedFrame = cache && cache.lastFrameTime > 0;
          const videoIsStable = hasCachedFrame ? stableCount >= 6 : stableCount >= 1;

          const shouldUpdateCache = p.videoEnabled && videoReady && videoIsStable && cache;
          const shouldDrawFromCache = p.videoEnabled && hasCachedFrame;
          const shouldDrawAvatar = !p.videoEnabled && p.type === 'local' && avatarImageRef.current;

          ctx.save();
          ctx.beginPath();
          ctx.roundRect(pos.x, pos.y, pos.width, pos.height, cornerRadius);
          ctx.clip();

          if (!shouldDrawFromCache && !shouldDrawAvatar) {
            ctx.fillStyle = '#1a1a1a';
            ctx.fill();
          }

          if (shouldUpdateCache) {
            try { cache!.ctx.drawImage(p.video!, 0, 0, cache!.canvas.width, cache!.canvas.height); cache!.lastFrameTime = now; } catch {}
          }

          if (shouldDrawFromCache && cache) {
            try { ctx.drawImage(cache.canvas, pos.x, pos.y, pos.width, pos.height); } catch { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(pos.x, pos.y, pos.width, pos.height); }
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
  useEffect(() => {
    const currentIds = Array.from(remoteParticipants.keys());
    const existingIds = Array.from(remoteVideoElementsRef.current.keys());

    currentIds.forEach(id => {
      const p = remoteParticipants.get(id);
      if (!p?.stream || p.role !== 'guest' || id === 'screen-share') return;

      if (!participantAudioAddedRef.current.has(id) && p.audioEnabled) {
        const audioTrack = p.stream.getAudioTracks()[0];
        if (audioTrack) {
          try {
            audioMixerService.addStream(`participant-${id}`, new MediaStream([audioTrack]));
            participantAudioAddedRef.current.add(id);
          } catch {}
        }
      }

      if (remoteVideoElementsRef.current.has(id)) {
        const video = remoteVideoElementsRef.current.get(id)!;
        // CRITICAL: Never update srcObject if video has valid dimensions and is not paused
        // This prevents flickering from stream object reference changes during WebRTC renegotiation
        const hasValidVideo = video.videoWidth > 0 && video.videoHeight > 0;
        const isPlaying = video.readyState >= 2 && hasValidVideo && !video.paused;

        if (isPlaying) {
          // Video is working - don't touch srcObject at all
          return;
        }

        // Only try to fix if video is actually broken
        if (video.paused && hasValidVideo) {
          // Video paused but has valid dimensions - just resume
          video.play().catch(() => {});
        } else if (!hasValidVideo && video.srcObject !== p.stream && p.stream) {
          // No valid video and stream changed - update srcObject
          video.srcObject = p.stream;
          video.play().catch(() => {});
        }
        return;
      }

      const video = document.createElement('video');
      video.autoplay = true;
      video.playsInline = true;
      video.muted = true;
      video.srcObject = p.stream;
      video.play().catch(() => {});
      remoteVideoElementsRef.current.set(id, video);
    });

    existingIds.forEach(id => {
      const p = remoteParticipants.get(id);
      if (!currentIds.includes(id) || (p && p.role !== 'guest')) {
        remoteVideoElementsRef.current.get(id)?.srcObject && (remoteVideoElementsRef.current.get(id)!.srcObject = null);
        remoteVideoElementsRef.current.delete(id);
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

    return () => {
      remoteVideoElementsRef.current.forEach(v => { v.srcObject = null; });
      remoteVideoElementsRef.current.clear();
      participantAudioAddedRef.current.forEach(id => audioMixerService.removeStream(`participant-${id}`));
      participantAudioAddedRef.current.clear();
      participantCanvasCacheRef.current.clear();
    };
  }, [remoteParticipants]);

  const handleFullscreen = () => {
    if (containerRef.current) {
      document.fullscreenElement ? document.exitFullscreen() : containerRef.current.requestFullscreen();
    }
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
      <canvas
        ref={canvasRef}
        style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
      />

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
            <input type="range" min="0" max="100" value={volume} onChange={e => setVolume(parseInt(e.target.value))} className="w-32 h-2" />
            <span className="text-white text-xs">100</span>
          </div>
          <div className="text-white text-sm">{volume}%</div>
        </div>
      </div>

      {localStream && isLocalUserOnStage && (
        <video ref={mainVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
      )}
      {screenShareStream && (
        <video ref={screenShareVideoRef} autoPlay playsInline style={{ display: 'none' }} />
      )}
    </div>
  );
}
