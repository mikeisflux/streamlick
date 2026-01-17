import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus, Play, Trash2, Users, LogOut, Radio, Video, Calendar,
  Home, Library, Settings, BarChart3, Copy, MoreVertical, Edit2, X
} from 'lucide-react';
import { broadcastAPI } from '../services/api';
import { useAuthStore } from '../store/authStore';

type CreateType = 'live' | 'recording' | 'webinar' | null;

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, logout } = useAuthStore();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<CreateType>(null);
  const [newTitle, setNewTitle] = useState('');
  const [activeNav, setActiveNav] = useState('home');
  const [editingBroadcast, setEditingBroadcast] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');

  const { data: broadcasts = [], isLoading } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: broadcastAPI.list,
  });

  const createMutation = useMutation({
    mutationFn: (title: string) => broadcastAPI.create({ title }),
    onSuccess: (broadcast) => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      setShowCreateModal(false);
      setCreateType(null);
      setNewTitle('');
      navigate(`/studio/${broadcast.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: broadcastAPI.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) =>
      broadcastAPI.update(id, { title }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] });
      setEditingBroadcast(null);
    },
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTitle.trim()) {
      createMutation.mutate(newTitle.trim());
    }
  };

  const copyInviteLink = (broadcastId: string) => {
    const url = `${window.location.origin}/join/${broadcastId}`;
    navigator.clipboard.writeText(url);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'LIVE':
        return (
          <span className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs font-medium">
            <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
            LIVE
          </span>
        );
      case 'GREENROOM':
        return (
          <span className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
            GREENROOM
          </span>
        );
      case 'ENDED':
        return (
          <span className="px-2 py-1 bg-dark-600 text-dark-400 rounded text-xs font-medium">
            ENDED
          </span>
        );
      default:
        return (
          <span className="px-2 py-1 bg-dark-700 text-dark-400 rounded text-xs font-medium">
            IDLE
          </span>
        );
    }
  };

  return (
    <div className="min-h-screen bg-dark-950 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-900 border-r border-dark-800 flex flex-col">
        {/* Logo */}
        <div className="h-16 flex items-center px-6 border-b border-dark-800">
          <span className="text-xl font-bold bg-gradient-to-r from-brand-400 to-brand-600 text-transparent bg-clip-text">
            Streamlick
          </span>
        </div>

        {/* User Info */}
        <div className="p-4 border-b border-dark-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-600 rounded-full flex items-center justify-center text-white font-medium">
              {user?.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate">{user?.name}</div>
              <div className="text-xs text-dark-400 truncate">{user?.email}</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <div className="space-y-1">
            <NavItem
              icon={Home}
              label="Home"
              active={activeNav === 'home'}
              onClick={() => setActiveNav('home')}
            />
            <NavItem
              icon={Library}
              label="Library"
              active={activeNav === 'library'}
              onClick={() => setActiveNav('library')}
            />
            <NavItem
              icon={Radio}
              label="Destinations"
              active={activeNav === 'destinations'}
              onClick={() => navigate('/destinations')}
            />
          </div>

          <div className="mt-8 pt-4 border-t border-dark-800">
            <div className="text-xs text-dark-500 uppercase font-semibold mb-3 px-3">
              Account
            </div>
            <div className="space-y-1">
              <NavItem
                icon={BarChart3}
                label="Analytics"
                active={activeNav === 'analytics'}
                onClick={() => setActiveNav('analytics')}
              />
              <NavItem
                icon={Settings}
                label="Settings"
                active={activeNav === 'settings'}
                onClick={() => setActiveNav('settings')}
              />
            </div>
          </div>
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-dark-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 w-full px-3 py-2 text-dark-400 hover:text-white hover:bg-dark-800 rounded-lg transition"
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto px-8 py-8">
          {/* Create Section */}
          <section className="mb-12">
            <h2 className="text-lg font-semibold mb-4">Create</h2>
            <div className="grid grid-cols-3 gap-4">
              <CreateButton
                icon={Radio}
                label="Live Stream"
                description="Go live to your audience"
                color="red"
                onClick={() => {
                  setCreateType('live');
                  setShowCreateModal(true);
                }}
              />
              <CreateButton
                icon={Video}
                label="Recording"
                description="Record without going live"
                color="brand"
                onClick={() => {
                  setCreateType('recording');
                  setShowCreateModal(true);
                }}
              />
              <CreateButton
                icon={Calendar}
                label="Webinar"
                description="Schedule a live event"
                color="green"
                onClick={() => {
                  setCreateType('webinar');
                  setShowCreateModal(true);
                }}
              />
            </div>
          </section>

          {/* Studios Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Your Studios</h2>
              <button
                onClick={() => {
                  setCreateType('live');
                  setShowCreateModal(true);
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm transition"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            </div>

            {isLoading ? (
              <div className="text-center py-20 text-dark-400">
                <div className="w-8 h-8 border-2 border-dark-700 border-t-brand-500 rounded-full animate-spin mx-auto mb-4" />
                Loading...
              </div>
            ) : broadcasts.length === 0 ? (
              <EmptyState onCreateClick={() => setShowCreateModal(true)} />
            ) : (
              <div className="bg-dark-900 rounded-xl border border-dark-800 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-dark-800">
                      <th className="text-left px-4 py-3 text-xs text-dark-400 font-semibold uppercase">
                        Studio
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-dark-400 font-semibold uppercase">
                        Status
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-dark-400 font-semibold uppercase">
                        Participants
                      </th>
                      <th className="text-left px-4 py-3 text-xs text-dark-400 font-semibold uppercase">
                        Created
                      </th>
                      <th className="text-right px-4 py-3 text-xs text-dark-400 font-semibold uppercase">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {broadcasts.map((broadcast: any) => (
                      <tr
                        key={broadcast.id}
                        className="border-b border-dark-800 last:border-0 hover:bg-dark-800/50 transition"
                      >
                        <td className="px-4 py-4">
                          {editingBroadcast === broadcast.id ? (
                            <div className="flex items-center gap-2">
                              <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                className="px-2 py-1 bg-dark-700 border border-dark-600 rounded text-sm focus:outline-none focus:border-brand-500"
                                autoFocus
                              />
                              <button
                                onClick={() =>
                                  updateMutation.mutate({
                                    id: broadcast.id,
                                    title: editTitle,
                                  })
                                }
                                className="p-1 text-green-400 hover:bg-dark-700 rounded"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => setEditingBroadcast(null)}
                                className="p-1 text-dark-400 hover:bg-dark-700 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <span className="font-medium">{broadcast.title}</span>
                          )}
                        </td>
                        <td className="px-4 py-4">{getStatusBadge(broadcast.status)}</td>
                        <td className="px-4 py-4">
                          <span className="flex items-center gap-1.5 text-dark-400">
                            <Users className="w-4 h-4" />
                            {broadcast._count?.participants || 0}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-dark-400 text-sm">
                          {new Date(broadcast.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              to={`/studio/${broadcast.id}`}
                              className="px-3 py-1.5 bg-brand-600 hover:bg-brand-700 rounded-lg text-sm font-medium transition"
                            >
                              {broadcast.status === 'ENDED' ? 'View' : 'Enter Studio'}
                            </Link>
                            <BroadcastMenu
                              onCopyLink={() => copyInviteLink(broadcast.id)}
                              onEdit={() => {
                                setEditingBroadcast(broadcast.id);
                                setEditTitle(broadcast.title);
                              }}
                              onDelete={() => {
                                if (confirm('Delete this broadcast?')) {
                                  deleteMutation.mutate(broadcast.id);
                                }
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </main>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-2xl p-6 w-full max-w-md border border-dark-800">
            <h2 className="text-xl font-bold mb-2">
              {createType === 'live' && 'Create Live Stream'}
              {createType === 'recording' && 'Create Recording'}
              {createType === 'webinar' && 'Schedule Webinar'}
            </h2>
            <p className="text-dark-400 text-sm mb-6">
              {createType === 'live' && 'Start a new live broadcast studio'}
              {createType === 'recording' && 'Record content without going live'}
              {createType === 'webinar' && 'Schedule a live event for later'}
            </p>

            <form onSubmit={handleCreate}>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">Title</label>
                <input
                  type="text"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Enter a title for your broadcast"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-700 rounded-lg focus:outline-none focus:border-brand-500"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setCreateType(null);
                    setNewTitle('');
                  }}
                  className="flex-1 py-2.5 bg-dark-800 hover:bg-dark-700 rounded-lg transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newTitle.trim() || createMutation.isPending}
                  className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition disabled:opacity-50"
                >
                  {createMutation.isPending ? 'Creating...' : 'Create Studio'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// Navigation Item Component
function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-3 w-full px-3 py-2 rounded-lg transition ${
        active
          ? 'bg-brand-600/20 text-brand-400'
          : 'text-dark-400 hover:text-white hover:bg-dark-800'
      }`}
    >
      <Icon className="w-5 h-5" />
      <span>{label}</span>
    </button>
  );
}

// Create Button Component
function CreateButton({
  icon: Icon,
  label,
  description,
  color,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  description: string;
  color: 'red' | 'brand' | 'green';
  onClick: () => void;
}) {
  const colorClasses = {
    red: 'bg-red-600/20 text-red-400 group-hover:bg-red-600/30',
    brand: 'bg-brand-600/20 text-brand-400 group-hover:bg-brand-600/30',
    green: 'bg-green-600/20 text-green-400 group-hover:bg-green-600/30',
  };

  return (
    <button
      onClick={onClick}
      className="group p-6 bg-dark-900 border border-dark-800 rounded-xl text-left hover:border-dark-700 transition"
    >
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center mb-4 transition ${colorClasses[color]}`}>
        <Icon className="w-6 h-6" />
      </div>
      <h3 className="font-semibold mb-1">{label}</h3>
      <p className="text-sm text-dark-400">{description}</p>
    </button>
  );
}

// Empty State Component
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <div className="text-center py-20 bg-dark-900 rounded-xl border border-dark-800">
      <div className="w-16 h-16 mx-auto mb-4 bg-dark-800 rounded-full flex items-center justify-center">
        <Play className="w-8 h-8 text-dark-500" />
      </div>
      <h3 className="text-lg font-medium mb-2">No broadcasts yet</h3>
      <p className="text-dark-400 mb-6">Create your first broadcast to get started</p>
      <button
        onClick={onCreateClick}
        className="inline-flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition"
      >
        <Plus className="w-5 h-5" />
        New Broadcast
      </button>
    </div>
  );
}

// Broadcast Menu Component
function BroadcastMenu({
  onCopyLink,
  onEdit,
  onDelete,
}: {
  onCopyLink: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 text-dark-400 hover:text-white hover:bg-dark-700 rounded transition"
      >
        <MoreVertical className="w-4 h-4" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-40 bg-dark-800 border border-dark-700 rounded-lg shadow-xl overflow-hidden z-20">
            <button
              onClick={() => {
                onCopyLink();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-dark-700 transition"
            >
              <Copy className="w-4 h-4" />
              Copy Invite Link
            </button>
            <button
              onClick={() => {
                onEdit();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-dark-700 transition"
            >
              <Edit2 className="w-4 h-4" />
              Edit Title
            </button>
            <button
              onClick={() => {
                onDelete();
                setIsOpen(false);
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-dark-700 transition"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </>
      )}
    </div>
  );
}
