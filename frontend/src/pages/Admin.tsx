import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Users, Radio, Settings, BarChart3, Server, FileText, ShieldCheck,
  ArrowLeft, Activity
} from 'lucide-react';
import { broadcastAPI } from '../services/api';

export default function Admin() {
  // Fetch stats
  const { data: broadcasts = [] } = useQuery({
    queryKey: ['broadcasts'],
    queryFn: broadcastAPI.list,
  });

  const activeBroadcasts = broadcasts.filter((b: any) => b.status === 'LIVE').length;
  const totalBroadcasts = broadcasts.length;

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="h-16 bg-dark-900 border-b border-dark-800 flex items-center px-6">
        <Link
          to="/dashboard"
          className="flex items-center gap-2 text-dark-400 hover:text-white transition mr-6"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>Back to Dashboard</span>
        </Link>
        <h1 className="text-xl font-bold">Admin Panel</h1>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats */}
        <section className="grid grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Active Broadcasts"
            value={activeBroadcasts}
            icon={Radio}
            color="red"
          />
          <StatCard
            label="Total Broadcasts"
            value={totalBroadcasts}
            icon={Activity}
            color="brand"
          />
          <StatCard
            label="Media Servers"
            value={1}
            icon={Server}
            color="green"
          />
          <StatCard
            label="System Status"
            value="Online"
            icon={ShieldCheck}
            color="green"
            isText
          />
        </section>

        {/* Admin Sections */}
        <section>
          <h2 className="text-lg font-semibold mb-4">Administration</h2>
          <div className="grid grid-cols-3 gap-4">
            <AdminCard
              to="/admin/settings"
              icon={Settings}
              title="Settings"
              description="System configuration and API keys"
            />
            <AdminCard
              to="/admin/users"
              icon={Users}
              title="Users"
              description="Manage user accounts and roles"
            />
            <AdminCard
              to="/admin/broadcasts"
              icon={Radio}
              title="Broadcasts"
              description="Monitor and manage all broadcasts"
            />
            <AdminCard
              to="/admin/analytics"
              icon={BarChart3}
              title="Analytics"
              description="Platform usage and statistics"
            />
            <AdminCard
              to="/admin/servers"
              icon={Server}
              title="Media Servers"
              description="Ant Media server configuration"
            />
            <AdminCard
              to="/admin/logs"
              icon={FileText}
              title="Logs"
              description="System and error logs"
            />
          </div>
        </section>

        {/* Quick Actions */}
        <section className="mt-8">
          <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
          <div className="flex gap-4">
            <button className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm transition">
              Restart Compositor
            </button>
            <button className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm transition">
              Clear Cache
            </button>
            <button className="px-4 py-2 bg-dark-800 hover:bg-dark-700 rounded-lg text-sm transition">
              Test RTMP Connection
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  color,
  isText = false,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: 'red' | 'brand' | 'green';
  isText?: boolean;
}) {
  const colorClasses = {
    red: 'bg-red-600/20 text-red-400',
    brand: 'bg-brand-600/20 text-brand-400',
    green: 'bg-green-600/20 text-green-400',
  };

  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-dark-400">{label}</span>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className={`text-2xl font-bold ${isText ? 'text-green-400' : ''}`}>
        {value}
      </div>
    </div>
  );
}

function AdminCard({
  to,
  icon: Icon,
  title,
  description,
}: {
  to: string;
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Link
      to={to}
      className="bg-dark-900 border border-dark-800 rounded-xl p-5 hover:border-dark-700 transition group"
    >
      <div className="w-10 h-10 bg-dark-800 rounded-lg flex items-center justify-center mb-4 group-hover:bg-dark-700 transition">
        <Icon className="w-5 h-5 text-dark-400 group-hover:text-white transition" />
      </div>
      <h3 className="font-semibold mb-1">{title}</h3>
      <p className="text-sm text-dark-400">{description}</p>
    </Link>
  );
}
