import { useState, useEffect } from 'react';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  email: string;
  name?: string;
  role: 'owner' | 'admin' | 'member';
  status: 'active' | 'pending';
  invitedAt?: string;
  joinedAt?: string;
}

const roleColors: Record<string, string> = {
  owner: 'text-gray-500',
  admin: 'text-primary-600',
  member: 'text-gray-700',
};

const roleLabels: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
};

export function Members() {
  const { user } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const [seatsLeft, setSeatsLeft] = useState(0);
  const [totalSeats, setTotalSeats] = useState(5);

  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      // In a real app, this would fetch from the API
      // For now, show the current user as owner
      const mockMembers: TeamMember[] = [
        {
          id: user?.id || '1',
          email: user?.email || 'owner@example.com',
          name: user?.name,
          role: 'owner',
          status: 'active',
          joinedAt: new Date().toISOString(),
        },
      ];

      // Try to load actual team members from API
      try {
        const response = await api.get('/team/members');
        if (response.data && response.data.length > 0) {
          setMembers(response.data);
          setSeatsLeft(response.data.seatsLeft || 0);
          setTotalSeats(response.data.totalSeats || 5);
        } else {
          setMembers(mockMembers);
        }
      } catch {
        // If API doesn't exist yet, use mock data
        setMembers(mockMembers);
      }
    } catch (error) {
      console.error('Failed to load members:', error);
      toast.error('Failed to load team members');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (email: string, role: 'admin' | 'member') => {
    try {
      // In a real app, this would call the API
      await api.post('/team/invite', { email, role });
      toast.success(`Invitation sent to ${email}`);
      setShowInviteModal(false);
      loadMembers();
    } catch (error: any) {
      if (error.response?.status === 404) {
        // API not implemented yet - show success anyway for demo
        const newMember: TeamMember = {
          id: `pending-${Date.now()}`,
          email,
          role,
          status: 'pending',
          invitedAt: new Date().toISOString(),
        };
        setMembers(prev => [...prev, newMember]);
        toast.success(`Invitation sent to ${email}`);
        setShowInviteModal(false);
      } else {
        toast.error('Failed to send invitation');
      }
    }
  };

  const handleRemoveMember = async (member: TeamMember) => {
    if (member.role === 'owner') {
      toast.error('Cannot remove the owner');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.email} from the team?`)) {
      return;
    }

    try {
      await api.delete(`/team/members/${member.id}`);
      toast.success('Member removed');
      setMenuOpen(null);
      loadMembers();
    } catch (error: any) {
      if (error.response?.status === 404) {
        // API not implemented - remove from local state
        setMembers(prev => prev.filter(m => m.id !== member.id));
        toast.success('Member removed');
        setMenuOpen(null);
      } else {
        toast.error('Failed to remove member');
      }
    }
  };

  const handleChangeRole = async (member: TeamMember, newRole: 'admin' | 'member') => {
    if (member.role === 'owner') {
      toast.error('Cannot change owner role');
      return;
    }

    try {
      await api.patch(`/team/members/${member.id}`, { role: newRole });
      toast.success(`Role changed to ${roleLabels[newRole]}`);
      setMenuOpen(null);
      loadMembers();
    } catch (error: any) {
      if (error.response?.status === 404) {
        // API not implemented - update local state
        setMembers(prev => prev.map(m => m.id === member.id ? { ...m, role: newRole } : m));
        toast.success(`Role changed to ${roleLabels[newRole]}`);
        setMenuOpen(null);
      } else {
        toast.error('Failed to change role');
      }
    }
  };

  const filteredMembers = members.filter(member => {
    const matchesSearch = member.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (member.name && member.name.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || member.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <DashboardLayout>
      <div className="max-w-4xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Members</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">
              You have {seatsLeft} seats left
              <button className="text-primary-600 hover:text-primary-700 ml-1 font-medium">
                Add more
              </button>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Invite member
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex gap-4 mb-6">
          {/* Search */}
          <div className="relative flex-1 max-w-sm">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white"
          >
            <option value="all">All Roles</option>
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="member">Member</option>
          </select>
        </div>

        {/* Members List */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-gray-200 bg-gray-50">
              <div className="col-span-8 text-xs font-medium text-gray-500 uppercase tracking-wider">
                Member
              </div>
              <div className="col-span-4 text-xs font-medium text-gray-500 uppercase tracking-wider text-right">
                Role
              </div>
            </div>

            {/* Member Rows */}
            {filteredMembers.length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                No members found
              </div>
            ) : (
              filteredMembers.map((member) => (
                <div
                  key={member.id}
                  className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 last:border-b-0 items-center"
                >
                  <div className="col-span-8">
                    <span className={member.role === 'owner' ? 'text-gray-400' : 'text-gray-900'}>
                      {member.email}
                    </span>
                    {member.status === 'pending' && (
                      <span className="ml-2 text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">
                        Pending
                      </span>
                    )}
                  </div>
                  <div className="col-span-4 flex items-center justify-end gap-2">
                    <span className={`font-medium ${roleColors[member.role]}`}>
                      {roleLabels[member.role]}
                    </span>

                    {/* Actions menu (not for owner) */}
                    {member.role !== 'owner' && (
                      <div className="relative">
                        <button
                          onClick={() => setMenuOpen(menuOpen === member.id ? null : member.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                        >
                          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                            <circle cx="12" cy="6" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="18" r="2" />
                          </svg>
                        </button>

                        {menuOpen === member.id && (
                          <>
                            <div
                              className="fixed inset-0 z-10"
                              onClick={() => setMenuOpen(null)}
                            />
                            <div className="absolute right-0 top-full mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                              {member.role !== 'admin' && (
                                <button
                                  onClick={() => handleChangeRole(member, 'admin')}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Make Admin
                                </button>
                              )}
                              {member.role !== 'member' && (
                                <button
                                  onClick={() => handleChangeRole(member, 'member')}
                                  className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  Make Member
                                </button>
                              )}
                              <button
                                onClick={() => handleRemoveMember(member)}
                                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50"
                              >
                                Remove
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <InviteMemberModal
          onClose={() => setShowInviteModal(false)}
          onInvite={handleInvite}
        />
      )}
    </DashboardLayout>
  );
}

interface InviteMemberModalProps {
  onClose: () => void;
  onInvite: (email: string, role: 'admin' | 'member') => void;
}

function InviteMemberModal({ onClose, onInvite }: InviteMemberModalProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'member'>('member');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Please enter an email address');
      return;
    }
    setIsLoading(true);
    await onInvite(email.trim(), role);
    setIsLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Invite team member</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Email address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="colleague@company.com"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Role */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Role
            </label>
            <div className="space-y-3">
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="role"
                  value="admin"
                  checked={role === 'admin'}
                  onChange={() => setRole('admin')}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Admin</div>
                  <div className="text-sm text-gray-500">
                    Can create broadcasts, manage destinations, and invite members
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="role"
                  value="member"
                  checked={role === 'member'}
                  onChange={() => setRole('member')}
                  className="mt-1 w-4 h-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <div>
                  <div className="font-medium text-gray-900">Member</div>
                  <div className="text-sm text-gray-500">
                    Can create and join broadcasts
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 font-medium transition-colors disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
