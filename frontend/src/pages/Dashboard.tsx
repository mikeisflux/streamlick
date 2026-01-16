import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Play, Settings, Trash2, Users, LogOut, Radio } from 'lucide-react';
import { broadcastAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: broadcastAPI.list,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => broadcastAPI.create({ title }),
    onSuccess: (broadcast) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      navigate(`/studio/${broadcast.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: broadcastAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      createMutation.mutate(newTitle.trim());
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">LIVE</span>;
      case 'GREENROOM':
        return <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">GREENROOM</span>;
      case 'ENDED':
        return <span className="px-2 py-1 bg-dark-600 text-dark-400 rounded text-xs font-medium">ENDED</span>;
      default:
        return <span className="px-2 py-1 bg-dark-700 text-dark-400 rounded text-xs font-medium">IDLE</span>;
    }
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="border-b border-dark-800 bg-dark-900">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="text-2xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text">
              Streamlick
            </div>
            <div className="flex items-center gap-4">
              <Link to="/destinations" className="flex items-center gap-2 text-dark-400 hover:text-white transition">
                <Radio className="w-4 h-4" />
                Destinations
              </Link>
              <div className="flex items-center gap-2 text-dark-400">
                <div className="w-8 h-8 bg-brand-600 rounded-full flex items-center justify-center text-white font-medium">
                  {user?.name?.charAt(0).toUpperCase()}
                </div>
                <span>{user?.name}</span>
              </div>
              <button
                onClick={logout}
                className="p-2 text-dark-400 hover:text-white transition"
                title="Logout"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="container mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Your Broadcasts</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
          >
            <Plus className="w-5 h-5" />
            New Broadcast
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-20 text-dark-400">Loading...</div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 bg-dark-800 rounded-full flex items-center justify-center">
              <Play className="w-8 h-8 text-dark-500" />
            </div>
            <h3 className="text-lg font-medium mb-2">No broadcasts yet</h3>
            <p className="text-dark-400 mb-6">Create your first broadcast to get started</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
            >
              <Plus className="w-5 h-5" />
              New Broadcast
            </button>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {broadcasts.map((broadcast: any) => (
              <div
                key={broadcast.id}
                className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden hover:border-dark-700 transition"
              >
                <div className="aspect-video bg-dark-800 flex items-center justify-center">
                  <Play className="w-12 h-12 text-dark-600" />
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold truncate">{broadcast.title}</h3>
                    {getStatusBadge(broadcast.status)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-dark-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {broadcast._count?.participants || 0}
                    </span>
                    <span>
                      {new Date(broadcast.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link
                      to={`/studio/${broadcast.id}`}
                      className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg text-center font-medium transition"
                    >
                      {broadcast.status === 'ENDED' ? 'View' : 'Enter Studio'}
                    </Link>
                    <button
                      onClick={() => {
                        if (confirm('Delete this broadcast?')) {
                          deleteMutation.mutate(broadcast.id);
                        }
                      }}
                      className="p-2 text-dark-400 hover:text-red-400 transition"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-md border border-dark-800">
            <h2 className="text-xl font-bold mb-4">Create New Broadcast</h2>
            <form onSubmit={handleCreate}>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Broadcast title"
                className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500 mb-4"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  className="flex-1 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
