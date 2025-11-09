import { useState } from 'react';
import {
  VideoCameraIcon,
  CheckCircleIcon,
  XCircleIcon,
  PlusIcon,
  EyeIcon,
} from '@heroicons/react/24/outline';

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

export function DestinationsPanel({ broadcastId }: DestinationsPanelProps) {
  const [destinations, setDestinations] = useState<StreamDestination[]>([
    {
      id: '1',
      name: 'YouTube',
      platform: 'youtube',
      enabled: false,
      connected: false,
      viewerCount: 0,
    },
    {
      id: '2',
      name: 'Facebook Live',
      platform: 'facebook',
      enabled: false,
      connected: false,
      viewerCount: 0,
    },
    {
      id: '3',
      name: 'LinkedIn Live',
      platform: 'linkedin',
      enabled: false,
      connected: false,
      viewerCount: 0,
    },
    {
      id: '4',
      name: 'Twitch',
      platform: 'twitch',
      enabled: false,
      connected: false,
      viewerCount: 0,
    },
  ]);

  const [showCustomRtmp, setShowCustomRtmp] = useState(false);
  const [customRtmpUrl, setCustomRtmpUrl] = useState('');
  const [customStreamKey, setCustomStreamKey] = useState('');

  const toggleDestination = (id: string) => {
    setDestinations((prev) =>
      prev.map((dest) =>
        dest.id === id ? { ...dest, enabled: !dest.enabled } : dest
      )
    );
  };

  const addCustomRtmp = () => {
    if (!customRtmpUrl || !customStreamKey) {
      return;
    }

    const newDestination: StreamDestination = {
      id: `custom-${Date.now()}`,
      name: 'Custom RTMP',
      platform: 'custom',
      enabled: true,
      connected: false,
      viewerCount: 0,
      rtmpUrl: customRtmpUrl,
      streamKey: customStreamKey,
    };

    setDestinations((prev) => [...prev, newDestination]);
    setShowCustomRtmp(false);
    setCustomRtmpUrl('');
    setCustomStreamKey('');
  };

  const removeDestination = (id: string) => {
    setDestinations((prev) => prev.filter((dest) => dest.id !== id));
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
    // TODO: Implement actual platform OAuth/connection flow
    console.log('Connecting to destination:', id);
    setDestinations((prev) =>
      prev.map((dest) =>
        dest.id === id ? { ...dest, connected: true } : dest
      )
    );
  };

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          Stream Destinations
        </h3>
        <p className="text-sm text-gray-600">
          Select where you want to stream. {broadcastId ? `Broadcast: ${broadcastId}` : ''}
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
                  className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                />

                {/* Platform Icon */}
                {getPlatformIcon(dest.platform)}

                {/* Platform Name */}
                <span className="font-medium text-gray-900">{dest.name}</span>
              </div>

              {/* Connection Status */}
              <div className="flex items-center space-x-2">
                {dest.enabled && !dest.connected && (
                  <button
                    onClick={() => connectDestination(dest.id)}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                  >
                    Connect
                  </button>
                )}
                {dest.connected ? (
                  <CheckCircleIcon className="w-5 h-5 text-green-600" />
                ) : dest.enabled ? (
                  <XCircleIcon className="w-5 h-5 text-gray-400" />
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
                <div className="truncate">Key: {dest.streamKey?.substring(0, 20)}...</div>
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
