import { Button } from '../Button';

interface StudioHeaderProps {
  broadcastTitle: string;
  isLive: boolean;
  onProducerModeClick: () => void;
  onResetStackClick: () => void;
  onDestinationsClick: () => void;
  onInviteGuestsClick: () => void;
  onSettingsClick: () => void;
  onGoLive: () => void;
  onEndBroadcast: () => void;
  isInitializing: boolean;
}

export function StudioHeader({
  broadcastTitle,
  isLive,
  onProducerModeClick,
  onResetStackClick,
  onDestinationsClick,
  onInviteGuestsClick,
  onSettingsClick,
  onGoLive,
  onEndBroadcast,
  isInitializing,
}: StudioHeaderProps) {
  return (
    <header
      style={{
        height: '60px',
        backgroundColor: '#2d2d2d',
        borderBottom: '1px solid #404040',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '24px',
        paddingRight: '24px',
        zIndex: 100, // Layer 100: Top navigation bar (always on top)
        flexShrink: 0,
      }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-4">
          <h1 style={{ width: '140px', fontSize: '20px', fontWeight: 'bold', color: '#ffffff' }}>Streamlick</h1>
          {isLive && (
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
              </span>
              <span className="text-red-500 text-sm font-semibold">LIVE</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-white text-sm">{broadcastTitle}</span>
          <button
            onClick={onProducerModeClick}
            className="px-4 py-2 rounded bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition-colors"
            title="Producer Mode"
          >
            Producer Mode
          </button>
          <button
            onClick={onResetStackClick}
            className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition-colors"
            title="Reset Stack"
          >
            Reset Stack
          </button>
          <button
            onClick={onDestinationsClick}
            className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
            title="Destinations"
          >
            Destinations
          </button>
          <button
            onClick={onInviteGuestsClick}
            className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white font-semibold transition-colors"
          >
            Invite Guests
          </button>
          <button
            onClick={onSettingsClick}
            className="text-gray-300 hover:text-white"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          {!isLive ? (
            <Button onClick={onGoLive} variant="primary" size="lg" disabled={isInitializing}>
              {isInitializing ? 'Initializing...' : 'Go Live'}
            </Button>
          ) : (
            <Button onClick={onEndBroadcast} variant="danger" size="lg">
              End Broadcast
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
