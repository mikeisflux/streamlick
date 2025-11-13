import { useState } from 'react';
import { useMedia } from '../useMedia';
import { compositorService } from '../../services/compositor.service';
import { webrtcService } from '../../services/webrtc.service';
import toast from 'react-hot-toast';

export function useScreenShare() {
  const [isSharingScreen, setIsSharingScreen] = useState(false);
  const [screenShareStream, setScreenShareStream] = useState<MediaStream | null>(null);
  const { startScreenShare, stopScreenShare } = useMedia();

  async function handleToggleScreenShare() {
    try {
      if (isSharingScreen) {
        stopScreenShare();
        setIsSharingScreen(false);
        setScreenShareStream(null);
        compositorService.removeParticipant('screen-share');
        toast.success('Screen sharing stopped');
      } else {
        const stream = await startScreenShare();
        setIsSharingScreen(true);
        setScreenShareStream(stream);

        await compositorService.addParticipant({
          id: 'screen-share',
          name: 'Screen Share',
          stream,
          isLocal: true,
          audioEnabled: false,
          videoEnabled: true,
        });

        const videoTrack = stream.getVideoTracks()[0];
        if (videoTrack) {
          await webrtcService.produceMedia(videoTrack);
        }

        videoTrack.onended = () => {
          setIsSharingScreen(false);
          setScreenShareStream(null);
          compositorService.removeParticipant('screen-share');
          toast.success('Screen sharing stopped');
        };

        toast.success('Screen sharing started');
      }
    } catch (error) {
      console.error('Screen share error:', error);
      toast.error('Failed to share screen');
      setIsSharingScreen(false);
      setScreenShareStream(null);
    }
  }

  return {
    isSharingScreen,
    screenShareStream,
    handleToggleScreenShare,
  };
}
