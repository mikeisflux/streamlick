import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuthStore } from '../store/authStore';
import { DashboardLayout } from '../components/layout/DashboardLayout';

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
        api.get(`/analytics/user/${user?.id}`),
        api.get(`/analytics/user/${user?.id}/broadcasts?limit=50`),
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
      <DashboardLayout title="Analytics" subtitle="Track your streaming performance">
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!analytics) {
    return (
      <DashboardLayout title="Analytics" subtitle="Track your streaming performance">
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No analytics data available</h3>
          <p className="text-gray-500">Start your first broadcast to see analytics!</p>
        </div>
      </DashboardLayout>
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
    <DashboardLayout title="Analytics Dashboard" subtitle="Track your streaming performance and engagement">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Broadcasts */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Broadcasts</span>
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics.totalBroadcasts}</div>
          <div className="text-xs text-gray-500 mt-1">
            {formatDuration(analytics.totalStreamTime)} total
          </div>
        </div>

        {/* Total Viewers */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Total Viewers</span>
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics.totalViewers.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            Peak: {analytics.peakViewers.toLocaleString()}
          </div>
        </div>

        {/* Chat Messages */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Chat Messages</span>
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">{analytics.totalChatMessages.toLocaleString()}</div>
          <div className="text-xs text-gray-500 mt-1">
            {analytics.totalSuperChats} Super Chats
          </div>
        </div>

        {/* Revenue */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-600 text-sm">Super Chat Revenue</span>
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div className="text-3xl font-bold text-gray-900">${analytics.superChatRevenue.toFixed(2)}</div>
          <div className="text-xs text-gray-500 mt-1">
            From {analytics.totalSuperChats} donations
          </div>
        </div>
      </div>

      {/* Platform Distribution & Best Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Platform Usage */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Platform Distribution</h2>

          {platformData.length > 0 ? (
            <div className="space-y-4">
              {platformData.map((platform) => (
                <div key={platform.name}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-gray-700">{platform.name}</span>
                    <span className="text-sm text-gray-500">
                      {platform.value} ({Math.round((platform.value / totalPlatformStreams) * 100)}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
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
            <div className="text-center py-8 text-gray-500">
              No platform data available
            </div>
          )}
        </div>

        {/* Best Performance */}
        <div className="bg-white rounded-lg p-6 border border-gray-200 shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6">Best Performance</h2>

          <div className="space-y-6">
            {/* Peak Viewers */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-yellow-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Peak Viewers</div>
                <div className="text-2xl font-bold text-gray-900">{analytics.peakViewers.toLocaleString()}</div>
              </div>
            </div>

            {/* Longest Stream */}
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <div className="text-sm text-gray-500">Longest Stream</div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatDuration(analytics.longestStreamSeconds)}
                </div>
              </div>
            </div>

            {/* Last Broadcast */}
            {analytics.lastBroadcastAt && (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                  <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Last Broadcast</div>
                  <div className="text-lg font-medium text-gray-900">
                    {formatDate(analytics.lastBroadcastAt)}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broadcast History */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Broadcast History</h2>

          {/* Period Filter */}
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedPeriod('7d')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedPeriod === '7d'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              7 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('30d')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedPeriod === '30d'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              30 Days
            </button>
            <button
              onClick={() => setSelectedPeriod('all')}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
                selectedPeriod === 'all'
                  ? 'bg-primary-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Duration</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Viewers</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Peak</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Avg</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Chat</th>
                  <th className="text-left py-3 px-6 text-xs font-medium text-gray-500 uppercase tracking-wider">Platforms</th>
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
                    <tr key={broadcast.broadcastId} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-6 text-sm text-gray-900">{formatDate(broadcast.startedAt)}</td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {formatDuration(broadcast.totalDurationSeconds)}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {broadcast.totalViewers.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-green-600 font-medium">
                        {broadcast.peakViewers.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {broadcast.averageViewers.toLocaleString()}
                      </td>
                      <td className="py-4 px-6 text-sm text-gray-700">
                        {broadcast.totalChatMessages.toLocaleString()}
                      </td>
                      <td className="py-4 px-6">
                        <div className="flex gap-1">
                          {platforms.map(p => (
                            <div
                              key={p.name}
                              className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white"
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
    </DashboardLayout>
  );
};
