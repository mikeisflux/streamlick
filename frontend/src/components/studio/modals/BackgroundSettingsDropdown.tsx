import { BackgroundOptions } from '../../../services/background-removal.service';

interface BackgroundSettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options: BackgroundOptions;
  setOptions: (options: BackgroundOptions) => void;
}

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
        style={{ width: '380px', maxHeight: '500px' }}
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
