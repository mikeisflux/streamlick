import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api from '../services/api';
import {
  Server,
  Settings,
  FileText,
  TestTube2,
  Image,
  BarChart3,
  Users,
  Radio,
  Layout,
  Palette,
  Rocket,
  FileEdit,
  HardDrive,
  Mail
} from 'lucide-react';

export function Admin() {
  const [stats, setStats] = useState({
    activeServers: 0,
    activeBroadcasts: 0,
    totalUsers: 0,
    systemStatus: 'Online',
  });
  const [storageStats, setStorageStats] = useState({
    configured: false,
    totalSize: 0,
    objectCount: 0,
    formattedSize: '0 B',
    bucketName: '',
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        // Fetch all stats in parallel
        const [serversRes, broadcastsRes, usersRes, storageRes] = await Promise.all([
          api.get('/media-servers').catch(() => ({ data: [] })),
          api.get('/broadcasts').catch(() => ({ data: { broadcasts: [] } })),
          api.get('/admin/users').catch(() => ({ data: [] })),
          api.get('/admin/storage-stats').catch(() => ({ data: { configured: false, totalSize: 0, objectCount: 0, formattedSize: '0 B', bucketName: '' } })),
        ]);

        // Handle paginated responses
        const servers = Array.isArray(serversRes.data) ? serversRes.data : [];
        const broadcasts = broadcastsRes.data.broadcasts || [];
        const users = Array.isArray(usersRes.data) ? usersRes.data : [];

        setStats({
          activeServers: servers.filter((s: any) => s.status === 'active').length || 0,
          activeBroadcasts: broadcasts.filter((b: any) => b.status === 'live').length || 0,
          totalUsers: users.length || 0,
          systemStatus: 'Online',
        });

        setStorageStats(storageRes.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
    // Refresh stats every 30 seconds
    const interval = setInterval(fetchStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const adminSections = [
    {
      title: 'Infrastructure',
      description: 'Deploy and scale all server types with one click',
      icon: Rocket,
      path: '/admin/infrastructure',
      color: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    },
    {
      title: 'Media Servers',
      description: 'Manage and monitor media streaming servers',
      icon: Server,
      path: '/admin/servers',
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    },
    {
      title: 'Settings',
      description: 'Configure system-wide settings',
      icon: Settings,
      path: '/admin/settings',
      color: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    },
    {
      title: 'Branding',
      description: 'Customize website logo, colors, and appearance',
      icon: Palette,
      path: '/admin/settings?tab=branding',
      color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    },
    {
      title: 'Page Manager',
      description: 'Edit Privacy Policy, Terms, and Data Deletion pages',
      icon: FileEdit,
      path: '/admin/pages',
      color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    },
    {
      title: 'Logs',
      description: 'View and analyze diagnostic logs',
      icon: FileText,
      path: '/admin/logs',
      color: 'bg-green-500/10 text-green-400 border-green-500/20',
    },
    {
      title: 'Testing',
      description: 'Run system tests and diagnostics',
      icon: TestTube2,
      path: '/admin/testing',
      color: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    },
    {
      title: 'Assets',
      description: 'Manage media assets and storage',
      icon: Image,
      path: '/admin/assets',
      color: 'bg-pink-500/10 text-pink-400 border-pink-500/20',
    },
    {
      title: 'Analytics',
      description: 'View platform analytics and metrics',
      icon: BarChart3,
      path: '/admin/analytics',
      color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    },
    {
      title: 'Users',
      description: 'Manage user accounts and permissions',
      icon: Users,
      path: '/admin/users',
      color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
    },
    {
      title: 'Broadcasts',
      description: 'Monitor all live broadcasts',
      icon: Radio,
      path: '/admin/broadcasts',
      color: 'bg-red-500/10 text-red-400 border-red-500/20',
    },
    {
      title: 'Templates',
      description: 'Manage broadcast templates',
      icon: Layout,
      path: '/admin/templates',
      color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    },
    {
      title: 'Email Management',
      description: 'Manage mailboxes, send and receive emails',
      icon: Mail,
      path: '/admin/emails',
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    },
  ];

  return (
    <div className="min-h-screen text-white p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold mb-2">Admin Dashboard</h1>
          <p className="text-gray-400 text-lg">
            Manage and monitor your Streamlick instance
          </p>
        </div>

        {/* Admin Sections Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {adminSections.map((section) => {
            const Icon = section.icon;
            return (
              <Link
                key={section.path}
                to={section.path}
                className={`${section.color} border rounded-lg p-6 hover:scale-105 transition-transform duration-200 cursor-pointer group`}
              >
                <div className="flex items-start space-x-4">
                  <div className="p-3 rounded-lg bg-gray-800/50 group-hover:bg-gray-800">
                    <Icon className="w-6 h-6" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold mb-2">{section.title}</h3>
                    <p className="text-gray-400 text-sm">{section.description}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

        {/* Quick Stats */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold mb-6">Quick Stats</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-gray-800 rounded-lg p-6 border border-red-500/20">
              <div className="text-gray-400 text-sm mb-1">Active Broadcasts</div>
              <div className="text-3xl font-bold text-red-400">
                {loading ? '...' : stats.activeBroadcasts}
              </div>
              {!loading && stats.activeBroadcasts > 0 && (
                <div className="text-xs text-red-400 mt-2 flex items-center gap-1">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
                  Live now
                </div>
              )}
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
              <div className="text-gray-400 text-sm mb-1">Active Servers</div>
              <div className="text-3xl font-bold text-green-400">
                {loading ? '...' : stats.activeServers}
              </div>
              {!loading && stats.activeServers > 0 && (
                <div className="text-xs text-green-400 mt-2">
                  Running
                </div>
              )}
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-purple-500/20">
              <div className="text-gray-400 text-sm mb-1">Total Users</div>
              <div className="text-3xl font-bold text-purple-400">
                {loading ? '...' : stats.totalUsers}
              </div>
              {!loading && (
                <div className="text-xs text-gray-400 mt-2">
                  Registered
                </div>
              )}
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-cyan-500/20">
              <div className="flex items-center gap-2 text-gray-400 text-sm mb-1">
                <HardDrive className="w-4 h-4" />
                R2 Storage
              </div>
              <div className="text-2xl font-bold text-cyan-400">
                {loading ? '...' : storageStats.configured ? storageStats.formattedSize : 'Not configured'}
              </div>
              {!loading && storageStats.configured && (
                <div className="text-xs text-gray-400 mt-2">
                  {storageStats.objectCount} objects
                </div>
              )}
            </div>
            <div className="bg-gray-800 rounded-lg p-6 border border-green-500/20">
              <div className="text-gray-400 text-sm mb-1">System Status</div>
              <div className="text-3xl font-bold text-green-400">
                {loading ? '...' : '✓'}
              </div>
              {!loading && (
                <div className="text-xs text-green-400 mt-2">
                  {stats.systemStatus}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation */}
        <div className="mt-8">
          <Link
            to="/dashboard"
            className="text-gray-400 hover:text-white transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
