/**
 * useCanvasMedia - Media asset loading for StudioCanvas
 *
 * Handles loading of background images, logos, overlays, avatars, and video clips
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { mediaStorageService } from '../../services/media-storage.service';
import { audioMixerService } from '../../services/audio-mixer.service';

export interface CanvasMediaRefs {
  backgroundImage: HTMLImageElement | null;
  logoImage: HTMLImageElement | null;
  overlayImage: HTMLImageElement | null;
  avatarImage: HTMLImageElement | null;
  videoClip: HTMLVideoElement | null;
}

export function useCanvasMedia() {
  // State for media URLs
  const [streamBackground, setStreamBackground] = useState<string | null>(null);
  const [streamLogo, setStreamLogo] = useState<string | null>(null);
  const [streamOverlay, setStreamOverlay] = useState<string | null>(null);

  // Refs for loaded images (for canvas rendering)
  const backgroundImageRef = useRef<HTMLImageElement | null>(null);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const overlayImageRef = useRef<HTMLImageElement | null>(null);
  const avatarImageRef = useRef<HTMLImageElement | null>(null);
  const videoClipRef = useRef<HTMLVideoElement | null>(null);
  const videoClipUrlRef = useRef<string | null>(null);

  // Load stream background from localStorage/IndexedDB
  useEffect(() => {
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
          console.error('[useCanvasMedia] Failed to load background from IndexedDB:', error);
        }
      } else if (streamBackground) {
        setStreamBackground(streamBackground);
      }
    };

    loadInitialBackground();

    const handleBackgroundUpdated = ((e: CustomEvent) => {
      setStreamBackground(e.detail.url);
    }) as EventListener;

    window.addEventListener('backgroundUpdated', handleBackgroundUpdated);
    return () => window.removeEventListener('backgroundUpdated', handleBackgroundUpdated);
  }, []);

  // Load stream logo and overlay from localStorage/IndexedDB
  useEffect(() => {
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
          console.error('[useCanvasMedia] Failed to load logo from IndexedDB:', error);
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
          console.error('[useCanvasMedia] Failed to load overlay from IndexedDB:', error);
        }
      } else if (streamOverlayUrl) {
        setStreamOverlay(streamOverlayUrl);
      }
    };

    loadAllMedia();

    const handleLogoUpdated = ((e: CustomEvent) => {
      setStreamLogo(e.detail.url);
    }) as EventListener;

    const handleOverlayUpdated = ((e: CustomEvent) => {
      setStreamOverlay(e.detail.url);
    }) as EventListener;

    window.addEventListener('logoUpdated', handleLogoUpdated);
    window.addEventListener('overlayUpdated', handleOverlayUpdated);

    return () => {
      window.removeEventListener('logoUpdated', handleLogoUpdated);
      window.removeEventListener('overlayUpdated', handleOverlayUpdated);
    };
  }, []);

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
    };
    img.onerror = () => {
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
    };
    img.onerror = () => {
      logoImageRef.current = null;
    };
    img.src = streamLogo;
  }, [streamLogo]);

  // Load overlay image
  useEffect(() => {
    if (!streamOverlay) {
      overlayImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      overlayImageRef.current = img;
    };
    img.onerror = () => {
      overlayImageRef.current = null;
    };
    img.src = streamOverlay;
  }, [streamOverlay]);

  // Load avatar image
  useEffect(() => {
    const avatarUrl = localStorage.getItem('selectedAvatar');
    if (!avatarUrl) {
      avatarImageRef.current = null;
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      avatarImageRef.current = img;
    };
    img.onerror = () => {
      avatarImageRef.current = null;
    };
    img.src = avatarUrl;
  }, []);

  // Video clip playback handling
  useEffect(() => {
    const handlePlayVideoClip = ((e: CustomEvent) => {
      const { url } = e.detail;

      // Clean up previous video clip
      if (videoClipRef.current) {
        videoClipRef.current.pause();
        videoClipRef.current.src = '';
        audioMixerService.removeStream('video-clip');
        videoClipRef.current = null;
      }

      if (!url) {
        videoClipUrlRef.current = null;
        return;
      }

      videoClipUrlRef.current = url;

      const video = document.createElement('video');
      video.crossOrigin = 'anonymous';
      video.src = url;
      video.loop = false;
      video.muted = false;
      video.playsInline = true;

      video.onloadedmetadata = () => {
        videoClipRef.current = video;

        try {
          audioMixerService.addMediaElement('video-clip', video);
          audioMixerService.setStreamVolume('video-clip', 1.0);
        } catch (err) {
          console.error('[useCanvasMedia] Failed to add video clip audio to mixer:', err);
        }

        video.play().catch((err) => {
          console.error('[useCanvasMedia] Failed to play video clip:', err);
        });
      };

      video.onended = () => {
        audioMixerService.removeStream('video-clip');
        videoClipRef.current = null;
        videoClipUrlRef.current = null;
        window.dispatchEvent(new CustomEvent('videoClipEnded'));
      };

      video.onerror = () => {
        videoClipRef.current = null;
        videoClipUrlRef.current = null;
      };
    }) as EventListener;

    const handleStopVideoClip = () => {
      if (videoClipRef.current) {
        videoClipRef.current.pause();
        videoClipRef.current.src = '';
        audioMixerService.removeStream('video-clip');
        videoClipRef.current = null;
        videoClipUrlRef.current = null;
      }
    };

    window.addEventListener('playVideoClip', handlePlayVideoClip);
    window.addEventListener('stopVideoClip', handleStopVideoClip);

    return () => {
      window.removeEventListener('playVideoClip', handlePlayVideoClip);
      window.removeEventListener('stopVideoClip', handleStopVideoClip);
      if (videoClipRef.current) {
        videoClipRef.current.pause();
        videoClipRef.current.src = '';
        audioMixerService.removeStream('video-clip');
      }
    };
  }, []);

  // Get current media refs for canvas rendering
  const getMediaRefs = useCallback((): CanvasMediaRefs => ({
    backgroundImage: backgroundImageRef.current,
    logoImage: logoImageRef.current,
    overlayImage: overlayImageRef.current,
    avatarImage: avatarImageRef.current,
    videoClip: videoClipRef.current,
  }), []);

  return {
    backgroundImageRef,
    logoImageRef,
    overlayImageRef,
    avatarImageRef,
    videoClipRef,
    getMediaRefs,
    // URL states for HTML preview layer
    streamBackground,
    streamLogo,
    streamOverlay,
  };
}
