import { useState, useEffect } from 'react';
import {
  VideoCameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';
import api from '../services/api';

interface StreamDestination {
  id: string;
  name: string;
  platform: 'youtube' | 'facebook' | 'linkedin' | 'twitch' | 'x' | 'rumble' | 'custom';
  enabled: boolean;
  connected: boolean;
  viewerCount: number;
  streamKey?: string;
  rtmpUrl?: string;
  comingSoon?: boolean;
  privacyStatus?: 'public' | 'unlisted' | 'private' | 'members_only';
  scheduledStartTime?: string;
}

interface DestinationsPanelProps {
  broadcastId?: string;
  selectedDestinations?: string[];
  onSelectionChange?: (selectedIds: string[]) => void;
  onSettingsChange?: (settings: { privacy: Record<string, string>; schedule: Record<string, string>; title: Record<string, string>; description: Record<string, string> }) => void;
}

// Available platforms that can be connected
const AVAILABLE_PLATFORMS = [
  { platform: 'youtube', name: 'YouTube', comingSoon: false },
  { platform: 'facebook', name: 'Facebook Live', comingSoon: false },
  { platform: 'twitch', name: 'Twitch', comingSoon: false },
  { platform: 'x', name: 'X (Twitter)', comingSoon: false },
  { platform: 'rumble', name: 'Rumble', comingSoon: false }, // NOW AVAILABLE!
  { platform: 'linkedin', name: 'LinkedIn Live', comingSoon: true },
];

export function DestinationsPanel({
  broadcastId,
  selectedDestinations = [],
  onSelectionChange,
  onSettingsChange
}: DestinationsPanelProps) {
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomRtmp, setShowCustomRtmp] = useState(false);
  const [customRtmpUrl, setCustomRtmpUrl] = useState('');
  const [customStreamKey, setCustomStreamKey] = useState('');
  const [showRumbleModal, setShowRumbleModal] = useState(false);
  const [rumbleApiKey, setRumbleApiKey] = useState('');
  const [rumbleChannelUrl, setRumbleChannelUrl] = useState('');
  // Track privacy and scheduling settings per destination
  const [privacySettings, setPrivacySettings] = useState<Record<string, string>>({});
  const [scheduleSettings, setScheduleSettings] = useState<Record<string, string>>({});
  const [titleSettings, setTitleSettings] = useState<Record<string, string>>({});
  const [descriptionSettings, setDescriptionSettings] = useState<Record<string, string>>({});

  // Notify parent of settings changes
  useEffect(() => {
    if (onSettingsChange) {
      onSettingsChange({ privacy: privacySettings, schedule: scheduleSettings, title: titleSettings, description: descriptionSettings });
    }
  }, [privacySettings, scheduleSettings, titleSettings, descriptionSettings, onSettingsChange]);

  // Load user's connected destinations
  useEffect(() => {
    loadDestinations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDestinations]); // Reload when selection changes to update UI

  const loadDestinations = async () => {
    try {
      const response = await api.get('/destinations');
      const connectedDestinations = response.data;

      // Merge with available platforms
      const merged = AVAILABLE_PLATFORMS.map(available => {
        const connected = connectedDestinations.find(
          (d: any) => d.platform === available.platform
        );

        return {
          id: connected?.id || available.platform,
          name: connected?.displayName || available.name,
          platform: available.platform as any,
          enabled: connected ? selectedDestinations.includes(connected.id) : false,
          connected: !!connected,
          viewerCount: 0,
          rtmpUrl: connected?.rtmpUrl,
          comingSoon: available.comingSoon,
          privacyStatus: (privacySettings[connected?.id || ''] as any) || 'public',
          scheduledStartTime: scheduleSettings[connected?.id || ''],
        };
      });

      // Add custom RTMP destinations
      const customDestinations = connectedDestinations
        .filter((d: any) => d.platform === 'custom')
        .map((d: any) => ({
          id: d.id,
          name: d.displayName || 'Custom RTMP',
          platform: 'custom' as any,
          enabled: selectedDestinations.includes(d.id),
          connected: true,
          viewerCount: 0,
          rtmpUrl: d.rtmpUrl,
        }));

      setDestinations([...merged, ...customDestinations]);
    } catch (error) {
      console.error('Failed to load destinations:', error);
      // Show default platforms even if API fails
      setDestinations(AVAILABLE_PLATFORMS.map(p => ({
        id: p.platform,
        name: p.name,
        platform: p.platform as any,
        enabled: false,
        connected: false,
        viewerCount: 0,
        comingSoon: p.comingSoon,
      })));
    } finally {
      setLoading(false);
    }
  };

  const toggleDestination = async (id: string) => {
    const destination = destinations.find(d => d.id === id);
    if (!destination?.connected) {
      return; // Can only select connected destinations
    }

    // Update selection via callback
    if (onSelectionChange) {
      const isCurrentlySelected = selectedDestinations.includes(id);
      const newSelection = isCurrentlySelected
        ? selectedDestinations.filter(destId => destId !== id)
        : [...selectedDestinations, id];
      onSelectionChange(newSelection);
    } else {
      // Fallback to local state if no callback provided
      setDestinations((prev) =>
        prev.map((dest) =>
          dest.id === id ? { ...dest, enabled: !dest.enabled } : dest
        )
      );
    }
  };

  const addCustomRtmp = async () => {
    if (!customRtmpUrl || !customStreamKey) {
      return;
    }

    try {
      const response = await api.post('/destinations', {
        platform: 'custom',
        displayName: 'Custom RTMP',
        rtmpUrl: customRtmpUrl,
        streamKey: customStreamKey,
      });

      const newDestination: StreamDestination = {
        id: response.data.id,
        name: response.data.displayName,
        platform: 'custom',
        enabled: true,
        connected: true,
        viewerCount: 0,
        rtmpUrl: response.data.rtmpUrl,
      };

      setDestinations((prev) => [...prev, newDestination]);
      setShowCustomRtmp(false);
      setCustomRtmpUrl('');
      setCustomStreamKey('');
    } catch (error) {
      console.error('Failed to add custom RTMP:', error);
      alert('Failed to add custom RTMP destination');
    }
  };

  const removeDestination = async (id: string) => {
    try {
      await api.delete(`/destinations/${id}`);
      setDestinations((prev) => prev.filter((dest) => dest.id !== id));
    } catch (error) {
      console.error('Failed to remove destination:', error);
      alert('Failed to remove destination');
    }
  };

  const getPlatformIcon = (platform: string) => {
    const iconClass = 'w-6 h-6';
    switch (platform) {
      case 'youtube':
        return <VideoCameraIcon className={`${iconClass} text-red-600`} />;
      case 'facebook':
        return <VideoCameraIcon className={`${iconClass} text-blue-600`} />;
      case 'linkedin':
        return <VideoCameraIcon className={`${iconClass} text-blue-700`} />;
      case 'twitch':
        return <VideoCameraIcon className={`${iconClass} text-purple-600`} />;
      case 'x':
        return <VideoCameraIcon className={`${iconClass} text-black`} />;
      case 'rumble':
        return <VideoCameraIcon className={`${iconClass} text-green-600`} />;
      case 'custom':
        return <VideoCameraIcon className={`${iconClass} text-gray-600`} />;
      default:
        return <VideoCameraIcon className={iconClass} />;
    }
  };

  const connectDestination = async (id: string) => {
    const destination = destinations.find(d => d.id === id);
    if (!destination) return;

    // Rumble uses API key authentication, not OAuth
    if (destination.platform === 'rumble') {
      setShowRumbleModal(true);
      return;
    }

    try {
      // Call OAuth authorize endpoint for other platforms
      const response = await api.get(`/oauth/${destination.platform}/authorize`);

      if (response.data.url) {
        // Open OAuth window
        const width = 600;
        const height = 700;
        const left = window.screenX + (window.outerWidth - width) / 2;
        const top = window.screenY + (window.outerHeight - height) / 2;

        const popup = window.open(
          response.data.url,
          `${destination.platform}_oauth`,
          `width=${width},height=${height},left=${left},top=${top}`
        );

        // Listen for postMessage from OAuth callback
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'oauth-success' && event.data?.platform === destination.platform) {
            popup?.close();
            loadDestinations();
            window.removeEventListener('message', handleMessage);
          }
        };
        window.addEventListener('message', handleMessage);

        // Poll for popup close (with try-catch for COOP errors)
        const pollTimer = setInterval(() => {
          try {
            if (popup?.closed) {
              clearInterval(pollTimer);
              window.removeEventListener('message', handleMessage);
              // Reload destinations after OAuth completes
              loadDestinations();
            }
          } catch (error) {
            // Cross-Origin-Opener-Policy blocks window.closed check
            // This is expected when popup navigates to OAuth provider
            // We rely on postMessage instead
          }
        }, 500);

        // Cleanup after 5 minutes if popup somehow stays open
        setTimeout(() => {
          clearInterval(pollTimer);
          window.removeEventListener('message', handleMessage);
          popup?.close();
          loadDestinations();
        }, 5 * 60 * 1000);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      alert(`Failed to connect to ${destination.name}. Please try again.`);
    }
  };

  const connectRumble = async () => {
    if (!rumbleApiKey || !rumbleChannelUrl) {
      alert('Please enter both API key and channel URL');
      return;
    }

    try {
      await api.post('/oauth/rumble/setup', {
        apiKey: rumbleApiKey,
        channelUrl: rumbleChannelUrl,
      });

      // Close modal and reset fields
      setShowRumbleModal(false);
      setRumbleApiKey('');
      setRumbleChannelUrl('');

      // Reload destinations
      loadDestinations();
      alert('Rumble connected successfully!');
    } catch (error: any) {
      console.error('Rumble setup error:', error);
      const errorMessage = error.response?.data?.error || 'Failed to connect to Rumble. Please check your API key and try again.';
      alert(errorMessage);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-4 bg-gray-200 rounded w-1/3"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
          <div className="h-20 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Stream Destinations
        </h3>
        <p className="text-sm text-gray-600">
          Connect and select where you want to stream. {broadcastId ? `Broadcast: ${broadcastId}` : ''}
        </p>
      </div>

      {/* Destinations List */}
      <div className="space-y-3">
        {destinations.map((dest) => (
          <div
            key={dest.id}
            className={`p-4 rounded-lg border-2 transition-all ${
              dest.enabled
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 bg-white'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={dest.enabled}
                  onChange={() => toggleDestination(dest.id)}
                  disabled={dest.comingSoon || (!dest.connected && dest.platform !== 'custom')}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                />

                {/* Platform Icon */}
                <div className={dest.comingSoon ? 'opacity-50' : ''}>
                  {getPlatformIcon(dest.platform)}
                </div>

                {/* Platform Name */}
                <span className={`font-medium ${dest.comingSoon ? 'line-through text-gray-400' : 'text-gray-900'}`}>
                  {dest.name}
                </span>

                {/* Coming Soon Badge */}
                {dest.comingSoon && (
                  <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 rounded-full">
                    Coming Soon
                  </span>
                )}
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {!dest.comingSoon && !dest.connected && dest.platform !== 'custom' && (
                  <button
                    onClick={() => connectDestination(dest.id)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Connect
                  </button>
                )}
                {dest.connected ? (
                  <div className="flex items-center space-x-1">
                    <CheckCircleIcon className="w-5 h-5 text-green-600" />
                    <span className="text-xs text-green-600">Connected</span>
                  </div>
                ) : null}
              </div>
            </div>

            {/* Viewer Count and Remove Button */}
            {dest.enabled && (
              <div className="ml-8 mt-2 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 text-sm text-gray-600">
                    <EyeIcon className="w-4 h-4" />
                    <span>{dest.viewerCount} viewers</span>
                  </div>
                  {dest.platform === 'custom' && (
                    <button
                      onClick={() => removeDestination(dest.id)}
                      className="text-sm text-red-600 hover:text-red-700"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {/* Title (Required for YouTube, Facebook, X) */}
                {(dest.platform === 'youtube' || dest.platform === 'facebook' || dest.platform === 'x') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter stream title"
                      value={titleSettings[dest.id] || ''}
                      onChange={(e) => setTitleSettings({ ...titleSettings, [dest.id]: e.target.value })}
                    />
                    <p className="text-xs text-gray-500">
                      Required by {dest.platform === 'youtube' ? 'YouTube' : dest.platform === 'facebook' ? 'Facebook' : 'X'}
                    </p>
                  </div>
                )}

                {/* Description (Required for YouTube, Facebook) */}
                {(dest.platform === 'youtube' || dest.platform === 'facebook') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Description
                    </label>
                    <textarea
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Enter stream description (optional)"
                      rows={3}
                      value={descriptionSettings[dest.id] || ''}
                      onChange={(e) => setDescriptionSettings({ ...descriptionSettings, [dest.id]: e.target.value })}
                    />
                  </div>
                )}

                {/* Privacy Settings (YouTube & Facebook only) */}
                {(dest.platform === 'youtube' || dest.platform === 'facebook') && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      Privacy
                    </label>
                    <select
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      value={privacySettings[dest.id] || 'public'}
                      onChange={(e) => setPrivacySettings({ ...privacySettings, [dest.id]: e.target.value })}
                    >
                      <option value="public">Public</option>
                      <option value="unlisted">Unlisted</option>
                      <option value="private">Private</option>
                      {dest.platform === 'youtube' && (
                        <option value="members_only">Members Only</option>
                      )}
                    </select>
                    <p className="text-xs text-gray-500">
                      {dest.platform === 'youtube'
                        ? 'Public: Anyone can watch | Unlisted: Only with link | Private: Only you | Members Only: Channel members only'
                        : 'Public: Anyone can watch | Unlisted: Only with link | Private: Only you'}
                    </p>
                  </div>
                )}

                {/* Scheduled Start Time */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Schedule Stream (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min={new Date().toISOString().slice(0, 16)}
                    value={scheduleSettings[dest.id] || ''}
                    onChange={(e) => setScheduleSettings({ ...scheduleSettings, [dest.id]: e.target.value })}
                  />
                  <p className="text-xs text-gray-500">
                    Leave empty to start immediately when you go live
                  </p>
                </div>
              </div>
            )}

            {/* Custom RTMP Details */}
            {dest.platform === 'custom' && dest.enabled && (
              <div className="ml-8 mt-2 space-y-1 text-xs text-gray-500">
                <div className="truncate">URL: {dest.rtmpUrl}</div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Custom RTMP */}
      {!showCustomRtmp ? (
        <button
          onClick={() => setShowCustomRtmp(true)}
          className="w-full mt-4 py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center space-x-2"
        >
          <PlusIcon className="w-5 h-5" />
          <span className="font-medium">Add Custom RTMP Destination</span>
        </button>
      ) : (
        <div className="mt-4 p-4 border-2 border-blue-500 rounded-lg bg-blue-50 space-y-3">
          <h4 className="font-medium text-gray-900">Custom RTMP Destination</h4>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              RTMP URL
            </label>
            <input
              type="text"
              value={customRtmpUrl}
              onChange={(e) => setCustomRtmpUrl(e.target.value)}
              placeholder="rtmp://live.example.com/live"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Stream Key
            </label>
            <input
              type="password"
              value={customStreamKey}
              onChange={(e) => setCustomStreamKey(e.target.value)}
              placeholder="Your stream key"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          <div className="flex space-x-2">
            <button
              onClick={addCustomRtmp}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Destination
            </button>
            <button
              onClick={() => {
                setShowCustomRtmp(false);
                setCustomRtmpUrl('');
                setCustomStreamKey('');
              }}
              className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Info Text */}
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-sm text-yellow-800">
          <strong>Note:</strong> Multi-streaming to 3+ destinations is available on paid plans.
          Free plan limited to 1 destination.
        </p>
      </div>

      {/* Rumble API Key Modal */}
      {showRumbleModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Connect to Rumble
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  API Key
                </label>
                <input
                  type="text"
                  value={rumbleApiKey}
                  onChange={(e) => setRumbleApiKey(e.target.value)}
                  placeholder="Enter your Rumble API key"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Get your API key from Rumble settings
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Channel URL
                </label>
                <input
                  type="text"
                  value={rumbleChannelUrl}
                  onChange={(e) => setRumbleChannelUrl(e.target.value)}
                  placeholder="https://rumble.com/c/yourchannel"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Your Rumble channel URL
                </p>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={connectRumble}
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                >
                  Connect
                </button>
                <button
                  onClick={() => {
                    setShowRumbleModal(false);
                    setRumbleApiKey('');
                    setRumbleChannelUrl('');
                  }}
                  className="flex-1 px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
