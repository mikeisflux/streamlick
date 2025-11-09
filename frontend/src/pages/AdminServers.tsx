/**
 * Admin Media Servers Management Page
 * Monitor and scale media server infrastructure
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { toast } from 'react-hot-toast';

interface MediaServer {
  id: string;
  url: string;
  ip: string;
  isHealthy: boolean;
  activeStreams: number;
  cpuUsage: number;
  memoryUsage: number;
  lastHealthCheck: string;
}

interface PoolStats {
  totalServers: number;
  healthyServers: number;
  unhealthyServers: number;
  totalActiveStreams: number;
  averageCpuUsage: number;
  averageMemoryUsage: number;
  hasCapacity: boolean;
  recommendation: {
    action: 'none' | 'warning' | 'scale_up';
    message: string;
  };
  servers: MediaServer[];
}

export function AdminServers() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [stats, setStats] = useState<PoolStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [newServerUrl, setNewServerUrl] = useState('');
  const [addingServer, setAddingServer] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
      toast.error('Admin access required');
    }
  }, [user, navigate]);

  // Load server stats
  const loadStats = async () => {
    try {
      const response = await api.get('/media-servers/stats');
      setStats(response.data);
    } catch (error: any) {
      console.error('Error loading stats:', error);
      toast.error('Failed to load server stats');
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 5 seconds
  useEffect(() => {
    loadStats();
    const interval = setInterval(loadStats, 5000);
    return () => clearInterval(interval);
  }, []);

  // Add new server
  const handleAddServer = async () => {
    if (!newServerUrl.trim()) {
      toast.error('Please enter a server URL');
      return;
    }

    setAddingServer(true);
    try {
      await api.post('/media-servers', { url: newServerUrl });
      toast.success('Media server added successfully!');
      setNewServerUrl('');
      setShowAddModal(false);
      await loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add server');
    } finally {
      setAddingServer(false);
    }
  };

  // Remove server
  const handleRemoveServer = async (serverId: string) => {
    if (!confirm('Are you sure you want to remove this server?')) return;

    try {
      await api.delete(`/media-servers/${serverId}`);
      toast.success('Server removed successfully');
      await loadStats();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove server');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading server stats...</div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-600">Failed to load server stats</div>
      </div>
    );
  }

  const getActionColor = (action: string) => {
    switch (action) {
      case 'scale_up': return 'bg-red-100 text-red-800 border-red-300';
      case 'warning': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      default: return 'bg-green-100 text-green-800 border-green-300';
    }
  };

  const getHealthColor = (isHealthy: boolean) => {
    return isHealthy ? 'bg-green-500' : 'bg-red-500';
  };

  const getLoadColor = (value: number, threshold: 'cpu' | 'streams') => {
    if (threshold === 'cpu') {
      if (value >= 80) return 'text-red-600';
      if (value >= 70) return 'text-yellow-600';
      return 'text-green-600';
    } else {
      if (value >= 20) return 'text-red-600';
      if (value >= 15) return 'text-yellow-600';
      return 'text-green-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/dashboard')}
            className="mb-4 text-primary-600 hover:text-primary-700 flex items-center gap-2"
          >
            ← Back to Dashboard
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Media Server Infrastructure</h1>
          <p className="mt-2 text-gray-600">Monitor and scale your streaming infrastructure</p>
        </div>

        {/* Scaling Recommendation Alert */}
        <div
          className={`mb-6 p-4 border rounded-lg ${getActionColor(stats.recommendation.action)}`}
        >
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="mt-1">
                {stats.recommendation.action === 'scale_up' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                )}
                {stats.recommendation.action === 'warning' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                )}
                {stats.recommendation.action === 'none' && (
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
              </div>
              <div>
                <h3 className="font-semibold">
                  {stats.recommendation.action === 'scale_up' && 'Action Required: Scale Up'}
                  {stats.recommendation.action === 'warning' && 'Warning: Approaching Capacity'}
                  {stats.recommendation.action === 'none' && 'All Systems Normal'}
                </h3>
                <p className="mt-1">{stats.recommendation.message}</p>
              </div>
            </div>
            {stats.recommendation.action !== 'none' && (
              <button
                onClick={() => setShowInstructions(true)}
                className="ml-4 px-4 py-2 bg-white rounded-lg font-medium hover:bg-gray-50 transition-colors"
              >
                Scale Now
              </button>
            )}
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-600 text-sm font-medium">Total Servers</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.totalServers}</div>
            <div className="mt-2 text-sm text-gray-500">
              {stats.healthyServers} healthy, {stats.unhealthyServers} down
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-600 text-sm font-medium">Active Streams</div>
            <div className="mt-2 text-3xl font-bold text-gray-900">{stats.totalActiveStreams}</div>
            <div className="mt-2 text-sm text-gray-500">
              ~{(stats.totalActiveStreams / stats.healthyServers || 0).toFixed(1)} per server
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-600 text-sm font-medium">Avg CPU Usage</div>
            <div className={`mt-2 text-3xl font-bold ${getLoadColor(stats.averageCpuUsage, 'cpu')}`}>
              {stats.averageCpuUsage.toFixed(1)}%
            </div>
            <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full ${stats.averageCpuUsage >= 80 ? 'bg-red-500' : stats.averageCpuUsage >= 70 ? 'bg-yellow-500' : 'bg-green-500'}`}
                style={{ width: `${Math.min(stats.averageCpuUsage, 100)}%` }}
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="text-gray-600 text-sm font-medium">Capacity Status</div>
            <div className={`mt-2 text-lg font-bold ${stats.hasCapacity ? 'text-green-600' : 'text-red-600'}`}>
              {stats.hasCapacity ? 'Available' : 'At Capacity'}
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-3 w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
            >
              + Add Server
            </button>
          </div>
        </div>

        {/* Server List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Media Servers</h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Server
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Streams
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    CPU Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Memory Usage
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Check
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {stats.servers.map((server) => (
                  <tr key={server.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${getHealthColor(server.isHealthy)}`} />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{server.id}</div>
                          <div className="text-xs text-gray-500">{server.ip}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          server.isHealthy
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {server.isHealthy ? 'Healthy' : 'Unhealthy'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getLoadColor(server.activeStreams, 'streams')}`}>
                        {server.activeStreams} / 25
                      </div>
                      <div className="mt-1 h-1.5 w-24 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${server.activeStreams >= 20 ? 'bg-red-500' : server.activeStreams >= 15 ? 'bg-yellow-500' : 'bg-green-500'}`}
                          style={{ width: `${(server.activeStreams / 25) * 100}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className={`text-sm font-medium ${getLoadColor(server.cpuUsage, 'cpu')}`}>
                        {server.cpuUsage.toFixed(1)}%
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{server.memoryUsage.toFixed(1)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(server.lastHealthCheck).toLocaleTimeString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {stats.servers.length > 1 && (
                        <button
                          onClick={() => handleRemoveServer(server.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Add Server Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Add Media Server</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Server URL
                </label>
                <input
                  type="text"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="http://116.203.x.x:3001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
                <p className="mt-2 text-xs text-gray-500">
                  Enter the full URL of the media server (e.g., http://116.203.123.45:3001)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={addingServer}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddServer}
                  disabled={addingServer}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {addingServer ? 'Adding...' : 'Add Server'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scaling Instructions Modal */}
        {showInstructions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6 border-b border-gray-200 sticky top-0 bg-white">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">How to Add a Media Server</h3>
                  <button
                    onClick={() => setShowInstructions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-900">
                    <strong>Total time: 10 minutes</strong> | Cost: €11.99/month (~$13/month) for CCX13
                  </p>
                  <p className="text-xs text-blue-700 mt-1">
                    Each CCX13 server handles 3-5 concurrent streams. Scale horizontally as needed.
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Step 1: Create New Server (2 min)</h4>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600 ml-4">
                      <li>Go to Hetzner Cloud console</li>
                      <li>Click "Create Server"</li>
                      <li>Select: <strong>CCX13</strong> (2 vCPU, 8GB RAM, €11.99/month) or <strong>CCX23</strong> (4 vCPU, 16GB, €24.49/month)</li>
                      <li>Image: Ubuntu 22.04</li>
                      <li>Add your SSH key</li>
                      <li>Click "Create & Buy"</li>
                      <li>Note the server IP: <code className="bg-gray-100 px-1 py-0.5 rounded">116.203.x.x</code></li>
                    </ol>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Step 2: SSH and Deploy (5 min)</h4>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                      <div>ssh root@116.203.x.x</div>
                      <div className="mt-2">git clone https://github.com/mikeisflux/streamlick.git</div>
                      <div>cd streamlick</div>
                      <div>sudo ./scripts/quick-deploy.sh</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Step 3: Configure (1 min)</h4>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                      <div>nano media-server/.env</div>
                      <div className="mt-2 text-yellow-400"># Set your server's public IP:</div>
                      <div>MEDIASOUP_ANNOUNCED_IP=116.203.x.x</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Step 4: Start Services (1 min)</h4>
                    <div className="bg-gray-900 text-gray-100 p-3 rounded-lg text-sm font-mono overflow-x-auto">
                      <div>npm install</div>
                      <div>pm2 start npm --name "media" -- run start --workspace=media-server</div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Step 5: Add to Pool (1 min)</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      Click "Add Server" button above and enter:
                    </p>
                    <div className="bg-gray-100 p-3 rounded-lg text-sm font-mono">
                      http://116.203.x.x:3001
                    </div>
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-900">
                    ✅ Done! New server will automatically start accepting streams.
                  </p>
                </div>
              </div>

              <div className="p-6 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={() => setShowInstructions(false)}
                  className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                  Got it!
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
