import { useState, useEffect } from 'react';
import { compositorService } from '../../services/compositor.service';
import { hotkeyService } from '../../services/hotkey.service';
import { clipPlayerService } from '../../services/clip-player.service';
import api from '../../services/api';
import toast from 'react-hot-toast';

export function useMediaClips() {
  const [mediaClips, setMediaClips] = useState<any[]>([]);
  const [showMediaLibrary, setShowMediaLibrary] = useState(false);

  const handlePlayClip = async (clip: any) => {
    try {
      const canvas = compositorService.getCanvas() || undefined;

      if (clip.type === 'video') {
        await clipPlayerService.playVideoClip(clip, canvas, compositorService);
        toast.success(`Playing video: ${clip.name}`);
      } else if (clip.type === 'audio') {
        await clipPlayerService.playAudioClip(clip);
        toast.success(`Playing audio: ${clip.name}`);
      } else if (clip.type === 'image') {
        const duration = clip.duration || 5000;
        clipPlayerService.showImageClip(clip, duration, canvas, compositorService);
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

        // Register hotkeys for clips that have them
        clips.forEach((clip: any) => {
          if (clip.hotkey) {
            hotkeyService.register({
              key: clip.hotkey.toLowerCase(),
              description: `Play ${clip.name}`,
              action: () => {
                handlePlayClip(clip);
              },
            });
          }
        });
      } catch (error) {
        console.error('Failed to load media clips:', error);
      }
    };

    loadMediaClips();

    return () => {
      // Unregister clip hotkeys on cleanup
      mediaClips.forEach((clip: any) => {
        if (clip.hotkey) {
          hotkeyService.unregister({ key: clip.hotkey.toLowerCase() });
        }
      });
    };
  }, []);

  return {
    mediaClips,
    showMediaLibrary,
    setShowMediaLibrary,
    handlePlayClip,
  };
}
