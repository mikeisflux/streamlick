import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api, { API_URL } from '../services/api';

interface OAuthConfig {
  youtube: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  facebook: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  twitch: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  twitter: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  x: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  rumble: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
  linkedin: { clientId: string; clientSecret: string; redirectUri: string; enabled: boolean };
}

interface SystemConfig {
  jwt_secret?: string;
  sendgrid_api_key?: string;
  stripe_secret_key?: string;
  aws_access_key_id?: string;
  aws_secret_access_key?: string;
  s3_bucket_name?: string;
  r2_access_key_id?: string;
  r2_secret_access_key?: string;
  r2_bucket_name?: string;
  r2_account_id?: string;
  r2_public_url?: string;
  redis_url?: string;
  turn_server_url?: string;
  turn_username?: string;
  turn_password?: string;
  log_retention_days?: string;
  enable_diagnostic_logging?: string;
  max_broadcast_participants?: string;
  max_concurrent_broadcasts?: string;
  hetzner_api_key?: string;
}

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<'oauth' | 'system' | 'webhooks' | 'rtmp' | 'branding'>('oauth');
  const [oauthConfig, setOAuthConfig] = useState<OAuthConfig>({
    youtube: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    facebook: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    twitch: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    twitter: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    x: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    rumble: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
    linkedin: { clientId: '', clientSecret: '', redirectUri: '', enabled: false },
  });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [heroFile, setHeroFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [faviconPreview, setFaviconPreview] = useState<string>('');
  const [heroPreview, setHeroPreview] = useState<string>('');
  const [brandingConfig, setBrandingConfig] = useState({
    primaryColor: '#6366f1',
    secondaryColor: '#8b5cf6',
    accentColor: '#ec4899',
    platformName: 'Streamlick',
    tagline: 'Browser-based Live Streaming Studio',
  });
  const [currentLogoUrl, setCurrentLogoUrl] = useState<string | null>(null);
  const [currentFaviconUrl, setCurrentFaviconUrl] = useState<string | null>(null);
  const [currentHeroUrl, setCurrentHeroUrl] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
  }, [activeTab]);

  // Debug: Log API_URL on mount
  useEffect(() => {
    console.log('[Branding Debug] API_URL:', API_URL);
    console.log('[Branding Debug] Current logo URL:', currentLogoUrl);
    console.log('[Branding Debug] Current favicon URL:', currentFaviconUrl);
    console.log('[Branding Debug] Current hero URL:', currentHeroUrl);
  }, [currentLogoUrl, currentFaviconUrl, currentHeroUrl]);

  const loadConfig = async () => {
    setLoading(true);
    try {
      if (activeTab === 'oauth') {
        const response = await api.get('/admin/oauth-config');
        setOAuthConfig(response.data);
      } else if (activeTab === 'system') {
        const response = await api.get('/admin/system-config');
        setSystemConfig(response.data);
      } else if (activeTab === 'branding') {
        const response = await api.get('/admin/branding');
        if (response.data) {
          setCurrentLogoUrl(response.data.logoUrl);
          setCurrentFaviconUrl(response.data.faviconUrl);
          setCurrentHeroUrl(response.data.heroUrl);
          if (response.data.config) {
            setBrandingConfig(response.data.config);
          }
        }
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
      { key: 'twitter', name: 'X (Twitter - Legacy)', icon: '🐦' },
      { key: 'x', name: 'X (Twitter)', icon: '✕' },
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

            <div className="space-y-4">
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

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Redirect URI
                </label>
                <input
                  type="text"
                  value={oauthConfig[key]?.redirectUri || ''}
                  onChange={(e) => {
                    setOAuthConfig(prev => ({
                      ...prev,
                      [key]: { ...prev[key], redirectUri: e.target.value }
                    }));
                  }}
                  className="w-full bg-gray-700 text-white rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder={`${name} OAuth Redirect URI (e.g., https://api.streamlick.com/api/oauth/${key}/callback)`}
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
          { key: 'sendgrid_api_key', label: 'SendGrid API Key', type: 'password', description: 'For sending verification emails' },
          { key: 'stripe_secret_key', label: 'Stripe Secret Key', type: 'password', description: 'For processing payments' },
        ],
      },
      {
        category: 'Storage & Cloud',
        fields: [
          { key: 'aws_access_key_id', label: 'AWS Access Key ID', type: 'text', description: 'For S3 storage access' },
          { key: 'aws_secret_access_key', label: 'AWS Secret Access Key', type: 'password', description: 'AWS secret key' },
          { key: 's3_bucket_name', label: 'S3 Bucket Name', type: 'text', description: 'Bucket for storing recordings' },
          { key: 'r2_account_id', label: 'Cloudflare R2 Account ID', type: 'text', description: 'Your Cloudflare account ID' },
          { key: 'r2_access_key_id', label: 'R2 Access Key ID', type: 'text', description: 'Cloudflare R2 access key' },
          { key: 'r2_secret_access_key', label: 'R2 Secret Access Key', type: 'password', description: 'Cloudflare R2 secret key' },
          { key: 'r2_bucket_name', label: 'R2 Bucket Name', type: 'text', description: 'R2 bucket for assets/recordings' },
          { key: 'r2_public_url', label: 'R2 Public URL', type: 'text', description: 'Public URL for R2 bucket (optional)' },
          { key: 'redis_url', label: 'Redis URL', type: 'text', description: 'Redis connection for caching' },
        ],
      },
      {
        category: 'Infrastructure & Deployment',
        fields: [
          { key: 'hetzner_api_key', label: 'Hetzner Cloud API Key', type: 'password', description: 'For automatic server provisioning and scaling' },
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

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 500KB)
    if (file.size > 500 * 1024) {
      toast.error('Logo file size must be less than 500KB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setLogoFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setLogoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFaviconChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 100KB)
    if (file.size > 100 * 1024) {
      toast.error('Favicon file size must be less than 100KB');
      return;
    }

    // Validate file type
    const validTypes = ['image/x-icon', 'image/png', 'image/vnd.microsoft.icon'];
    if (!validTypes.includes(file.type) && !file.name.endsWith('.ico')) {
      toast.error('Please select an ICO or PNG file');
      return;
    }

    setFaviconFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFaviconPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleHeroChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (max 2MB for hero image)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Hero image file size must be less than 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }

    setHeroFile(file);

    // Generate preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setHeroPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const saveBrandingSettings = async () => {
    setSaving(true);
    try {
      const formData = new FormData();

      // Add files if selected
      if (logoFile) {
        formData.append('logo', logoFile);
      }
      if (faviconFile) {
        formData.append('favicon', faviconFile);
      }
      if (heroFile) {
        formData.append('hero', heroFile);
      }

      // Add branding config as JSON
      formData.append('config', JSON.stringify(brandingConfig));

      const response = await api.post('/admin/branding', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      toast.success('Branding settings saved successfully!');

      // Clear file selections and previews after successful upload
      setLogoFile(null);
      setFaviconFile(null);
      setHeroFile(null);
      setLogoPreview('');
      setFaviconPreview('');
      setHeroPreview('');

      console.log('[Branding Debug] Saved response:', response.data);
      console.log('[Branding Debug] Logo URL from server:', response.data.logoUrl);
      console.log('[Branding Debug] Favicon URL from server:', response.data.faviconUrl);
      console.log('[Branding Debug] Hero URL from server:', response.data.heroUrl);

      // Reload branding to get updated URLs
      await loadConfig();
    } catch (error: any) {
      console.error('Failed to save branding:', error);
      toast.error(error.response?.data?.error || 'Failed to save branding settings');
    } finally {
      setSaving(false);
    }
  };

  const deleteBrandingImage = async (type: 'logo' | 'favicon' | 'hero') => {
    if (!confirm(`Are you sure you want to delete the ${type}?`)) {
      return;
    }

    setSaving(true);
    try {
      await api.delete(`/admin/branding/${type}`);
      toast.success(`${type} deleted successfully!`);

      // Clear the current URL
      if (type === 'logo') {
        setCurrentLogoUrl(null);
      } else if (type === 'favicon') {
        setCurrentFaviconUrl(null);
      } else if (type === 'hero') {
        setCurrentHeroUrl(null);
      }
    } catch (error: any) {
      console.error(`Failed to delete ${type}:`, error);
      toast.error(error.response?.data?.error || `Failed to delete ${type}`);
    } finally {
      setSaving(false);
    }
  };

  const renderBrandingTab = () => {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">Website Branding</h2>
          <p className="text-gray-400">
            Customize your platform's appearance, logo, colors, and visual identity.
          </p>
        </div>

        {/* Logo & Images */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">📷 Logos & Images</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Main Logo</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleLogoChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: PNG or SVG, 300x134px, max 500KB</p>
              {currentLogoUrl && !logoPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Current Logo:</p>
                  <div className="flex items-center gap-2">
                    <img
                      src={currentLogoUrl.startsWith('http') ? currentLogoUrl : `${API_URL}${currentLogoUrl}`}
                      alt="Current logo"
                      className="max-h-20 bg-white p-2 rounded"
                      onError={(e) => {
                        console.error('Failed to load logo:', currentLogoUrl);
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50"><text x="10" y="25" fill="gray">Logo Error</text></svg>';
                      }}
                    />
                    <button
                      onClick={() => deleteBrandingImage('logo')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {logoPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">New Preview:</p>
                  <img src={logoPreview} alt="Logo preview" className="max-h-20 bg-white p-2 rounded" />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Used in: Header, navigation</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Favicon</label>
              <input
                type="file"
                accept="image/x-icon,image/png"
                onChange={handleFaviconChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: ICO or PNG, 32x32px</p>
              {currentFaviconUrl && !faviconPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Current Favicon:</p>
                  <div className="flex items-center gap-2">
                    <img
                      src={currentFaviconUrl.startsWith('http') ? currentFaviconUrl : `${API_URL}${currentFaviconUrl}`}
                      alt="Current favicon"
                      className="max-h-8 bg-white p-1 rounded"
                      onError={(e) => {
                        console.error('Failed to load favicon:', currentFaviconUrl);
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><text x="2" y="20" fill="gray" font-size="12">Error</text></svg>';
                      }}
                    />
                    <button
                      onClick={() => deleteBrandingImage('favicon')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {faviconPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">New Preview:</p>
                  <img src={faviconPreview} alt="Favicon preview" className="max-h-8 bg-white p-1 rounded" />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Used in: Browser tab</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Hero Image</label>
              <input
                type="file"
                accept="image/*"
                onChange={handleHeroChange}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:bg-blue-600 file:text-white hover:file:bg-blue-700"
              />
              <p className="text-xs text-gray-500 mt-1">Recommended: JPG or PNG, max 2MB, 1920x600px</p>
              {currentHeroUrl && !heroPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">Current Hero:</p>
                  <div className="flex flex-col gap-2">
                    <img
                      src={currentHeroUrl.startsWith('http') ? currentHeroUrl : `${API_URL}${currentHeroUrl}`}
                      alt="Current hero"
                      className="max-h-32 w-full object-cover rounded"
                      onError={(e) => {
                        console.error('Failed to load hero image:', currentHeroUrl);
                        e.currentTarget.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="200"><text x="150" y="100" fill="gray">Hero Image Error</text></svg>';
                      }}
                    />
                    <button
                      onClick={() => deleteBrandingImage('hero')}
                      className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-xs rounded self-start"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
              {heroPreview && (
                <div className="mt-3">
                  <p className="text-xs text-gray-400 mb-2">New Preview:</p>
                  <img src={heroPreview} alt="Hero preview" className="max-h-32 w-full object-cover rounded" />
                </div>
              )}
              <p className="text-xs text-gray-400 mt-2">Used in: Landing page banner</p>
            </div>
          </div>
        </div>

        {/* Brand Colors */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">🎨 Brand Colors</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Primary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandingConfig.primaryColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="h-10 w-16 rounded border border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandingConfig.primaryColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, primaryColor: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300"
                  placeholder="#6366f1"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Secondary Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandingConfig.secondaryColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="h-10 w-16 rounded border border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandingConfig.secondaryColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, secondaryColor: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300"
                  placeholder="#8b5cf6"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Accent Color</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={brandingConfig.accentColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="h-10 w-16 rounded border border-gray-600 cursor-pointer"
                />
                <input
                  type="text"
                  value={brandingConfig.accentColor}
                  onChange={(e) => setBrandingConfig(prev => ({ ...prev, accentColor: e.target.value }))}
                  className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300"
                  placeholder="#ec4899"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Typography */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">✍️ Typography</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Heading Font</label>
              <select className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300">
                <option>Inter</option>
                <option>Roboto</option>
                <option>Poppins</option>
                <option>Montserrat</option>
                <option>Open Sans</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Body Font</label>
              <select className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300">
                <option>Inter</option>
                <option>Roboto</option>
                <option>Poppins</option>
                <option>Lato</option>
                <option>Source Sans Pro</option>
              </select>
            </div>
          </div>
        </div>

        {/* Platform Name */}
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-4">🏷️ Platform Identity</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Platform Name</label>
              <input
                type="text"
                value={brandingConfig.platformName}
                onChange={(e) => setBrandingConfig(prev => ({ ...prev, platformName: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300"
                placeholder="Enter platform name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tagline</label>
              <input
                type="text"
                value={brandingConfig.tagline}
                onChange={(e) => setBrandingConfig(prev => ({ ...prev, tagline: e.target.value }))}
                className="w-full px-4 py-2 bg-gray-900 border border-gray-600 rounded text-gray-300"
                placeholder="Enter tagline"
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            onClick={saveBrandingSettings}
            disabled={saving}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold"
          >
            {saving ? 'Saving...' : 'Save Branding Settings'}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-8">
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
            <button
              onClick={() => setActiveTab('branding')}
              className={`flex-1 px-6 py-4 font-semibold transition-colors ${
                activeTab === 'branding'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-400 hover:bg-gray-750 hover:text-white'
              }`}
            >
              🎨 Branding
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
            {activeTab === 'branding' && renderBrandingTab()}
          </>
        )}
      </div>
    </div>
  );
}
