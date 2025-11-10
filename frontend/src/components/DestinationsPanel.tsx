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
  platform: 'youtube' | 'facebook' | 'linkedin' | 'twitch' | 'custom';
  enabled: boolean;
  connected: boolean;
  viewerCount: number;
  streamKey?: string;
  rtmpUrl?: string;
}

interface DestinationsPanelProps {
  broadcastId?: string;
}

// Available platforms that can be connected
const AVAILABLE_PLATFORMS = [
  { platform: 'youtube', name: 'YouTube' },
  { platform: 'facebook', name: 'Facebook Live' },
  { platform: 'linkedin', name: 'LinkedIn Live' },
  { platform: 'twitch', name: 'Twitch' },
];

export function DestinationsPanel({ broadcastId }: DestinationsPanelProps) {
  const [destinations, setDestinations] = useState<StreamDestination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCustomRtmp, setShowCustomRtmp] = useState(false);
  const [customRtmpUrl, setCustomRtmpUrl] = useState('');
  const [customStreamKey, setCustomStreamKey] = useState('');

  // Load user's connected destinations
  useEffect(() => {
    loadDestinations();
  }, []);

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
          enabled: connected?.isActive || false,
          connected: !!connected,
          viewerCount: 0,
          rtmpUrl: connected?.rtmpUrl,
        };
      });

      // Add custom RTMP destinations
      const customDestinations = connectedDestinations
        .filter((d: any) => d.platform === 'custom')
        .map((d: any) => ({
          id: d.id,
          name: d.displayName || 'Custom RTMP',
          platform: 'custom' as any,
          enabled: d.isActive,
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
      })));
    } finally {
      setLoading(false);
    }
  };

  const toggleDestination = async (id: string) => {
    const destination = destinations.find(d => d.id === id);
    if (!destination || !destination.connected) {
      // If not connected, just toggle locally
      setDestinations((prev) =>
        prev.map((dest) =>
          dest.id === id ? { ...dest, enabled: !dest.enabled } : dest
        )
      );
      return;
    }

    try {
      // Update on backend
      await api.patch(`/destinations/${id}`, {
        isActive: !destination.enabled,
      });

      setDestinations((prev) =>
        prev.map((dest) =>
          dest.id === id ? { ...dest, enabled: !dest.enabled } : dest
        )
      );
    } catch (error) {
      console.error('Failed to toggle destination:', error);
      alert('Failed to update destination status');
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
      case 'custom':
        return <VideoCameraIcon className={`${iconClass} text-gray-600`} />;
      default:
        return <VideoCameraIcon className={iconClass} />;
    }
  };

  const connectDestination = async (id: string) => {
    const destination = destinations.find(d => d.id === id);
    if (!destination) return;

    try {
      // Call OAuth authorize endpoint
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

        // Poll for popup close or success
        const pollTimer = setInterval(() => {
          if (popup?.closed) {
            clearInterval(pollTimer);
            // Reload destinations after OAuth completes
            loadDestinations();
          }
        }, 500);
      }
    } catch (error) {
      console.error('OAuth error:', error);
      alert(`Failed to connect to ${destination.name}. Please try again.`);
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
                  disabled={!dest.connected && dest.platform !== 'custom'}
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500 disabled:opacity-50"
                />

                {/* Platform Icon */}
                {getPlatformIcon(dest.platform)}

                {/* Platform Name */}
                <span className="font-medium text-gray-900">{dest.name}</span>
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {!dest.connected && dest.platform !== 'custom' && (
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
              <div className="flex items-center justify-between ml-8 mt-2">
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
    </div>
  );
}
