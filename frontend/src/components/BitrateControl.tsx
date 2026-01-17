import { useEffect, useState } from 'react';
import { socketService } from '../services/socket.service';

export interface BitrateProfile {
  name: string;
  videoBitrate: number;
  audioBitrate: number;
  width: number;
  height: number;
  framerate: number;
}

interface BitrateControlProps {
  broadcastId: string;
  isLive: boolean;
}

export function BitrateControl({ broadcastId, isLive }: BitrateControlProps) {
  const [profiles, setProfiles] = useState<BitrateProfile[]>([]);
  const [currentProfile, setCurrentProfile] = useState<BitrateProfile | null>(null);
  const [isAdaptive, setIsAdaptive] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Fetch available profiles
    socketService.emit('get-bitrate-profiles');

    const handleProfiles = (fetchedProfiles: BitrateProfile[]) => {
      setProfiles(fetchedProfiles);
      // Default to High profile
      setCurrentProfile(fetchedProfiles.find((p) => p.name === 'High') || fetchedProfiles[0]);
    };

    const handleProfileUpdated = ({ profileName }: { profileName: string }) => {
      const profile = profiles.find((p) => p.name === profileName);
      if (profile) {
        setCurrentProfile(profile);
      }
    };

    const handleAdaptiveStarted = ({ profile }: { profile: BitrateProfile }) => {
      setIsAdaptive(true);
      if (profile) {
        setCurrentProfile(profile);
      }
    };

    const handleAdaptiveStopped = () => {
      setIsAdaptive(false);
    };

    socketService.on('bitrate-profiles', handleProfiles);
    socketService.on('bitrate-profile-updated', handleProfileUpdated);
    socketService.on('adaptive-bitrate-started', handleAdaptiveStarted);
    socketService.on('adaptive-bitrate-stopped', handleAdaptiveStopped);

    return () => {
      socketService.off('bitrate-profiles', handleProfiles);
      socketService.off('bitrate-profile-updated', handleProfileUpdated);
      socketService.off('adaptive-bitrate-started', handleAdaptiveStarted);
      socketService.off('adaptive-bitrate-stopped', handleAdaptiveStopped);
    };
  }, [profiles]);

  useEffect(() => {
    if (isLive && isAdaptive && currentProfile) {
      // Start adaptive bitrate when going live
      socketService.emit('start-adaptive-bitrate', {
        broadcastId,
        initialProfile: currentProfile,
      });
    } else if (!isLive && isAdaptive) {
      // Stop adaptive bitrate when ending stream
      socketService.emit('stop-adaptive-bitrate', { broadcastId });
    }
  }, [isLive, isAdaptive, broadcastId, currentProfile]);

  const handleToggleAdaptive = () => {
    setIsLoading(true);
    if (isAdaptive) {
      socketService.emit('stop-adaptive-bitrate', { broadcastId });
      setIsAdaptive(false);
    } else {
      socketService.emit('start-adaptive-bitrate', {
        broadcastId,
        initialProfile: currentProfile,
      });
      setIsAdaptive(true);
    }
    setTimeout(() => setIsLoading(false), 500);
  };

  const handleProfileChange = (profileName: string) => {
    setIsLoading(true);
    socketService.emit('set-bitrate-profile', { broadcastId, profileName });
    const profile = profiles.find((p) => p.name === profileName);
    if (profile) {
      setCurrentProfile(profile);
    }
    setTimeout(() => setIsLoading(false), 500);
  };

  const getProfileBadgeColor = (profile: BitrateProfile): string => {
    switch (profile.name) {
      case 'Ultra':
        return 'bg-purple-600';
      case 'High':
        return 'bg-blue-600';
      case 'Medium':
        return 'bg-green-600';
      case 'Low':
        return 'bg-yellow-600';
      case 'Very Low':
        return 'bg-red-600';
      default:
        return 'bg-gray-600';
    }
  };

  if (!currentProfile) {
    return null;
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300">Stream Quality</h3>
        <span className={`px-2 py-1 rounded text-xs font-medium ${getProfileBadgeColor(currentProfile)} text-white`}>
          {currentProfile.name}
        </span>
      </div>

      {/* Current Profile Info */}
      <div className="bg-gray-700 rounded p-3 space-y-2">
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div>
            <span className="text-gray-400">Resolution:</span>
            <span className="text-white ml-2">{currentProfile.width}x{currentProfile.height}</span>
          </div>
          <div>
            <span className="text-gray-400">FPS:</span>
            <span className="text-white ml-2">{currentProfile.framerate}</span>
          </div>
          <div>
            <span className="text-gray-400">Video:</span>
            <span className="text-white ml-2">{currentProfile.videoBitrate} kbps</span>
          </div>
          <div>
            <span className="text-gray-400">Audio:</span>
            <span className="text-white ml-2">{currentProfile.audioBitrate} kbps</span>
          </div>
        </div>
      </div>

      {/* Adaptive Toggle */}
      <div className="flex items-center justify-between bg-gray-700 rounded p-3">
        <div>
          <div className="text-sm text-white font-medium">Adaptive Bitrate</div>
          <div className="text-xs text-gray-400">Auto-adjust quality based on network</div>
        </div>
        <button
          onClick={handleToggleAdaptive}
          disabled={isLoading}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            isAdaptive ? 'bg-primary-600' : 'bg-gray-600'
          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              isAdaptive ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Manual Profile Selector */}
      {!isAdaptive && (
        <div className="space-y-2">
          <label className="text-xs text-gray-400">Manual Profile Selection</label>
          <select
            value={currentProfile.name}
            onChange={(e) => handleProfileChange(e.target.value)}
            disabled={isLoading || isLive}
            className="w-full bg-gray-700 text-white text-sm rounded px-3 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {profiles.map((profile) => (
              <option key={profile.name} value={profile.name}>
                {profile.name} - {profile.width}x{profile.height}@{profile.framerate}fps
              </option>
            ))}
          </select>
          {isLive && (
            <p className="text-xs text-yellow-400">Profile cannot be changed during live stream</p>
          )}
        </div>
      )}

      {/* Adaptive Info */}
      {isAdaptive && isLive && (
        <div className="bg-blue-900/30 border border-blue-500/50 rounded p-2 text-xs text-blue-300">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>Adaptive bitrate active - quality will adjust automatically</span>
          </div>
        </div>
      )}
    </div>
  );
}
