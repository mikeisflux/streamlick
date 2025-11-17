import { useState, useEffect, useCallback, useRef } from 'react';
import toast from 'react-hot-toast';
import { clipRecordingService } from '../../services/clip-recording.service';

export function useClipRecording(
  clipRecordingEnabled: boolean,
  localStream: MediaStream | null,
  getCompositeStream: () => MediaStream | null
) {
  const [showClipDurationSelector, setShowClipDurationSelector] = useState(false);
  const getCompositeStreamRef = useRef(getCompositeStream);
  const bufferStartedRef = useRef(false);

  // Keep ref up to date
  useEffect(() => {
    getCompositeStreamRef.current = getCompositeStream;
  }, [getCompositeStream]);

  // Manage clip recording buffer lifecycle
  useEffect(() => {
    if (clipRecordingEnabled && localStream && !bufferStartedRef.current) {
      const stream = getCompositeStreamRef.current() || localStream;
      bufferStartedRef.current = true;
      clipRecordingService.startBuffer(stream, { bufferDuration: 60 })
        .then(() => {
          toast.success('Clip recording buffer started (60s rolling buffer)');
        })
        .catch((error) => {
          console.error('Failed to start clip buffer:', error);
          toast.error('Failed to start clip recording buffer');
          bufferStartedRef.current = false;
        });
    } else if (!clipRecordingEnabled && bufferStartedRef.current && clipRecordingService.isActive()) {
      clipRecordingService.stopBuffer();
      bufferStartedRef.current = false;
      toast.success('Clip recording buffer stopped');
    }

    return () => {
      if (bufferStartedRef.current && clipRecordingService.isActive()) {
        clipRecordingService.stopBuffer();
        bufferStartedRef.current = false;
      }
    };
  }, [clipRecordingEnabled, localStream]);

  const handleCreateClip = useCallback(async (duration: 30 | 60) => {
    try {
      if (!clipRecordingService.isActive()) {
        toast.error('Clip recording buffer not active');
        return;
      }

      const bufferDuration = clipRecordingService.getBufferDuration();
      if (bufferDuration < duration) {
        toast.error(`Not enough buffer (${bufferDuration}s available, ${duration}s requested)`);
        return;
      }

      setShowClipDurationSelector(false);
      toast.loading('Creating clip...', { id: 'clip-creation' });

      const clipData = await clipRecordingService.createClip(duration);

      // Save to file system
      clipRecordingService.saveClip(clipData, `streamlick-clip-${duration}s-${Date.now()}.webm`);

      toast.success(`${duration}s clip saved!`, { id: 'clip-creation' });
    } catch (error) {
      console.error('Failed to create clip:', error);
      toast.error('Failed to create clip', { id: 'clip-creation' });
    }
  }, []);

  return {
    showClipDurationSelector,
    setShowClipDurationSelector,
    handleCreateClip,
  };
}
