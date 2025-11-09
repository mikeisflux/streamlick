import { useState } from 'react';

interface MediaAssetsPanelProps {
  broadcastId?: string;
}

type AssetTab = 'brand' | 'music' | 'images' | 'videos';

interface Asset {
  id: string;
  type: 'brand' | 'music' | 'image' | 'video';
  name: string;
  url: string;
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
}

export function MediaAssetsPanel({ broadcastId }: MediaAssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('brand');
  const [assets, setAssets] = useState<Asset[]>([
    {
      id: '1',
      type: 'brand',
      name: 'Company Logo',
      url: '/assets/logo.png',
      thumbnailUrl: '/assets/logo-thumb.png',
    },
    {
      id: '2',
      type: 'music',
      name: 'Background Music 1',
      url: '/assets/music1.mp3',
      duration: 180,
    },
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      // Handle file upload
      console.log('Uploading files:', files);
    }
  };

  const renderAssetCard = (asset: Asset) => {
    return (
      <div
        key={asset.id}
        className="p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow cursor-pointer group"
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
          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-50 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button className="px-3 py-1 bg-white text-gray-900 rounded text-sm font-medium">
              Use Asset
            </button>
          </div>
        </div>
        <p className="text-xs font-medium text-gray-900 truncate">{asset.name}</p>
        {asset.duration && (
          <p className="text-xs text-gray-500">
            {Math.floor(asset.duration / 60)}:{String(asset.duration % 60).padStart(2, '0')}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="border-b border-gray-200 px-4">
        <div className="flex gap-2 overflow-x-auto">
          {[
            { id: 'brand', label: '🎨 Brand', icon: '🎨' },
            { id: 'music', label: '🎵 Music', icon: '🎵' },
            { id: 'images', label: '🖼️ Images', icon: '🖼️' },
            { id: 'videos', label: '🎬 Videos', icon: '🎬' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AssetTab)}
              className={`px-4 py-3 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'brand' && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">Brand Presets</h4>
              <p className="text-xs text-blue-700 mb-3">
                Create and save brand presets with your logo, colors, and overlays for quick access.
              </p>
              <button className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors">
                + Create Brand Preset
              </button>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Brand Assets</h4>
              <div className="grid grid-cols-2 gap-3">
                {assets
                  .filter((a) => a.type === 'brand')
                  .map((asset) => renderAssetCard(asset))}
                <div className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                  <label className="cursor-pointer text-center">
                    <div className="text-3xl mb-2">+</div>
                    <div className="text-xs text-gray-600">Upload Logo</div>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'music' && (
          <div className="space-y-4">
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-purple-900 mb-2">🎵 Background Music</h4>
              <p className="text-xs text-purple-700 mb-3">
                Add background music to your stream. Supports MP3, WAV, and OGG formats.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">Your Music Library</h4>
              <div className="space-y-2">
                {assets
                  .filter((a) => a.type === 'music')
                  .map((asset) => (
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
                              {Math.floor(asset.duration / 60)}:
                              {String(asset.duration % 60).padStart(2, '0')}
                            </p>
                          )}
                        </div>
                        <button className="px-3 py-1 bg-purple-600 hover:bg-purple-700 text-white text-xs rounded transition-colors">
                          Play
                        </button>
                      </div>
                    </div>
                  ))}
              </div>

              <label className="mt-3 block">
                <div className="w-full p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg text-center cursor-pointer hover:border-gray-400 transition-colors">
                  <div className="text-3xl mb-2">🎵</div>
                  <div className="text-sm text-gray-600">Upload Music</div>
                  <div className="text-xs text-gray-500 mt-1">MP3, WAV, or OGG</div>
                </div>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'images' && (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-green-900 mb-2">🖼️ Image Assets</h4>
              <p className="text-xs text-green-700">
                Upload images for overlays, backgrounds, and lower thirds.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                <div className="text-3xl mb-2">🖼️</div>
                <div className="text-xs text-gray-600">Upload Image</div>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        )}

        {activeTab === 'videos' && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
              <h4 className="text-sm font-semibold text-orange-900 mb-2">🎬 Video Clips</h4>
              <p className="text-xs text-orange-700">
                Upload intro/outro videos and pre-recorded segments.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="aspect-video bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-gray-400 transition-colors">
                <div className="text-3xl mb-2">🎬</div>
                <div className="text-xs text-gray-600">Upload Video</div>
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
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
