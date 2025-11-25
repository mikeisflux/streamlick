import { useState, useEffect, useRef } from 'react';
import { studioCanvasOutputService } from '../../services/studioCanvasOutput.service';
import { hotkeyService } from '../../services/hotkey.service';
import { clipPlayerService } from '../../services/clip-player.service';
import api from '../../services/api';
import toast from 'react-hot-toast';

export function useMediaClips() {
  const [mediaClips, setMediaClips] = useState<any[]>([]);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);
  const registeredHotkeysRef = useRef<string[]>([]);

  const handlePlayClip = async (clip: any) => {
    try {
      const canvas = studioCanvasOutputService.getCanvas() || undefined;

      if (clip.type === 'video') {
        await clipPlayerService.playVideoClip(clip, canvas, studioCanvasOutputService);
        toast.success(`Playing video: ${clip.name}`);
      } else if (clip.type === 'audio') {
        await clipPlayerService.playAudioClip(clip);
        toast.success(`Playing audio: ${clip.name}`);
      } else if (clip.type === 'image') {
        const duration = clip.duration || 5000;
        clipPlayerService.showImageClip(clip, duration, canvas, studioCanvasOutputService);
        toast.success(`Showing image: ${clip.name}`);
      }
    } catch (error) {
      console.error('Failed to play clip:', error);
      toast.error('Failed to play media clip');
    }
  };

  // Load media clips and register hotkeys
  useEffect(() => {
    const loadMediaClips = async () => {
      try {
        const response = await api.get('/media-clips');
        const clips = response.data.clips || [];
        setMediaClips(clips);

        // Clear any previously registered hotkeys
        registeredHotkeysRef.current.forEach((hotkey) => {
          hotkeyService.unregister({ key: hotkey });
        });
        registeredHotkeysRef.current = [];

        // Register hotkeys for clips that have them
        clips.forEach((clip: any) => {
          if (clip.hotkey) {
            const hotkeyLower = clip.hotkey.toLowerCase();
            hotkeyService.register({
              key: hotkeyLower,
              description: `Play ${clip.name}`,
              action: () => {
                handlePlayClip(clip);
              },
            });
            // Track registered hotkeys for proper cleanup
            registeredHotkeysRef.current.push(hotkeyLower);
          }
        });
      } catch (error) {
        console.error('Failed to load media clips:', error);
      }
    };

    loadMediaClips();

    return () => {
      // Unregister clip hotkeys on cleanup using the ref (not stale closure)
      registeredHotkeysRef.current.forEach((hotkey) => {
        hotkeyService.unregister({ key: hotkey });
      });
      registeredHotkeysRef.current = [];
    };
    // handlePlayClip is stable, doesn't need to be in deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    mediaClips,
    showMediaLibrary,
    setShowMediaLibrary,
    handlePlayClip,
  };
}
