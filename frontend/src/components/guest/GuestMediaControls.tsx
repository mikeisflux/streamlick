/**
 * GuestMediaControls Component
 *
 * Displays audio and video toggle buttons for guests.
 */

interface GuestMediaControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
  onToggleAudio: () => void;
  onToggleVideo: () => void;
  variant?: 'light' | 'dark';
}

export function GuestMediaControls({
  audioEnabled,
  videoEnabled,
  onToggleAudio,
  onToggleVideo,
  variant = 'dark',
}: GuestMediaControlsProps) {
  const buttonBase = variant === 'dark'
    ? 'bg-gray-700 hover:bg-gray-600 text-white'
    : 'bg-gray-100 hover:bg-gray-200 text-gray-900';

  const disabledStyle = 'bg-red-600 hover:bg-red-700 text-white';

  return (
    <div className="flex justify-center gap-4">
      <button
        onClick={onToggleAudio}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
          audioEnabled ? buttonBase : disabledStyle
        }`}
        title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
      >
        <span className="text-xl">{audioEnabled ? '🎤' : '🔇'}</span>
        <span>{audioEnabled ? 'Mute' : 'Unmute'}</span>
      </button>
      <button
        onClick={onToggleVideo}
        className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
          videoEnabled ? buttonBase : disabledStyle
        }`}
        title={videoEnabled ? 'Turn off camera' : 'Turn on camera'}
      >
        <span className="text-xl">{videoEnabled ? '📹' : '📵'}</span>
        <span>{videoEnabled ? 'Stop Video' : 'Start Video'}</span>
      </button>
    </div>
  );
}
