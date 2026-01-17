import { useState, useEffect, useRef } from 'react';
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
  handleLayoutChange: (layoutId: number) => void;
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

  // Use refs to avoid stale closures in hotkey handlers
  const audioEnabledRef = useRef(audioEnabled);
  const videoEnabledRef = useRef(videoEnabled);
  const isLiveRef = useRef(isLive);
  const isRecordingRef = useRef(isRecording);
  const isSharingScreenRef = useRef(isSharingScreen);

  // Keep refs updated
  useEffect(() => {
    audioEnabledRef.current = audioEnabled;
    videoEnabledRef.current = videoEnabled;
    isLiveRef.current = isLive;
    isRecordingRef.current = isRecording;
    isSharingScreenRef.current = isSharingScreen;
  }, [audioEnabled, videoEnabled, isLive, isRecording, isSharingScreen]);

  useEffect(() => {
    hotkeyService.initialize();

    // Toggle audio (M)
    hotkeyService.register({
      key: 'm',
      description: 'Toggle microphone',
      action: () => {
        toggleAudio();
        const message = audioEnabledRef.current ? 'Microphone muted' : 'Microphone unmuted';
        showFeedback(message, audioEnabledRef.current ? '🔇' : '🎤');
        toast.success(message);
      },
    });

    // Toggle video (V)
    hotkeyService.register({
      key: 'v',
      description: 'Toggle camera',
      action: () => {
        toggleVideo();
        const message = videoEnabledRef.current ? 'Camera off' : 'Camera on';
        showFeedback(message, videoEnabledRef.current ? '📵' : '📹');
        toast.success(message);
      },
    });

    // Go live (Ctrl+L)
    hotkeyService.register({
      key: 'l',
      ctrl: true,
      description: 'Go live',
      action: () => {
        if (!isLiveRef.current) {
          handleGoLive();
        }
      },
    });

    // End broadcast (Ctrl+E)
    hotkeyService.register({
      key: 'e',
      ctrl: true,
      description: 'End broadcast',
      action: () => {
        if (isLiveRef.current) {
          handleEndBroadcast();
        }
      },
    });

    // Toggle recording (R)
    hotkeyService.register({
      key: 'r',
      description: 'Toggle recording',
      action: () => {
        if (isRecordingRef.current) {
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
        showFeedback(isSharingScreenRef.current ? 'Stopping screen share' : 'Starting screen share', '🖥️');
        handleToggleScreenShare();
      },
    });

    // Layout shortcuts (Shift+1-8)
    hotkeyService.register({
      key: '1',
      shift: true,
      description: 'Switch to Solo layout',
      action: () => {
        showFeedback('Solo layout', '▢');
        handleLayoutChange(1);
      },
    });

    hotkeyService.register({
      key: '2',
      shift: true,
      description: 'Switch to Cropped layout',
      action: () => {
        showFeedback('Cropped layout', '▦');
        handleLayoutChange(2);
      },
    });

    hotkeyService.register({
      key: '3',
      shift: true,
      description: 'Switch to Group layout',
      action: () => {
        showFeedback('Group layout', '⊞');
        handleLayoutChange(3);
      },
    });

    hotkeyService.register({
      key: '4',
      shift: true,
      description: 'Switch to Spotlight layout',
      action: () => {
        showFeedback('Spotlight layout', '◉');
        handleLayoutChange(4);
      },
    });

    hotkeyService.register({
      key: '5',
      shift: true,
      description: 'Switch to News layout',
      action: () => {
        showFeedback('News layout', '▥');
        handleLayoutChange(5);
      },
    });

    hotkeyService.register({
      key: '6',
      shift: true,
      description: 'Switch to Screen layout',
      action: () => {
        showFeedback('Screen layout', '🖥️');
        handleLayoutChange(6);
      },
    });

    hotkeyService.register({
      key: '7',
      shift: true,
      description: 'Switch to Picture-in-Picture layout',
      action: () => {
        showFeedback('Picture-in-Picture layout', '⧉');
        handleLayoutChange(7);
      },
    });

    hotkeyService.register({
      key: '8',
      shift: true,
      description: 'Switch to Cinema layout',
      action: () => {
        showFeedback('Cinema layout', '▭');
        handleLayoutChange(8);
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
    // Only include function handlers, not state values (using refs for state)
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
