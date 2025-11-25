import { useEffect, useState, useCallback } from 'react';
import { Button } from '../components/Button';
import api from '../services/api';
import toast from 'react-hot-toast';

interface ServerHealth {
  status: string;
  activeStreams: number;
  totalBroadcasts: number;
  cpu: { usage: number; cores: number } | null;
  memory: { total: number; free: number; used: number } | null;
  jvmMemory: { max: number; total: number; free: number; used: number } | null;
  settings: { rtmpEnabled: boolean; webrtcEnabled: boolean; hlsEnabled: boolean } | null;
}

interface StreamInfo {
  streamId: string;
  name: string;
  status: string;
  type: string;
  createdAt: string;
  updatedAt: string;
  duration: number;
  speed: number;
  bitrate: number;
  width: number;
  height: number;
  viewers: {
    rtmp: number;
    webrtc: number;
    hls: number;
    total: number;
  };
  rtmpEndpoints: Array<{
    id: string;
    url: string;
    status: string;
  }>;
  stats: any;
}

interface ActivityLog {
  timestamp: string;
  type: string;
  streamId: string;
  message: string;
}

interface DashboardData {
  timestamp: string;
  server: ServerHealth;
  broadcasts: StreamInfo[];
  recentActivity: ActivityLog[];
}

export function MediaServerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000);
  const [selectedStream, setSelectedStream] = useState<string | null>(null);
  const [streamDetails, setStreamDetails] = useState<any>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await api.get('/logs/media-server/dashboard');
      setData(response.data);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch media server dashboard:', err);
      setError(err.response?.data?.error || 'Failed to connect to Media Server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchStreamDetails = useCallback(async (streamId: string) => {
    try {
      const response = await api.get(`/logs/media-server/stream/${streamId}`);
      setStreamDetails(response.data.stream);
    } catch (err) {
      console.error('Failed to fetch stream details:', err);
      toast.error('Failed to fetch stream details');
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchDashboard, refreshInterval);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshInterval, fetchDashboard]);

  useEffect(() => {
    if (selectedStream) {
      fetchStreamDetails(selectedStream);
      const interval = setInterval(() => fetchStreamDetails(selectedStream), 3000);
      return () => clearInterval(interval);
    }
  }, [selectedStream, fetchStreamDetails]);

  const formatBytes = (bytes: number) => {
    if (!bytes) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'broadcasting':
        return 'bg-green-500';
      case 'created':
        return 'bg-yellow-500';
      case 'finished':
        return 'bg-gray-500';
      case 'failed':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  if (isLoading && !data) {
    return (
      <div className="min-h-screen text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-gray-400">Connecting to Media Server...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Media Server Dashboard</h1>
            <p className="text-gray-400 mt-1">
              Real-time monitoring of Ant Media Server
              {data && (
                <span className="ml-2 text-sm">
                  Last updated: {new Date(data.timestamp).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-400">Refresh:</label>
              <select
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(Number(e.target.value))}
                className="bg-gray-700 text-white rounded px-2 py-1 text-sm"
              >
                <option value={2000}>2s</option>
                <option value={5000}>5s</option>
                <option value={10000}>10s</option>
                <option value={30000}>30s</option>
              </select>
            </div>
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-4 py-2 rounded-lg font-medium ${
                autoRefresh ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-600 hover:bg-gray-500'
              }`}
            >
              {autoRefresh ? 'Auto-Refresh ON' : 'Auto-Refresh OFF'}
            </button>
            <Button onClick={fetchDashboard} variant="secondary">
              Refresh Now
            </Button>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="bg-red-900/50 border border-red-700 text-red-200 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-2">
              <span className="text-red-400">⚠️</span>
              <span>{error}</span>
            </div>
          </div>
        )}

        {/* Server Health Cards */}
        {data && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              {/* Server Status */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Server Status</span>
                  <span className={`w-3 h-3 rounded-full ${data.server.status === 'online' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
                </div>
                <div className="text-2xl font-bold text-white capitalize">{data.server.status}</div>
                <div className="text-sm text-gray-400 mt-1">
                  {data.server.activeStreams} active streams
                </div>
              </div>

              {/* CPU Usage */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-2">CPU Usage</div>
                {data.server.cpu ? (
                  <>
                    <div className="text-2xl font-bold text-white">
                      {(data.server.cpu.usage * 100).toFixed(1)}%
                    </div>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${
                          data.server.cpu.usage > 0.8 ? 'bg-red-500' : data.server.cpu.usage > 0.5 ? 'bg-yellow-500' : 'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(100, data.server.cpu.usage * 100)}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 mt-1">{data.server.cpu.cores} cores</div>
                  </>
                ) : (
                  <div className="text-gray-500">N/A</div>
                )}
              </div>

              {/* Memory Usage */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-2">System Memory</div>
                {data.server.memory ? (
                  <>
                    <div className="text-2xl font-bold text-white">
                      {((data.server.memory.used / data.server.memory.total) * 100).toFixed(1)}%
                    </div>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${(data.server.memory.used / data.server.memory.total) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {formatBytes(data.server.memory.used)} / {formatBytes(data.server.memory.total)}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">N/A</div>
                )}
              </div>

              {/* JVM Memory */}
              <div className="bg-gray-800 rounded-lg p-4">
                <div className="text-gray-400 text-sm mb-2">JVM Heap</div>
                {data.server.jvmMemory ? (
                  <>
                    <div className="text-2xl font-bold text-white">
                      {((data.server.jvmMemory.used / data.server.jvmMemory.max) * 100).toFixed(1)}%
                    </div>
                    <div className="mt-2 h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-purple-500 transition-all duration-300"
                        style={{ width: `${(data.server.jvmMemory.used / data.server.jvmMemory.max) * 100}%` }}
                      />
                    </div>
                    <div className="text-sm text-gray-400 mt-1">
                      {formatBytes(data.server.jvmMemory.used)} / {formatBytes(data.server.jvmMemory.max)}
                    </div>
                  </>
                ) : (
                  <div className="text-gray-500">N/A</div>
                )}
              </div>
            </div>

            {/* Features Enabled */}
            {data.server.settings && (
              <div className="bg-gray-800 rounded-lg p-4 mb-6">
                <div className="text-gray-400 text-sm mb-3">Server Features</div>
                <div className="flex gap-4">
                  <div className={`px-3 py-1 rounded-full text-sm ${data.server.settings.rtmpEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    RTMP {data.server.settings.rtmpEnabled ? '✓' : '✗'}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm ${data.server.settings.webrtcEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    WebRTC {data.server.settings.webrtcEnabled ? '✓' : '✗'}
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm ${data.server.settings.hlsEnabled ? 'bg-green-900 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                    HLS {data.server.settings.hlsEnabled ? '✓' : '✗'}
                  </div>
                </div>
              </div>
            )}

            {/* Active Streams */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Streams List */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                  <h2 className="text-lg font-semibold">Active Streams ({data.broadcasts.filter(b => b.status === 'broadcasting').length})</h2>
                </div>
                <div className="max-h-[400px] overflow-y-auto">
                  {data.broadcasts.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      No streams found
                    </div>
                  ) : (
                    data.broadcasts.map((stream) => (
                      <div
                        key={stream.streamId}
                        onClick={() => setSelectedStream(stream.streamId)}
                        className={`p-4 border-b border-gray-700 hover:bg-gray-700/50 cursor-pointer transition-colors ${
                          selectedStream === stream.streamId ? 'bg-gray-700' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(stream.status)}`}></span>
                            <span className="font-medium truncate max-w-[200px]">{stream.name}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs ${
                            stream.status === 'broadcasting' ? 'bg-green-900/50 text-green-400' : 'bg-gray-600 text-gray-300'
                          }`}>
                            {stream.status}
                          </span>
                        </div>
                        <div className="text-sm text-gray-400">
                          <span className="font-mono">{stream.streamId.substring(0, 20)}...</span>
                        </div>
                        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                          <span>👥 {stream.viewers.total} viewers</span>
                          <span>📡 {stream.rtmpEndpoints.length} endpoints</span>
                          {stream.bitrate > 0 && <span>📊 {(stream.bitrate / 1000).toFixed(0)} kbps</span>}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Stream Details */}
              <div className="bg-gray-800 rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                  <h2 className="text-lg font-semibold">
                    {selectedStream ? 'Stream Details' : 'Select a Stream'}
                  </h2>
                </div>
                <div className="p-4">
                  {streamDetails ? (
                    <div className="space-y-4">
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Stream ID</div>
                        <div className="font-mono text-sm break-all">{streamDetails.streamId}</div>
                      </div>
                      <div>
                        <div className="text-gray-400 text-sm mb-1">Name</div>
                        <div>{streamDetails.name || 'Unnamed'}</div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Status</div>
                          <div className="flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${getStatusColor(streamDetails.status)}`}></span>
                            <span className="capitalize">{streamDetails.status}</span>
                          </div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Duration</div>
                          <div>{formatDuration(streamDetails.duration || 0)}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Resolution</div>
                          <div>{streamDetails.width}x{streamDetails.height}</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Bitrate</div>
                          <div>{(streamDetails.bitrate / 1000).toFixed(0)} kbps</div>
                        </div>
                        <div>
                          <div className="text-gray-400 text-sm mb-1">Speed</div>
                          <div>{streamDetails.speed?.toFixed(2)}x</div>
                        </div>
                      </div>

                      {/* Viewers */}
                      <div>
                        <div className="text-gray-400 text-sm mb-2">Viewers</div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-gray-700/50 rounded p-2 text-center">
                            <div className="text-lg font-bold">{streamDetails.rtmpViewerCount || 0}</div>
                            <div className="text-xs text-gray-400">RTMP</div>
                          </div>
                          <div className="bg-gray-700/50 rounded p-2 text-center">
                            <div className="text-lg font-bold">{streamDetails.webRTCViewerCount || 0}</div>
                            <div className="text-xs text-gray-400">WebRTC</div>
                          </div>
                          <div className="bg-gray-700/50 rounded p-2 text-center">
                            <div className="text-lg font-bold">{streamDetails.hlsViewerCount || 0}</div>
                            <div className="text-xs text-gray-400">HLS</div>
                          </div>
                        </div>
                      </div>

                      {/* RTMP Endpoints */}
                      {streamDetails.rtmpEndpoints && streamDetails.rtmpEndpoints.length > 0 && (
                        <div>
                          <div className="text-gray-400 text-sm mb-2">RTMP Endpoints</div>
                          <div className="space-y-2">
                            {streamDetails.rtmpEndpoints.map((ep: any, idx: number) => (
                              <div key={idx} className="bg-gray-700/50 rounded p-2">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono text-xs truncate max-w-[200px]">
                                    {ep.url?.substring(0, 40)}...
                                  </span>
                                  <span className={`px-2 py-0.5 rounded text-xs ${
                                    ep.status === 'broadcasting' ? 'bg-green-900 text-green-400' : 'bg-gray-600'
                                  }`}>
                                    {ep.status}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* WebRTC Clients */}
                      {streamDetails.webrtcClients && streamDetails.webrtcClients.length > 0 && (
                        <div>
                          <div className="text-gray-400 text-sm mb-2">WebRTC Clients ({streamDetails.webrtcClients.length})</div>
                          <div className="max-h-[150px] overflow-y-auto space-y-1">
                            {streamDetails.webrtcClients.slice(0, 10).map((client: any, idx: number) => (
                              <div key={idx} className="bg-gray-700/50 rounded p-2 text-xs">
                                <div className="flex justify-between">
                                  <span className="font-mono">{client.streamId || client.viewerId || 'Client ' + (idx + 1)}</span>
                                  <span>{client.measuredBitrate ? `${(client.measuredBitrate / 1000).toFixed(0)} kbps` : ''}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-12">
                      Click on a stream to view details
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-gray-800 rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-gray-700/50 border-b border-gray-700">
                <h2 className="text-lg font-semibold">Recent Activity</h2>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {data.recentActivity.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    No recent activity
                  </div>
                ) : (
                  data.recentActivity.map((activity, idx) => (
                    <div key={idx} className="px-4 py-3 border-b border-gray-700/50 flex items-center gap-4">
                      <span className={`w-2 h-2 rounded-full ${
                        activity.type === 'stream_started' ? 'bg-green-500' : 'bg-gray-500'
                      }`}></span>
                      <span className="text-gray-400 text-sm w-24">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </span>
                      <span className="flex-1">{activity.message}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
