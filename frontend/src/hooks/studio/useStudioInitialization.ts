import { useState, useEffect } from 'react';
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
  const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
  const { setBroadcast } = useStudioStore();

  useEffect(() => {
    if (!broadcastId) return;

    const init = async () => {
      try {
        // Load broadcast
        const broadcastData = await broadcastService.getById(broadcastId);
        setBroadcast(broadcastData);

        // Load destinations
        const destResponse = await api.get('/destinations');
        setDestinations(destResponse.data.filter((d: any) => d.isActive));

        // Start camera FIRST to request permissions
        await startCamera();

        // Load available devices AFTER permissions are granted
        await loadDevices();

        // Connect socket
        const token = localStorage.getItem('accessToken');
        if (token) {
          socketService.connect(token);
          socketService.joinStudio(broadcastId, 'host-id');
        }

        setIsLoading(false);
      } catch (error) {
        toast.error('Failed to initialize studio');
        setIsLoading(false);
      }
    };

    init();

    return () => {
      stopCamera();
      socketService.leaveStudio();
      webrtcService.close();
    };
  }, [broadcastId, startCamera, stopCamera, loadDevices, setBroadcast]);

  return {
    isLoading,
    destinations,
    setDestinations,
    selectedDestinations,
    setSelectedDestinations,
  };
}
