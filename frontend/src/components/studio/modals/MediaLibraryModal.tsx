import { MediaLibrary } from '../../MediaLibrary';

interface MediaLibraryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTriggerClip: (clip: any) => void;
}

export function MediaLibraryModal({ isOpen, onClose, onTriggerClip }: MediaLibraryModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <h2 className="text-2xl font-bold text-white">Media Library</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <MediaLibrary onTriggerClip={onTriggerClip} />
        </div>
      </div>
    </div>
  );
}
