import { useState, useEffect } from 'react';
import { Button } from '../Button';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Destination } from '../../types';

export function DestinationsSettings() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  useEffect(() => {
    loadDestinations();
  }, []);

  const loadDestinations = async () => {
    try {
      const response = await api.get('/destinations');
      setDestinations(response.data);
    } catch (error) {
      toast.error('Failed to load destinations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to remove this destination?')) return;

    try {
      await api.delete(`/destinations/${id}`);
      toast.success('Destination removed');
      loadDestinations();
    } catch (error) {
      toast.error('Failed to remove destination');
    }
  };

  const platformInfo: Record<string, { name: string; icon: string; color: string }> = {
    youtube: { name: 'YouTube', icon: '📺', color: 'bg-red-500' },
    facebook: { name: 'Facebook', icon: '👥', color: 'bg-blue-600' },
    linkedin: { name: 'LinkedIn', icon: '💼', color: 'bg-blue-700' },
    twitch: { name: 'Twitch', icon: '🎮', color: 'bg-purple-600' },
    x: { name: 'X (Twitter)', icon: '𝕏', color: 'bg-black' },
    rumble: { name: 'Rumble', icon: '🎬', color: 'bg-green-600' },
    custom: { name: 'Custom RTMP', icon: '📡', color: 'bg-gray-600' },
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Streaming Destinations</h2>
          <p className="text-gray-600">Connect your streaming platforms</p>
        </div>
        <Button onClick={() => setShowAddModal(true)}>
          + Add Destination
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : destinations.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <svg
            className="mx-auto h-12 w-12 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">No destinations</h3>
          <p className="mt-1 text-sm text-gray-500">
            Get started by adding a streaming destination.
          </p>
          <div className="mt-6">
            <Button onClick={() => setShowAddModal(true)}>
              + Add Destination
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid gap-4">
          {destinations.map((dest) => {
            const info = platformInfo[dest.platform as keyof typeof platformInfo] || platformInfo.custom;
            return (
              <div
                key={dest.id}
                className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 ${info.color} rounded-lg flex items-center justify-center text-2xl`}>
                    {info.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900">
                      {dest.displayName || info.name}
                    </h3>
                    <p className="text-sm text-gray-600">{info.name}</p>
                    {dest.rtmpUrl && (
                      <p className="text-xs text-gray-500 mt-1">{dest.rtmpUrl}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      dest.isActive
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {dest.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => handleDelete(dest.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showAddModal && (
        <AddDestinationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadDestinations();
          }}
        />
      )}
    </div>
  );
}

interface AddDestinationModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddDestinationModal({ onClose, onSuccess }: AddDestinationModalProps) {
  const [platform, setPlatform] = useState<string>('youtube');
  const [displayName, setDisplayName] = useState('');
  const [rtmpUrl, setRtmpUrl] = useState('');
  const [streamKey, setStreamKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const platforms = [
    { id: 'youtube', name: 'YouTube Live', icon: '📺', defaultRtmp: 'rtmp://a.rtmp.youtube.com/live2' },
    { id: 'facebook', name: 'Facebook Live', icon: '👥', defaultRtmp: 'rtmps://live-api-s.facebook.com:443/rtmp' },
    { id: 'linkedin', name: 'LinkedIn Live', icon: '💼', defaultRtmp: '' },
    { id: 'twitch', name: 'Twitch', icon: '🎮', defaultRtmp: 'rtmp://live.twitch.tv/app' },
    { id: 'x', name: 'X (Twitter)', icon: '𝕏', defaultRtmp: 'rtmp://fa.contribute.live-video.net/app' },
    { id: 'rumble', name: 'Rumble', icon: '🎬', defaultRtmp: 'rtmp://d.rumble.com/live' },
    { id: 'custom', name: 'Custom RTMP', icon: '📡', defaultRtmp: '' },
  ];

  const selectedPlatform = platforms.find((p) => p.id === platform);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await api.post('/destinations', {
        platform,
        displayName: displayName || selectedPlatform?.name,
        rtmpUrl: rtmpUrl || selectedPlatform?.defaultRtmp,
        streamKey,
      });
      toast.success('Destination added successfully');
      onSuccess();
    } catch (error) {
      toast.error('Failed to add destination');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-gray-900">Add Destination</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Platform
            </label>
            <div className="grid grid-cols-2 gap-2">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlatform(p.id);
                    setRtmpUrl(p.defaultRtmp);
                  }}
                  className={`p-3 border-2 rounded-lg text-left transition-colors ${
                    platform === p.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-2xl mb-1">{p.icon}</div>
                  <div className="text-sm font-medium text-gray-900">{p.name}</div>
                </button>
              ))}
            </div>
            {platform === 'custom' && (
              <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">
                  <strong>Custom RTMP:</strong> Connect to any streaming service that supports RTMP protocol.
                  Examples: Restream.io, Castr, Dacast, Wowza, or your own RTMP server.
                </p>
              </div>
            )}
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name (optional)
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={selectedPlatform?.name}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* RTMP URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              RTMP URL
            </label>
            <input
              type="text"
              value={rtmpUrl}
              onChange={(e) => setRtmpUrl(e.target.value)}
              placeholder={
                platform === 'custom'
                  ? 'rtmp://your-server.com/live or rtmps://...'
                  : 'rtmp://...'
              }
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {platform === 'custom' && (
              <p className="text-xs text-gray-600 mt-1">
                Enter the RTMP server URL provided by your streaming service (e.g., rtmp://live.example.com/app)
              </p>
            )}
          </div>

          {/* Stream Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Stream Key
            </label>
            <input
              type="password"
              value={streamKey}
              onChange={(e) => setStreamKey(e.target.value)}
              placeholder={platform === 'custom' ? 'Your stream key or path' : 'Your stream key'}
              required
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-600 mt-1">
              {platform === 'custom'
                ? 'Stream key, path, or authentication token provided by your service'
                : "Find this in your platform's streaming settings (kept secure and encrypted)"}
            </p>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="flex-1"
            >
              {isLoading ? 'Adding...' : 'Add Destination'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
