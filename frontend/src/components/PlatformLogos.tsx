import React from 'react';

interface PlatformLogoProps {
  platform: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const sizeClasses = {
  sm: 'w-4 h-4',
  md: 'w-6 h-6',
  lg: 'w-8 h-8',
  xl: 'w-12 h-12',
};

export const PlatformLogo: React.FC<PlatformLogoProps> = ({ platform, size = 'md', className = '' }) => {
  const sizeClass = sizeClasses[size];

  const renderLogo = () => {
    switch (platform.toLowerCase()) {
      case 'youtube':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FF0000" />
          </svg>
        );

      case 'facebook':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" fill="#1877F2" />
          </svg>
        );

      case 'twitch':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714Z" fill="#9146FF" />
          </svg>
        );

      case 'twitter':
      case 'x':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" fill="#000000" />
          </svg>
        );

      case 'rumble':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M4 2h16c1.1 0 2 .9 2 2v16c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2z" fill="#85C742" />
            <path d="M12 8l6 4-6 4V8z" fill="#FFFFFF" />
          </svg>
        );

      case 'linkedin':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" fill="#0A66C2" />
          </svg>
        );

      case 'custom_rtmp':
      case 'custom':
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" fill="#6366F1" />
          </svg>
        );

      default:
        return (
          <svg className={`${sizeClass} ${className}`} viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="10" fill="#9CA3AF" />
            <path d="M12 8v8M8 12h8" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" />
          </svg>
        );
    }
  };

  return renderLogo();
};

export const PlatformBadge: React.FC<{
  platform: string;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showName?: boolean;
  connected?: boolean;
}> = ({ platform, label, size = 'md', showName = true, connected = false }) => {
  const platformNames: Record<string, string> = {
    youtube: 'YouTube',
    facebook: 'Facebook',
    twitch: 'Twitch',
    twitter: 'X',
    x: 'X',
    rumble: 'Rumble',
    linkedin: 'LinkedIn',
    custom_rtmp: 'Custom RTMP',
    custom: 'Custom',
  };

  const platformColors: Record<string, string> = {
    youtube: 'bg-red-500/10 text-red-500 border-red-500/20',
    facebook: 'bg-blue-600/10 text-blue-600 border-blue-600/20',
    twitch: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
    twitter: 'bg-black/10 text-gray-900 border-gray-900/20',
    x: 'bg-black/10 text-gray-900 border-gray-900/20',
    rumble: 'bg-green-500/10 text-green-500 border-green-500/20',
    linkedin: 'bg-blue-700/10 text-blue-700 border-blue-700/20',
    custom_rtmp: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20',
    custom: 'bg-gray-500/10 text-gray-500 border-gray-500/20',
  };

  const key = platform.toLowerCase();
  const colorClass = platformColors[key] || platformColors.custom;
  const name = label || platformNames[key] || platform;

  return (
    <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorClass} relative`}>
      {connected && (
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-900 animate-pulse" />
      )}
      <PlatformLogo platform={platform} size={size} />
      {showName && <span className="text-sm font-medium">{name}</span>}
    </div>
  );
};

export const PlatformIconButton: React.FC<{
  platform: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  className?: string;
}> = ({ platform, onClick, active = false, disabled = false, className = '' }) => {
  const platformColors: Record<string, string> = {
    youtube: 'hover:bg-red-500/10 hover:border-red-500/30',
    facebook: 'hover:bg-blue-600/10 hover:border-blue-600/30',
    twitch: 'hover:bg-purple-500/10 hover:border-purple-500/30',
    twitter: 'hover:bg-gray-900/10 hover:border-gray-900/30',
    x: 'hover:bg-gray-900/10 hover:border-gray-900/30',
    rumble: 'hover:bg-green-500/10 hover:border-green-500/30',
    linkedin: 'hover:bg-blue-700/10 hover:border-blue-700/30',
    custom_rtmp: 'hover:bg-indigo-500/10 hover:border-indigo-500/30',
  };

  const key = platform.toLowerCase();
  const hoverClass = platformColors[key] || 'hover:bg-gray-500/10';
  const activeClass = active ? 'bg-blue-500/20 border-blue-500' : 'border-gray-700';

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`p-2 rounded-lg border ${activeClass} ${hoverClass} transition-all disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    >
      <PlatformLogo platform={platform} size="md" />
    </button>
  );
};

// Platform selector component
export const PlatformSelector: React.FC<{
  platforms: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  maxSelection?: number;
}> = ({ platforms, selected, onChange, maxSelection }) => {
  const togglePlatform = (platform: string) => {
    if (selected.includes(platform)) {
      onChange(selected.filter(p => p !== platform));
    } else {
      if (maxSelection && selected.length >= maxSelection) {
        return; // Max selection reached
      }
      onChange([...selected, platform]);
    }
  };

  return (
    <div className="flex flex-wrap gap-3">
      {platforms.map((platform) => (
        <button
          key={platform}
          onClick={() => togglePlatform(platform)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all ${
            selected.includes(platform)
              ? 'bg-blue-500/20 border-blue-500 text-blue-400'
              : 'bg-gray-800 border-gray-700 text-gray-400 hover:border-gray-600'
          }`}
        >
          <PlatformLogo platform={platform} size="sm" />
          <span className="text-sm font-medium capitalize">{platform.replace('_', ' ')}</span>
          {selected.includes(platform) && <span className="ml-1">✓</span>}
        </button>
      ))}
    </div>
  );
};
