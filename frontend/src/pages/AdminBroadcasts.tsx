import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { Radio, Search, Eye, Trash2, ArrowLeft, Users, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface Broadcast {
  id: string;
  title: string;
  userId: string;
  user?: {
    email: string;
    name?: string;
  };
  status: 'waiting' | 'live' | 'ended';
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  viewers?: number;
}

export function AdminBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [filteredBroadcasts, setFilteredBroadcasts] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'live' | 'waiting' | 'ended'>('all');

  useEffect(() => {
    fetchBroadcasts();
    // Refresh every 10 seconds
    const interval = setInterval(fetchBroadcasts, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Filter broadcasts
    let filtered = broadcasts;

    if (filterStatus !== 'all') {
      filtered = filtered.filter((b) => b.status === filterStatus);
    }

    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (b) =>
          b.title.toLowerCase().includes(query) ||
          b.user?.email.toLowerCase().includes(query) ||
          b.id.toLowerCase().includes(query)
      );
    }

    setFilteredBroadcasts(filtered);
  }, [searchQuery, filterStatus, broadcasts]);

  const fetchBroadcasts = async () => {
    try {
      const response = await api.get('/admin/broadcasts');
      setBroadcasts(response.data);
    } catch (error) {
      console.error('Error fetching broadcasts:', error);
      if (!loading) {
        toast.error('Failed to load broadcasts');
      }
    } finally {
      setLoading(false);
    }
  };

  const deleteBroadcast = async (id: string) => {
    if (!confirm('Are you sure you want to delete this broadcast?')) {
      return;
    }

    try {
      await api.delete(`/broadcasts/${id}`);
      toast.success('Broadcast deleted');
      fetchBroadcasts();
    } catch (error) {
      console.error('Error deleting broadcast:', error);
      toast.error('Failed to delete broadcast');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDuration = (startDate?: string, endDate?: string) => {
    if (!startDate) return '-';
    const start = new Date(startDate).getTime();
    const end = endDate ? new Date(endDate).getTime() : Date.now();
    const diff = Math.floor((end - start) / 1000 / 60); // minutes
    if (diff < 60) return `${diff}m`;
    const hours = Math.floor(diff / 60);
    const mins = diff % 60;
    return `${hours}h ${mins}m`;
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
              <div className="p-3 bg-red-500/10 rounded-lg">
                <Radio className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-4xl font-bold">Broadcast Management</h1>
                <p className="text-gray-400">Monitor and manage all broadcasts</p>
              </div>
            </div>
          </div>
        </div>

        {/* Stats and Filters */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-4 mb-8">
          <div className="lg:col-span-2 bg-gray-800 rounded-lg p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search broadcasts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
          </div>
          <button
            onClick={() => setFilterStatus('all')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            All ({broadcasts.length})
          </button>
          <button
            onClick={() => setFilterStatus('live')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'live'
                ? 'bg-red-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Live ({broadcasts.filter((b) => b.status === 'live').length})
          </button>
          <button
            onClick={() => setFilterStatus('waiting')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'waiting'
                ? 'bg-yellow-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Waiting ({broadcasts.filter((b) => b.status === 'waiting').length})
          </button>
          <button
            onClick={() => setFilterStatus('ended')}
            className={`px-4 py-2 rounded-lg transition-colors ${
              filterStatus === 'ended'
                ? 'bg-gray-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
            }`}
          >
            Ended ({broadcasts.filter((b) => b.status === 'ended').length})
          </button>
        </div>

        {/* Broadcasts Table */}
        <div className="bg-gray-800 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-700">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Broadcast
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Host
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-6 py-4 text-right text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      Loading broadcasts...
                    </td>
                  </tr>
                ) : filteredBroadcasts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                      No broadcasts found
                    </td>
                  </tr>
                ) : (
                  filteredBroadcasts.map((broadcast) => (
                    <tr key={broadcast.id} className="hover:bg-gray-700/50 transition-colors">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-white">{broadcast.title}</div>
                          <div className="text-xs text-gray-500">ID: {broadcast.id.substring(0, 8)}...</div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-300">{broadcast.user?.name || 'Unknown'}</div>
                        <div className="text-xs text-gray-500">{broadcast.user?.email}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium ${
                            broadcast.status === 'live'
                              ? 'bg-red-500/20 text-red-400'
                              : broadcast.status === 'waiting'
                              ? 'bg-yellow-500/20 text-yellow-400'
                              : 'bg-gray-500/20 text-gray-400'
                          }`}
                        >
                          {broadcast.status === 'live' && (
                            <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                          )}
                          {broadcast.status.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-sm text-gray-400">
                          <Clock className="w-4 h-4" />
                          {getDuration(broadcast.startedAt, broadcast.endedAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-400">{formatDate(broadcast.createdAt)}</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            to={`/studio/${broadcast.id}`}
                            className="px-3 py-1 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <Eye className="w-3 h-3" />
                            View
                          </Link>
                          <button
                            onClick={() => deleteBroadcast(broadcast.id)}
                            className="px-3 py-1 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded text-xs transition-colors inline-flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
