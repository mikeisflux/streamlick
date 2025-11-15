import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';
import {
  PlusIcon,
  TrashIcon,
  EyeIcon,
  EyeSlashIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';

interface Banner {
  id: string;
  type: 'lower-third' | 'text-overlay' | 'cta' | 'countdown';
  title: string;
  subtitle?: string;
  position: 'top-left' | 'top-center' | 'top-right' | 'bottom-left' | 'bottom-center' | 'bottom-right';
  backgroundColor: string;
  textColor: string;
  visible: boolean;
}

export function BannerEditorPanel() {
  // Load banners from localStorage or use default
  const [banners, setBanners] = useState<Banner[]>(() => {
    const saved = localStorage.getItem('banners');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved banners:', e);
      }
    }
    // Default demo banner
    return [
      {
        id: '1',
        type: 'lower-third',
        title: 'John Doe',
        subtitle: 'CEO, Example Company',
        position: 'bottom-left',
        backgroundColor: '#3b82f6',
        textColor: '#ffffff',
        visible: false,
      },
    ];
  });

  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [showEditor, setShowEditor] = useState(false);

  // Persist banners to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('banners', JSON.stringify(banners));
    // Dispatch custom event to notify same-tab components of banner changes
    window.dispatchEvent(new CustomEvent('bannersUpdated', { detail: banners }));
  }, [banners]);

  const bannerTypes = [
    { value: 'lower-third', label: 'Lower Third' },
    { value: 'text-overlay', label: 'Text Overlay' },
    { value: 'cta', label: 'Call to Action' },
    { value: 'countdown', label: 'Countdown Timer' },
  ];

  const positions = [
    { value: 'top-left', label: 'Top Left' },
    { value: 'top-center', label: 'Top Center' },
    { value: 'top-right', label: 'Top Right' },
    { value: 'bottom-left', label: 'Bottom Left' },
    { value: 'bottom-center', label: 'Bottom Center' },
    { value: 'bottom-right', label: 'Bottom Right' },
  ];

  const presetColors = [
    { name: 'Blue', value: '#3b82f6' },
    { name: 'Purple', value: '#8b5cf6' },
    { name: 'Green', value: '#10b981' },
    { name: 'Red', value: '#ef4444' },
    { name: 'Yellow', value: '#f59e0b' },
    { name: 'Black', value: '#000000' },
    { name: 'White', value: '#ffffff' },
  ];

  const createNewBanner = () => {
    // Load colors from StylePanel settings
    const primaryColor = localStorage.getItem('style_primaryColor') || '#3b82f6';
    const textColor = localStorage.getItem('style_textColor') || '#ffffff';

    const newBanner: Banner = {
      id: `banner-${Date.now()}`,
      type: 'lower-third',
      title: 'New Banner',
      subtitle: '',
      position: 'bottom-left',
      backgroundColor: primaryColor,
      textColor: textColor,
      visible: false,
    };
    setEditingBanner(newBanner);
    setShowEditor(true);
  };

  const saveBanner = () => {
    if (!editingBanner) {
      toast.error('No banner to save');
      return;
    }

    if (!editingBanner.title.trim()) {
      toast.error('Banner title is required');
      return;
    }

    setBanners((prev) => {
      const exists = prev.find((b) => b.id === editingBanner.id);
      if (exists) {
        toast.success('Banner updated successfully');
        return prev.map((b) => (b.id === editingBanner.id ? editingBanner : b));
      }
      toast.success('Banner created successfully');
      return [...prev, editingBanner];
    });

    setShowEditor(false);
    setEditingBanner(null);
  };

  const deleteBanner = (id: string) => {
    setBanners((prev) => prev.filter((b) => b.id !== id));
    toast.success('Banner deleted successfully');
  };

  const toggleBannerVisibility = (id: string) => {
    setBanners((prev) =>
      prev.map((b) =>
        b.id === id ? { ...b, visible: !b.visible } : b
      )
    );
  };

  const editBanner = (banner: Banner) => {
    setEditingBanner({ ...banner });
    setShowEditor(true);
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Banners & Overlays
        </h3>
        <p className="text-sm text-gray-600">
          Create and manage on-screen graphics for your broadcast
        </p>
      </div>

      {/* Banner List */}
      {!showEditor && (
        <div className="space-y-3">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`p-4 rounded-lg border-2 transition-all ${
                banner.visible
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="px-2 py-1 text-xs font-medium bg-gray-200 text-gray-700 rounded">
                      {bannerTypes.find((t) => t.value === banner.type)?.label}
                    </span>
                    <span className="text-xs text-gray-500">
                      {positions.find((p) => p.value === banner.position)?.label}
                    </span>
                  </div>
                  <h4 className="font-medium text-gray-900">{banner.title}</h4>
                  {banner.subtitle && (
                    <p className="text-sm text-gray-600">{banner.subtitle}</p>
                  )}
                  <div className="flex items-center space-x-2 mt-2">
                    <div
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: banner.backgroundColor }}
                    />
                    <div
                      className="w-6 h-6 rounded border border-gray-300"
                      style={{ backgroundColor: banner.textColor }}
                    />
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => editBanner(banner)}
                    className="p-2 rounded-lg hover:bg-gray-200 transition-colors"
                    title="Edit"
                  >
                    <PencilIcon className="w-5 h-5 text-gray-600" />
                  </button>
                  <button
                    onClick={() => toggleBannerVisibility(banner.id)}
                    className={`p-2 rounded-lg transition-colors ${
                      banner.visible
                        ? 'bg-green-100 hover:bg-green-200'
                        : 'hover:bg-gray-200'
                    }`}
                    title={banner.visible ? 'Hide' : 'Show'}
                  >
                    {banner.visible ? (
                      <EyeIcon className="w-5 h-5 text-green-600" />
                    ) : (
                      <EyeSlashIcon className="w-5 h-5 text-gray-600" />
                    )}
                  </button>
                  <button
                    onClick={() => deleteBanner(banner.id)}
                    className="p-2 rounded-lg hover:bg-red-100 transition-colors"
                    title="Delete"
                  >
                    <TrashIcon className="w-5 h-5 text-red-600" />
                  </button>
                </div>
              </div>
            </div>
          ))}

          {/* Add New Button */}
          <button
            onClick={createNewBanner}
            className="w-full py-4 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center space-x-2"
          >
            <PlusIcon className="w-5 h-5" />
            <span className="font-medium">Create New Banner</span>
          </button>
        </div>
      )}

      {/* Banner Editor */}
      {showEditor && editingBanner && (
        <div className="space-y-4">
          {/* Type Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Banner Type
            </label>
            <select
              value={editingBanner.type}
              onChange={(e) =>
                setEditingBanner({
                  ...editingBanner,
                  type: e.target.value as Banner['type'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {bannerTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Title
            </label>
            <input
              type="text"
              value={editingBanner.title}
              onChange={(e) =>
                setEditingBanner({ ...editingBanner, title: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter title"
            />
          </div>

          {/* Subtitle (for lower-third) */}
          {editingBanner.type === 'lower-third' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Subtitle
              </label>
              <input
                type="text"
                value={editingBanner.subtitle || ''}
                onChange={(e) =>
                  setEditingBanner({
                    ...editingBanner,
                    subtitle: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter subtitle"
              />
            </div>
          )}

          {/* Position */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Position
            </label>
            <select
              value={editingBanner.position}
              onChange={(e) =>
                setEditingBanner({
                  ...editingBanner,
                  position: e.target.value as Banner['position'],
                })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-blue-500 focus:border-blue-500"
            >
              {positions.map((pos) => (
                <option key={pos.value} value={pos.value}>
                  {pos.label}
                </option>
              ))}
            </select>
          </div>

          {/* Background Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Background Color
            </label>
            <div className="flex items-center space-x-2 mb-2">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() =>
                    setEditingBanner({
                      ...editingBanner,
                      backgroundColor: color.value,
                    })
                  }
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    editingBanner.backgroundColor === color.value
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <input
              type="color"
              value={editingBanner.backgroundColor}
              onChange={(e) =>
                setEditingBanner({
                  ...editingBanner,
                  backgroundColor: e.target.value,
                })
              }
              className="w-full h-12 rounded-lg border border-gray-300"
            />
          </div>

          {/* Text Color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Text Color
            </label>
            <div className="flex items-center space-x-2 mb-2">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  onClick={() =>
                    setEditingBanner({
                      ...editingBanner,
                      textColor: color.value,
                    })
                  }
                  className={`w-10 h-10 rounded-lg border-2 transition-all ${
                    editingBanner.textColor === color.value
                      ? 'border-blue-500 scale-110'
                      : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
            </div>
            <input
              type="color"
              value={editingBanner.textColor}
              onChange={(e) =>
                setEditingBanner({
                  ...editingBanner,
                  textColor: e.target.value,
                })
              }
              className="w-full h-12 rounded-lg border border-gray-300"
            />
          </div>

          {/* Preview */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preview
            </label>
            <div className="relative w-full h-32 bg-gray-900 rounded-lg overflow-hidden">
              <div
                className={`absolute p-4 rounded ${
                  editingBanner.position.includes('top') ? 'top-0' : 'bottom-0'
                } ${
                  editingBanner.position.includes('left')
                    ? 'left-0'
                    : editingBanner.position.includes('right')
                    ? 'right-0'
                    : 'left-1/2 transform -translate-x-1/2'
                }`}
                style={{
                  backgroundColor: editingBanner.backgroundColor,
                  color: editingBanner.textColor,
                }}
              >
                <div className="font-bold">{editingBanner.title}</div>
                {editingBanner.subtitle && (
                  <div className="text-sm opacity-90">
                    {editingBanner.subtitle}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-2 pt-4">
            <button
              onClick={saveBanner}
              className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Save Banner
            </button>
            <button
              onClick={() => {
                setShowEditor(false);
                setEditingBanner(null);
              }}
              className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
