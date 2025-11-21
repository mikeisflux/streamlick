import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { mediaStorageService } from '../services/media-storage.service';

// Helper function to generate thumbnail from video
const generateVideoThumbnail = (videoDataUrl: string): Promise<{ thumbnail: string; duration: number }> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek to 1 second or 10% of video duration, whichever is earlier
      const seekTime = Math.min(1, video.duration * 0.1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 320;
        canvas.height = 180;
        const ctx = canvas.getContext('2d');

        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.7);
          resolve({ thumbnail, duration: video.duration });
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      } catch (error) {
        reject(error);
      }
    };

    video.onerror = () => {
      reject(new Error('Failed to load video'));
    };

    video.src = videoDataUrl;
  });
};

interface MediaAssetsPanelProps {
  broadcastId?: string;
}

type AssetTab = 'logos' | 'overlays' | 'backgrounds' | 'videoBackgrounds' | 'videoClips' | 'banners' | 'music';

interface Asset {
  id: string;
  type: 'logo' | 'overlay' | 'background' | 'videoBackground' | 'videoClip' | 'banner' | 'music';
  name: string;
  url: string; // Object URL or data URL
  thumbnailUrl?: string;
  duration?: number;
  fileSize?: number;
  isActive?: boolean;
  storedInIndexedDB?: boolean; // Flag to indicate if file is in IndexedDB
}

export function MediaAssetsPanel({ broadcastId }: MediaAssetsPanelProps) {
  const [activeTab, setActiveTab] = useState<AssetTab>('logos');
  const logoInputRef = useRef<HTMLInputElement>(null);
  const overlayInputRef = useRef<HTMLInputElement>(null);
  const [isLoadingAssets, setIsLoadingAssets] = useState(true);
  const objectURLsRef = useRef<string[]>([]);

  // Track active overlay asset
  const [activeOverlayUrl, setActiveOverlayUrl] = useState<string | null>(() => {
    return localStorage.getItem('streamOverlay');
  });

  // Track active background asset
  const [activeBackgroundUrl, setActiveBackgroundUrl] = useState<string | null>(() => {
    return localStorage.getItem('streamBackground');
  });

  // Track active logo asset
  const [activeLogoUrl, setActiveLogoUrl] = useState<string | null>(() => {
    return localStorage.getItem('streamLogo');
  });

  // Load assets from localStorage metadata only
  const [assets, setAssets] = useState<Asset[]>([]);

  // Initialize IndexedDB and load assets on mount
  useEffect(() => {
    const loadAssets = async () => {
      try {
        // Initialize IndexedDB
        await mediaStorageService.initialize();

        // Load metadata from localStorage
        const storageKey = `media_assets_${broadcastId || 'default'}`;
        const saved = localStorage.getItem(storageKey);

        if (saved) {
          const assetMetadata = JSON.parse(saved);

          // Load actual files from IndexedDB for large files
          const loadedAssets = await Promise.all(
            assetMetadata.map(async (asset: Asset) => {
              if (asset.storedInIndexedDB) {
                try {
                  const mediaData = await mediaStorageService.getMedia(asset.id);
                  if (mediaData) {
                    // Create object URL from blob
                    const objectURL = URL.createObjectURL(mediaData.blob);
                    objectURLsRef.current.push(objectURL);

                    return {
                      ...asset,
                      url: objectURL,
                      thumbnailUrl: mediaData.thumbnail, // Restore thumbnail from IndexedDB
                      duration: mediaData.metadata.duration,
                    };
                  }
                } catch (error) {
                  console.error(`Failed to load asset ${asset.id} from IndexedDB:`, error);
                }
              }
              return asset;
            })
          );

          setAssets(loadedAssets);
        }

        // Reload active logo from IndexedDB if needed
        const logoAssetId = localStorage.getItem('streamLogoAssetId');
        if (logoAssetId) {
          try {
            const mediaData = await mediaStorageService.getMedia(logoAssetId);
            if (mediaData) {
              const objectURL = URL.createObjectURL(mediaData.blob);
              objectURLsRef.current.push(objectURL);
              // Don't save object URL to localStorage
              setActiveLogoUrl(objectURL);
              window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: objectURL } }));
            }
          } catch (error) {
            console.error('Failed to reload logo from IndexedDB:', error);
          }
        }

        // Reload active overlay from IndexedDB if needed
        const overlayAssetId = localStorage.getItem('streamOverlayAssetId');
        if (overlayAssetId) {
          try {
            const mediaData = await mediaStorageService.getMedia(overlayAssetId);
            if (mediaData) {
              const objectURL = URL.createObjectURL(mediaData.blob);
              objectURLsRef.current.push(objectURL);
              // Don't save object URL to localStorage
              setActiveOverlayUrl(objectURL);
              window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: objectURL } }));
            }
          } catch (error) {
            console.error('Failed to reload overlay from IndexedDB:', error);
          }
        }

        // Reload active background from IndexedDB if needed
        const backgroundAssetId = localStorage.getItem('streamBackgroundAssetId');
        if (backgroundAssetId) {
          try {
            const mediaData = await mediaStorageService.getMedia(backgroundAssetId);
            if (mediaData) {
              const objectURL = URL.createObjectURL(mediaData.blob);
              objectURLsRef.current.push(objectURL);
              // Don't save object URL to localStorage
              setActiveBackgroundUrl(objectURL);
              window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: objectURL } }));
            }
          } catch (error) {
            console.error('Failed to reload background from IndexedDB:', error);
          }
        }
      } catch (error) {
        console.error('Failed to load assets:', error);
      } finally {
        setIsLoadingAssets(false);
      }
    };

    loadAssets();

    // Cleanup object URLs on unmount
    return () => {
      objectURLsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectURLsRef.current = [];
    };
  }, [broadcastId]);

  // Save asset metadata to localStorage (without large data URLs)
  useEffect(() => {
    if (isLoadingAssets) return; // Don't save while loading

    const storageKey = `media_assets_${broadcastId || 'default'}`;
    try {
      // Only save minimal metadata
      const metadata = assets.map((asset) => ({
        id: asset.id,
        type: asset.type,
        name: asset.name,
        fileSize: asset.fileSize,
        duration: asset.duration,
        storedInIndexedDB: asset.storedInIndexedDB,
        // Only include url/thumbnail for non-IndexedDB assets
        url: asset.storedInIndexedDB ? undefined : asset.url,
        thumbnailUrl: asset.storedInIndexedDB ? undefined : asset.thumbnailUrl,
      }));

      localStorage.setItem(storageKey, JSON.stringify(metadata));
    } catch (error: any) {
      console.error('Failed to save asset metadata:', error);
      // Note: All media files are now stored in IndexedDB, so localStorage quota issues should not occur
      // The only data in localStorage is minimal metadata (IDs, names, types)
    }
  }, [assets, broadcastId, isLoadingAssets]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];

      // Different file size limits based on type
      let maxSize: number;
      let maxSizeLabel: string;

      if (file.type.startsWith('video/')) {
        maxSize = 2 * 1024 * 1024 * 1024; // 2GB for videos
        maxSizeLabel = '2GB';
      } else if (file.type.startsWith('audio/')) {
        maxSize = 50 * 1024 * 1024; // 50MB for audio
        maxSizeLabel = '50MB';
      } else {
        maxSize = 10 * 1024 * 1024; // 10MB for images
        maxSizeLabel = '10MB';
      }

      // Check file size
      if (file.size > maxSize) {
        toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(2)}MB). Maximum allowed: ${maxSizeLabel}`);
        return;
      }

      // Store ALL media files in IndexedDB to avoid localStorage quota limits
      // User's machine has unlimited local storage via IndexedDB
      const shouldUseIndexedDB = true; // Always use IndexedDB for media files

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

      const processFile = async () => {
        try {
          const assetId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          let fileURL: string;
          let thumbnailUrl: string | undefined;
          let duration: number | undefined;

          if (shouldUseIndexedDB) {
            // Store file in IndexedDB
            toast.loading('Processing file...');

            // Create object URL directly from file
            fileURL = URL.createObjectURL(file);
            objectURLsRef.current.push(fileURL);

            // Generate thumbnail from object URL
            if (file.type.startsWith('video/')) {
              try {
                const videoResult = await generateVideoThumbnail(fileURL);
                thumbnailUrl = videoResult.thumbnail;
                duration = videoResult.duration;
              } catch (error) {
                console.error('Failed to generate video thumbnail:', error);
              }
            } else if (file.type.startsWith('image/')) {
              thumbnailUrl = fileURL;
            }

            // Store blob in IndexedDB with thumbnail
            await mediaStorageService.saveMedia(
              assetId,
              file,
              {
                name: file.name,
                type: assetType,
                fileSize: file.size,
                duration,
              },
              thumbnailUrl // Save thumbnail in IndexedDB
            );

            toast.dismiss();
            toast.success(`${file.name} uploaded successfully!`);
          } else {
            // Store small file as data URL
            const reader = new FileReader();
            const dataUrl = await new Promise<string>((resolve, reject) => {
              reader.onload = (e) => resolve(e.target?.result as string);
              reader.onerror = reject;
              reader.readAsDataURL(file);
            });

            fileURL = dataUrl;

            // Generate thumbnail
            if (file.type.startsWith('video/')) {
              try {
                const videoResult = await generateVideoThumbnail(dataUrl);
                thumbnailUrl = videoResult.thumbnail;
                duration = videoResult.duration;
              } catch (error) {
                console.error('Failed to generate video thumbnail:', error);
              }
            } else if (file.type.startsWith('image/')) {
              thumbnailUrl = dataUrl;
            }

            toast.success(`${file.name} uploaded successfully!`);
          }

          // Create new asset
          const newAsset: Asset = {
            id: assetId,
            type: assetType,
            name: file.name,
            url: fileURL,
            thumbnailUrl,
            duration,
            fileSize: file.size,
            storedInIndexedDB: shouldUseIndexedDB,
          };

          // Add to assets array
          setAssets([...assets, newAsset]);
        } catch (error) {
          console.error('Error processing file:', error);
          toast.error('Failed to upload file. Please try again.');
        }
      };

      processFile();
    }
  };


  const handleDeleteAsset = async (assetId: string) => {
    if (confirm('Delete this asset?')) {
      const asset = assets.find((a) => a.id === assetId);

      if (asset) {
        // Check if this asset is currently active and remove it from the screen
        const isActiveLogo = asset.type === 'logo' && activeLogoUrl === asset.url;
        const isActiveOverlay = asset.type === 'overlay' && activeOverlayUrl === asset.url;
        const isActiveBackground = (asset.type === 'background' || asset.type === 'videoBackground') && activeBackgroundUrl === asset.url;

        if (isActiveLogo) {
          localStorage.removeItem('streamLogo');
          localStorage.removeItem('streamLogoName');
          localStorage.removeItem('streamLogoAssetId');
          setActiveLogoUrl(null);
          window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: null, name: null } }));
        } else if (isActiveOverlay) {
          localStorage.removeItem('streamOverlay');
          localStorage.removeItem('streamOverlayName');
          localStorage.removeItem('streamOverlayAssetId');
          setActiveOverlayUrl(null);
          window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: null, name: null } }));
        } else if (isActiveBackground) {
          localStorage.removeItem('streamBackground');
          localStorage.removeItem('streamBackgroundName');
          localStorage.removeItem('streamBackgroundAssetId');
          setActiveBackgroundUrl(null);
          window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: null, name: null } }));
        }

        // Delete from IndexedDB if stored there
        if (asset.storedInIndexedDB) {
          try {
            await mediaStorageService.deleteMedia(assetId);

            // Revoke object URL
            if (asset.url.startsWith('blob:')) {
              URL.revokeObjectURL(asset.url);
              objectURLsRef.current = objectURLsRef.current.filter((url) => url !== asset.url);
            }
          } catch (error) {
            console.error('Failed to delete from IndexedDB:', error);
          }
        }
      }

      // Remove from assets list and save
      const updatedAssets = assets.filter((a) => a.id !== assetId);
      setAssets(updatedAssets);

      // Save to localStorage
      const storageKey = `media_assets_${broadcastId || 'default'}`;
      localStorage.setItem(storageKey, JSON.stringify(updatedAssets.map(a => ({
        id: a.id,
        type: a.type,
        name: a.name,
        url: a.url,
        thumbnailUrl: a.thumbnailUrl,
        duration: a.duration,
        fileSize: a.fileSize,
        storedInIndexedDB: a.storedInIndexedDB,
      }))));

      toast.success('Asset deleted successfully');
    }
  };

  const handleUseAsset = async (asset: Asset) => {
    // Check if this asset is already active (check both URL and asset ID for IndexedDB assets)
    const logoAssetId = localStorage.getItem('streamLogoAssetId');
    const overlayAssetId = localStorage.getItem('streamOverlayAssetId');
    const backgroundAssetId = localStorage.getItem('streamBackgroundAssetId');

    const isActiveLogo = asset.type === 'logo' && (activeLogoUrl === asset.url || logoAssetId === asset.id);
    const isActiveOverlay = asset.type === 'overlay' && (activeOverlayUrl === asset.url || overlayAssetId === asset.id);
    const isActiveBackground = (asset.type === 'background' || asset.type === 'videoBackground') && (activeBackgroundUrl === asset.url || backgroundAssetId === asset.id);

    if (isActiveLogo) {
      // Remove the logo
      localStorage.removeItem('streamLogo');
      localStorage.removeItem('streamLogoName');
      localStorage.removeItem('streamLogoAssetId');
      setActiveLogoUrl(null);
      window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: null, name: null } }));
      toast.success('Logo removed');
    } else if (isActiveOverlay) {
      // Remove the overlay
      localStorage.removeItem('streamOverlay');
      localStorage.removeItem('streamOverlayName');
      localStorage.removeItem('streamOverlayAssetId');
      setActiveOverlayUrl(null);
      window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: null, name: null } }));
      toast.success('Overlay removed');
    } else if (isActiveBackground) {
      // Remove the background
      localStorage.removeItem('streamBackground');
      localStorage.removeItem('streamBackgroundName');
      localStorage.removeItem('streamBackgroundAssetId');
      setActiveBackgroundUrl(null);
      window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: null, name: null } }));
      toast.success('Background removed');
    } else {
      // Apply asset based on type
      switch (asset.type) {
        case 'logo':
          // For IndexedDB assets, we need to handle them specially
          if (asset.storedInIndexedDB) {
            try {
              const mediaData = await mediaStorageService.getMedia(asset.id);
              if (mediaData) {
                const objectURL = URL.createObjectURL(mediaData.blob);
                objectURLsRef.current.push(objectURL);

                // Store only the asset ID - don't save URL to localStorage
                localStorage.setItem('streamLogoAssetId', asset.id);
                localStorage.setItem('streamLogoName', asset.name);
                localStorage.removeItem('streamLogo'); // Don't save object URLs
                setActiveLogoUrl(objectURL);
                window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: objectURL, name: asset.name } }));
                toast.success(`Logo applied: ${asset.name}`);
              }
            } catch (error) {
              console.error('Failed to load logo from IndexedDB:', error);
              toast.error('Failed to apply logo');
            }
          } else {
            try {
              localStorage.setItem('streamLogo', asset.url);
              localStorage.setItem('streamLogoName', asset.name);
              localStorage.removeItem('streamLogoAssetId');
              setActiveLogoUrl(asset.url);
              window.dispatchEvent(new CustomEvent('logoUpdated', { detail: { url: asset.url, name: asset.name } }));
              toast.success(`Logo applied: ${asset.name}`);
            } catch (error) {
              console.error('Failed to save logo:', error);
              toast.error('Failed to apply logo - storage full');
            }
          }
          break;

        case 'overlay':
          // Overlays go on top of everything
          if (asset.storedInIndexedDB) {
            try {
              const mediaData = await mediaStorageService.getMedia(asset.id);
              if (mediaData) {
                const objectURL = URL.createObjectURL(mediaData.blob);
                objectURLsRef.current.push(objectURL);

                localStorage.setItem('streamOverlayAssetId', asset.id);
                localStorage.setItem('streamOverlayName', asset.name);
                localStorage.removeItem('streamOverlay'); // Don't save object URLs
                setActiveOverlayUrl(objectURL);
                window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: objectURL, name: asset.name } }));
                toast.success(`Overlay applied: ${asset.name}`);
              }
            } catch (error) {
              console.error('Failed to load overlay from IndexedDB:', error);
              toast.error('Failed to apply overlay');
            }
          } else {
            try {
              localStorage.setItem('streamOverlay', asset.url);
              localStorage.setItem('streamOverlayName', asset.name);
              localStorage.removeItem('streamOverlayAssetId');
              setActiveOverlayUrl(asset.url);
              window.dispatchEvent(new CustomEvent('overlayUpdated', { detail: { url: asset.url, name: asset.name } }));
              toast.success(`Overlay applied: ${asset.name}`);
            } catch (error) {
              console.error('Failed to save overlay:', error);
              toast.error('Failed to apply overlay - storage full');
            }
          }
          break;

        case 'background':
        case 'videoBackground':
          if (asset.storedInIndexedDB) {
            try {
              const mediaData = await mediaStorageService.getMedia(asset.id);
              if (mediaData) {
                const objectURL = URL.createObjectURL(mediaData.blob);
                objectURLsRef.current.push(objectURL);

                localStorage.setItem('streamBackgroundAssetId', asset.id);
                localStorage.setItem('streamBackgroundName', asset.name);
                localStorage.removeItem('streamBackground'); // Don't save object URLs
                setActiveBackgroundUrl(objectURL);
                window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: objectURL, name: asset.name } }));
                toast.success(`Background applied: ${asset.name}`);
              }
            } catch (error) {
              console.error('Failed to load background from IndexedDB:', error);
              toast.error('Failed to apply background');
            }
          } else {
            try {
              localStorage.setItem('streamBackground', asset.url);
              localStorage.setItem('streamBackgroundName', asset.name);
              localStorage.removeItem('streamBackgroundAssetId');
              setActiveBackgroundUrl(asset.url);
              window.dispatchEvent(new CustomEvent('backgroundUpdated', { detail: { url: asset.url, name: asset.name } }));
              toast.success(`Background applied: ${asset.name}`);
            } catch (error) {
              console.error('Failed to save background:', error);
              toast.error('Failed to apply background - storage full');
            }
          }
          break;

        case 'videoClip':
          // Play video clip on canvas
          if (asset.storedInIndexedDB) {
            try {
              const mediaData = await mediaStorageService.getMedia(asset.id);
              if (mediaData) {
                const objectURL = URL.createObjectURL(mediaData.blob);
                objectURLsRef.current.push(objectURL);

                localStorage.setItem('streamVideoClip', objectURL);
                localStorage.setItem('streamVideoClipAssetId', asset.id);
                localStorage.setItem('streamVideoClipName', asset.name);
                window.dispatchEvent(new CustomEvent('videoClipUpdated', { detail: { url: objectURL, name: asset.name } }));
                toast.success(`Playing: ${asset.name}`);
              }
            } catch (error) {
              console.error('Failed to load video clip from IndexedDB:', error);
              toast.error('Failed to play video clip');
            }
          } else {
            localStorage.setItem('streamVideoClip', asset.url);
            localStorage.setItem('streamVideoClipName', asset.name);
            localStorage.removeItem('streamVideoClipAssetId');
            window.dispatchEvent(new CustomEvent('videoClipUpdated', { detail: { url: asset.url, name: asset.name } }));
            toast.success(`Playing: ${asset.name}`);
          }
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
    // Check if this asset is currently active (check both URL and asset ID for IndexedDB assets)
    const logoAssetId = localStorage.getItem('streamLogoAssetId');
    const overlayAssetId = localStorage.getItem('streamOverlayAssetId');
    const backgroundAssetId = localStorage.getItem('streamBackgroundAssetId');

    const isActive = (asset.type === 'logo' && (activeLogoUrl === asset.url || logoAssetId === asset.id)) ||
                     (asset.type === 'overlay' && (activeOverlayUrl === asset.url || overlayAssetId === asset.id)) ||
                     ((asset.type === 'background' || asset.type === 'videoBackground') && (activeBackgroundUrl === asset.url || backgroundAssetId === asset.id));

    return (
      <div
        key={asset.id}
        onClick={() => handleUseAsset(asset)}
        className={`p-3 bg-white rounded-lg hover:shadow-md transition-shadow cursor-pointer group relative ${
          isActive ? 'border-2 border-blue-500' : 'border border-gray-200'
        }`}
      >
        <div className="aspect-video bg-gray-100 rounded mb-2 overflow-hidden relative">
          {asset.thumbnailUrl ? (
            <>
              <img
                src={asset.thumbnailUrl}
                alt={asset.name}
                className="w-full h-full object-cover"
              />
              {/* Video play icon indicator */}
              {(asset.type === 'videoBackground' || asset.type === 'videoClip') && !isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 bg-black bg-opacity-60 rounded-full flex items-center justify-center">
                    <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[10px] border-t-transparent border-b-[10px] border-b-transparent ml-1"></div>
                  </div>
                </div>
              )}
              {/* Stop icon for active videos */}
              {(asset.type === 'videoBackground' || asset.type === 'videoClip') && isActive && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-12 h-12 bg-red-600 bg-opacity-80 rounded-full flex items-center justify-center">
                    <div className="w-4 h-4 bg-white"></div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              {asset.type === 'music' ? '🎵' : (asset.type === 'logo' || asset.type === 'overlay' || asset.type === 'banner') ? '🖼️' : '🎬'}
            </div>
          )}
          {/* Active indicator */}
          {isActive && (
            <div className="absolute top-2 left-2 bg-blue-500 text-white text-xs px-2 py-1 rounded font-medium">
              Active
            </div>
          )}
          {/* Delete button - tiny red X in top-right corner */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleDeleteAsset(asset.id);
            }}
            className="absolute top-2 right-2 w-6 h-6 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center text-sm font-bold opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            ×
          </button>
        </div>
        <p className="text-xs font-medium text-gray-900 truncate">{asset.name}</p>
        {asset.duration && (
          <p className="text-xs text-gray-500">
            {Math.floor(asset.duration / 60)}:{String(Math.floor(asset.duration % 60)).padStart(2, '0')}
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
      <div className="border-b border-gray-200 px-2 py-2">
        <div className="grid grid-cols-3 gap-1">
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
              className={`px-3 py-2 text-xs font-medium border-2 rounded transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-blue-600 bg-blue-50'
                  : 'text-gray-600 border-gray-200 hover:text-gray-900 hover:bg-gray-50 hover:border-gray-300'
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
                Looping video backgrounds (no audio). Recommended size: 1280×720 px. Maximum file size: 2GB.
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
                <div className="text-xs text-gray-500 mt-1">MP4, GIF (&lt;2GB)</div>
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
                Maximum file size: 2GB.
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
