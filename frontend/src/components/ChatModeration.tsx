import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

export interface ChatMessage {
  id: string;
  platform: string;
  authorId: string;
  authorName: string;
  messageText: string;
  timestamp: Date;
  isSuperChat?: boolean;
  amount?: number;
}

export interface ModerationAction {
  id: string;
  platform: string;
  userId: string;
  username: string;
  action: 'ban' | 'timeout' | 'unban';
  duration?: number;
  reason?: string;
  timestamp: Date;
  expiresAt?: Date;
  isActive: boolean;
}

interface ChatModerationProps {
  broadcastId: string;
  isHost: boolean;
  recentMessages?: ChatMessage[];
}

export const ChatModeration: React.FC<ChatModerationProps> = ({
  broadcastId,
  isHost,
  recentMessages = [],
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'quick' | 'history'>('quick');
  const [moderationHistory, setModerationHistory] = useState<ModerationAction[]>([]);
  const [activeActions, setActiveActions] = useState<ModerationAction[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [banReason, setBanReason] = useState('');
  const [timeoutDuration, setTimeoutDuration] = useState(600); // 10 minutes default
  const [crossPlatform, setCrossPlatform] = useState(false);

  useEffect(() => {
    if (isExpanded && isHost) {
      loadModerationData();
    }
  }, [isExpanded, isHost, broadcastId]);

  const loadModerationData = async () => {
    try {
      const [historyRes, activeRes] = await Promise.all([
        api.get(`/api/moderation/${broadcastId}/history`),
        api.get(`/api/moderation/${broadcastId}/active`),
      ]);
      setModerationHistory(historyRes.data);
      setActiveActions(activeRes.data);
    } catch (error: any) {
      console.error('Failed to load moderation data:', error);
    }
  };

  const handleBanUser = async () => {
    if (!selectedMessage) return;

    try {
      if (crossPlatform) {
        await api.post(`/api/moderation/${broadcastId}/ban-cross-platform`, {
          userId: selectedMessage.authorId,
          username: selectedMessage.authorName,
          reason: banReason,
        });
        toast.success(`${selectedMessage.authorName} banned from all platforms!`);
      } else {
        await api.post(`/api/moderation/${broadcastId}/ban`, {
          platform: selectedMessage.platform,
          userId: selectedMessage.authorId,
          username: selectedMessage.authorName,
          reason: banReason,
        });
        toast.success(`${selectedMessage.authorName} banned from ${selectedMessage.platform}!`);
      }

      setShowBanModal(false);
      setSelectedMessage(null);
      setBanReason('');
      loadModerationData();
    } catch (error: any) {
      toast.error(`Failed to ban user: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleTimeoutUser = async (duration: number) => {
    if (!selectedMessage) return;

    try {
      await api.post(`/api/moderation/${broadcastId}/timeout`, {
        platform: selectedMessage.platform,
        userId: selectedMessage.authorId,
        username: selectedMessage.authorName,
        duration,
        reason: banReason || 'Timed out by moderator',
      });

      const minutes = Math.floor(duration / 60);
      toast.success(`${selectedMessage.authorName} timed out for ${minutes} minute(s)!`);

      setShowBanModal(false);
      setSelectedMessage(null);
      setBanReason('');
      loadModerationData();
    } catch (error: any) {
      toast.error(`Failed to timeout user: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleUnbanUser = async (action: ModerationAction) => {
    try {
      await api.post(`/api/moderation/${broadcastId}/unban`, {
        platform: action.platform,
        userId: action.userId,
        username: action.username,
      });

      toast.success(`${action.username} unbanned from ${action.platform}!`);
      loadModerationData();
    } catch (error: any) {
      toast.error(`Failed to unban user: ${error.response?.data?.error || error.message}`);
    }
  };

  const formatTimeRemaining = (expiresAt?: Date): string => {
    if (!expiresAt) return '';

    const now = new Date();
    const expires = new Date(expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const minutes = Math.floor(diff / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${minutes}m ${seconds}s`;
  };

  if (!isHost) {
    return null; // Only hosts can moderate
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>🛡️</span>
          Chat Moderation
        </h3>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white"
        >
          {isExpanded ? '▼' : '▶'}
        </button>
      </div>

      {isExpanded && (
        <>
          {/* Tab navigation */}
          <div className="flex gap-2 mb-4 border-b border-gray-700">
            <button
              onClick={() => setActiveTab('quick')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'quick'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Quick Actions
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              History & Active
            </button>
          </div>

          {/* Quick Actions Tab */}
          {activeTab === 'quick' && (
            <div className="space-y-3">
              <div className="text-sm text-gray-400 mb-3">
                Click on any recent chat message to moderate
              </div>

              {recentMessages.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No recent chat messages
                </div>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {recentMessages.slice(-10).reverse().map((message) => (
                    <div
                      key={message.id}
                      onClick={() => {
                        setSelectedMessage(message);
                        setShowBanModal(true);
                      }}
                      className="bg-gray-900 rounded p-3 cursor-pointer hover:bg-gray-850 transition-colors border border-gray-700 hover:border-gray-600"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                              {message.platform}
                            </span>
                            <span className="text-white font-medium">{message.authorName}</span>
                            {message.isSuperChat && (
                              <span className="text-xs px-2 py-0.5 rounded bg-yellow-500 text-black font-medium">
                                ${message.amount}
                              </span>
                            )}
                          </div>
                          <div className="text-sm text-gray-300">{message.messageText}</div>
                        </div>
                        <button className="text-gray-400 hover:text-red-500 text-xs">
                          Moderate →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* History & Active Tab */}
          {activeTab === 'history' && (
            <div className="space-y-4">
              {/* Active Actions */}
              {activeActions.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-white mb-2">Active Bans & Timeouts</h4>
                  <div className="space-y-2">
                    {activeActions.map((action) => (
                      <div
                        key={action.id}
                        className="bg-gray-900 rounded p-3 border border-red-500/30"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-white font-medium">{action.username}</span>
                              <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                                {action.platform}
                              </span>
                              <span
                                className={`text-xs px-2 py-0.5 rounded font-medium ${
                                  action.action === 'ban'
                                    ? 'bg-red-500 text-white'
                                    : 'bg-yellow-500 text-black'
                                }`}
                              >
                                {action.action === 'ban' ? 'BANNED' : 'TIMEOUT'}
                              </span>
                            </div>
                            {action.reason && (
                              <div className="text-xs text-gray-400 mb-1">Reason: {action.reason}</div>
                            )}
                            {action.expiresAt && (
                              <div className="text-xs text-yellow-500">
                                Expires in: {formatTimeRemaining(action.expiresAt)}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => handleUnbanUser(action)}
                            className="text-xs px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            Unban
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Moderation History */}
              <div>
                <h4 className="text-sm font-medium text-white mb-2">Recent History</h4>
                {moderationHistory.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No moderation actions yet
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {moderationHistory.map((action) => (
                      <div key={action.id} className="bg-gray-900 rounded p-3 border border-gray-700">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-white font-medium">{action.username}</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-800 text-gray-300">
                            {action.platform}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded ${
                              action.action === 'ban'
                                ? 'bg-red-500/20 text-red-400'
                                : action.action === 'timeout'
                                ? 'bg-yellow-500/20 text-yellow-400'
                                : 'bg-green-500/20 text-green-400'
                            }`}
                          >
                            {action.action.toUpperCase()}
                          </span>
                          {!action.isActive && (
                            <span className="text-xs text-gray-500">(Inactive)</span>
                          )}
                        </div>
                        {action.reason && (
                          <div className="text-xs text-gray-400">Reason: {action.reason}</div>
                        )}
                        <div className="text-xs text-gray-500 mt-1">
                          {new Date(action.timestamp).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Ban/Timeout Modal */}
          {showBanModal && selectedMessage && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
              <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4 border border-gray-700">
                <h3 className="text-lg font-semibold text-white mb-4">
                  Moderate User: {selectedMessage.authorName}
                </h3>

                <div className="space-y-4">
                  {/* Platform info */}
                  <div className="bg-gray-900 rounded p-3">
                    <div className="text-xs text-gray-400 mb-1">Platform</div>
                    <div className="text-white font-medium">{selectedMessage.platform}</div>
                  </div>

                  {/* Reason input */}
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Reason (optional)</label>
                    <textarea
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      className="w-full bg-gray-900 text-white rounded px-3 py-2 border border-gray-700 focus:outline-none focus:border-blue-500"
                      rows={3}
                      placeholder="E.g., Spam, harassment, inappropriate content..."
                    />
                  </div>

                  {/* Cross-platform option */}
                  <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input
                      type="checkbox"
                      checked={crossPlatform}
                      onChange={(e) => setCrossPlatform(e.target.checked)}
                      className="rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Ban from all connected platforms</span>
                  </label>

                  {/* Quick timeout buttons */}
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Quick Timeout</div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => handleTimeoutUser(60)}
                        className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        1 min
                      </button>
                      <button
                        onClick={() => handleTimeoutUser(600)}
                        className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        10 min
                      </button>
                      <button
                        onClick={() => handleTimeoutUser(3600)}
                        className="px-3 py-2 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                      >
                        1 hour
                      </button>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-700">
                    <button
                      onClick={handleBanUser}
                      className="flex-1 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 font-medium"
                    >
                      Permanent Ban
                    </button>
                    <button
                      onClick={() => {
                        setShowBanModal(false);
                        setSelectedMessage(null);
                        setBanReason('');
                        setCrossPlatform(false);
                      }}
                      className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-gray-500 border-t border-gray-700 pt-3">
            <p>💡 Moderation actions sync to the source platform (YouTube, Twitch, etc.)</p>
            <p className="mt-1">💡 Timeouts automatically expire after the set duration</p>
          </div>
        </>
      )}
    </div>
  );
};
