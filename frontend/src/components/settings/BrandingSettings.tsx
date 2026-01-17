import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Asset {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  createdAt: string;
}

interface BrandColors {
  primary: string;
  secondary: string;
  accent: string;
  text: string;
}

type AssetType = 'logo' | 'overlay' | 'background' | 'banner';

export function BrandingSettings() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadType, setUploadType] = useState<AssetType>('logo');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [brandColors, setBrandColors] = useState<BrandColors>({
    primary: '#6366f1',
    secondary: '#8b5cf6',
    accent: '#22c55e',
    text: '#ffffff',
  });

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const response = await api.get('/assets');
      setAssets(response.data);
    } catch (error) {
      // Silently fail - assets may not exist yet
      setAssets([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this asset?')) return;

    try {
      await api.delete(`/assets/${id}`);
      toast.success('Asset deleted');
      loadAssets();
    } catch (error) {
      toast.error('Failed to delete asset');
    }
  };

  const filterByType = (type: string) => assets.filter((a) => a.type === type);

  const openUploadModal = (type: AssetType) => {
    setUploadType(type);
    setShowUploadModal(true);
  };

  const handleColorChange = (key: keyof BrandColors, value: string) => {
    setBrandColors(prev => ({ ...prev, [key]: value }));
  };

  const saveColors = async () => {
    try {
      await api.post('/settings/brand-colors', brandColors);
      toast.success('Brand colors saved');
    } catch (error) {
      toast.error('Failed to save colors');
    }
  };

  const assetCategories = [
    {
      type: 'logo' as AssetType,
      title: 'Logos',
      description: 'Upload your logo to display on your stream',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      ),
      acceptFormats: 'PNG, JPG, SVG, GIF',
      gridCols: 'grid-cols-2 md:grid-cols-4 lg:grid-cols-6',
    },
    {
      type: 'overlay' as AssetType,
      title: 'Overlays',
      description: 'Add visual overlays like borders, lower thirds, and frames',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
      ),
      acceptFormats: 'PNG with transparency',
      gridCols: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    },
    {
      type: 'background' as AssetType,
      title: 'Backgrounds',
      description: 'Set custom backgrounds for your stream scenes',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
      ),
      acceptFormats: 'PNG, JPG, MP4, WEBM',
      gridCols: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
    },
    {
      type: 'banner' as AssetType,
      title: 'Banners',
      description: 'Create ticker banners and announcement graphics',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
      ),
      acceptFormats: 'PNG, JPG, GIF',
      gridCols: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Branding</h2>
        <p className="text-sm text-gray-500 mt-1">
          Customize your stream's visual identity with logos, overlays, and colors
        </p>
      </div>

      {/* Brand Colors Section */}
      <div className="bg-gray-50 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
            <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
          </div>
          <div>
            <h3 className="font-medium text-gray-900">Brand Colors</h3>
            <p className="text-sm text-gray-500">Set your brand's color palette for overlays and text</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { key: 'primary', label: 'Primary' },
            { key: 'secondary', label: 'Secondary' },
            { key: 'accent', label: 'Accent' },
            { key: 'text', label: 'Text' },
          ].map(({ key, label }) => (
            <div key={key} className="bg-white rounded-lg p-4 shadow-sm">
              <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
              <div className="flex items-center gap-3">
                <div className="relative">
                  <input
                    type="color"
                    value={brandColors[key as keyof BrandColors]}
                    onChange={(e) => handleColorChange(key as keyof BrandColors, e.target.value)}
                    className="w-10 h-10 rounded-lg cursor-pointer border-0 p-0"
                  />
                </div>
                <input
                  type="text"
                  value={brandColors[key as keyof BrandColors]}
                  onChange={(e) => handleColorChange(key as keyof BrandColors, e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent uppercase"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-end">
          <button
            onClick={saveColors}
            className="px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
          >
            Save Colors
          </button>
        </div>
      </div>

      {/* Asset Categories */}
      {assetCategories.map((category) => {
        const categoryAssets = filterByType(category.type);

        return (
          <div key={category.type} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Category Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600">
                  {category.icon}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900">{category.title}</h3>
                  <p className="text-sm text-gray-500">{category.description}</p>
                </div>
              </div>
              <button
                onClick={() => openUploadModal(category.type)}
                className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload
              </button>
            </div>

            {/* Assets Grid */}
            <div className="p-6">
              {categoryAssets.length > 0 ? (
                <div className={`grid gap-4 ${category.gridCols}`}>
                  {categoryAssets.map((asset) => (
                    <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  type={category.type}
                  acceptFormats={category.acceptFormats}
                  onUpload={() => openUploadModal(category.type)}
                />
              )}
            </div>
          </div>
        );
      })}

      {/* Upload Modal */}
      {showUploadModal && (
        <UploadAssetModal
          type={uploadType}
          onClose={() => setShowUploadModal(false)}
          onSuccess={() => {
            setShowUploadModal(false);
            loadAssets();
          }}
        />
      )}
    </div>
  );
}

interface AssetCardProps {
  asset: Asset;
  onDelete: (id: string) => void;
}

function AssetCard({ asset, onDelete }: AssetCardProps) {
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="group relative bg-gray-50 rounded-lg overflow-hidden border border-gray-200 hover:border-gray-300 transition-colors">
      {/* Preview */}
      <div className="aspect-video bg-gray-900 flex items-center justify-center">
        <img
          src={asset.fileUrl}
          alt={asset.name}
          className="max-w-full max-h-full object-contain"
        />
      </div>

      {/* Info */}
      <div className="p-3 flex items-center justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
          <p className="text-xs text-gray-500">
            {new Date(asset.createdAt).toLocaleDateString()}
          </p>
        </div>

        {/* Menu Button */}
        <div className="relative">
          <button
            onClick={() => setShowMenu(!showMenu)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
          </button>

          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                <button
                  onClick={() => {
                    window.open(asset.fileUrl, '_blank');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  View full size
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(asset.fileUrl);
                    toast.success('URL copied');
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Copy URL
                </button>
                <hr className="my-1 border-gray-100" />
                <button
                  onClick={() => {
                    onDelete(asset.id);
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface EmptyStateProps {
  type: AssetType;
  acceptFormats: string;
  onUpload: () => void;
}

function EmptyState({ type, acceptFormats, onUpload }: EmptyStateProps) {
  return (
    <div
      onClick={onUpload}
      className="border-2 border-dashed border-gray-200 rounded-lg p-8 text-center hover:border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer"
    >
      <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
        </svg>
      </div>
      <p className="text-sm font-medium text-gray-900 mb-1">
        No {type}s uploaded yet
      </p>
      <p className="text-xs text-gray-500 mb-4">
        Accepted formats: {acceptFormats}
      </p>
      <button className="px-4 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg hover:bg-gray-800 transition-colors">
        Upload {type}
      </button>
    </div>
  );
}

interface UploadAssetModalProps {
  type: AssetType;
  onClose: () => void;
  onSuccess: () => void;
}

function UploadAssetModal({ type, onClose, onSuccess }: UploadAssetModalProps) {
  const [name, setName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'file' | 'url'>('file');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.type.startsWith('image/')) {
      setFile(droppedFile);
      if (!name) setName(droppedFile.name.replace(/\.[^/.]+$/, ''));
    }
  }, [name]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      if (!name) setName(selectedFile.name.replace(/\.[^/.]+$/, ''));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // In production, upload to S3 first, then save URL
      // For now, we'll just use the URL directly
      await api.post('/assets/upload', {
        type,
        name: name || file?.name || 'Untitled',
        fileUrl: uploadMethod === 'url' ? fileUrl : (file ? URL.createObjectURL(file) : ''),
        mimeType: file?.type,
        fileSizeBytes: file?.size,
      });
      toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} uploaded successfully`);
      onSuccess();
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
    } finally {
      setIsLoading(false);
    }
  };

  const typeLabels: Record<AssetType, { title: string; description: string }> = {
    logo: {
      title: 'Upload Logo',
      description: 'Add your logo to display on your stream',
    },
    overlay: {
      title: 'Upload Overlay',
      description: 'Add overlays like borders and lower thirds',
    },
    background: {
      title: 'Upload Background',
      description: 'Add custom backgrounds for your scenes',
    },
    banner: {
      title: 'Upload Banner',
      description: 'Add ticker banners and announcements',
    },
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-lg w-full shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{typeLabels[type].title}</h3>
            <p className="text-sm text-gray-500">{typeLabels[type].description}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name Input */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${type}`}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          {/* Upload Method Toggle */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Source</label>
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                type="button"
                onClick={() => setUploadMethod('file')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  uploadMethod === 'file'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setUploadMethod('url')}
                className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                  uploadMethod === 'url'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                From URL
              </button>
            </div>
          </div>

          {/* File Upload or URL Input */}
          {uploadMethod === 'file' ? (
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*,video/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                  isDragging
                    ? 'border-primary-500 bg-primary-50'
                    : file
                    ? 'border-green-300 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-3">
                    <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </div>
                    <p className="text-sm font-medium text-gray-900 mb-1">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-xs text-gray-500">
                      PNG, JPG, SVG, GIF, MP4, WEBM up to 50MB
                    </p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Image URL</label>
              <input
                type="url"
                value={fileUrl}
                onChange={(e) => setFileUrl(e.target.value)}
                placeholder="https://example.com/image.png"
                className="w-full px-4 py-2.5 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
              {fileUrl && (
                <div className="mt-3 p-2 bg-gray-50 rounded-lg">
                  <img
                    src={fileUrl}
                    alt="Preview"
                    className="max-h-32 mx-auto rounded"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading || (uploadMethod === 'file' ? !file : !fileUrl)}
              className="flex-1 px-4 py-2.5 bg-primary-600 text-white font-medium rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Uploading...
                </span>
              ) : (
                'Upload'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
