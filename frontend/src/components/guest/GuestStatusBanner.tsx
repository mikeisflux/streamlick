/**
 * GuestStatusBanner Component
 *
 * Displays the current guest status (live, backstage, greenroom)
 * with appropriate styling and messaging.
 */

export type GuestStatus = 'greenroom' | 'backstage' | 'live';

interface GuestStatusBannerProps {
  status: GuestStatus;
}

export function GuestStatusBanner({ status }: GuestStatusBannerProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'live':
        return {
          gradient: 'bg-gradient-to-r from-red-900 to-pink-900',
          iconBg: 'bg-red-500',
          icon: '🔴',
          textColor: 'text-red-200',
          badgeBg: 'bg-red-500 bg-opacity-20',
          badgeText: 'text-red-200',
          title: 'You are LIVE!',
          message: "You're now visible to all viewers. Smile and be yourself!",
          tip: 'Remember: Thousands may be watching you live!',
          animate: true,
        };
      case 'backstage':
        return {
          gradient: 'bg-gradient-to-r from-yellow-900 to-orange-900',
          iconBg: null,
          icon: null,
          textColor: 'text-yellow-200',
          badgeBg: 'bg-yellow-500 bg-opacity-20',
          badgeText: 'text-yellow-200',
          title: "You're in Backstage",
          message: 'Get ready! The host will bring you on screen shortly. Make final adjustments to your camera and microphone.',
          tip: "Tip: You can see and hear the broadcast, but viewers can't see you yet",
          animate: false,
        };
      default:
        return {
          gradient: 'bg-gradient-to-r from-blue-900 to-purple-900',
          iconBg: null,
          icon: null,
          textColor: 'text-blue-200',
          badgeBg: 'bg-blue-500 bg-opacity-20',
          badgeText: 'text-blue-200',
          title: 'Welcome to the Greenroom!',
          message: 'The host will move you to backstage and then bring you on screen when ready. Make sure your camera and microphone are working properly.',
          tip: 'Tip: Test your audio and video before going live',
          animate: false,
        };
    }
  };

  const config = getStatusConfig();

  const renderIcon = () => {
    if (status === 'live') {
      return (
        <div className={`w-16 h-16 ${config.iconBg} rounded-full flex items-center justify-center animate-pulse`}>
          <span className="text-3xl">{config.icon}</span>
        </div>
      );
    }

    if (status === 'backstage') {
      return (
        <svg className="w-12 h-12 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      );
    }

    return (
      <svg className="w-12 h-12 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
      </svg>
    );
  };

  return (
    <div className={`rounded-lg p-6 text-center mb-6 ${config.gradient}`}>
      <div className="flex items-center justify-center mb-3">
        {renderIcon()}
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">{config.title}</h2>
      <p className={`mb-4 ${config.textColor}`}>{config.message}</p>
      <div className={`inline-flex items-center px-4 py-2 rounded-lg ${config.badgeBg}`}>
        <svg className={`w-4 h-4 mr-2 ${config.badgeText}`} fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
        </svg>
        <span className={`text-sm ${config.badgeText}`}>{config.tip}</span>
      </div>
    </div>
  );
}
