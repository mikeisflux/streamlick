import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Plus, Trash2, Youtube, Twitch, Facebook, Radio } from 'lucide-react';
import { destinationAPI } from '../services/api';

const PLATFORMS = [
  { value: 'YOUTUBE', label: 'YouTube', icon: Youtube, color: 'text-red-500' },
  { value: 'TWITCH', label: 'Twitch', icon: Twitch, color: 'text-purple-500' },
  { value: 'FACEBOOK', label: 'Facebook', icon: Facebook, color: 'text-blue-500' },
  { value: 'CUSTOM_RTMP', label: 'Custom RTMP', icon: Radio, color: 'text-dark-400' },
];

export default function Destinations() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    platform: 'YOUTUBE',
    rtmpUrl: '',
    streamKey: '',
  });

  const { data: destinations = [], isLoading } = useQuery({
    queryKey: ['destinations'],
    queryFn: destinationAPI.list,
  });

  const createMutation = useMutation({
    mutationFn: destinationAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
      setShowModal(false);
      setFormData({ name: '', platform: 'YOUTUBE', rtmpUrl: '', streamKey: '' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: destinationAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['destinations'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate(formData);
  };

  const getPlatformIcon = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform);
    if (!p) return Radio;
    return p.icon;
  };

  const getPlatformColor = (platform: string) => {
    const p = PLATFORMS.find(pl => pl.value === platform);
    return p?.color || 'text-dark-400';
  };

  // Set default RTMP URL based on platform
  const handlePlatformChange = (platform: string) => {
    let rtmpUrl = '';
    switch (platform) {
      case 'YOUTUBE':
        rtmpUrl = 'rtmp://a.rtmp.youtube.com/live2';
        break;
      case 'TWITCH':
        rtmpUrl = 'rtmp://live.twitch.tv/app';
        break;
      case 'FACEBOOK':
        rtmpUrl = 'rtmps://live-api-s.facebook.com:443/rtmp';
        break;
    }
    setFormData({ ...formData, platform, rtmpUrl });
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="border-b border-dark-800 bg-dark-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link to="/dashboard" className="p-2 hover:bg-dark-800 rounded-lg transition">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <h1 className="text-xl font-bold">Stream Destinations</h1>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <p className="text-dark-400">
            Configure where your broadcasts will be streamed
          </p>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            Add Destination
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-dark-400">Loading...</div>
        ) : destinations.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-dark-800 rounded-full flex items-center justify-center">
              <Radio className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">No destinations yet</h3>
            <p className="text-dark-400 mb-6">Add streaming destinations to broadcast to multiple platforms</p>
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
            >
              <Plus className="w-5 h-5" />
              Add Destination
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {destinations.map((dest: any) => {
              const Icon = getPlatformIcon(dest.platform);
              return (
                <div
                  key={dest.id}
                  className="bg-dark-900 rounded-xl border border-dark-800 p-4 flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-3 bg-dark-800 rounded-lg ${getPlatformColor(dest.platform)}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{dest.name}</h3>
                      <p className="text-sm text-dark-400">{dest.platform.replace('_', ' ')}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      if (confirm('Delete this destination?')) {
                        deleteMutation.mutate(dest.id);
                      }
                    }}
                    className="p-2 text-dark-400 hover:text-red-400 transition"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-lg border border-dark-800">
            <h2 className="text-xl font-bold mb-6">Add Destination</h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
                  placeholder="My YouTube Channel"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Platform</label>
                <div className="grid grid-cols-4 gap-2">
                  {PLATFORMS.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.value}
                        type="button"
                        onClick={() => handlePlatformChange(p.value)}
                        className={`p-3 rounded-lg text-center transition ${
                          formData.platform === p.value
                            ? 'bg-brand-600'
                            : 'bg-dark-800 hover:bg-dark-700'
                        }`}
                      >
                        <Icon className={`w-6 h-6 mx-auto mb-1 ${formData.platform === p.value ? 'text-white' : p.color}`} />
                        <div className="text-xs">{p.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">RTMP URL</label>
                <input
                  type="text"
                  value={formData.rtmpUrl}
                  onChange={(e) => setFormData({ ...formData, rtmpUrl: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
                  placeholder="rtmp://..."
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Stream Key</label>
                <input
                  type="password"
                  value={formData.streamKey}
                  onChange={(e) => setFormData({ ...formData, streamKey: e.target.value })}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
                  placeholder="Your stream key"
                  required
                />
                <p className="text-xs text-dark-500 mt-1">
                  Find this in your streaming platform's dashboard
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-3 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending}
                  className="flex-1 py-3 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Adding...' : 'Add Destination'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
