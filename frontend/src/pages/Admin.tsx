import { Link } from 'react-router-dom';
import {
  Server,
  Settings,
  FileText,
  TestTube2,
  Image
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
