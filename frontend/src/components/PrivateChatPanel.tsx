import { useState, useRef, useEffect } from 'react';

interface Message {
  id: string;
  senderId: string;
  senderName: string;
  message: string;
  timestamp: Date;
  isHost: boolean;
}

interface PrivateChatPanelProps {
  broadcastId?: string;
  currentUserId?: string;
}

export function PrivateChatPanel({ broadcastId, currentUserId }: PrivateChatPanelProps) {
  // Load messages from localStorage or use default demo messages
  const [messages, setMessages] = useState<Message[]>(() => {
    const storageKey = `private_chat_${broadcastId || 'default'}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Convert timestamp strings back to Date objects
        return parsed.map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp),
        }));
      } catch (e) {
        console.error('Failed to parse saved messages:', e);
      }
    }
    // Default demo messages if nothing saved
    return [
      {
        id: '1',
        senderId: 'host-1',
        senderName: 'Host',
        message: 'Welcome to the show! Can everyone hear me okay?',
        timestamp: new Date(Date.now() - 300000),
        isHost: true,
      },
      {
        id: '2',
        senderId: 'guest-1',
        senderName: 'Sarah',
        message: 'Yes, audio is clear!',
        timestamp: new Date(Date.now() - 240000),
        isHost: false,
      },
      {
        id: '3',
        senderId: 'guest-2',
        senderName: 'Mike',
        message: 'All good here too 👍',
        timestamp: new Date(Date.now() - 180000),
        isHost: false,
      },
    ];
  });
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Persist messages to localStorage whenever they change
  useEffect(() => {
    const storageKey = `private_chat_${broadcastId || 'default'}`;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, broadcastId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage: Message = {
      id: Date.now().toString(),
      senderId: currentUserId || 'host-1',
      senderName: 'You',
      message: inputMessage,
      timestamp: new Date(),
      isHost: true,
    };

    setMessages([...messages, newMessage]);
    setInputMessage('');
    inputRef.current?.focus();
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900">Private Chat</h3>
        <p className="text-xs text-gray-500 mt-1">
          🔒 Only visible to hosts and guests (not on stream)
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.senderName === 'You' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] ${
                msg.senderName === 'You'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-900'
              } rounded-lg px-3 py-2`}
            >
              <div className="flex items-baseline gap-2 mb-1">
                <span
                  className={`text-xs font-semibold ${
                    msg.senderName === 'You' ? 'text-blue-100' : 'text-gray-700'
                  }`}
                >
                  {msg.senderName}
                </span>
                {msg.isHost && msg.senderName !== 'You' && (
                  <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">
                    Host
                  </span>
                )}
              </div>
              <p className="text-sm">{msg.message}</p>
              <p
                className={`text-xs mt-1 ${
                  msg.senderName === 'You' ? 'text-blue-200' : 'text-gray-500'
                }`}
              >
                {formatTime(msg.timestamp)}
              </p>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={handleSendMessage}
        className="border-t border-gray-200 p-3 bg-gray-50"
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            placeholder="Type a private message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          <button
            type="submit"
            disabled={!inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            Send
          </button>
        </div>
      </form>

      {/* Quick Actions */}
      <div className="border-t border-gray-200 p-2 bg-white">
        <div className="flex gap-1 overflow-x-auto">
          {[
            '👍 Good to go',
            '⏸️ Take a break',
            '🎤 Mic check',
            '📹 Camera check',
            '✋ I have a question',
          ].map((action) => (
            <button
              key={action}
              onClick={() => setInputMessage(action)}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs rounded whitespace-nowrap transition-colors"
            >
              {action}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
