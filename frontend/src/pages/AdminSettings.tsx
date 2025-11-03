import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

interface OAuthConfig {
  youtube: { clientId: string; clientSecret: string; enabled: boolean };
  facebook: { clientId: string; clientSecret: string; enabled: boolean };
  twitch: { clientId: string; clientSecret: string; enabled: boolean };
  twitter: { clientId: string; clientSecret: string; enabled: boolean };
  rumble: { clientId: string; clientSecret: string; enabled: boolean };
  linkedin: { clientId: string; clientSecret: string; enabled: boolean };
}

interface SystemConfig {
  jwt_secret?: string;
  sendgrid_api_key?: string;
  stripe_secret_key?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  s3_bucket_name?: string;
  redis_url?: string;
  turn_server_url?: string;
  turn_username?: string;
  turn_password?: string;
  log_retention_days?: string;
  enable_diagnostic_logging?: string;
  max_broadcast_participants?: string;
  max_concurrent_broadcasts?: string;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'oauth' | 'system' | 'webhooks' | 'rtmp'>('oauth');
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig>({
    youtube: { clientId: '', clientSecret: '', enabled: false },
    facebook: { clientId: '', clientSecret: '', enabled: false },
    twitch: { clientId: '', clientSecret: '', enabled: false },
    twitter: { clientId: '', clientSecret: '', enabled: false },
    rumble: { clientId: '', clientSecret: '', enabled: false },
    linkedin: { clientId: '', clientSecret: '', enabled: false },
  });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, [activeTab]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      if (activeTab === 'oauth') {
        const response = await api.get('/admin/oauth-config');
        setOAuthConfig(response.data);
      } else if (activeTab === 'system') {
        const response = await api.get('/admin/system-config');
        setSystemConfig(response.data);
      }
    } catch (error: any) {
      console.error('Failed to load config:', error);
      if (error.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to load configuration');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveOAuthConfig = async (platform: keyof OAuthConfig) => {
    setSaving(true);
    try {
      await api.post(`/admin/oauth-config/${platform}`, oauthConfig[platform]);
      toast.success(`${platform} OAuth configuration saved`);
    } catch (error) {
      console.error('Failed to save OAuth config:', error);
      toast.error('Failed to save OAuth configuration');
    } finally {
      setSaving(false);
    }
  };

  const saveSystemConfig = async () => {
    setSaving(true);
    try {
      await api.post('/admin/system-config', systemConfig);
      toast.success('System configuration saved');
    } catch (error) {
      console.error('Failed to save system config:', error);
      toast.error('Failed to save system configuration');
    } finally {
      setSaving(false);
    }
  };

  const renderOAuthTab = () => {
    const platforms: Array<{ key: keyof OAuthConfig; name: string; icon: string }> = [
      { key: 'youtube', name: 'YouTube', icon: '🎬' },
      { key: 'facebook', name: 'Facebook', icon: '👥' },
      { key: 'twitch', name: 'Twitch', icon: '🎮' },
      { key: 'twitter', name: 'X (Twitter)', icon: '🐦' },
      { key: 'rumble', name: 'Rumble', icon: '📹' },
      { key: 'linkedin', name: 'LinkedIn', icon: '💼' },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">OAuth Configuration</h2>
          <p className="text-gray-400">
            Configure OAuth credentials for platform integrations. Users will be able to connect these platforms.
          </p>
        </div>

        {platforms.map(({ key, name, icon }) => (
          <div key={key} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <span className="text-3xl">{icon}</span>
                <h3 className="text-xl font-semibold text-white">{name}</h3>
              </div>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={oauthConfig[key]?.enabled || false}
                  onChange={(e) => {
                    setOAuthConfig(prev => ({
                      ...prev,
                      [key]: { ...prev[key], enabled: e.target.checked }
                    }));
                  }}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-gray-300">Enabled</span>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client ID
                </label>
                <input
                  type="text"
                  value={oauthConfig[key]?.clientId || ''}
                  onChange={(e) => {
                    setOAuthConfig(prev => ({
                      ...prev,
                      [key]: { ...prev[key], clientId: e.target.value }
                    }));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${name} OAuth Client ID`}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Client Secret
                </label>
                <input
                  type="password"
                  value={oauthConfig[key]?.clientSecret || ''}
                  onChange={(e) => {
                    setOAuthConfig(prev => ({
                      ...prev,
                      [key]: { ...prev[key], clientSecret: e.target.value }
                    }));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${name} OAuth Client Secret`}
                />
              </div>
            </div>

            <div className="mt-4">
              <button
                onClick={() => saveOAuthConfig(key)}
                disabled={saving}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : `Save ${name} Config`}
              </button>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderSystemTab = () => {
    const settings = [
      {
        category: 'Authentication & Security',
        fields: [
          { key: 'jwt_secret', label: 'JWT Secret', type: 'password', description: 'Secret key for JWT token signing' },
          { key: 'turn_server_url', label: 'TURN Server URL', type: 'text', description: 'WebRTC TURN server for NAT traversal' },
          { key: 'turn_username', label: 'TURN Username', type: 'text', description: 'TURN server authentication username' },
          { key: 'turn_password', label: 'TURN Password', type: 'password', description: 'TURN server authentication password' },
        ],
      },
      {
        category: 'Email & Payment',
        fields: [
          { key: 'sendgrid_api_key', label: 'SendGrid API Key', type: 'password', description: 'For sending magic link emails' },
          { key: 'stripe_secret_key', label: 'Stripe Secret Key', type: 'password', description: 'For processing payments' },
        ],
      },
      {
        category: 'Storage & Cloud',
        fields: [
          { key: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'text', description: 'For S3 storage access' },
          { key: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', description: 'AWS secret key' },
          { key: 's3_bucket_name', label: 'S3 Bucket Name', type: 'text', description: 'Bucket for storing recordings' },
          { key: 'redis_url', label: 'Redis URL', type: 'text', description: 'Redis connection for caching' },
        ],
      },
      {
        category: 'System Limits & Logging',
        fields: [
          { key: 'max_broadcast_participants', label: 'Max Broadcast Participants', type: 'number', description: 'Maximum participants per broadcast' },
          { key: 'max_concurrent_broadcasts', label: 'Max Concurrent Broadcasts', type: 'number', description: 'Maximum simultaneous broadcasts' },
          { key: 'log_retention_days', label: 'Log Retention (Days)', type: 'number', description: 'Days to keep diagnostic logs' },
        ],
      },
    ];

    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">System Configuration</h2>
          <p className="text-gray-400">
            Configure system-wide settings, API keys, and limits. Changes take effect immediately.
          </p>
        </div>

        {settings.map((section, idx) => (
          <div key={idx} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">{section.category}</h3>

            <div className="space-y-4">
              {section.fields.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    {field.label}
                  </label>
                  {field.description && (
                    <p className="text-xs text-gray-500 mb-2">{field.description}</p>
                  )}
                  <input
                    type={field.type}
                    value={(systemConfig as any)[field.key] || ''}
                    onChange={(e) => {
                      setSystemConfig(prev => ({
                        ...prev,
                        [field.key]: e.target.value
                      }));
                    }}
                    className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={field.label}
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Diagnostic Logging</h3>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-300 font-medium">Enable Diagnostic Logging</p>
              <p className="text-sm text-gray-500">Log detailed system events for debugging</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={systemConfig.enable_diagnostic_logging === 'true'}
                onChange={(e) => {
                  setSystemConfig(prev => ({
                    ...prev,
                    enable_diagnostic_logging: e.target.checked ? 'true' : 'false'
                  }));
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={saveSystemConfig}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save All System Settings'}
          </button>
        </div>
      </div>
    );
  };

  const renderWebhooksTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Webhook Configuration</h2>
          <p className="text-gray-400">
            Configure webhooks for platform events and integrations (Coming Soon).
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
          <div className="text-6xl mb-4">🔗</div>
          <h3 className="text-xl font-semibold text-white mb-2">Webhooks Coming Soon</h3>
          <p className="text-gray-400">
            Configure webhooks for Stripe, YouTube, Facebook, and other platform events.
          </p>
        </div>
      </div>
    );
  };

  const renderRTMPTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">RTMP Configuration</h2>
          <p className="text-gray-400">
            Configure RTMP streaming settings and limits (Coming Soon).
          </p>
        </div>

        <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
          <div className="text-6xl mb-4">📡</div>
          <h3 className="text-xl font-semibold text-white mb-2">RTMP Settings Coming Soon</h3>
          <p className="text-gray-400">
            Configure RTMP server settings, bitrate limits, and quality profiles.
          </p>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">⚙️ Admin Settings</h1>
          <p className="text-gray-400">
            Manage system configuration, OAuth credentials, and platform settings
          </p>
        </div>

        {/* Tabs */}
        <div className="bg-gray-800 rounded-lg border border-gray-700 mb-6">
          <div className="flex border-b border-gray-700">
            <button
              onClick={() => setActiveTab('oauth')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'oauth'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-white'
              }`}
            >
              🔐 OAuth Platforms
            </button>
            <button
              onClick={() => setActiveTab('system')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'system'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-white'
              }`}
            >
              ⚡ System Config
            </button>
            <button
              onClick={() => setActiveTab('webhooks')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'webhooks'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-white'
              }`}
            >
              🔗 Webhooks
            </button>
            <button
              onClick={() => setActiveTab('rtmp')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'rtmp'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-white'
              }`}
            >
              📡 RTMP
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {loading ? (
          <div className="bg-gray-800 rounded-lg p-12 border border-gray-700 text-center">
            <div className="text-4xl mb-4">⏳</div>
            <p className="text-gray-400">Loading configuration...</p>
          </div>
        ) : (
          <>
            {activeTab === 'oauth' && renderOAuthTab()}
            {activeTab === 'system' && renderSystemTab()}
            {activeTab === 'webhooks' && renderWebhooksTab()}
            {activeTab === 'rtmp' && renderRTMPTab()}
          </>
        )}
      </div>
    </div>
  );
}
