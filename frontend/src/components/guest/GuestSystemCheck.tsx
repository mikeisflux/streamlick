/**
 * GuestSystemCheck Component
 *
 * Displays a summary of camera and microphone status.
 */

interface GuestSystemCheckProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export function GuestSystemCheck({ audioEnabled, videoEnabled }: GuestSystemCheckProps) {
  return (
    <div className="p-4 border-t border-gray-700 bg-gray-850">
      <div className="text-xs text-gray-400 space-y-1">
        <p className="font-medium text-gray-300">System Check:</p>
        <div className="flex items-center gap-2">
          <span className="text-green-400">✓</span>
          <span>Camera: {videoEnabled ? 'On' : 'Off'}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-green-400">✓</span>
          <span>Microphone: {audioEnabled ? 'On' : 'Off'}</span>
        </div>
      </div>
    </div>
  );
}
