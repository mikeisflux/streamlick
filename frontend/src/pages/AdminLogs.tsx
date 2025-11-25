import { useEffect, useState } from 'react';
import { Button } from '../components/Button';
import api from '../services/api';
import toast from 'react-hot-toast';

interface DiagnosticLog {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug' | 'performance';
  category: 'rtp-pipeline' | 'ffmpeg' | 'compositor' | 'network' | 'system';
  component: string;
  message: string;
  broadcastId?: string;
  data?: any;
  metrics?: any;
  error?: any;
}

export function AdminLogs() {
  const [logs, setLogs] = useState<DiagnosticLog[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [limit, setLimit] = useState(500);
  const [activeTab, setActiveTab] = useState<'diagnostic' | 'application' | 'oauth' | 'media-server'>('application');

  useEffect(() => {
    fetchLogs();
  }, [selectedLevel, selectedCategory, limit, activeTab]);

  const fetchLogs = async () => {
    setIsLoading(true);
    try {
      const params: any = { limit };

      // Build endpoint based on active tab
      let endpoint = '/logs/diagnostic';
      if (activeTab === 'application') {
        endpoint = '/logs/application';
        if (selectedLevel.length > 0) {
          params.level = selectedLevel[0]; // Application logs use single level
        }
        if (searchQuery) {
          params.search = searchQuery;
        }
      } else if (activeTab === 'oauth') {
        endpoint = '/logs/oauth';
      } else if (activeTab === 'media-server') {
        endpoint = '/logs/media-server';
        if (searchQuery) {
          params.search = searchQuery;
        }
      } else {
        // Diagnostic logs
        if (selectedLevel.length > 0) {
          params.level = selectedLevel.join(',');
        }
        if (selectedCategory.length > 0) {
          params.category = selectedCategory.join(',');
        }
      }

      const response = await api.get(endpoint, { params });
      setLogs(response.data.logs || []);
    } catch (error) {
      toast.error('Failed to fetch logs');
      console.error('Fetch logs error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadReport = async (format: 'json' | 'csv') => {
    try {
      toast.loading('Generating report...');

      const params: any = { format };
      if (selectedCategory.length > 0) {
        params.category = selectedCategory.join(',');
      }

      const response = await api.get('/logs/report', {
        params,
        responseType: 'blob',
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `diagnostic-report-${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.dismiss();
      toast.success(`Report downloaded as ${format.toUpperCase()}`);
    } catch (error) {
      toast.dismiss();
      toast.error('Failed to download report');
      console.error('Download report error:', error);
    }
  };

  const handleClearLogs = async () => {
    if (!confirm('Are you sure you want to clear all logs? This action cannot be undone.')) {
      return;
    }

    try {
      await api.delete('/logs/diagnostic');
      setLogs([]);
      toast.success('Logs cleared successfully');
    } catch (error) {
      toast.error('Failed to clear logs');
      console.error('Clear logs error:', error);
    }
  };

  const toggleLevel = (level: string) => {
    setSelectedLevel((prev) =>
      prev.includes(level) ? prev.filter((l) => l !== level) : [...prev, level]
    );
  };

  const toggleCategory = (category: string) => {
    setSelectedCategory((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  const getLevelColor = (level: string): string => {
    switch (level) {
      case 'error':
        return 'text-red-400 bg-red-900/30';
      case 'warn':
        return 'text-yellow-400 bg-yellow-900/30';
      case 'performance':
        return 'text-purple-400 bg-purple-900/30';
      case 'debug':
        return 'text-gray-400 bg-gray-900/30';
      default:
        return 'text-blue-400 bg-blue-900/30';
    }
  };

  const getCategoryIcon = (category: string): string => {
    switch (category) {
      case 'rtp-pipeline':
        return '🔗';
      case 'ffmpeg':
        return '🎬';
      case 'compositor':
        return '🎨';
      case 'network':
        return '🌐';
      case 'system':
        return '⚙️';
      default:
        return '📝';
    }
  };

  const filteredLogs = logs.filter((log) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        log.message.toLowerCase().includes(query) ||
        log.component.toLowerCase().includes(query) ||
        log.broadcastId?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Application Logs</h1>
          <p className="text-gray-400">
            View and analyze logs for debugging and monitoring
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-700">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('application')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'application'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📋 Application Logs
            </button>
            <button
              onClick={() => setActiveTab('oauth')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'oauth'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔐 OAuth Logs
            </button>
            <button
              onClick={() => setActiveTab('diagnostic')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'diagnostic'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              🔧 Diagnostic Logs
            </button>
            <button
              onClick={() => setActiveTab('media-server')}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === 'media-server'
                  ? 'text-white border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              📡 Media Server
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="bg-gray-800 rounded-lg p-6 mb-6 space-y-4">
          {/* Level Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Log Level</label>
            <div className="flex flex-wrap gap-2">
              {['error', 'warn', 'info', 'debug', 'performance'].map((level) => (
                <button
                  key={level}
                  onClick={() => toggleLevel(level)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedLevel.includes(level)
                      ? getLevelColor(level)
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Category Filters */}
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Category</label>
            <div className="flex flex-wrap gap-2">
              {['rtp-pipeline', 'ffmpeg', 'compositor', 'network', 'system'].map((category) => (
                <button
                  key={category}
                  onClick={() => toggleCategory(category)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedCategory.includes(category)
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                  }`}
                >
                  {getCategoryIcon(category)} {category.replace('-', ' ').toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Search and Controls */}
          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-medium text-gray-300 mb-2">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search logs..."
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
              />
            </div>

            <div className="w-32">
              <label className="block text-sm font-medium text-gray-300 mb-2">Limit</label>
              <select
                value={limit}
                onChange={(e) => setLimit(parseInt(e.target.value))}
                className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
              >
                <option value="100">100</option>
                <option value="500">500</option>
                <option value="1000">1000</option>
                <option value="5000">5000</option>
              </select>
            </div>

            <Button onClick={fetchLogs} variant="secondary" disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Refresh'}
            </Button>

            <Button onClick={() => handleDownloadReport('json')} variant="secondary">
              📥 Export JSON
            </Button>

            <Button onClick={() => handleDownloadReport('csv')} variant="secondary">
              📥 Export CSV
            </Button>

            <Button onClick={handleClearLogs} variant="danger">
              🗑️ Clear Logs
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-800 rounded-lg p-4">
            <div className="text-gray-400 text-sm mb-1">Total Logs</div>
            <div className="text-2xl font-bold">{filteredLogs.length}</div>
          </div>
          <div className="bg-red-900/30 rounded-lg p-4">
            <div className="text-red-400 text-sm mb-1">Errors</div>
            <div className="text-2xl font-bold text-red-400">
              {filteredLogs.filter((l) => l.level === 'error').length}
            </div>
          </div>
          <div className="bg-yellow-900/30 rounded-lg p-4">
            <div className="text-yellow-400 text-sm mb-1">Warnings</div>
            <div className="text-2xl font-bold text-yellow-400">
              {filteredLogs.filter((l) => l.level === 'warn').length}
            </div>
          </div>
          <div className="bg-purple-900/30 rounded-lg p-4">
            <div className="text-purple-400 text-sm mb-1">Performance</div>
            <div className="text-2xl font-bold text-purple-400">
              {filteredLogs.filter((l) => l.level === 'performance').length}
            </div>
          </div>
        </div>

        {/* Logs Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full">
              <thead className="bg-gray-700 sticky top-0">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Level</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Component</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Message</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Broadcast</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredLogs.map((log, index) => (
                  <tr key={index} className="hover:bg-gray-700/50">
                    <td className="px-4 py-3 text-sm text-gray-300 font-mono whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${getLevelColor(log.level)}`}>
                        {log.level.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {getCategoryIcon(log.category)} {log.category}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{log.component}</td>
                    <td className="px-4 py-3 text-sm text-gray-200 max-w-md truncate" title={log.message}>
                      {log.message}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                      {log.broadcastId ? log.broadcastId.substring(0, 8) : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredLogs.length === 0 && (
            <div className="p-12 text-center text-gray-500">
              <p className="text-lg mb-2">No logs found</p>
              <p className="text-sm">Try adjusting your filters or refreshing</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
