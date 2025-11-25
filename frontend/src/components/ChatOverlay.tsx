/**
 * ⚠️ CRITICAL WARNING ⚠️
 * THIS COMPONENT DISPLAYS ON THE STUDIOCANVAS.
 * ANY VISUAL CHANGE HERE MUST ALSO BE INTEGRATED INTO THE HIDDEN CANVAS
 * IN StudioCanvas.tsx (drawToCanvas function) OR YOU WILL CREATE A BREAK IN THE CODE.
 *
 * The hidden canvas captures the broadcast output and must be a CARBON COPY of what
 * is displayed in the React preview. If you modify chat overlay styling, message rendering,
 * platform icons, colors, or appearance, you MUST update the corresponding drawing code
 * in StudioCanvas.tsx.
 */

import { useState, useEffect, useRef } from 'react';

export interface ChatMessage {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'x' | 'rumble';
  author: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
  isSuperChat?: boolean;
  superChatAmount?: number;
  isFeatured?: boolean;
}

interface ChatOverlayProps {
  messages: ChatMessage[];
  onFeatureMessage?: (messageId: string) => void;
  showPlatformIcons?: boolean;
  maxMessages?: number;
}

const platformIcons: Record<string, string> = {
  youtube: '📺',
  facebook: '👥',
  twitch: '💜',
  x: '𝕏',
  rumble: '🎬',
};

const platformColors: Record<string, string> = {
  youtube: 'bg-red-500',
  facebook: 'bg-blue-600',
  twitch: 'bg-purple-600',
  x: 'bg-black',
  rumble: 'bg-green-600',
};

export function ChatOverlay({
  messages,
  onFeatureMessage,
  showPlatformIcons = true,
  maxMessages = 50,
}: ChatOverlayProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Keep only the latest messages
    setVisibleMessages(messages.slice(-maxMessages));
  }, [messages, maxMessages]);

  useEffect(() => {
    // Auto-scroll to bottom
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages]);

  const formatTimestamp = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="h-full flex flex-col bg-gray-900 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gray-800 px-4 py-3 border-b border-gray-700">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          💬 Live Chat
          <span className="text-xs text-gray-400">
            ({visibleMessages.length} messages)
          </span>
        </h3>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {visibleMessages.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <div className="text-4xl mb-2">💬</div>
            <p className="text-sm">No chat messages yet</p>
            <p className="text-xs mt-1">Messages will appear here when viewers comment</p>
          </div>
        ) : (
          visibleMessages.map((msg) => (
            <div
              key={msg.id}
              className={`group rounded-lg p-3 ${
                msg.isSuperChat
                  ? 'bg-gradient-to-r from-yellow-500/20 to-orange-500/20 border border-yellow-500/50'
                  : msg.isFeatured
                  ? 'bg-primary-500/20 border border-primary-500'
                  : 'bg-gray-800 hover:bg-gray-750'
              } transition-colors relative`}
            >
              {/* Platform Badge */}
              {showPlatformIcons && (
                <div
                  className={`absolute top-2 right-2 text-xs px-2 py-1 rounded ${
                    platformColors[msg.platform]
                  } text-white opacity-70`}
                >
                  {platformIcons[msg.platform]}
                </div>
              )}

              {/* Message Header */}
              <div className="flex items-start gap-2 mb-1">
                {msg.authorAvatar && (
                  <img
                    src={msg.authorAvatar}
                    alt={msg.author}
                    className="w-6 h-6 rounded-full"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {msg.author}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTimestamp(msg.timestamp)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Super Chat Amount */}
              {msg.isSuperChat && msg.superChatAmount && (
                <div className="mb-2">
                  <span className="text-xs font-bold text-yellow-400">
                    ${msg.superChatAmount.toFixed(2)} Super Chat
                  </span>
                </div>
              )}

              {/* Message Content */}
              <p className="text-sm text-gray-200 break-words">{msg.message}</p>

              {/* Feature Button */}
              {onFeatureMessage && !msg.isFeatured && (
                <button
                  onClick={() => onFeatureMessage(msg.id)}
                  className="absolute bottom-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 bg-primary-600 hover:bg-primary-700 rounded text-white"
                >
                  ⭐ Feature
                </button>
              )}

              {/* Featured Badge */}
              {msg.isFeatured && (
                <div className="absolute bottom-2 right-2 text-xs px-2 py-1 bg-primary-600 rounded text-white">
                  ⭐ Featured
                </div>
              )}
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Footer Stats */}
      <div className="bg-gray-800 px-4 py-2 border-t border-gray-700">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-3">
            {showPlatformIcons && (
              <>
                <span className="flex items-center gap-1">
                  {platformIcons.youtube}{' '}
                  {visibleMessages.filter((m) => m.platform === 'youtube').length}
                </span>
                <span className="flex items-center gap-1">
                  {platformIcons.facebook}{' '}
                  {visibleMessages.filter((m) => m.platform === 'facebook').length}
                </span>
                <span className="flex items-center gap-1">
                  {platformIcons.twitch}{' '}
                  {visibleMessages.filter((m) => m.platform === 'twitch').length}
                </span>
              </>
            )}
          </div>
          <span>
            {visibleMessages.filter((m) => m.isSuperChat).length} Super Chats
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * Compact Chat Overlay for Video Compositor
 * Shows only the most recent 3-5 messages in a compact format
 */
interface CompactChatOverlayProps {
  messages: ChatMessage[];
  maxMessages?: number;
}

export function CompactChatOverlay({ messages, maxMessages = 3 }: CompactChatOverlayProps) {
  const [visibleMessages, setVisibleMessages] = useState<ChatMessage[]>([]);

  useEffect(() => {
    // Keep only the latest messages
    setVisibleMessages(messages.slice(-maxMessages));
  }, [messages, maxMessages]);

  if (visibleMessages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleMessages.map((msg) => (
        <div
          key={msg.id}
          className={`rounded-lg px-3 py-2 ${
            msg.isSuperChat
              ? 'bg-gradient-to-r from-yellow-500/90 to-orange-500/90'
              : 'bg-gray-900/90'
          } backdrop-blur-sm`}
        >
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs px-2 py-0.5 rounded bg-black/30 text-white">
              {platformIcons[msg.platform]}
            </span>
            <span className="text-sm font-semibold text-white truncate">
              {msg.author}
            </span>
            {msg.isSuperChat && msg.superChatAmount && (
              <span className="text-xs font-bold text-yellow-300">
                ${msg.superChatAmount.toFixed(2)}
              </span>
            )}
          </div>
          <p className="text-sm text-white line-clamp-2">{msg.message}</p>
        </div>
      ))}
    </div>
  );
}
