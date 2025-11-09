import { Link } from 'react-router-dom';
import {
  Server,
  Settings,
  FileText,
  TestTube2,
  Image,
  BarChart3,
  Users,
  Radio,
  Key,
  Video,
  Film,
  Layout,
  Shield,
  CreditCard,
  Cast,
  Palette
} from 'lucide-react';

export function Admin() {
  const adminSections = [
    {
      title: 'Servers',
      description: 'Manage and monitor streaming servers',
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
      path: '/analytics',
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
      title: 'OAuth Config',
      description: 'Configure platform OAuth settings',
      icon: Key,
      path: '/admin/oauth',
      color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    },
    {
      title: 'Media Clips',
      description: 'Manage media clip library',
      icon: Video,
      path: '/admin/clips',
      color: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
    },
    {
      title: 'Recordings',
      description: 'View and manage recordings',
      icon: Film,
      path: '/admin/recordings',
      color: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/20',
    },
    {
      title: 'Templates',
      description: 'Manage broadcast templates',
      icon: Layout,
      path: '/admin/templates',
      color: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
    },
    {
      title: 'Moderation',
      description: 'Content moderation and chat controls',
      icon: Shield,
      path: '/admin/moderation',
      color: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    },
    {
      title: 'Billing & Plans',
      description: 'Manage subscription plans and billing',
      icon: CreditCard,
      path: '/admin/billing',
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    },
    {
      title: 'Destinations',
      description: 'Manage streaming destinations',
      icon: Cast,
      path: '/admin/destinations',
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-900 text-white p-8">
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
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Active Broadcasts</div>
              <div className="text-3xl font-bold text-blue-400">-</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Active Servers</div>
              <div className="text-3xl font-bold text-green-400">-</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">Total Users</div>
              <div className="text-3xl font-bold text-purple-400">-</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-6">
              <div className="text-gray-400 text-sm mb-1">System Status</div>
              <div className="text-3xl font-bold text-green-400">✓</div>
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
