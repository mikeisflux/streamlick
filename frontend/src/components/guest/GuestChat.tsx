/**
 * GuestChat Component
 *
 * Chat interface with private and public tabs.
 */

import { useState } from 'react';

interface ChatMessage {
  author: string;
  message: string;
  timestamp: number;
}

interface GuestChatProps {
  currentUserName: string;
  privateChatMessages: ChatMessage[];
  publicChatMessages: ChatMessage[];
  onSendPrivateMessage: (message: string) => void;
}

export function GuestChat({
  currentUserName,
  privateChatMessages,
  publicChatMessages,
  onSendPrivateMessage,
}: GuestChatProps) {
  const [activeTab, setActiveTab] = useState<'private' | 'public'>('private');
  const [message, setMessage] = useState('');

  const handleSend = () => {
    if (!message.trim()) return;
    onSendPrivateMessage(message);
    setMessage('');
  };

  const messages = activeTab === 'private' ? privateChatMessages : publicChatMessages;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Chat Tabs */}
      <div className="flex border-b border-gray-700">
        <button
          onClick={() => setActiveTab('private')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'private'
              ? 'text-white bg-gray-700 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          Private Chat
        </button>
        <button
          onClick={() => setActiveTab('public')}
          className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
            activeTab === 'public'
              ? 'text-white bg-gray-700 border-b-2 border-blue-500'
              : 'text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          Public Chat
        </button>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {messages.length === 0 ? (
          <p className="text-gray-500 text-sm text-center">
            {activeTab === 'private'
              ? 'No messages yet. Start chatting with other guests!'
              : 'No public chat messages yet.'}
          </p>
        ) : (
          messages.map((msg, i) => (
            <div
              key={i}
              className={`p-2 rounded ${
                activeTab === 'private' && msg.author === currentUserName
                  ? 'bg-blue-600 ml-4'
                  : 'bg-gray-700 mr-4'
              }`}
            >
              <p className="text-xs text-gray-300 font-medium">{msg.author}</p>
              <p className="text-sm text-white">{msg.message}</p>
            </div>
          ))
        )}
      </div>

      {/* Chat Input - only for private chat */}
      {activeTab === 'private' ? (
        <div className="p-4 border-t border-gray-700">
          <div className="flex gap-2">
            <input
              type="text"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a message..."
              className="flex-1 px-3 py-2 bg-gray-700 text-white rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              aria-label="Chat message"
            />
            <button
              onClick={handleSend}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
            >
              Send
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 border-t border-gray-700 bg-gray-900">
          <p className="text-xs text-gray-500 text-center">
            Public chat is read-only while in the greenroom
          </p>
        </div>
      )}
    </div>
  );
}
