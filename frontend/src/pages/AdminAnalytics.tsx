import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { BarChart3, ArrowLeft, TrendingUp, Users, Radio, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface AnalyticsData {
  totalUsers: number;
  totalBroadcasts: number;
  activeBroadcasts: number;
  totalViewTime: number;
  avgBroadcastDuration: number;
  topBroadcasters: Array<{
    userId: string;
    email: string;
    broadcastCount: number;
  }>;
  recentActivity: Array<{
    type: string;
    message: string;
    timestamp: string;
  }>;
}

export function AdminAnalytics() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      const response = await api.get(`/api/admin/analytics?range=${timeRange}`);
      setAnalytics(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      // Set default values on error
      setAnalytics({
        totalUsers: 0,
        totalBroadcasts: 0,
        activeBroadcasts: 0,
        totalViewTime: 0,
        avgBroadcastDuration: 0,
        topBroadcasters: [],
        recentActivity: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`;
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return `${hours}h ${mins}m`;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 1000 / 60);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
    return `${Math.floor(minutes / 1440)}d ago`;
  };

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link to="/admin" className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Admin
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-cyan-500/10 rounded-lg">
                <BarChart3 className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Platform Analytics</h1>
                <p className="text-gray-400">View usage metrics and insights</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {(['24h', '7d', '30d', 'all'] as const).map((range) => (
                <button
                  key={range}
                  onClick={() => setTimeRange(range)}
                  className={`px-4 py-2 rounded-lg transition-colors ${
                    timeRange === range
                      ? 'bg-cyan-600 text-white'
                      : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                  }`}
                >
                  {range === '24h'
                    ? 'Last 24h'
                    : range === '7d'
                    ? 'Last 7 days'
                    : range === '30d'
                    ? 'Last 30 days'
                    : 'All Time'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12 text-gray-400">Loading analytics...</div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-gray-800 rounded-lg p-6 border border-indigo-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-indigo-500/10 rounded-lg">
                    <Users className="w-6 h-6 text-indigo-400" />
                  </div>
                  <TrendingUp className="w-5 h-5 text-green-400" />
                </div>
                <div className="text-gray-400 text-sm mb-1">Total Users</div>
                <div className="text-3xl font-bold text-white">{analytics?.totalUsers || 0}</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-cyan-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-cyan-500/10 rounded-lg">
                    <Radio className="w-6 h-6 text-cyan-400" />
                  </div>
                </div>
                <div className="text-gray-400 text-sm mb-1">Total Broadcasts</div>
                <div className="text-3xl font-bold text-white">{analytics?.totalBroadcasts || 0}</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-red-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-red-500/10 rounded-lg">
                    <Radio className="w-6 h-6 text-red-400" />
                  </div>
                  {(analytics?.activeBroadcasts || 0) > 0 && (
                    <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  )}
                </div>
                <div className="text-gray-400 text-sm mb-1">Active Now</div>
                <div className="text-3xl font-bold text-white">{analytics?.activeBroadcasts || 0}</div>
              </div>

              <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/20">
                <div className="flex items-center justify-between mb-4">
                  <div className="p-3 bg-purple-500/10 rounded-lg">
                    <Clock className="w-6 h-6 text-purple-400" />
                  </div>
                </div>
                <div className="text-gray-400 text-sm mb-1">Avg Duration</div>
                <div className="text-3xl font-bold text-white">
                  {formatDuration(analytics?.avgBroadcastDuration || 0)}
                </div>
              </div>
            </div>

            {/* Charts and Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Broadcasters */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-green-400" />
                  Top Broadcasters
                </h3>
                {analytics?.topBroadcasters && analytics.topBroadcasters.length > 0 ? (
                  <div className="space-y-3">
                    {analytics.topBroadcasters.slice(0, 5).map((broadcaster, index) => (
                      <div
                        key={broadcaster.userId}
                        className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center text-cyan-400 font-semibold text-sm">
                            #{index + 1}
                          </div>
                          <div>
                            <div className="text-white font-medium">{broadcaster.email}</div>
                            <div className="text-xs text-gray-400">
                              {broadcaster.broadcastCount} broadcasts
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No data available</div>
                )}
              </div>

              {/* Recent Activity */}
              <div className="bg-gray-800 rounded-lg p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  Recent Activity
                </h3>
                {analytics?.recentActivity && analytics.recentActivity.length > 0 ? (
                  <div className="space-y-3 max-h-80 overflow-y-auto">
                    {analytics.recentActivity.map((activity, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-700/30 rounded-lg">
                        <div className="w-2 h-2 bg-blue-400 rounded-full mt-2 flex-shrink-0"></div>
                        <div className="flex-1">
                          <div className="text-white text-sm">{activity.message}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formatTime(activity.timestamp)}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">No recent activity</div>
                )}
              </div>
            </div>

            {/* Platform Overview */}
            <div className="mt-6 bg-gray-800 rounded-lg p-6">
              <h3 className="text-xl font-semibold text-white mb-4">Platform Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <div className="text-gray-400 text-sm mb-2">Total View Time</div>
                  <div className="text-2xl font-bold text-white">
                    {formatDuration(analytics?.totalViewTime || 0)}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Across all broadcasts</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-2">Platform Status</div>
                  <div className="text-2xl font-bold text-green-400">Online</div>
                  <div className="text-xs text-gray-500 mt-1">All systems operational</div>
                </div>
                <div>
                  <div className="text-gray-400 text-sm mb-2">Time Range</div>
                  <div className="text-2xl font-bold text-cyan-400">
                    {timeRange === '24h'
                      ? 'Last 24h'
                      : timeRange === '7d'
                      ? '7 days'
                      : timeRange === '30d'
                      ? '30 days'
                      : 'All Time'}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">Selected period</div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
