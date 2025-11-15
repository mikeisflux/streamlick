import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

interface MediaAssetsPanelProps {
  broadcastId?: string;
}

type AssetTab = 'logos' | 'overlays' | 'backgrounds' | 'videoBackgrounds' | 'videoClips' | 'banners' | 'music';

interface Asset {
  id: string;
  type: 'logo' | 'overlay' | 'background' | 'videoBackground' | 'videoClip' | 'banner' | 'music';
  name: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  isActive?: boolean;
}

export function MediaAssetsPanel({ broadcastId }: MediaAssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('logos');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);

  // Track active background asset
  const [activeBackgroundUrl, setActiveBackgroundUrl] = useState<string | null>(() => {
    return localStorage.getItem('streamBackground');
  });

  // Track active logo asset
  const [activeLogoUrl, setActiveLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('streamLogo');
  });

  // Load assets from localStorage or use defaults
  const [assets, setAssets] = useState<Asset[]>(() => {
    const storageKey = `media_assets_${broadcastId || 'default'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved assets:', e);
      }
    }
    // Default demo assets
    return [];
  });

  // Persist assets to localStorage whenever they change
  useEffect(() => {
    const storageKey = `media_assets_${broadcastId || 'default'}`;
    try {
      localStorage.setItem(storageKey, JSON.stringify(assets));
    } catch (error: any) {
      console.error('Failed to save assets to localStorage:', error);
      if (error.name === 'QuotaExceededError') {
        toast.error('Storage quota exceeded. Consider uploading smaller files or clearing old assets.');
      }
    }
  }, [assets, broadcastId]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Check file size (warn if > 2MB for localStorage compatibility)
      const maxSize = 2 * 1024 * 1024; // 2MB
      if (file.size > maxSize) {
        toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Please upload files smaller than 2MB for best performance.`);
        return;
      }

      const reader = new FileReader();

      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;

        // Determine asset type based on active tab and file type
        let assetType: Asset['type'] = 'logo';
        if (file.type.startsWith('audio/')) {
          assetType = 'music';
        } else if (file.type.startsWith('image/')) {
          if (activeTab === 'logos') assetType = 'logo';
          else if (activeTab === 'overlays') assetType = 'overlay';
          else if (activeTab === 'backgrounds') assetType = 'background';
          else if (activeTab === 'banners') assetType = 'banner';
          else assetType = 'background';
        } else if (file.type.startsWith('video/')) {
          if (activeTab === 'videoBackgrounds') assetType = 'videoBackground';
          else if (activeTab === 'videoClips') assetType = 'videoClip';
          else assetType = 'videoClip';
        }

        // Create new asset
        const newAsset: Asset = {
          id: Date.now().toString(),
          type: assetType,
          name: file.name,
          url: dataUrl,
          thumbnailUrl: file.type.startsWith('image/') ? dataUrl : undefined,
          fileSize: file.size,
        };

        // Add to assets array
        setAssets([...assets, newAsset]);
        toast.success(`${file.name} uploaded successfully!`);
      };

      reader.onerror = (error) => {
        console.error('Error reading file:', error);
        toast.error('Failed to upload file. Please try again.');
      };

      reader.readAsDataURL(file);
    }
  };


  const handleDeleteAsset = (assetId: string) => {
    if (confirm('Delete this asset?')) {
      setAssets(assets.filter((a) => a.id !== assetId));
      toast.success('Asset deleted successfully');
    }
  };

  const handleUseAsset = (asset: Asset) => {
    // Check if this asset is already active
    const isActiveLogo = asset.type === 'logo' && activeLogoUrl === asset.url;
    const isActiveBackground = (asset.type === 'background' || asset.type === 'videoBackground') && activeBackgroundUrl === asset.url;

    if (isActiveLogo) {
      // Remove the logo
      localStorage.removeItem('streamLogo');
      localStorage.removeItem('streamLogoName');
      setActiveLogoUrl(null);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: null, name: null } }));
      toast.success('Logo removed');
    } else if (isActiveBackground) {
      // Remove the background
      localStorage.removeItem('streamBackground');
      localStorage.removeItem('streamBackgroundName');
      setActiveBackgroundUrl(null);
      window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: null, name: null } }));
      toast.success('Background removed');
    } else {
      // Apply asset based on type
      switch (asset.type) {
        case 'logo':
          localStorage.setItem('streamLogo', asset.url);
          localStorage.setItem('streamLogoName', asset.name);
          setActiveLogoUrl(asset.url);
          window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: asset.url, name: asset.name } }));
          toast.success(`Logo applied: ${asset.name}`);
          break;

        case 'overlay':
          // Overlays go on top of everything
          localStorage.setItem('streamOverlay', asset.url);
          localStorage.setItem('streamOverlayName', asset.name);
          window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: asset.url, name: asset.name } }));
          toast.success(`Overlay applied: ${asset.name}`);
          break;

        case 'background':
        case 'videoBackground':
          localStorage.setItem('streamBackground', asset.url);
          localStorage.setItem('streamBackgroundName', asset.name);
          setActiveBackgroundUrl(asset.url);
          window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: asset.url, name: asset.name } }));
          toast.success(`Background applied: ${asset.name}`);
          break;

        case 'videoClip':
          // Play video clip
          window.dispatchEvent(new CustomEvent('playVideoClip', { detail: { url: asset.url, name: asset.name } }));
          toast.success(`Playing: ${asset.name}`);
          break;

        case 'banner':
          // Add banner to stream
          window.dispatchEvent(new CustomEvent('addBanner', { detail: { url: asset.url, name: asset.name } }));
          toast.success(`Banner added: ${asset.name}`);
          break;

        case 'music':
          localStorage.setItem('backgroundMusic', asset.url);
          localStorage.setItem('backgroundMusicName', asset.name);
          toast.success(`Background music: ${asset.name}`);
          break;
      }
    }
  };

  const renderAssetCard = (asset: Asset) => {
    // Check if this asset is currently active
    const isActive = (asset.type === 'logo' && activeLogoUrl === asset.url) ||
                     ((asset.type === 'background' || asset.type === 'videoBackground') && activeBackgroundUrl === asset.url);

    return (
      <div
        key={asset.id}
        className={`p-3 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer group relative ${
          isActive ? 'border-2 border-blue-500' : 'border border-gray-200'
        }`}
      >
        <div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden relative">
          {asset.thumbnailUrl ? (
            <img
              src={asset.thumbnailUrl}
              alt={asset.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              {asset.type === 'music' ? '🎵' : asset.type === 'image' ? '🖼️' : '🎬'}
            </div>
          )}
          {/* Active indicator */}
          {isActive && (
            <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
              Active
            </div>
          )}
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUseAsset(asset);
              }}
              className={`px-3 py-1 rounded text-sm font-medium ${
                isActive
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : 'bg-white text-gray-900 hover:bg-gray-100'
              }`}
            >
              {isActive ? 'Remove Asset' : 'Use Asset'}
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleDeleteAsset(asset.id);
              }}
              className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-sm font-medium"
            >
              Delete
            </button>
          </div>
        </div>
        <p className="text-xs font-medium text-gray-900 truncate">{asset.name}</p>
        {asset.duration && (
          <p className="text-xs text-gray-500">
            {Math.floor(asset.duration / 60)}:{String(asset.duration % 60).padStart(2, '0')}
          </p>
        )}
        {asset.fileSize && (
          <p className="text-xs text-gray-500">
            {(asset.fileSize / 1024 / 1024).toFixed(2)} MB
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Media Assets</h2>
        <p className="text-xs text-gray-600 mt-1">Manage your logos, overlays, backgrounds, videos, and more</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 px-2">
        <div className="flex gap-1 overflow-x-auto scrollbar-hide">
          {[
            { id: 'logos', label: 'Logos', icon: '⭐' },
            { id: 'overlays', label: 'Overlays', icon: '🎨' },
            { id: 'backgrounds', label: 'Backgrounds', icon: '🖼️' },
            { id: 'videoBackgrounds', label: 'Video BG', icon: '🎬' },
            { id: 'videoClips', label: 'Video Clips', icon: '🎥' },
            { id: 'banners', label: 'Banners', icon: '📢' },
            { id: 'music', label: 'Music', icon: '🎵' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AssetTab)}
              className={`px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-gray-50'
              }`}
            >
              <span className="mr-1">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* LOGOS TAB */}
        {activeTab === 'logos' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">⭐ Brand Logos</h4>
              <p className="text-xs text-blue-700">
                Upload brand logos that appear in the top-left corner of your stream. Recommended size: 150×150 px.
                Logos persist across all scenes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'logo').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors">
                <div className="text-3xl mb-2">+</div>
                <div className="text-xs text-gray-600 font-medium">Upload Logo</div>
                <div className="text-xs text-gray-500 mt-1">PNG, JPG (150×150)</div>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* OVERLAYS TAB */}
        {activeTab === 'overlays' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">🎨 Stream Overlays</h4>
              <p className="text-xs text-purple-700 mb-2">
                Full-screen transparent overlays that layer on top of your stream. Use PNG files with transparency.
                Recommended size: 1920×1080 px (1080p) or 1280×720 px (720p).
              </p>
              <p className="text-xs text-purple-600 italic">
                Tip: Overlays are always full-screen but can have transparent areas to show your content underneath.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'overlay').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                <div className="text-3xl mb-2">🎨</div>
                <div className="text-xs text-gray-600 font-medium">Upload Overlay</div>
                <div className="text-xs text-gray-500 mt-1">PNG, GIF (1920×1080)</div>
                <input type="file" accept="image/png,image/gif" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* BACKGROUNDS TAB */}
        {activeTab === 'backgrounds' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-green-900 mb-2">🖼️ Background Images</h4>
              <p className="text-xs text-green-700">
                Static image backgrounds for your stream. Recommended sizes: 1920×1080 px (1080p) or 1280×720 px (720p).
                Maximum file size: 20MB.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'background').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-green-400 hover:bg-green-50 transition-colors">
                <div className="text-3xl mb-2">🖼️</div>
                <div className="text-xs text-gray-600 font-medium">Upload Background</div>
                <div className="text-xs text-gray-500 mt-1">JPG, PNG (1920×1080)</div>
                <input type="file" accept="image/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* VIDEO BACKGROUNDS TAB */}
        {activeTab === 'videoBackgrounds' && (
          <div className="space-y-4">
            <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-indigo-900 mb-2">🎬 Video Backgrounds</h4>
              <p className="text-xs text-indigo-700 mb-2">
                Looping video backgrounds (no audio). Recommended size: 1280×720 px. Maximum file size: 200MB.
                Videos automatically loop continuously.
              </p>
              <p className="text-xs text-indigo-600 italic">
                Tip: Keep video backgrounds 1-2 minutes for optimal looping.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'videoBackground').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                <div className="text-3xl mb-2">🎬</div>
                <div className="text-xs text-gray-600 font-medium">Upload Video BG</div>
                <div className="text-xs text-gray-500 mt-1">MP4, GIF (&lt;200MB)</div>
                <input type="file" accept="video/mp4,image/gif" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* VIDEO CLIPS TAB */}
        {activeTab === 'videoClips' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-orange-900 mb-2">🎥 Video Clips</h4>
              <p className="text-xs text-orange-700 mb-2">
                Intro/outro videos and pre-recorded segments with audio. Recommended sizes: 1920×1080 px or 1280×720 px (16:9).
                Maximum file size: 200MB.
              </p>
              <p className="text-xs text-orange-600 italic">
                Tip: Video clips play once when triggered, perfect for intros, outros, and announcements.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'videoClip').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-colors">
                <div className="text-3xl mb-2">🎥</div>
                <div className="text-xs text-gray-600 font-medium">Upload Video Clip</div>
                <div className="text-xs text-gray-500 mt-1">MP4 (1920×1080)</div>
                <input type="file" accept="video/*" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* BANNERS TAB */}
        {activeTab === 'banners' && (
          <div className="space-y-4">
            <div className="bg-pink-50 border border-pink-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-pink-900 mb-2">📢 Banners & Lower Thirds</h4>
              <p className="text-xs text-pink-700 mb-2">
                Custom banner graphics for lower thirds, name tags, and text overlays. Recommended size: 1920×1080 px with transparency.
              </p>
              <p className="text-xs text-pink-600 italic">
                Tip: Use the Banner Editor to create text-based banners, or upload custom banner graphics here.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {assets.filter((a) => a.type === 'banner').map((asset) => renderAssetCard(asset))}
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-pink-400 hover:bg-pink-50 transition-colors">
                <div className="text-3xl mb-2">📢</div>
                <div className="text-xs text-gray-600 font-medium">Upload Banner</div>
                <div className="text-xs text-gray-500 mt-1">PNG (1920×1080)</div>
                <input type="file" accept="image/png" onChange={handleFileUpload} className="hidden" />
              </label>
            </div>
          </div>
        )}

        {/* MUSIC TAB */}
        {activeTab === 'music' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">🎵 Background Music</h4>
              <p className="text-xs text-purple-700">
                Add background music to your stream. Supports MP3, WAV, and OGG formats.
                Music plays continuously in the background.
              </p>
            </div>

            <div className="space-y-2">
              {assets.filter((a) => a.type === 'music').map((asset) => (
                <div
                  key={asset.id}
                  className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-purple-100 rounded flex items-center justify-center text-2xl">
                      🎵
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
                      {asset.duration && (
                        <p className="text-xs text-gray-500">
                          {Math.floor(asset.duration / 60)}:{String(asset.duration % 60).padStart(2, '0')}
                        </p>
                      )}
                      {asset.fileSize && (
                        <p className="text-xs text-gray-500">
                          {(asset.fileSize / 1024 / 1024).toFixed(2)} MB
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleUseAsset(asset)}
                        className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors"
                      >
                        Use
                      </button>
                      <button
                        onClick={() => handleDeleteAsset(asset.id)}
                        className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <label className="block">
              <div className="w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-purple-400 hover:bg-purple-50 transition-colors">
                <div className="text-3xl mb-2">🎵</div>
                <div className="text-sm text-gray-600 font-medium">Upload Music</div>
                <div className="text-xs text-gray-500 mt-1">MP3, WAV, or OGG</div>
              </div>
              <input type="file" accept="audio/*" onChange={handleFileUpload} className="hidden" />
            </label>
          </div>
        )}
      </div>

      {/* Storage Info */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
          <span>Storage Used</span>
          <span>12.5 MB / 500 MB</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full" style={{ width: '2.5%' }} />
        </div>
      </div>
    </div>
  );
}
