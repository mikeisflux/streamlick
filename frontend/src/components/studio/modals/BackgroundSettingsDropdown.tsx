import { BackgroundOptions } from '../../../services/background-removal.service';

interface BackgroundSettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options: BackgroundOptions;
  setOptions: (options: BackgroundOptions) => void;
}

// Sample virtual backgrounds
const SAMPLE_BACKGROUNDS = [
  {
    id: 'office',
    name: 'Modern Office',
    url: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=320&h=180&fit=crop',
  },
  {
    id: 'library',
    name: 'Cozy Library',
    url: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1507842217343-583bb7270b66?w=320&h=180&fit=crop',
  },
  {
    id: 'nature',
    name: 'Nature View',
    url: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=320&h=180&fit=crop',
  },
  {
    id: 'city',
    name: 'City Skyline',
    url: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1449824913935-59a10b8d2000?w=320&h=180&fit=crop',
  },
  {
    id: 'gradient',
    name: 'Blue Gradient',
    url: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=1920&h=1080&fit=crop',
    thumbnail: 'https://images.unsplash.com/photo-1557682250-33bd709cbe85?w=320&h=180&fit=crop',
  },
];

export function BackgroundSettingsDropdown({
  isOpen,
  onClose,
  options,
  setOptions,
}: BackgroundSettingsDropdownProps) {
  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed bottom-24 left-1/2 transform -translate-x-1/2 bg-white rounded-lg shadow-2xl z-50"
        style={{ width: '480px', maxHeight: '600px' }}
      >
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-sm font-semibold text-gray-900">Background Removal Settings</h3>
          <p className="text-xs text-gray-500 mt-1">Customize your virtual background effect</p>
        </div>
        <div className="overflow-y-auto max-h-96 p-4">
          <div className="space-y-4">
            {/* Background Type */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-2">Effect Type</label>
              <div className="space-y-2">
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="backgroundType"
                    checked={options.type === 'blur'}
                    onChange={() => setOptions({ ...options, type: 'blur' })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">Blur Background</p>
                    <p className="text-xs text-gray-500">Blur everything behind you</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="backgroundType"
                    checked={options.type === 'image'}
                    onChange={() => setOptions({ ...options, type: 'image' })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">Virtual Background</p>
                    <p className="text-xs text-gray-500">Replace with an image</p>
                  </div>
                </label>
                <label className="flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                  <input
                    type="radio"
                    name="backgroundType"
                    checked={options.type === 'color'}
                    onChange={() => setOptions({ ...options, type: 'color' })}
                    className="w-4 h-4 text-purple-600 focus:ring-purple-500"
                  />
                  <div className="ml-3 flex-1">
                    <p className="text-sm font-medium text-gray-900">Solid Color</p>
                    <p className="text-xs text-gray-500">Replace with a solid color</p>
                  </div>
                </label>
              </div>
            </div>

            {/* Virtual Background Selector */}
            {options.type === 'image' && (
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">Choose Background</label>
                <div className="grid grid-cols-2 gap-2">
                  {SAMPLE_BACKGROUNDS.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setOptions({ ...options, imageUrl: bg.url })}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        options.imageUrl === bg.url
                          ? 'border-purple-600 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={bg.thumbnail}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                      {options.imageUrl === bg.url && (
                        <div className="absolute top-1 right-1 bg-purple-600 text-white rounded-full p-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs font-medium text-white">{bg.name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Blur Amount */}
            {options.type === 'blur' && (
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">
                  Blur Intensity: {options.blurAmount}px
                </label>
                <input
                  type="range"
                  min="5"
                  max="50"
                  step="1"
                  value={options.blurAmount || 15}
                  onChange={(e) => setOptions({ ...options, blurAmount: parseInt(e.target.value) })}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
              </div>
            )}

            {/* Color Picker */}
            {options.type === 'color' && (
              <div>
                <label className="block text-xs font-semibold text-gray-900 mb-2">Background Color</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={options.color || '#1a1a1a'}
                    onChange={(e) => setOptions({ ...options, color: e.target.value })}
                    className="w-16 h-16 rounded-lg border-2 border-gray-300 cursor-pointer"
                  />
                  <div className="flex-1">
                    <input
                      type="text"
                      value={options.color || '#1a1a1a'}
                      onChange={(e) => setOptions({ ...options, color: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm font-mono"
                      placeholder="#1a1a1a"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Edge Softness */}
            <div>
              <label className="block text-xs font-semibold text-gray-900 mb-2">
                Edge Smoothing: {Math.round((options.edgeSoftness || 0.3) * 100)}%
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={options.edgeSoftness || 0.3}
                onChange={(e) => setOptions({ ...options, edgeSoftness: parseFloat(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
