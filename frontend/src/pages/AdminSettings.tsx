import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Save, Eye, EyeOff } from 'lucide-react';

type Tab = 'system' | 'branding' | 'media' | 'rtmp';

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('system');
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const toggleSecret = (key: string) => {
    setShowSecrets(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen bg-dark-950">
      {/* Header */}
      <header className="h-16 bg-dark-900 border-b border-dark-800 flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <Link
            to="/admin"
            className="flex items-center gap-2 text-dark-400 hover:text-white transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-xl font-bold">Settings</h1>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 rounded-lg font-medium transition">
          <Save className="w-4 h-4" />
          Save Changes
        </button>
      </header>

      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Tabs */}
        <div className="flex gap-1 bg-dark-900 p-1 rounded-lg mb-8">
          <TabButton
            active={activeTab === 'system'}
            onClick={() => setActiveTab('system')}
            label="System"
          />
          <TabButton
            active={activeTab === 'branding'}
            onClick={() => setActiveTab('branding')}
            label="Branding"
          />
          <TabButton
            active={activeTab === 'media'}
            onClick={() => setActiveTab('media')}
            label="Media Server"
          />
          <TabButton
            active={activeTab === 'rtmp'}
            onClick={() => setActiveTab('rtmp')}
            label="RTMP"
          />
        </div>

        {/* System Tab */}
        {activeTab === 'system' && (
          <div className="space-y-6">
            <SettingsSection title="Authentication">
              <SecretInput
                label="JWT Secret"
                name="jwtSecret"
                placeholder="Enter JWT secret key"
                showSecret={showSecrets['jwtSecret']}
                onToggleSecret={() => toggleSecret('jwtSecret')}
              />
            </SettingsSection>

            <SettingsSection title="Database">
              <TextInput
                label="Database URL"
                name="databaseUrl"
                placeholder="postgresql://user:pass@localhost:5432/db"
                type="text"
              />
              <TextInput
                label="Redis URL"
                name="redisUrl"
                placeholder="redis://localhost:6379"
                type="text"
              />
            </SettingsSection>

            <SettingsSection title="Limits">
              <NumberInput
                label="Max Participants per Broadcast"
                name="maxParticipants"
                defaultValue={10}
                min={2}
                max={50}
              />
              <NumberInput
                label="Max Concurrent Broadcasts"
                name="maxBroadcasts"
                defaultValue={100}
                min={1}
                max={1000}
              />
            </SettingsSection>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === 'branding' && (
          <div className="space-y-6">
            <SettingsSection title="Platform">
              <TextInput
                label="Platform Name"
                name="platformName"
                placeholder="Streamlick"
                defaultValue="Streamlick"
              />
              <TextInput
                label="Tagline"
                name="tagline"
                placeholder="Professional live streaming platform"
              />
            </SettingsSection>

            <SettingsSection title="Colors">
              <ColorInput
                label="Primary Color"
                name="primaryColor"
                defaultValue="#6366f1"
              />
              <ColorInput
                label="Secondary Color"
                name="secondaryColor"
                defaultValue="#4f46e5"
              />
            </SettingsSection>

            <SettingsSection title="Logo">
              <div className="space-y-4">
                <label className="block text-sm font-medium">Logo</label>
                <div className="flex items-center gap-4">
                  <div className="w-24 h-24 bg-dark-800 border border-dark-700 rounded-lg flex items-center justify-center">
                    <span className="text-dark-500 text-sm">No logo</span>
                  </div>
                  <button className="px-4 py-2 bg-dark-700 hover:bg-dark-600 rounded-lg text-sm transition">
                    Upload Logo
                  </button>
                </div>
              </div>
            </SettingsSection>
          </div>
        )}

        {/* Media Server Tab */}
        {activeTab === 'media' && (
          <div className="space-y-6">
            <SettingsSection title="Ant Media Server">
              <TextInput
                label="Server URL"
                name="antMediaUrl"
                placeholder="wss://your-server.com:5443/LiveApp/websocket"
              />
              <TextInput
                label="Application Name"
                name="antMediaApp"
                placeholder="LiveApp"
                defaultValue="LiveApp"
              />
              <SecretInput
                label="API Key"
                name="antMediaApiKey"
                placeholder="Enter Ant Media API key"
                showSecret={showSecrets['antMediaApiKey']}
                onToggleSecret={() => toggleSecret('antMediaApiKey')}
              />
            </SettingsSection>

            <SettingsSection title="Compositor">
              <TextInput
                label="Compositor URL"
                name="compositorUrl"
                placeholder="https://your-server.com/compositor"
              />
              <SecretInput
                label="Compositor Secret"
                name="compositorSecret"
                placeholder="Enter compositor secret"
                showSecret={showSecrets['compositorSecret']}
                onToggleSecret={() => toggleSecret('compositorSecret')}
              />
            </SettingsSection>

            <SettingsSection title="TURN Server">
              <TextInput
                label="TURN URL"
                name="turnUrl"
                placeholder="turn:your-turn-server.com:3478"
              />
              <TextInput
                label="TURN Username"
                name="turnUsername"
                placeholder="username"
              />
              <SecretInput
                label="TURN Password"
                name="turnPassword"
                placeholder="Enter TURN password"
                showSecret={showSecrets['turnPassword']}
                onToggleSecret={() => toggleSecret('turnPassword')}
              />
            </SettingsSection>
          </div>
        )}

        {/* RTMP Tab */}
        {activeTab === 'rtmp' && (
          <div className="space-y-6">
            <SettingsSection title="Default RTMP Settings">
              <SelectInput
                label="Default Resolution"
                name="defaultResolution"
                options={[
                  { value: '1080p', label: '1080p (1920x1080)' },
                  { value: '720p', label: '720p (1280x720)' },
                  { value: '480p', label: '480p (854x480)' },
                ]}
                defaultValue="1080p"
              />
              <SelectInput
                label="Default Bitrate"
                name="defaultBitrate"
                options={[
                  { value: '6000', label: '6000 kbps (High)' },
                  { value: '4500', label: '4500 kbps (Medium)' },
                  { value: '2500', label: '2500 kbps (Low)' },
                ]}
                defaultValue="4500"
              />
              <SelectInput
                label="Default Frame Rate"
                name="defaultFrameRate"
                options={[
                  { value: '60', label: '60 fps' },
                  { value: '30', label: '30 fps' },
                  { value: '24', label: '24 fps' },
                ]}
                defaultValue="30"
              />
            </SettingsSection>

            <SettingsSection title="Recording">
              <ToggleInput
                label="Enable Cloud Recording"
                name="enableRecording"
                defaultValue={true}
              />
              <SelectInput
                label="Recording Format"
                name="recordingFormat"
                options={[
                  { value: 'mp4', label: 'MP4' },
                  { value: 'webm', label: 'WebM' },
                  { value: 'mkv', label: 'MKV' },
                ]}
                defaultValue="mp4"
              />
            </SettingsSection>
          </div>
        )}
      </div>
    </div>
  );
}

// Components
function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition ${
        active
          ? 'bg-dark-800 text-white'
          : 'text-dark-400 hover:text-white'
      }`}
    >
      {label}
    </button>
  );
}

function SettingsSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-dark-900 border border-dark-800 rounded-xl p-6">
      <h3 className="text-lg font-semibold mb-4">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function TextInput({
  label,
  name,
  placeholder,
  defaultValue = '',
  type = 'text',
}: {
  label: string;
  name: string;
  placeholder?: string;
  defaultValue?: string;
  type?: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type={type}
        name={name}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
      />
    </div>
  );
}

function SecretInput({
  label,
  name,
  placeholder,
  showSecret,
  onToggleSecret,
}: {
  label: string;
  name: string;
  placeholder?: string;
  showSecret: boolean;
  onToggleSecret: () => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="relative">
        <input
          type={showSecret ? 'text' : 'password'}
          name={name}
          placeholder={placeholder}
          className="w-full px-4 py-2.5 pr-10 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
        />
        <button
          type="button"
          onClick={onToggleSecret}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-dark-400 hover:text-white"
        >
          {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function NumberInput({
  label,
  name,
  defaultValue,
  min,
  max,
}: {
  label: string;
  name: string;
  defaultValue: number;
  min: number;
  max: number;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        min={min}
        max={max}
        className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
      />
    </div>
  );
}

function ColorInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          name={name}
          defaultValue={defaultValue}
          className="w-10 h-10 rounded-lg border border-dark-700 cursor-pointer"
        />
        <input
          type="text"
          defaultValue={defaultValue}
          className="flex-1 px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
        />
      </div>
    </div>
  );
}

function SelectInput({
  label,
  name,
  options,
  defaultValue,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <select
        name={name}
        defaultValue={defaultValue}
        className="w-full px-4 py-2.5 bg-dark-800 border border-dark-700 rounded-lg text-sm focus:outline-none focus:border-brand-500"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function ToggleInput({
  label,
  name,
  defaultValue,
}: {
  label: string;
  name: string;
  defaultValue: boolean;
}) {
  const [checked, setChecked] = useState(defaultValue);

  return (
    <div className="flex items-center justify-between">
      <label className="text-sm font-medium">{label}</label>
      <button
        type="button"
        onClick={() => setChecked(!checked)}
        className={`relative w-11 h-6 rounded-full transition ${
          checked ? 'bg-brand-600' : 'bg-dark-700'
        }`}
      >
        <input type="hidden" name={name} value={checked ? 'true' : 'false'} />
        <span
          className={`absolute top-1 w-4 h-4 rounded-full bg-white transition ${
            checked ? 'left-6' : 'left-1'
          }`}
        />
      </button>
    </div>
  );
}
