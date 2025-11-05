import { useState, useEffect } from 'react';
import { Button } from '../Button';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Asset {
  id: string;
  type: string;
  name: string;
  fileUrl: string;
  createdAt: string;
}

export function BrandingSettings() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [uploadType, setUploadType] = useState<'logo' | 'overlay' | 'background'>('logo');
  const [showUploadModal, setShowUploadModal] = useState(false);

  useEffect(() => {
    loadAssets();
  }, []);

  const loadAssets = async () => {
    try {
      const response = await api.get('/assets');
      setAssets(response.data);
    } catch (error) {
      toast.error('Failed to load assets');
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

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Branding & Assets</h2>
        <p className="text-gray-600">Upload logos, overlays, and backgrounds for your streams</p>
      </div>

      {/* Logos Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Logos</h3>
          <Button
            size="sm"
            onClick={() => {
              setUploadType('logo');
              setShowUploadModal(true);
            }}
          >
            + Upload Logo
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filterByType('logo').map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
          ))}
          {filterByType('logo').length === 0 && (
            <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No logos uploaded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Overlays Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Overlays</h3>
          <Button
            size="sm"
            onClick={() => {
              setUploadType('overlay');
              setShowUploadModal(true);
            }}
          >
            + Upload Overlay
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filterByType('overlay').map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
          ))}
          {filterByType('overlay').length === 0 && (
            <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No overlays uploaded yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Backgrounds Section */}
      <div>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Backgrounds</h3>
          <Button
            size="sm"
            onClick={() => {
              setUploadType('background');
              setShowUploadModal(true);
            }}
          >
            + Upload Background
          </Button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {filterByType('background').map((asset) => (
            <AssetCard key={asset.id} asset={asset} onDelete={handleDelete} />
          ))}
          {filterByType('background').length === 0 && (
            <div className="col-span-full text-center py-8 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No backgrounds uploaded yet</p>
            </div>
          )}
        </div>
      </div>

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
  return (
    <div className="relative group">
      <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden">
        <img
          src={asset.fileUrl}
          alt={asset.name}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="mt-2">
        <p className="text-sm font-medium text-gray-900 truncate">{asset.name}</p>
      </div>
      <button
        onClick={() => onDelete(asset.id)}
        className="absolute top-2 right-2 bg-red-600 text-white p-2 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
      >
        🗑️
      </button>
    </div>
  );
}

interface UploadAssetModalProps {
  type: 'logo' | 'overlay' | 'background';
  onClose: () => void;
  onSuccess: () => void;
}

function UploadAssetModal({ type, onClose, onSuccess }: UploadAssetModalProps) {
  const [name, setName] = useState('');
  const [fileUrl, setFileUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      // In production, upload to S3 first, then save URL
      // For now, we'll just use the URL directly
      await api.post('/assets/upload', {
        type,
        name: name || file?.name || 'Untitled',
        fileUrl: fileUrl || (file ? URL.createObjectURL(file) : ''),
        mimeType: file?.type,
        fileSizeBytes: file?.size,
      });
      toast.success(`${type} uploaded successfully`);
      onSuccess();
    } catch (error) {
      toast.error(`Failed to upload ${type}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900 capitalize">Upload {type}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`My ${type}`}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Method
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="uploadMethod"
                  value="file"
                  defaultChecked
                  className="text-primary-600"
                />
                <span>Upload File</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="uploadMethod"
                  value="url"
                  className="text-primary-600"
                />
                <span>Use URL</span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              File or URL
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg"
            />
            <p className="text-xs text-gray-500 mt-1">Or</p>
            <input
              type="url"
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              placeholder="https://example.com/image.png"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent mt-2"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button type="button" variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading || (!file && !fileUrl)} className="flex-1">
              {isLoading ? 'Uploading...' : 'Upload'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
