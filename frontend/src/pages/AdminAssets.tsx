import { useState, useEffect } from 'react';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';
import api from '../services/api';

type AssetType = 'backgrounds' | 'sounds' | 'images' | 'overlays';

interface Asset {
  id: string;
  name: string;
  url: string;
  thumbnailUrl?: string;
  type: string;
  category: string;
  fileSize: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
}

export function AdminAssets() {
  const [activeTab, setActiveTab] = useState<AssetType>('backgrounds');
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState('');
  const [uploadCategory, setUploadCategory] = useState('');

  useEffect(() => {
    loadAssets();
  }, [activeTab]);

  const loadAssets = async () => {
    setIsLoading(true);
    try {
      const response = await api.get(`/admin/assets/${activeTab}`);
      setAssets(response.data.assets || []);
    } catch (error) {
      console.error('Failed to load assets:', error);
      toast.error('Failed to load assets');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadingFile(file);
      setUploadName(file.name.replace(/\.[^/.]+$/, '')); // Remove extension
    }
  };

  const handleUpload = async () => {
    if (!uploadingFile || !uploadName) {
      toast.error('Please select a file and provide a name');
      return;
    }

    const formData = new FormData();
    formData.append('file', uploadingFile);
    formData.append('name', uploadName);
    formData.append('category', uploadCategory || 'default');
    formData.append('isDefault', 'true');

    try {
      toast.loading('Uploading...', { id: 'upload' });
      const response = await api.post(`/admin/assets/${activeTab}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setAssets([...assets, response.data.asset]);
      toast.success('Asset uploaded successfully', { id: 'upload' });
      setShowUploadModal(false);
      setUploadingFile(null);
      setUploadName('');
      setUploadCategory('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed', { id: 'upload' });
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this asset? Users will no longer be able to use it.')) {
      return;
    }

    try {
      await api.delete(`/admin/assets/${activeTab}/${assetId}`);
      setAssets(assets.filter(a => a.id !== assetId));
      toast.success('Asset deleted');
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const handleToggleActive = async (assetId: string, isActive: boolean) => {
    try {
      await api.patch(`/admin/assets/${activeTab}/${assetId}`, { isActive });
      setAssets(assets.map(a => a.id === assetId ? { ...a, isActive } : a));
      toast.success(isActive ? 'Asset activated' : 'Asset deactivated');
    } catch (error) {
      toast.error('Failed to update asset');
    }
  };

  const getAssetTypeInfo = (type: AssetType) => {
    const info = {
      backgrounds: {
        title: 'Default Backgrounds',
        description: 'Manage default virtual backgrounds available to all users',
        icon: '🖼️',
        acceptedFormats: 'image/*',
        categories: ['Office', 'Studio', 'Nature', 'Abstract', 'Cityscape', 'Patterns'],
      },
      sounds: {
        title: 'Default Sounds',
        description: 'Manage default sound effects and audio clips available to all users',
        icon: '🔊',
        acceptedFormats: 'audio/*',
        categories: ['Intro', 'Outro', 'Transition', 'Notification', 'Ambient', 'Effects'],
      },
      images: {
        title: 'Site Images & Graphics',
        description: 'Manage platform logos, graphics, and visual assets',
        icon: '🎨',
        acceptedFormats: 'image/*',
        categories: ['Logo', 'Icon', 'Banner', 'Graphic', 'Avatar', 'Placeholder'],
      },
      overlays: {
        title: 'Default Overlays',
        description: 'Manage default overlay templates available to all users',
        icon: '📐',
        acceptedFormats: 'image/*,video/*',
        categories: ['Lower Third', 'Frame', 'Banner', 'Corner', 'Full Screen', 'Ticker'],
      },
    };
    return info[type];
  };

  const typeInfo = getAssetTypeInfo(activeTab);

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Asset Management</h1>
          <p className="text-gray-400">Manage default assets available to all users</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-700">
          {(['backgrounds', 'sounds', 'images', 'overlays'] as AssetType[]).map((type) => {
            const info = getAssetTypeInfo(type);
            return (
              <button
                key={type}
                onClick={() => setActiveTab(type)}
                className={`px-6 py-3 text-sm font-medium transition-colors ${
                  activeTab === type
                    ? 'text-primary-500 border-b-2 border-primary-500'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                <span className="mr-2">{info.icon}</span>
                {info.title}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="bg-gray-800 rounded-lg p-6">
          {/* Section Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-bold text-white mb-1">{typeInfo.title}</h2>
              <p className="text-sm text-gray-400">{typeInfo.description}</p>
            </div>
            <Button
              onClick={() => setShowUploadModal(true)}
              variant="primary"
              size="md"
            >
              📤 Upload {activeTab === 'sounds' ? 'Sound' : activeTab === 'images' ? 'Image' : activeTab === 'overlays' ? 'Overlay' : 'Background'}
            </Button>
          </div>

          {/* Assets Grid */}
          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading assets...</div>
          ) : assets.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-gray-500 text-lg mb-2">No {activeTab} yet</p>
              <p className="text-gray-600 text-sm">Upload your first {activeTab.slice(0, -1)} to get started</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {assets.map((asset) => (
                <div
                  key={asset.id}
                  className={`bg-gray-700 rounded-lg overflow-hidden transition-all ${
                    asset.isActive ? 'ring-2 ring-green-500/50' : 'opacity-60'
                  }`}
                >
                  {/* Preview */}
                  <div className="aspect-video bg-gray-900 flex items-center justify-center relative">
                    {activeTab === 'backgrounds' || activeTab === 'images' || activeTab === 'overlays' ? (
                      asset.thumbnailUrl || asset.url ? (
                        <img
                          src={asset.thumbnailUrl || asset.url}
                          alt={asset.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-4xl">{typeInfo.icon}</span>
                      )
                    ) : (
                      <span className="text-4xl">{typeInfo.icon}</span>
                    )}
                    {!asset.isActive && (
                      <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                        <span className="text-white font-semibold">INACTIVE</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-4">
                    <h3 className="text-white font-medium mb-1 truncate">{asset.name}</h3>
                    <p className="text-xs text-gray-400 mb-2">{asset.category}</p>
                    <p className="text-xs text-gray-500 mb-3">
                      {(asset.fileSize / 1024).toFixed(0)} KB
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleToggleActive(asset.id, !asset.isActive)}
                        variant={asset.isActive ? 'ghost' : 'secondary'}
                        size="sm"
                        className="flex-1 text-xs"
                      >
                        {asset.isActive ? '🔴 Deactivate' : '🟢 Activate'}
                      </Button>
                      <Button
                        onClick={() => handleDelete(asset.id)}
                        variant="danger"
                        size="sm"
                        className="text-xs"
                      >
                        🗑️
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-2xl max-w-md w-full p-6">
              <h2 className="text-2xl font-bold text-white mb-4">
                Upload {typeInfo.title.replace('Default ', '')}
              </h2>

              <div className="space-y-4">
                {/* File Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Select File
                  </label>
                  <input
                    type="file"
                    accept={typeInfo.acceptedFormats}
                    onChange={handleFileSelect}
                    className="w-full text-sm text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary-600 file:text-white hover:file:bg-primary-700"
                  />
                  {uploadingFile && (
                    <p className="mt-2 text-sm text-gray-400">
                      Selected: {uploadingFile.name} ({(uploadingFile.size / 1024).toFixed(0)} KB)
                    </p>
                  )}
                </div>

                {/* Name Input */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Asset Name
                  </label>
                  <input
                    type="text"
                    value={uploadName}
                    onChange={(e) => setUploadName(e.target.value)}
                    placeholder="Enter a descriptive name"
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-primary-500 focus:outline-none"
                  />
                </div>

                {/* Category Select */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Category
                  </label>
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value)}
                    className="w-full px-3 py-2 bg-gray-700 text-white rounded border border-gray-600 focus:border-primary-500 focus:outline-none"
                  >
                    <option value="">Select category</option>
                    {typeInfo.categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-4">
                  <Button
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadingFile(null);
                      setUploadName('');
                      setUploadCategory('');
                    }}
                    variant="ghost"
                    size="md"
                    className="flex-1"
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleUpload}
                    variant="primary"
                    size="md"
                    className="flex-1"
                    disabled={!uploadingFile || !uploadName}
                  >
                    Upload
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
