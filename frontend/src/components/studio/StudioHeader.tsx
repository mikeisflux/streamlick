import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Radio, Square, Settings, Users } from 'lucide-react';

interface StudioHeaderProps {
  broadcastTitle: string;
  isLive: boolean;
  status: string;
  participantCount: number;
  onGoLive: () => void;
  onEndBroadcast: () => void;
  onTitleChange: (title: string) => void;
  onSettingsClick: () => void;
  onInviteClick: () => void;
  isInitializing?: boolean;
}

export function StudioHeader({
  broadcastTitle,
  isLive,
  status,
  participantCount,
  onGoLive,
  onEndBroadcast,
  onTitleChange,
  onSettingsClick,
  onInviteClick,
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
    <header className="h-14 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-4 flex-shrink-0 z-50">
      {/* Left Section */}
      <div className="flex items-center gap-4">
        <Link
          to="/dashboard"
          className="p-2 hover:bg-dark-800 rounded-lg transition text-dark-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>

        <div className="flex items-center gap-3">
          <span className="text-xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text">
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
      </div>

      {/* Center Section - Title */}
      <div className="flex items-center gap-2">
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

        {!isLive && (
          <span className="text-xs text-dark-500 uppercase">{status}</span>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1 text-dark-400 text-sm">
          <Users className="w-4 h-4" />
          <span>{participantCount}</span>
        </div>

        <button
          onClick={onInviteClick}
          className="px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium transition"
        >
          Invite Guests
        </button>

        <button
          onClick={onSettingsClick}
          className="p-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition"
          title="Settings"
        >
          <Settings className="w-5 h-5" />
        </button>

        {!isLive ? (
          <button
            onClick={onGoLive}
            disabled={isInitializing}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Radio className="w-4 h-4" />
            {isInitializing ? 'Initializing...' : 'Go Live'}
          </button>
        ) : (
          <button
            onClick={onEndBroadcast}
            className="flex items-center gap-2 px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-white font-medium transition"
          >
            <Square className="w-4 h-4" />
            End Broadcast
          </button>
        )}
      </div>
    </header>
  );
}
