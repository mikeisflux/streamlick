import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';

interface UserAnalytics {
  totalBroadcasts: number;
  totalStreamTime: number;
  totalViewers: number;
  peakViewers: number;
  longestStreamSeconds: number;
  youtubeStreams: number;
  facebookStreams: number;
  twitchStreams: number;
  xStreams: number;
  rumbleStreams: number;
  linkedinStreams: number;
  totalChatMessages: number;
  totalSuperChats: number;
  superChatRevenue: number;
  lastBroadcastAt?: string;
}

interface BroadcastHistory {
  broadcastId: string;
  startedAt: string;
  endedAt?: string;
  totalDurationSeconds: number;
  totalViewers: number;
  peakViewers: number;
  averageViewers: number;
  youtubeViews: number;
  facebookViews: number;
  twitchViews: number;
  xViews: number;
  rumbleViews: number;
  linkedinViews: number;
  totalChatMessages: number;
}

export const Analytics: React.FC = () => {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [history, setHistory] = useState<BroadcastHistory[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'7d' | '30d' | 'all'>('30d');

  useEffect(() => {
    if (user) {
      loadAnalytics();
    }
  }, [user]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [analyticsRes, historyRes] = await Promise.all([
        api.get(`/api/analytics/user/${user?.id}`),
        api.get(`/api/analytics/user/${user?.id}/broadcasts?limit=50`),
      ]);

      setAnalytics(analyticsRes.data);
      setHistory(historyRes.data);
    } catch (error: any) {
      toast.error('Failed to load analytics');
      console.error('Load analytics error:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getPlatformColor = (platform: string): string => {
    const colors: Record<string, string> = {
      youtube: '#FF0000',
      facebook: '#1877F2',
      twitch: '#9146FF',
      x: '#000000',
      rumble: '#85C742',
      linkedin: '#0A66C2',
    };
    return colors[platform] || '#888';
  };

  const filteredHistory = history.filter(broadcast => {
    if (selectedPeriod === 'all') return true;

    const broadcastDate = new Date(broadcast.startedAt);
    const now = new Date();
    const daysAgo = selectedPeriod === '7d' ? 7 : 30;
    const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);

    return broadcastDate >= cutoffDate;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-gray-400">Loading analytics...</div>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="flex flex-col items-center justify-center h-96">
        <div className="text-gray-400 mb-4">No analytics data available</div>
        <div className="text-sm text-gray-500">Start your first broadcast to see analytics!</div>
      </div>
    );
  }

  const platformData = [
    { name: 'YouTube', value: analytics.youtubeStreams, color: '#FF0000' },
    { name: 'Facebook', value: analytics.facebookStreams, color: '#1877F2' },
    { name: 'Twitch', value: analytics.twitchStreams, color: '#9146FF' },
    { name: 'X', value: analytics.xStreams, color: '#000000' },
    { name: 'Rumble', value: analytics.rumbleStreams, color: '#85C742' },
    { name: 'LinkedIn', value: analytics.linkedinStreams, color: '#0A66C2' },
  ].filter(p => p.value > 0);

  const totalPlatformStreams = platformData.reduce((sum, p) => sum + p.value, 0);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Analytics Dashboard</h1>
        <p className="text-gray-400">Track your streaming performance and engagement</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Broadcasts */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Broadcasts</span>
            <span className="text-2xl">📺</span>
          </div>
          <div className="text-3xl font-bold text-white">{analytics.totalBroadcasts}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatDuration(analytics.totalStreamTime)} total
          </div>
        </div>

        {/* Total Viewers */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Total Viewers</span>
            <span className="text-2xl">👥</span>
          </div>
          <div className="text-3xl font-bold text-white">{analytics.totalViewers.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            Peak: {analytics.peakViewers.toLocaleString()}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Chat Messages</span>
            <span className="text-2xl">💬</span>
          </div>
          <div className="text-3xl font-bold text-white">{analytics.totalChatMessages.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.totalSuperChats} Super Chats
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Super Chat Revenue</span>
            <span className="text-2xl">💰</span>
          </div>
          <div className="text-3xl font-bold text-white">${analytics.superChatRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">
            From {analytics.totalSuperChats} donations
          </div>
        </div>
      </div>

      {/* Platform Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Platform Usage Chart */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-6">Platform Distribution</h2>

          {platformData.length > 0 ? (
            <div className="space-y-4">
              {platformData.map((platform) => (
                <div key={platform.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-300">{platform.name}</span>
                    <span className="text-sm text-gray-400">
                      {platform.value} ({Math.round((platform.value / totalPlatformStreams) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-700 rounded-full h-2">
                    <div
                      className="h-2 rounded-full transition-all duration-300"
                      style={{
                        width: `${(platform.value / totalPlatformStreams) * 100}%`,
                        backgroundColor: platform.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No platform data available
            </div>
          )}
        </div>

        {/* Best Performance */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h2 className="text-xl font-semibold text-white mb-6">Best Performance</h2>

          <div className="space-y-6">
            {/* Peak Viewers */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">🏆</span>
                <span className="text-sm text-gray-400">Peak Viewers</span>
              </div>
              <div className="text-3xl font-bold text-white">{analytics.peakViewers.toLocaleString()}</div>
            </div>

            {/* Longest Stream */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-2xl">⏱️</span>
                <span className="text-sm text-gray-400">Longest Stream</span>
              </div>
              <div className="text-3xl font-bold text-white">
                {formatDuration(analytics.longestStreamSeconds)}
              </div>
            </div>

            {/* Last Broadcast */}
            {analytics.lastBroadcastAt && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-2xl">📅</span>
                  <span className="text-sm text-gray-400">Last Broadcast</span>
                </div>
                <div className="text-lg font-medium text-white">
                  {formatDate(analytics.lastBroadcastAt)}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast History */}
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-white">Broadcast History</h2>

          {/* Period Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('7d')}
              className={`px-3 py-1.5 text-sm rounded ${
                selectedPeriod === '7d'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('30d')}
              className={`px-3 py-1.5 text-sm rounded ${
                selectedPeriod === '30d'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1.5 text-sm rounded ${
                selectedPeriod === 'all'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              All Time
            </button>
          </div>
        </div>

        {filteredHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Date</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Duration</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Viewers</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Peak</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Avg</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Chat</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.map((broadcast) => {
                  const platforms = [
                    { name: 'youtube', views: broadcast.youtubeViews },
                    { name: 'facebook', views: broadcast.facebookViews },
                    { name: 'twitch', views: broadcast.twitchViews },
                    { name: 'x', views: broadcast.xViews },
                    { name: 'rumble', views: broadcast.rumbleViews },
                    { name: 'linkedin', views: broadcast.linkedinViews },
                  ].filter(p => p.views > 0);

                  return (
                    <tr key={broadcast.broadcastId} className="border-b border-gray-700 hover:bg-gray-750">
                      <td className="py-3 px-4 text-sm text-white">{formatDate(broadcast.startedAt)}</td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {formatDuration(broadcast.totalDurationSeconds)}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {broadcast.totalViewers.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-green-400 font-medium">
                        {broadcast.peakViewers.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {broadcast.averageViewers.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-300">
                        {broadcast.totalChatMessages.toLocaleString()}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex gap-1">
                          {platforms.map(p => (
                            <div
                              key={p.name}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: getPlatformColor(p.name) }}
                              title={`${p.name}: ${p.views} viewers`}
                            >
                              {p.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-gray-500">
            No broadcasts in selected period
          </div>
        )}
      </div>
    </div>
  );
};
