import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { Button } from '../components/Button';
import { AccountSettings } from '../components/settings/AccountSettings';
import { DestinationsSettings } from '../components/settings/DestinationsSettings';
import { BrandingSettings } from '../components/settings/BrandingSettings';
import { TemplatesSettings } from '../components/settings/TemplatesSettings';
import { RecordingsSettings } from '../components/settings/RecordingsSettings';
import { BillingSettings } from '../components/settings/BillingSettings';

type Tab = 'account' | 'destinations' | 'branding' | 'templates' | 'recordings' | 'billing';

export function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('account');
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();

  const tabs = [
    { id: 'account' as Tab, label: 'Account', icon: '👤' },
    { id: 'destinations' as Tab, label: 'Destinations', icon: '📡' },
    { id: 'branding' as Tab, label: 'Branding', icon: '🎨' },
    { id: 'templates' as Tab, label: 'Templates', icon: '📋' },
    { id: 'recordings' as Tab, label: 'Recordings', icon: '📹' },
    { id: 'billing' as Tab, label: 'Billing', icon: '💳' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/dashboard')} className="text-gray-600 hover:text-gray-900">
              ← Back
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <Button variant="ghost" size="sm" onClick={() => logout()}>
              Logout
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex gap-8">
          {/* Sidebar */}
          <aside className="w-64 flex-shrink-0">
            <nav className="space-y-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    activeTab === tab.id
                      ? 'bg-primary-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <span className="text-xl">{tab.icon}</span>
                  <span className="font-medium">{tab.label}</span>
                </button>
              ))}
            </nav>
          </aside>

          {/* Content */}
          <main className="flex-1">
            <div className="bg-white rounded-lg shadow p-6">
              {activeTab === 'account' && <AccountSettings />}
              {activeTab === 'destinations' && <DestinationsSettings />}
              {activeTab === 'branding' && <BrandingSettings />}
              {activeTab === 'templates' && <TemplatesSettings />}
              {activeTab === 'recordings' && <RecordingsSettings />}
              {activeTab === 'billing' && <BillingSettings />}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
