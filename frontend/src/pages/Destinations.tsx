import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import api from '../services/api';
import toast from 'react-hot-toast';
import { Destination } from '../types';

// Platform icons as SVG components
const PlatformIcons: Record<string, JSX.Element> = {
  youtube: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
    </svg>
  ),
  twitch: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z"/>
    </svg>
  ),
  facebook: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  ),
  x: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  ),
  linkedin: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
    </svg>
  ),
  rumble: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm4.5 12.75l-6 4.5c-.5.375-1.25.031-1.25-.563V7.313c0-.594.75-.938 1.25-.563l6 4.5c.417.313.417.938 0 1.25z"/>
    </svg>
  ),
  custom: (
    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
    </svg>
  ),
};

const platformInfo: Record<string, { name: string; description: string; color: string; bgColor: string }> = {
  youtube: { name: 'YouTube', description: 'YouTube and YouTube Shorts', color: 'text-white', bgColor: 'bg-red-600' },
  twitch: { name: 'Twitch', description: 'Twitch', color: 'text-white', bgColor: 'bg-purple-600' },
  facebook: { name: 'Facebook', description: 'Facebook Live', color: 'text-white', bgColor: 'bg-blue-600' },
  x: { name: 'X', description: 'X (Twitter)', color: 'text-white', bgColor: 'bg-black' },
  linkedin: { name: 'LinkedIn', description: 'LinkedIn Live', color: 'text-white', bgColor: 'bg-blue-700' },
  rumble: { name: 'Rumble', description: 'Other platforms', color: 'text-white', bgColor: 'bg-green-600' },
  custom: { name: 'Custom', description: 'Custom RTMP', color: 'text-white', bgColor: 'bg-gray-600' },
};

export function Destinations() {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

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
      setMenuOpen(null);
      loadDestinations();
    } catch (error) {
      toast.error('Failed to remove destination');
    }
  };

  const handleReconnect = async (dest: Destination) => {
    // For OAuth platforms, redirect to OAuth flow
    const oauthPlatforms = ['youtube', 'twitch', 'facebook', 'x', 'linkedin'];
    if (oauthPlatforms.includes(dest.platform)) {
      toast('Redirecting to reconnect...', { icon: '🔄' });
      // This would typically redirect to an OAuth flow
      window.location.href = `/api/auth/${dest.platform}/connect`;
    } else {
      toast.error('Please remove and re-add this destination');
    }
    setMenuOpen(null);
  };

  // Check if any destinations need reconnection (simplified check)
  const disconnectedDestinations = destinations.filter(d => !d.isActive);

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Destinations</h1>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
          >
            Add a destination
          </button>
        </div>

        {/* Disconnected Warning Banner */}
        {disconnectedDestinations.length > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-yellow-600 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <p className="text-sm text-yellow-800">
                  Streamlick has lost access to your {disconnectedDestinations[0].displayName || disconnectedDestinations[0].platform} account ({disconnectedDestinations[0].displayName}). Don't worry, we've got you covered!{' '}
                  <button
                    onClick={() => handleReconnect(disconnectedDestinations[0])}
                    className="text-primary-600 hover:text-primary-700 font-medium underline"
                  >
                    Click here to reconnect your destination.
                  </button>
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Destinations List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : destinations.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No destinations yet</h3>
            <p className="text-gray-500 mb-6">
              Connect your streaming platforms to go live.
            </p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Add a destination
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="px-6 py-3 border-b border-gray-200 bg-gray-50">
              <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Name</span>
            </div>

            {/* Destination Rows */}
            {destinations.map((dest) => {
              const info = platformInfo[dest.platform] || platformInfo.custom;
              const Icon = PlatformIcons[dest.platform] || PlatformIcons.custom;

              return (
                <div
                  key={dest.id}
                  className="flex items-center justify-between px-6 py-4 border-b border-gray-100 hover:bg-gray-50 last:border-b-0"
                >
                  <div className="flex items-center gap-4">
                    {/* Avatar with platform badge */}
                    <div className="relative">
                      <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center overflow-hidden">
                        <span className="text-lg font-medium text-gray-600">
                          {(dest.displayName || dest.platform)[0].toUpperCase()}
                        </span>
                      </div>
                      {/* Platform badge */}
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 ${info.bgColor} rounded-full flex items-center justify-center ${info.color}`}>
                        {Icon}
                      </div>
                    </div>

                    {/* Account info */}
                    <div>
                      <div className="font-medium text-gray-900">
                        {dest.displayName || info.name}
                      </div>
                      <div className="text-sm text-gray-500">{info.description}</div>
                    </div>
                  </div>

                  {/* Actions menu */}
                  <div className="relative">
                    <button
                      onClick={() => setMenuOpen(menuOpen === dest.id ? null : dest.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="6" r="2" />
                        <circle cx="12" cy="12" r="2" />
                        <circle cx="12" cy="18" r="2" />
                      </svg>
                    </button>

                    {/* Dropdown menu */}
                    {menuOpen === dest.id && (
                      <>
                        <div
                          className="fixed inset-0 z-10"
                          onClick={() => setMenuOpen(null)}
                        />
                        <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                          {!dest.isActive && (
                            <button
                              onClick={() => handleReconnect(dest)}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Reconnect
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(dest.id)}
                            className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Remove
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Destination Modal */}
      {showAddModal && (
        <AddDestinationModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadDestinations();
          }}
        />
      )}
    </DashboardLayout>
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
    { id: 'youtube', name: 'YouTube Live', icon: PlatformIcons.youtube, defaultRtmp: 'rtmp://a.rtmp.youtube.com/live2', color: 'bg-red-600' },
    { id: 'twitch', name: 'Twitch', icon: PlatformIcons.twitch, defaultRtmp: 'rtmp://live.twitch.tv/app', color: 'bg-purple-600' },
    { id: 'facebook', name: 'Facebook Live', icon: PlatformIcons.facebook, defaultRtmp: 'rtmps://live-api-s.facebook.com:443/rtmp', color: 'bg-blue-600' },
    { id: 'x', name: 'X (Twitter)', icon: PlatformIcons.x, defaultRtmp: 'rtmp://fa.contribute.live-video.net/app', color: 'bg-black' },
    { id: 'linkedin', name: 'LinkedIn Live', icon: PlatformIcons.linkedin, defaultRtmp: '', color: 'bg-blue-700' },
    { id: 'rumble', name: 'Rumble', icon: PlatformIcons.rumble, defaultRtmp: 'rtmp://d.rumble.com/live', color: 'bg-green-600' },
    { id: 'custom', name: 'Custom RTMP', icon: PlatformIcons.custom, defaultRtmp: '', color: 'bg-gray-600' },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Add a destination</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Platform Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select Platform
            </label>
            <div className="grid grid-cols-2 gap-3">
              {platforms.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setPlatform(p.id);
                    setRtmpUrl(p.defaultRtmp);
                  }}
                  className={`flex items-center gap-3 p-4 border-2 rounded-lg text-left transition-all ${
                    platform === p.id
                      ? 'border-primary-600 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className={`w-10 h-10 ${p.color} rounded-lg flex items-center justify-center text-white`}>
                    {p.icon}
                  </div>
                  <span className="font-medium text-gray-900">{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Display Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={selectedPlatform?.name}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
              placeholder="rtmp://..."
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
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
              placeholder="Your stream key"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
            <p className="text-xs text-gray-500 mt-2">
              Find this in your platform's streaming settings. Your key is encrypted and stored securely.
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Adding...' : 'Add destination'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
