import { useState, useEffect } from 'react';
import { hotkeyService } from '../../services/hotkey.service';
import { useHotkeyFeedback } from '../../components/HotkeyFeedback';
import toast from 'react-hot-toast';

interface UseStudioHotkeysProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  isLive: boolean;
  isRecording: boolean;
  isSharingScreen: boolean;
  toggleAudio: () => void;
  toggleVideo: () => void;
  handleGoLive: () => void;
  handleEndBroadcast: () => void;
  handleStartRecording: () => void;
  handleStopRecording: () => void;
  handleToggleScreenShare: () => void;
  handleLayoutChange: (layout: 'grid' | 'spotlight' | 'sidebar' | 'pip') => void;
  setShowChatOnStream: React.Dispatch<React.SetStateAction<boolean>>;
}

export function useStudioHotkeys({
  audioEnabled,
  videoEnabled,
  isLive,
  isRecording,
  isSharingScreen,
  toggleAudio,
  toggleVideo,
  handleGoLive,
  handleEndBroadcast,
  handleStartRecording,
  handleStopRecording,
  handleToggleScreenShare,
  handleLayoutChange,
  setShowChatOnStream,
}: UseStudioHotkeysProps) {
  const [showHotkeyReference, setShowHotkeyReference] = useState(false);
  const { showFeedback } = useHotkeyFeedback();

  useEffect(() => {
    hotkeyService.initialize();

    // Toggle audio (M)
    hotkeyService.register({
      key: 'm',
      description: 'Toggle microphone',
      action: () => {
        toggleAudio();
        const message = audioEnabled ? 'Microphone muted' : 'Microphone unmuted';
        showFeedback(message, audioEnabled ? '🔇' : '🎤');
        toast.success(message);
      },
    });

    // Toggle video (V)
    hotkeyService.register({
      key: 'v',
      description: 'Toggle camera',
      action: () => {
        toggleVideo();
        const message = videoEnabled ? 'Camera off' : 'Camera on';
        showFeedback(message, videoEnabled ? '📵' : '📹');
        toast.success(message);
      },
    });

    // Go live (Ctrl+L)
    hotkeyService.register({
      key: 'l',
      ctrl: true,
      description: 'Go live',
      action: () => {
        if (!isLive) {
          handleGoLive();
        }
      },
      enabled: !isLive,
    });

    // End broadcast (Ctrl+E)
    hotkeyService.register({
      key: 'e',
      ctrl: true,
      description: 'End broadcast',
      action: () => {
        if (isLive) {
          handleEndBroadcast();
        }
      },
      enabled: isLive,
    });

    // Toggle recording (R)
    hotkeyService.register({
      key: 'r',
      description: 'Toggle recording',
      action: () => {
        if (isRecording) {
          showFeedback('Stopping recording', '⏹️');
          handleStopRecording();
        } else {
          showFeedback('Starting recording', '⏺️');
          handleStartRecording();
        }
      },
    });

    // Toggle screen share (S)
    hotkeyService.register({
      key: 's',
      description: 'Toggle screen share',
      action: () => {
        showFeedback(isSharingScreen ? 'Stopping screen share' : 'Starting screen share', '🖥️');
        handleToggleScreenShare();
      },
    });

    // Layout shortcuts (1-4)
    hotkeyService.register({
      key: '1',
      description: 'Switch to grid layout',
      action: () => {
        showFeedback('Grid layout', '▦');
        handleLayoutChange('grid');
      },
    });

    hotkeyService.register({
      key: '2',
      description: 'Switch to spotlight layout',
      action: () => {
        showFeedback('Spotlight layout', '◉');
        handleLayoutChange('spotlight');
      },
    });

    hotkeyService.register({
      key: '3',
      description: 'Switch to sidebar layout',
      action: () => {
        showFeedback('Sidebar layout', '▥');
        handleLayoutChange('sidebar');
      },
    });

    hotkeyService.register({
      key: '4',
      description: 'Switch to picture-in-picture layout',
      action: () => {
        showFeedback('Picture-in-picture layout', '⧉');
        handleLayoutChange('pip');
      },
    });

    // Toggle chat on stream (C)
    hotkeyService.register({
      key: 'c',
      description: 'Toggle chat on stream',
      action: () => {
        setShowChatOnStream((prev) => {
          const newValue = !prev;
          const message = newValue ? 'Chat visible on stream' : 'Chat hidden from stream';
          showFeedback(message, '💬');
          toast.success(message);
          return newValue;
        });
      },
    });

    // Show hotkey reference (?)
    hotkeyService.register({
      key: '?',
      shift: true,
      description: 'Show keyboard shortcuts',
      action: () => {
        setShowHotkeyReference((prev) => !prev);
      },
    });

    return () => {
      hotkeyService.cleanup();
      hotkeyService.unregisterAll();
    };
  }, [
    audioEnabled,
    videoEnabled,
    isLive,
    isRecording,
    isSharingScreen,
    toggleAudio,
    toggleVideo,
    handleGoLive,
    handleEndBroadcast,
    handleStartRecording,
    handleStopRecording,
    handleToggleScreenShare,
    handleLayoutChange,
    setShowChatOnStream,
    showFeedback,
  ]);

  return { showHotkeyReference };
}
