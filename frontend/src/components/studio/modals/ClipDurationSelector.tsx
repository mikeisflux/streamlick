import { clipRecordingService } from '../../../services/clip-recording.service';

interface ClipDurationSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateClip: (duration: 30 | 60) => void;
}

export function ClipDurationSelector({ isOpen, onClose, onCreateClip }: ClipDurationSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl p-6 max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">✂️</span>
            <h2 className="text-xl font-bold text-gray-900">Create Instant Clip</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <p className="text-sm text-gray-600 mb-6">
          Select clip duration to capture the last 30 or 60 seconds from the rolling buffer.
        </p>

        {/* Buffer Status */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
          <div className="flex items-center gap-2 text-sm text-blue-800">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              Buffer: {clipRecordingService.getBufferDuration()}s available
            </span>
          </div>
        </div>

        {/* Duration Buttons */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => onCreateClip(30)}
            disabled={clipRecordingService.getBufferDuration() < 30}
            className={`py-6 px-4 rounded-lg border-2 transition-all ${
              clipRecordingService.getBufferDuration() >= 30
                ? 'border-green-500 bg-green-50 hover:bg-green-100 hover:border-green-600'
                : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">30s</div>
              <div className="text-xs text-gray-600">Last 30 seconds</div>
            </div>
          </button>

          <button
            onClick={() => onCreateClip(60)}
            disabled={clipRecordingService.getBufferDuration() < 60}
            className={`py-6 px-4 rounded-lg border-2 transition-all ${
              clipRecordingService.getBufferDuration() >= 60
                ? 'border-purple-500 bg-purple-50 hover:bg-purple-100 hover:border-purple-600'
                : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
            }`}
          >
            <div className="text-center">
              <div className="text-3xl font-bold text-gray-900 mb-1">60s</div>
              <div className="text-xs text-gray-600">Last 60 seconds</div>
            </div>
          </button>
        </div>

        {/* Footer Note */}
        <p className="text-xs text-gray-500 text-center">
          Clips are automatically saved to your downloads folder
        </p>
      </div>
    </div>
  );
}
