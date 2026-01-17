import { useState } from 'react';
import { Radio, Square, Settings } from 'lucide-react';

interface StudioHeaderProps {
  broadcastTitle: string;
  isLive: boolean;
  status: string;
  onGoLive: () => void;
  onEndBroadcast: () => void;
  onTitleChange: (title: string) => void;
  onSettingsClick: () => void;
  onInviteClick: () => void;
  onProducerModeClick?: () => void;
  onResetStackClick?: () => void;
  onDestinationsClick?: () => void;
  isInitializing?: boolean;
}

export function StudioHeader({
  broadcastTitle,
  isLive,
  status: _status,
  onGoLive,
  onEndBroadcast,
  onTitleChange,
  onSettingsClick,
  onInviteClick,
  onProducerModeClick,
  onResetStackClick,
  onDestinationsClick,
  isInitializing = false,
}: StudioHeaderProps) {
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState(broadcastTitle);

  const handleTitleSubmit = () => {
    if (editedTitle.trim() && editedTitle !== broadcastTitle) {
      onTitleChange(editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleTitleSubmit();
    } else if (e.key === 'Escape') {
      setEditedTitle(broadcastTitle);
      setIsEditingTitle(false);
    }
  };

  return (
    <header className="h-[60px] bg-dark-900 border-b border-dark-800 flex items-center justify-between px-6 flex-shrink-0 z-50">
      {/* Left Section - Logo */}
      <div className="flex items-center gap-4">
        <span className="text-xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text w-[140px]">
          Streamlick
        </span>

        {isLive && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-red-500 text-sm font-semibold">LIVE</span>
          </div>
        )}
      </div>

      {/* Center Section - Title */}
      <div className="flex items-center gap-3">
        {isEditingTitle ? (
          <input
            type="text"
            value={editedTitle}
            onChange={(e) => setEditedTitle(e.target.value)}
            onBlur={handleTitleSubmit}
            onKeyDown={handleTitleKeyDown}
            className="px-3 py-1.5 bg-dark-800 text-white text-sm rounded-lg border border-dark-700 focus:outline-none focus:border-brand-500 min-w-[200px]"
            autoFocus
            placeholder="Broadcast title..."
          />
        ) : (
          <button
            onClick={() => {
              if (!isLive) {
                setIsEditingTitle(true);
                setEditedTitle(broadcastTitle);
              }
            }}
            className={`text-white text-sm px-3 py-1.5 rounded-lg transition ${
              !isLive ? 'hover:bg-dark-800 cursor-pointer' : 'cursor-default'
            }`}
            title={isLive ? 'Cannot edit while live' : 'Click to edit title'}
          >
            {broadcastTitle || 'Untitled Broadcast'}
            {!isLive && (
              <svg className="w-3 h-3 inline ml-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            )}
          </button>
        )}
      </div>

      {/* Right Section - Buttons */}
      <div className="flex items-center gap-3">
        {/* Producer Mode Button */}
        <button
          onClick={onProducerModeClick}
          className="px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-700 text-white text-sm font-semibold transition"
          title="Producer Mode"
        >
          Producer Mode
        </button>

        {/* Reset Stack Button */}
        <button
          onClick={onResetStackClick}
          className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold transition"
          title="Reset Stack"
        >
          Reset Stack
        </button>

        {/* Destinations Button */}
        <button
          onClick={onDestinationsClick}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
          title="Destinations"
        >
          Destinations
        </button>

        {/* Invite Guests Button */}
        <button
          onClick={onInviteClick}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition"
        >
          Invite Guests
        </button>

        {/* Settings Button */}
        <button
          onClick={onSettingsClick}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {/* Go Live / End Broadcast Button */}
        {!isLive ? (
          <button
            onClick={onGoLive}
            disabled={isInitializing}
            className="flex items-center gap-2 px-5 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-white font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Radio className="w-4 h-4" />
            {isInitializing ? 'Initializing...' : 'Go Live'}
          </button>
        ) : (
          <button
            onClick={onEndBroadcast}
            className="flex items-center gap-2 px-5 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition"
          >
            <Square className="w-4 h-4" />
            End Broadcast
          </button>
        )}
      </div>
    </header>
  );
}
