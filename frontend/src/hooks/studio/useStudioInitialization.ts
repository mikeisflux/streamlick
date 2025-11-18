import { useState, useEffect, useRef } from 'react';
import { broadcastService } from '../../services/broadcast.service';
import { socketService } from '../../services/socket.service';
import { webrtcService } from '../../services/webrtc.service';
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
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('Failed to load selected destinations from localStorage:', error);
      return [];
    }
  });

  // Save selected destinations to localStorage whenever they change
  useEffect(() => {
    if (!broadcastId || selectedDestinations.length === 0) return;
    try {
      localStorage.setItem(getStorageKey(), JSON.stringify(selectedDestinations));
      console.log('[Studio Init] Saved selected destinations:', selectedDestinations);
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

        console.log('[Studio Init] Starting camera...');
        // Start camera FIRST to request permissions
        await startCamera();
        if (!isMounted) return;

        console.log('[Studio Init] Loading devices...');
        // Load available devices AFTER permissions are granted
        await loadDevices();
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

  return {
    isLoading,
    destinations,
    setDestinations,
    selectedDestinations,
    setSelectedDestinations,
  };
}
