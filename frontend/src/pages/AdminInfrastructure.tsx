/**
 * Admin Infrastructure Page
 * Comprehensive server management with tabs for different server types
 * Push-to-deploy system for instant server provisioning
 */

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../services/api';
import { toast } from 'react-hot-toast';
import { Server, Database, Network, HardDrive, Zap, Plus } from 'lucide-react';

interface HetznerServer {
  id: number;
  name: string;
  status: string;
  server_type: {
    name: string;
    cores: number;
    memory: number;
    disk: number;
  };
  public_net: {
    ipv4: {
      ip: string;
    };
  };
  created: string;
  labels: {
    role?: string;
  };
}

type ServerRole = 'media-server' | 'database-server' | 'load-balancer' | 'api-server' | 'frontend-server' | 'redis-server' | 'turn-server';

export function AdminInfrastructure() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<ServerRole>(
    (searchParams.get('tab') as ServerRole) || 'media-server'
  );
  const [servers, setServers] = useState<HetznerServer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDeployModal, setShowDeployModal] = useState(false);
  const [deployConfig, setDeployConfig] = useState({
    name: '',
    serverType: 'ccx13',
    location: 'nbg1',
    role: '' as ServerRole,
    sshKeys: [] as number[],
    streamingMethod: 'daily' as const,
    backendApiUrl: '',
  });
  const [deploying, setDeploying] = useState(false);
  const [availableSSHKeys, setAvailableSSHKeys] = useState<any[]>([]);
  const [apiKeyMissing, setApiKeyMissing] = useState(false);

  // Redirect if not admin
  useEffect(() => {
    if (user && user.role !== 'admin') {
      navigate('/dashboard');
      toast.error('Admin access required');
    }
  }, [user, navigate]);

  // Update URL when tab changes
  useEffect(() => {
    setSearchParams({ tab: activeTab });
  }, [activeTab, setSearchParams]);

  // Load servers
  const loadServers = async () => {
    try {
      const response = await api.get('/infrastructure/servers');
      setServers(response.data.servers || []);
      setApiKeyMissing(false);
    } catch (error: any) {
      console.error('Error loading servers:', error);
      const errorMessage = error.response?.data?.error || 'Failed to load servers';

      // Check if it's a configuration error
      if (errorMessage.includes('API key not configured') || errorMessage.includes('HETZNER_API_KEY')) {
        setApiKeyMissing(true);
        toast.error('Hetzner API key not configured. Add it in Admin Settings → System Config.');
      } else {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  // Load SSH keys
  const loadSSHKeys = async () => {
    try {
      const response = await api.get('/infrastructure/ssh-keys');
      setAvailableSSHKeys(response.data.keys || []);
    } catch (error) {
      console.error('Failed to load SSH keys:', error);
    }
  };

  useEffect(() => {
    loadServers();
    loadSSHKeys();
    // Refresh every 30 seconds
    const interval = setInterval(loadServers, 30000);
    return () => clearInterval(interval);
  }, []);

  // Deploy server
  const handleDeploy = async () => {
    if (!deployConfig.name || !deployConfig.role) {
      toast.error('Please fill in all required fields');
      return;
    }

    setDeploying(true);
    try {
      const response = await api.post('/infrastructure/deploy', deployConfig);
      toast.success(response.data.message || 'Server deployed successfully!');
      if (response.data.warning) {
        toast(response.data.warning, { icon: '⚠️' });
      }
      setShowDeployModal(false);
      setDeployConfig({
        name: '',
        serverType: 'ccx13',
        location: 'nbg1',
        role: '' as ServerRole,
        sshKeys: [],
        streamingMethod: 'daily',
        backendApiUrl: '',
      });
      await loadServers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to deploy server');
    } finally {
      setDeploying(false);
    }
  };

  // Delete server
  const handleDelete = async (serverId: number, serverName: string) => {
    if (!confirm(`Are you sure you want to delete ${serverName}? This action cannot be undone.`)) {
      return;
    }

    try {
      await api.delete(`/infrastructure/servers/${serverId}`);
      toast.success('Server deleted successfully');
      await loadServers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to delete server');
    }
  };

  // Filter servers by role
  const getServersByRole = (role: ServerRole) => {
    return servers.filter((s) => s.labels?.role === role);
  };

  // Get unlabeled servers (no role label set)
  const getUnlabeledServers = () => {
    return servers.filter((s) => !s.labels?.role);
  };

  // Assign role to server
  const handleAssignRole = async (serverId: number, role: ServerRole) => {
    try {
      await api.post(`/infrastructure/servers/${serverId}/labels`, {
        role: role,
      });
      toast.success(`Server role updated to ${role}`);
      await loadServers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to assign role');
    }
  };

  const tabs: { id: ServerRole; label: string; icon: any }[] = [
    { id: 'media-server', label: 'Media Servers', icon: Server },
    { id: 'turn-server', label: 'TURN Servers', icon: Network },
    { id: 'database-server', label: 'Databases', icon: Database },
    { id: 'load-balancer', label: 'Load Balancers', icon: Network },
    { id: 'api-server', label: 'API Servers', icon: HardDrive },
    { id: 'frontend-server', label: 'Frontend Servers', icon: HardDrive },
    { id: 'redis-server', label: 'Redis Servers', icon: Zap },
  ];

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'running':
        return 'bg-green-500';
      case 'starting':
      case 'stopping':
        return 'bg-yellow-500';
      case 'off':
      case 'stopped':
        return 'bg-gray-500';
      default:
        return 'bg-red-500';
    }
  };

  const formatUptime = (createdDate: string) => {
    const now = new Date();
    const created = new Date(createdDate);
    const diffMs = now.getTime() - created.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (diffDays > 0) return `${diffDays}d ${diffHours}h`;
    return `${diffHours}h`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-600">Loading infrastructure...</div>
      </div>
    );
  }

  // Show API key configuration message
  if (apiKeyMissing) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => navigate('/admin')}
            className="mb-4 text-primary-600 hover:text-primary-700 flex items-center gap-2"
          >
            ← Back to Admin
          </button>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-8">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg className="w-12 h-12 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Hetzner API Key Required</h2>
                <p className="text-gray-600 mb-4">
                  To manage infrastructure, you need to configure your Hetzner Cloud API key.
                </p>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <h3 className="font-semibold text-blue-900 mb-2">How to get your API key:</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                    <li>Go to <a href="https://console.hetzner.cloud" target="_blank" rel="noopener noreferrer" className="underline">Hetzner Cloud Console</a></li>
                    <li>Select your project</li>
                    <li>Go to Security → API Tokens</li>
                    <li>Click "Generate API Token"</li>
                    <li>Copy the token (it starts with "read_write...")</li>
                  </ol>
                </div>
                <button
                  onClick={() => navigate('/admin/settings')}
                  className="px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors"
                >
                  Go to Settings → Add API Key
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate('/admin')}
            className="mb-4 text-primary-600 hover:text-primary-700 flex items-center gap-2"
          >
            ← Back to Admin
          </button>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Infrastructure Management</h1>
              <p className="mt-2 text-gray-600">Manage and monitor all server infrastructure</p>
            </div>
            <button
              onClick={() => {
                setDeployConfig({ ...deployConfig, role: activeTab });
                setShowDeployModal(true);
              }}
              className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-semibold transition-colors shadow-lg"
            >
              <Plus className="w-5 h-5" />
              Deploy New Server
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="flex gap-4 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const count = getServersByRole(tab.id).length;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    isActive
                      ? 'border-primary-600 text-primary-600 font-semibold'
                      : 'border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                  <span
                    className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${
                      isActive ? 'bg-primary-100 text-primary-700' : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Server List */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              {tabs.find((t) => t.id === activeTab)?.label || 'Servers'}
            </h2>
          </div>

          <div className="overflow-x-auto">
            {getServersByRole(activeTab).length === 0 ? (
              <div className="px-6 py-12 text-center text-gray-500">
                <p className="mb-4">No {tabs.find((t) => t.id === activeTab)?.label.toLowerCase()} deployed yet</p>
                <button
                  onClick={() => {
                    setDeployConfig({ ...deployConfig, role: activeTab });
                    setShowDeployModal(true);
                  }}
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  Deploy your first server →
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Resources
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uptime
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {getServersByRole(activeTab).map((server) => (
                    <tr key={server.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{server.name}</div>
                            <div className="text-xs text-gray-500">ID: {server.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            server.status === 'running'
                              ? 'bg-green-100 text-green-800'
                              : server.status === 'starting'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {server.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {server.server_type.name.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {server.server_type.cores} vCPU, {server.server_type.memory} GB RAM
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {server.public_net.ipv4.ip}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {formatUptime(server.created)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(server.id, server.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Unlabeled Servers Section */}
        {getUnlabeledServers().length > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg shadow-sm">
            <div className="px-6 py-4 border-b border-yellow-200">
              <h3 className="text-lg font-semibold text-yellow-900 flex items-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                Unlabeled Servers - Assign Roles
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                These servers don't have a role assigned. Click "Assign Role" to categorize them.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-yellow-100 border-b border-yellow-200">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      Server
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      Resources
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      IP Address
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-yellow-900 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-yellow-200 bg-white">
                  {getUnlabeledServers().map((server) => (
                    <tr key={server.id} className="hover:bg-yellow-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full ${getStatusColor(server.status)}`} />
                          <div>
                            <div className="text-sm font-medium text-gray-900">{server.name}</div>
                            <div className="text-xs text-gray-500">ID: {server.id}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            server.status === 'running'
                              ? 'bg-green-100 text-green-800'
                              : server.status === 'starting'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {server.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {server.server_type.name.toUpperCase()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {server.server_type.cores} vCPU, {server.server_type.memory} GB RAM
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                          {server.public_net.ipv4.ip}
                        </code>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAssignRole(server.id, e.target.value as ServerRole);
                            }
                          }}
                          className="px-3 py-1 text-xs border border-yellow-300 rounded-lg bg-white hover:bg-yellow-50 focus:ring-2 focus:ring-yellow-500 focus:border-transparent mr-2"
                        >
                          <option value="">Assign Role...</option>
                          <option value="media-server">Media Server</option>
                          <option value="turn-server">TURN Server</option>
                          <option value="database-server">Database Server</option>
                          <option value="load-balancer">Load Balancer</option>
                          <option value="api-server">API Server</option>
                          <option value="frontend-server">Frontend Server</option>
                          <option value="redis-server">Redis Server</option>
                        </select>
                        <button
                          onClick={() => handleDelete(server.id, server.name)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Deploy Modal */}
        {showDeployModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">Deploy New Server</h3>
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                  disabled={deploying}
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Server Name</label>
                  <input
                    type="text"
                    value={deployConfig.name}
                    onChange={(e) => setDeployConfig({ ...deployConfig, name: e.target.value })}
                    placeholder="my-media-server-01"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={deploying}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Server Role</label>
                  <select
                    value={deployConfig.role}
                    onChange={(e) => setDeployConfig({ ...deployConfig, role: e.target.value as ServerRole })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={deploying}
                  >
                    <option value="">Select a role...</option>
                    <option value="media-server">Media Server</option>
                    <option value="turn-server">TURN Server (WebRTC Relay)</option>
                    <option value="database-server">Database Server (PostgreSQL)</option>
                    <option value="load-balancer">Load Balancer (Nginx)</option>
                    <option value="api-server">API Server</option>
                    <option value="frontend-server">Frontend Server</option>
                    <option value="redis-server">Redis Server</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Server Type</label>
                  <select
                    value={deployConfig.serverType}
                    onChange={(e) => setDeployConfig({ ...deployConfig, serverType: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={deploying}
                  >
                    {deployConfig.role === 'turn-server' ? (
                      <>
                        <option value="cpx11">CPX11 - 2 vCPU, 2GB RAM (€4.51/mo) - Recommended</option>
                        <option value="cpx21">CPX21 - 3 vCPU, 4GB RAM (€8.21/mo) - High Traffic</option>
                        <option value="cpx31">CPX31 - 4 vCPU, 8GB RAM (€15.29/mo)</option>
                      </>
                    ) : (
                      <>
                        <option value="ccx13">CCX13 - 2 vCPU, 8GB RAM (€11.99/mo)</option>
                        <option value="ccx23">CCX23 - 4 vCPU, 16GB RAM (€24.49/mo)</option>
                        <option value="ccx33">CCX33 - 8 vCPU, 32GB RAM (€48.99/mo)</option>
                        <option value="ccx43">CCX43 - 16 vCPU, 64GB RAM (€97.99/mo)</option>
                      </>
                    )}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Location</label>
                  <select
                    value={deployConfig.location}
                    onChange={(e) => setDeployConfig({ ...deployConfig, location: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={deploying}
                  >
                    <option value="nbg1">Nuremberg, Germany (nbg1)</option>
                    <option value="fsn1">Falkenstein, Germany (fsn1)</option>
                    <option value="hel1">Helsinki, Finland (hel1)</option>
                    <option value="ash">Ashburn, USA (ash)</option>
                  </select>
                </div>

                {/* Media Server Specific Configuration */}
                {deployConfig.role === 'media-server' && (
                  <>
                    <div className="pt-4 border-t border-gray-200">
                      <h4 className="text-sm font-semibold text-gray-900 mb-3">Media Server Configuration</h4>

                      <div className="space-y-3">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <p className="text-xs text-green-900 mb-2">
                            <strong>✓ Daily.co Streaming</strong>
                          </p>
                          <ul className="text-xs text-green-800 space-y-1">
                            <li>• Zero CPU usage for RTMP output</li>
                            <li>• Automatic reconnection built-in</li>
                            <li>• Professional quality streaming</li>
                            <li>• Cost: ~$1-2/hour per broadcast</li>
                            <li>• Requires Daily API key in Settings</li>
                          </ul>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Backend API URL <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            value={deployConfig.backendApiUrl}
                            onChange={(e) => setDeployConfig({ ...deployConfig, backendApiUrl: e.target.value })}
                            placeholder="https://api.streamlick.com"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                            disabled={deploying}
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            URL where your backend API is running (required for Daily integration)
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-xs text-blue-900">
                    <strong>Deployment takes ~2 minutes.</strong> The server will be automatically configured
                    with all required software and started.
                  </p>
                </div>
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setShowDeployModal(false)}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  disabled={deploying}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeploy}
                  disabled={deploying || !deployConfig.name || !deployConfig.role}
                  className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
                >
                  {deploying ? 'Deploying...' : 'Deploy Server'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
