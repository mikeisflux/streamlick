import { useState, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { webrtcService } from '../../services/webrtc.service';
import { compositorService } from '../../services/compositor.service';
import { mediaStorageService } from '../../services/media-storage.service';
import { useStudioStore } from '../../store/studioStore';
import toast from 'react-hot-toast';
import api from '../../services/api';

interface UseStudioInitializationProps {
  broadcastId: string | undefined;
  startCamera: () => Promise<void>;
  stopCamera: () => void;
  loadDevices: () => Promise<void>;
}

export function useStudioInitialization({
  broadcastId,
  startCamera,
  stopCamera,
  loadDevices,
}: UseStudioInitializationProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [destinations, setDestinations] = useState<any[]>([]);

  // Load selected destinations from localStorage on mount
  const getStorageKey = () => `selectedDestinations_${broadcastId}`;
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>(() => {
    if (!broadcastId) return [];
    try {
      const saved = localStorage.getItem(getStorageKey());
      if (!saved) return [];

      const parsed = JSON.parse(saved);
      // CRITICAL: Deduplicate array when loading from localStorage
      const deduplicated = Array.from(new Set(parsed as string[])) as string[];

      if (deduplicated.length !== parsed.length) {
        console.warn('[Studio Init] Found duplicates in localStorage:', {
          original: parsed,
          deduplicated,
          duplicateCount: parsed.length - deduplicated.length,
        });
      }

      return deduplicated;
    } catch (error) {
      console.error('Failed to load selected destinations from localStorage:', error);
      return [];
    }
  });

  // Save selected destinations to localStorage whenever they change
  useEffect(() => {
    if (!broadcastId || selectedDestinations.length === 0) return;
    try {
      // CRITICAL: Deduplicate before saving to localStorage to prevent corruption
      const deduplicated = Array.from(new Set(selectedDestinations));

      if (deduplicated.length !== selectedDestinations.length) {
        console.warn('[Studio Init] Preventing duplicate save to localStorage:', {
          original: selectedDestinations,
          deduplicated,
          duplicateCount: selectedDestinations.length - deduplicated.length,
        });
      }

      localStorage.setItem(getStorageKey(), JSON.stringify(deduplicated));
      console.log('[Studio Init] Saved selected destinations:', deduplicated);
    } catch (error) {
      console.error('Failed to save selected destinations to localStorage:', error);
    }
  }, [selectedDestinations, broadcastId]);

  const [isInitialized, setIsInitialized] = useState(false);
  const { setBroadcast } = useStudioStore();

  // Use ref to prevent re-initialization
  const isInitializedRef = useRef(false);

  useEffect(() => {
    // Prevent re-initialization even if dependencies change
    if (!broadcastId || isInitializedRef.current) {
      console.log('[Studio Init] Skipping initialization:', { broadcastId, isInitialized: isInitializedRef.current });
      return;
    }

    console.log('[Studio Init] Starting initialization for broadcast:', broadcastId);
    let isMounted = true;

    const init = async () => {
      try {
        console.log('[Studio Init] Loading broadcast data...');
        // Load broadcast
        const broadcastData = await broadcastService.getById(broadcastId);
        if (!isMounted) return;
        setBroadcast(broadcastData);

        console.log('[Studio Init] Loading destinations...');
        // Load destinations (connected destinations only)
        const destResponse = await api.get('/destinations');
        if (!isMounted) return;
        const connectedDestinations = destResponse.data;
        setDestinations(connectedDestinations);
        // NOTE: Do NOT auto-select destinations - user chooses per broadcast via Destinations panel
        console.log('[Studio Init] Loaded destinations:', connectedDestinations.length);

        // CRITICAL FIX: Validate selectedDestinations against actual available destinations
        // Remove any stale/invalid destination IDs from localStorage
        const validDestinationIds = new Set(connectedDestinations.map((d: any) => d.id));
        const validatedSelection = selectedDestinations.filter(id => validDestinationIds.has(id));

        if (validatedSelection.length !== selectedDestinations.length) {
          const removedIds = selectedDestinations.filter(id => !validDestinationIds.has(id));
          console.warn('[Studio Init] Removing stale destination IDs from localStorage:', {
            original: selectedDestinations,
            validated: validatedSelection,
            removed: removedIds,
            removedCount: removedIds.length,
          });

          // Update state and localStorage with cleaned list
          setSelectedDestinations(validatedSelection);
        }

        console.log('[Studio Init] Starting camera...');
        // Start camera FIRST to request permissions
        await startCamera();
        if (!isMounted) return;

        console.log('[Studio Init] Loading devices...');
        // Load available devices AFTER permissions are granted
        await loadDevices();
        if (!isMounted) return;

        console.log('[Studio Init] Restoring media assets from localStorage...');
        // Restore saved media assets (background, logo, overlay)
        await restoreMediaAssets();
        if (!isMounted) return;

        console.log('[Studio Init] Connecting socket...');
        // Connect socket (uses httpOnly cookies for authentication)
        socketService.connect();
        socketService.joinStudio(broadcastId, 'host-id');

        // Set initialized flag BEFORE setting loading to false (atomic state update)
        isInitializedRef.current = true;
        setIsInitialized(true);
        setIsLoading(false);
        console.log('[Studio Init] Initialization complete');
      } catch (error) {
        if (!isMounted) return;
        console.error('[Studio Init] Initialization failed:', error);
        toast.error('Failed to initialize studio');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      console.log('[Studio Init] Cleanup triggered');
      isMounted = false;

      // Cleanup only if we actually initialized
      if (isInitializedRef.current) {
        console.log('[Studio Init] Cleaning up resources...');
        stopCamera();
        socketService.leaveStudio();
        webrtcService.close();
        isInitializedRef.current = false;
      }
    };
    // CRITICAL: Only depend on broadcastId to prevent infinite re-renders
    // Functions (startCamera, stopCamera, loadDevices, setBroadcast) are accessed via closure
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [broadcastId]);

  // Restore media assets from localStorage and IndexedDB
  const restoreMediaAssets = async () => {
    try {
      // Small delay to ensure DOM and canvas are ready
      await new Promise(resolve => setTimeout(resolve, 100));

      // Restore background - check IndexedDB first, then localStorage
      const streamBackgroundAssetId = localStorage.getItem('streamBackgroundAssetId');
      const streamBackground = localStorage.getItem('streamBackground');
      const streamBackgroundName = localStorage.getItem('streamBackgroundName');

      if (streamBackgroundAssetId) {
        // Background stored in IndexedDB - load it
        try {
          console.log('[Studio Init] Loading background from IndexedDB:', streamBackgroundAssetId);
          const mediaData = await mediaStorageService.getMedia(streamBackgroundAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            console.log('[Studio Init] Restoring background from IndexedDB:', streamBackgroundName || streamBackgroundAssetId);

            // Dispatch event for other listeners
            window.dispatchEvent(new CustomEvent('backgroundUpdated', {
              detail: { url: objectURL, name: streamBackgroundName }
            }));

            // ALSO directly call compositor to ensure it's set
            await compositorService.addOverlay({
              id: 'background',
              type: 'background',
              url: objectURL,
              position: { x: 0, y: 0, width: 1920, height: 1080 },
            });
            console.log('[Studio Init] Background set on compositor');
          }
        } catch (error) {
          console.error('[Studio Init] Failed to load background from IndexedDB:', error);
        }
      } else if (streamBackground) {
        // Background stored as URL in localStorage
        console.log('[Studio Init] Restoring background from localStorage:', streamBackgroundName || streamBackground);

        // Dispatch event for other listeners
        window.dispatchEvent(new CustomEvent('backgroundUpdated', {
          detail: { url: streamBackground, name: streamBackgroundName }
        }));

        // ALSO directly call compositor to ensure it's set
        await compositorService.addOverlay({
          id: 'background',
          type: 'background',
          url: streamBackground,
          position: { x: 0, y: 0, width: 1920, height: 1080 },
        });
        console.log('[Studio Init] Background set on compositor');
      }

      // Restore logo - check IndexedDB first, then localStorage
      const streamLogoAssetId = localStorage.getItem('streamLogoAssetId');
      const streamLogo = localStorage.getItem('streamLogo');
      const streamLogoName = localStorage.getItem('streamLogoName');

      if (streamLogoAssetId) {
        try {
          console.log('[Studio Init] Loading logo from IndexedDB:', streamLogoAssetId);
          const mediaData = await mediaStorageService.getMedia(streamLogoAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            console.log('[Studio Init] Restoring logo from IndexedDB:', streamLogoName || streamLogoAssetId);

            // Dispatch event for other listeners
            window.dispatchEvent(new CustomEvent('logoUpdated', {
              detail: { url: objectURL, name: streamLogoName }
            }));

            // ALSO directly call compositor to ensure it's set
            await compositorService.addOverlay({
              id: 'logo',
              type: 'logo',
              url: objectURL,
              position: { x: 20, y: 20, width: 100, height: 100 },
            });
            console.log('[Studio Init] Logo set on compositor');
          }
        } catch (error) {
          console.error('[Studio Init] Failed to load logo from IndexedDB:', error);
        }
      } else if (streamLogo) {
        console.log('[Studio Init] Restoring logo from localStorage:', streamLogoName || streamLogo);

        // Dispatch event for other listeners
        window.dispatchEvent(new CustomEvent('logoUpdated', {
          detail: { url: streamLogo, name: streamLogoName }
        }));

        // ALSO directly call compositor to ensure it's set
        await compositorService.addOverlay({
          id: 'logo',
          type: 'logo',
          url: streamLogo,
          position: { x: 20, y: 20, width: 100, height: 100 },
        });
        console.log('[Studio Init] Logo set on compositor');
      }

      // Restore overlay - check IndexedDB first, then localStorage
      const streamOverlayAssetId = localStorage.getItem('streamOverlayAssetId');
      const streamOverlay = localStorage.getItem('streamOverlay');
      const streamOverlayName = localStorage.getItem('streamOverlayName');

      if (streamOverlayAssetId) {
        try {
          console.log('[Studio Init] Loading overlay from IndexedDB:', streamOverlayAssetId);
          const mediaData = await mediaStorageService.getMedia(streamOverlayAssetId);
          if (mediaData) {
            const objectURL = URL.createObjectURL(mediaData.blob);
            console.log('[Studio Init] Restoring overlay from IndexedDB:', streamOverlayName || streamOverlayAssetId);

            // Dispatch event for other listeners
            window.dispatchEvent(new CustomEvent('overlayUpdated', {
              detail: { url: objectURL, name: streamOverlayName }
            }));

            // ALSO directly call compositor to ensure it's set
            await compositorService.addOverlay({
              id: 'overlay',
              type: 'banner',
              url: objectURL,
              position: { x: 0, y: 0, width: 1920, height: 1080 },
            });
            console.log('[Studio Init] Overlay set on compositor');
          }
        } catch (error) {
          console.error('[Studio Init] Failed to load overlay from IndexedDB:', error);
        }
      } else if (streamOverlay) {
        console.log('[Studio Init] Restoring overlay from localStorage:', streamOverlayName || streamOverlay);

        // Dispatch event for other listeners
        window.dispatchEvent(new CustomEvent('overlayUpdated', {
          detail: { url: streamOverlay, name: streamOverlayName }
        }));

        // ALSO directly call compositor to ensure it's set
        await compositorService.addOverlay({
          id: 'overlay',
          type: 'banner',
          url: streamOverlay,
          position: { x: 0, y: 0, width: 1920, height: 1080 },
        });
        console.log('[Studio Init] Overlay set on compositor');
      }

      console.log('[Studio Init] Media assets restored');
    } catch (error) {
      console.error('[Studio Init] Failed to restore media assets:', error);
      // Don't throw - allow studio to continue even if media restore fails
    }
  };

  // Wrap setSelectedDestinations to always deduplicate
  const setSelectedDestinationsSafe = (destinations: string[] | ((prev: string[]) => string[])) => {
    if (typeof destinations === 'function') {
      setSelectedDestinations((prev) => {
        const updated = destinations(prev);
        const deduplicated = Array.from(new Set(updated));
        if (deduplicated.length !== updated.length) {
          console.warn('[Studio Init] Auto-deduplicating in setSelectedDestinations:', {
            original: updated,
            deduplicated,
            duplicateCount: updated.length - deduplicated.length,
          });
        }
        return deduplicated;
      });
    } else {
      const deduplicated = Array.from(new Set(destinations));
      if (deduplicated.length !== destinations.length) {
        console.warn('[Studio Init] Auto-deduplicating in setSelectedDestinations:', {
          original: destinations,
          deduplicated,
          duplicateCount: destinations.length - deduplicated.length,
        });
      }
      setSelectedDestinations(deduplicated);
    }
  };

  return {
    isLoading,
    destinations,
    setDestinations,
    selectedDestinations,
    setSelectedDestinations: setSelectedDestinationsSafe,
  };
}
