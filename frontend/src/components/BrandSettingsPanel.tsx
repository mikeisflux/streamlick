import { useState, useRef } from 'react';
import {
  PhotoIcon,
  TrashIcon,
  ArrowUpTrayIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';

interface BrandSettings {
  logo: string | null;
  logoPosition: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  logoSize: 'small' | 'medium' | 'large';
  logoOpacity: number;
  background: string | null;
  backgroundType: 'color' | 'image' | 'blur';
  backgroundColor: string;
}

export function BrandSettingsPanel() {
  const [settings, setSettings] = useState<BrandSettings>({
    logo: null,
    logoPosition: 'top-left',
    logoSize: 'medium',
    logoOpacity: 100,
    background: null,
    backgroundType: 'color',
    backgroundColor: '#1a1a1a',
  });

  const logoInputRef = useRef<HTMLInputElement>(null);
  const backgroundInputRef = useRef<HTMLInputElement>(null);

  const positions = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  const sizes = [
    { value: 'small', label: 'Small (80px)', size: 80 },
    { value: 'medium', label: 'Medium (120px)', size: 120 },
    { value: 'large', label: 'Large (160px)', size: 160 },
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be less than 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({
        ...prev,
        logo: reader.result as string,
      }));
      toast.success('Logo uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  const handleBackgroundUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please upload an image file');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image must be less than 10MB');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setSettings((prev) => ({
        ...prev,
        background: reader.result as string,
        backgroundType: 'image',
      }));
      toast.success('Background uploaded successfully');
    };
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setSettings((prev) => ({ ...prev, logo: null }));
    if (logoInputRef.current) {
      logoInputRef.current.value = '';
    }
  };

  const removeBackground = () => {
    setSettings((prev) => ({ ...prev, background: null }));
    if (backgroundInputRef.current) {
      backgroundInputRef.current.value = '';
    }
  };

  const getLogoSize = () => {
    return sizes.find((s) => s.value === settings.logoSize)?.size || 120;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Brand Settings
        </h3>
        <p className="text-sm text-gray-600">
          Customize your broadcast with your brand logo and backgrounds
        </p>
      </div>

      {/* Recommended Sizes Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
        <div className="flex items-start space-x-2">
          <InformationCircleIcon className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="space-y-2">
            <h4 className="font-semibold text-blue-900 text-sm">
              Recommended Asset Sizes
            </h4>
            <div className="text-sm text-blue-800 space-y-1.5">
              <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                <div>
                  <strong>Logos:</strong> 150×150 px
                </div>
                <div>
                  <strong>Overlays:</strong> 1920×1080 px
                </div>
                <div>
                  <strong>Backgrounds:</strong> 1280×720 px (720p) or 1920×1080 px (1080p)
                </div>
                <div>
                  <strong>Video Clips:</strong> 1920×1080 px or 1280×720 px (16:9 ratio)
                </div>
                <div>
                  <strong>Video Backgrounds:</strong> 1280×720 px (up to 1-2 min)
                </div>
                <div>
                  <strong>File Size:</strong> Videos &lt;200MB, Images &lt;20MB
                </div>
              </div>
              <p className="mt-2 text-xs italic">
                All assets should maintain a 16:9 aspect ratio for optimal compatibility.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Logo Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Logo</h4>

        {/* Logo Upload */}
        <div>
          {!settings.logo ? (
            <button
              onClick={() => logoInputRef.current?.click()}
              className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors flex flex-col items-center justify-center space-y-2 text-gray-600 hover:text-blue-600"
            >
              <PhotoIcon className="w-10 h-10" />
              <span className="text-sm font-medium">Upload Logo</span>
              <span className="text-xs">PNG, JPG up to 5MB</span>
            </button>
          ) : (
            <div className="relative">
              <div className="w-full h-32 border-2 border-gray-300 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
                <img
                  src={settings.logo}
                  alt="Logo"
                  className="max-h-full max-w-full object-contain"
                />
              </div>
              <button
                onClick={removeLogo}
                className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            onChange={handleLogoUpload}
            className="hidden"
          />
        </div>

        {/* Logo Position */}
        {settings.logo && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Position
              </label>
              <div className="grid grid-cols-2 gap-2">
                {positions.map((pos) => (
                  <button
                    key={pos.value}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        logoPosition: pos.value as BrandSettings['logoPosition'],
                      }))
                    }
                    className={`px-4 py-2 rounded-lg border-2 transition-all ${
                      settings.logoPosition === pos.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {pos.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Size */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Size
              </label>
              <div className="grid grid-cols-3 gap-2">
                {sizes.map((size) => (
                  <button
                    key={size.value}
                    onClick={() =>
                      setSettings((prev) => ({
                        ...prev,
                        logoSize: size.value as BrandSettings['logoSize'],
                      }))
                    }
                    className={`px-3 py-2 rounded-lg border-2 transition-all text-sm ${
                      settings.logoSize === size.value
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 text-gray-700 hover:border-gray-400'
                    }`}
                  >
                    {size.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Logo Opacity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Opacity: {settings.logoOpacity}%
              </label>
              <input
                type="range"
                min="0"
                max="100"
                value={settings.logoOpacity}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    logoOpacity: parseInt(e.target.value),
                  }))
                }
                className="w-full"
              />
            </div>
          </>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-300" />

      {/* Background Section */}
      <div className="space-y-4">
        <h4 className="font-medium text-gray-900">Background</h4>

        {/* Background Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Background Type
          </label>
          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={() =>
                setSettings((prev) => ({ ...prev, backgroundType: 'color' }))
              }
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                settings.backgroundType === 'color'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              Solid Color
            </button>
            <button
              onClick={() =>
                setSettings((prev) => ({ ...prev, backgroundType: 'image' }))
              }
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                settings.backgroundType === 'image'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              Image
            </button>
            <button
              onClick={() =>
                setSettings((prev) => ({ ...prev, backgroundType: 'blur' }))
              }
              className={`px-4 py-2 rounded-lg border-2 transition-all ${
                settings.backgroundType === 'blur'
                  ? 'border-blue-500 bg-blue-50 text-blue-700'
                  : 'border-gray-300 text-gray-700 hover:border-gray-400'
              }`}
            >
              Blur
            </button>
          </div>
        </div>

        {/* Color Picker (if color type) */}
        {settings.backgroundType === 'color' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Color
            </label>
            <div className="flex items-center space-x-3">
              <input
                type="color"
                value={settings.backgroundColor}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    backgroundColor: e.target.value,
                  }))
                }
                className="w-20 h-12 rounded-lg border border-gray-300"
              />
              <input
                type="text"
                value={settings.backgroundColor}
                onChange={(e) =>
                  setSettings((prev) => ({
                    ...prev,
                    backgroundColor: e.target.value,
                  }))
                }
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm"
              />
            </div>
          </div>
        )}

        {/* Image Upload (if image type) */}
        {settings.backgroundType === 'image' && (
          <div>
            {!settings.background ? (
              <button
                onClick={() => backgroundInputRef.current?.click()}
                className="w-full h-32 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 transition-colors flex flex-col items-center justify-center space-y-2 text-gray-600 hover:text-blue-600"
              >
                <ArrowUpTrayIcon className="w-10 h-10" />
                <span className="text-sm font-medium">Upload Background</span>
                <span className="text-xs">PNG, JPG up to 10MB</span>
              </button>
            ) : (
              <div className="relative">
                <div className="w-full h-32 border-2 border-gray-300 rounded-lg overflow-hidden">
                  <img
                    src={settings.background}
                    alt="Background"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  onClick={removeBackground}
                  className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            )}
            <input
              ref={backgroundInputRef}
              type="file"
              accept="image/*"
              onChange={handleBackgroundUpload}
              className="hidden"
            />
          </div>
        )}

        {/* Blur Info */}
        {settings.backgroundType === 'blur' && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Background blur will be applied to your camera feed, creating a professional look without needing a physical backdrop.
            </p>
          </div>
        )}
      </div>

      {/* Preview */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">
          Preview
        </label>
        <div
          className="relative w-full h-48 rounded-lg overflow-hidden"
          style={{
            backgroundColor:
              settings.backgroundType === 'color'
                ? settings.backgroundColor
                : '#1a1a1a',
            backgroundImage:
              settings.backgroundType === 'image' && settings.background
                ? `url(${settings.background})`
                : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            filter: settings.backgroundType === 'blur' ? 'blur(20px)' : 'none',
          }}
        >
          {settings.logo && (
            <img
              src={settings.logo}
              alt="Logo preview"
              className={`absolute ${
                settings.logoPosition.includes('top') ? 'top-4' : 'bottom-4'
              } ${
                settings.logoPosition.includes('left') ? 'left-4' : 'right-4'
              }`}
              style={{
                width: `${getLogoSize()}px`,
                opacity: settings.logoOpacity / 100,
              }}
            />
          )}
        </div>
      </div>

      {/* Save Button */}
      <button className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium">
        Save Brand Settings
      </button>
    </div>
  );
}
