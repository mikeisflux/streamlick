import { captionService, POPULAR_LANGUAGES } from '../../../services/caption.service';
import toast from 'react-hot-toast';

interface LanguageSelectorDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  currentLanguage: string;
  setLanguage: (lang: string) => void;
  captionsEnabled: boolean;
}

export function LanguageSelectorDropdown({
  isOpen,
  onClose,
  currentLanguage,
  setLanguage,
  captionsEnabled,
}: LanguageSelectorDropdownProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl z-50"
        style={{ width: '400px', maxHeight: '500px' }}
      >
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Select Caption Language</h3>
          <p className="text-xs text-gray-500 mt-1">Choose language for real-time transcription</p>
        </div>
        <div className="overflow-y-auto max-h-96 p-2">
          {POPULAR_LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              onClick={() => {
                setLanguage(lang.code);
                onClose();
                if (captionsEnabled) {
                  captionService.changeLanguage(lang.code);
                  toast.success(`Language changed to ${lang.name}`);
                }
              }}
              className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors rounded ${
                currentLanguage === lang.code ? 'bg-blue-50 border border-blue-200' : ''
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{lang.flag}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{lang.name}</p>
                  <p className="text-xs text-gray-500">{lang.code}</p>
                </div>
                {currentLanguage === lang.code && (
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
