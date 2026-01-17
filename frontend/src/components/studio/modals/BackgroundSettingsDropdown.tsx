import { useState, useRef, useEffect } from 'react';
import { BackgroundOptions } from '../../../services/background-removal.service';
import api from '../../../services/api';
import toast from 'react-hot-toast';

interface BackgroundSettingsDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  options: BackgroundOptions;
  setOptions: (options: BackgroundOptions) => void;
}

// Default virtual backgrounds (bundled with the app)
const DEFAULT_BACKGROUNDS = [
  {
    id: 'blue-gradient',
    name: 'Blue Gradient',
    url: '/backgrounds/blue-gradient.svg',
    thumbnail: '/backgrounds/blue-gradient.svg',
  },
  {
    id: 'purple-gradient',
    name: 'Purple Gradient',
    url: '/backgrounds/purple-gradient.svg',
    thumbnail: '/backgrounds/purple-gradient.svg',
  },
  {
    id: 'office',
    name: 'Modern Office',
    url: '/backgrounds/office.svg',
    thumbnail: '/backgrounds/office.svg',
  },
  {
    id: 'nature',
    name: 'Nature View',
    url: '/backgrounds/nature.svg',
    thumbnail: '/backgrounds/nature.svg',
  },
  {
    id: 'bokeh',
    name: 'Bokeh Blur',
    url: '/backgrounds/bokeh.svg',
    thumbnail: '/backgrounds/bokeh.svg',
  },
];

export function BackgroundSettingsDropdown({
  isOpen,
  onClose,
  options,
  setOptions,
}: BackgroundSettingsDropdownProps) {
  const [customBackgrounds, setCustomBackgrounds] = useState<any[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load custom backgrounds on mount
  useEffect(() => {
    if (isOpen) {
      loadCustomBackgrounds();
    }
  }, [isOpen]);

  const loadCustomBackgrounds = async () => {
    try {
      const response = await api.get('/backgrounds/custom');
      setCustomBackgrounds(response.data.backgrounds || []);
    } catch (error) {
      console.error('Failed to load custom backgrounds:', error);
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      toast.loading('Uploading background...', { id: 'upload-bg' });
      const response = await api.post('/backgrounds/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const newBackground = response.data.background;
      setCustomBackgrounds([newBackground, ...customBackgrounds]);
      toast.success('Background uploaded successfully', { id: 'upload-bg' });

      // Auto-select the uploaded background
      setOptions({ ...options, type: 'image', imageUrl: newBackground.fileUrl });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.error || 'Failed to upload background', { id: 'upload-bg' });
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

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
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-gray-900">Choose Background</label>
                  <button
                    onClick={handleUploadClick}
                    disabled={isUploading}
                    className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-purple-600 hover:text-purple-700 hover:bg-purple-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    {isUploading ? 'Uploading...' : 'Upload Custom'}
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {/* Default backgrounds */}
                  {DEFAULT_BACKGROUNDS.map((bg) => (
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
                  {/* Custom uploaded backgrounds */}
                  {customBackgrounds.map((bg) => (
                    <button
                      key={bg.id}
                      onClick={() => setOptions({ ...options, imageUrl: bg.fileUrl })}
                      className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all ${
                        options.imageUrl === bg.fileUrl
                          ? 'border-purple-600 ring-2 ring-purple-200'
                          : 'border-gray-200 hover:border-gray-400'
                      }`}
                    >
                      <img
                        src={bg.fileUrl}
                        alt={bg.name}
                        className="w-full h-full object-cover"
                      />
                      {options.imageUrl === bg.fileUrl && (
                        <div className="absolute top-1 right-1 bg-purple-600 text-white rounded-full p-1">
                          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                        <p className="text-xs font-medium text-white truncate">{bg.name}</p>
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
