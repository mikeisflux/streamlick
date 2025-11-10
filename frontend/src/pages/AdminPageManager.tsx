import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

interface PageContent {
  privacy?: string;
  terms?: string;
  dataDeletion?: string;
}

export default function AdminPageManager() {
  const [activeTab, setActiveTab] = useState<'privacy' | 'terms' | 'dataDeletion'>('privacy');
  const [content, setContent] = useState<PageContent>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentContent, setCurrentContent] = useState('');

  useEffect(() => {
    loadContent();
  }, []);

  useEffect(() => {
    setCurrentContent(content[activeTab] || '');
  }, [activeTab, content]);

  const loadContent = async () => {
    setLoading(true);
    try {
      const response = await api.get('/admin/page-content');
      setContent(response.data);
    } catch (error: any) {
      console.error('Failed to load page content:', error);
      if (error.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to load page content');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    try {
      await api.put(`/admin/page-content/${activeTab}`, {
        content: currentContent,
      });
      toast.success('Page content saved successfully');
      setContent({ ...content, [activeTab]: currentContent });
    } catch (error: any) {
      console.error('Failed to save page content:', error);
      toast.error(error.response?.data?.error || 'Failed to save page content');
    } finally {
      setSaving(false);
    }
  };

  const resetToDefault = () => {
    if (window.confirm('Are you sure you want to reset this page to default content? This cannot be undone.')) {
      // Set default content based on page
      let defaultContent = '';

      if (activeTab === 'privacy') {
        defaultContent = getDefaultPrivacyPolicy();
      } else if (activeTab === 'terms') {
        defaultContent = getDefaultTerms();
      } else if (activeTab === 'dataDeletion') {
        defaultContent = getDefaultDataDeletion();
      }

      setCurrentContent(defaultContent);
    }
  };

  const tabs = [
    { id: 'privacy' as const, name: 'Privacy Policy' },
    { id: 'terms' as const, name: 'Terms of Service' },
    { id: 'dataDeletion' as const, name: 'Data Deletion Instructions' },
  ];

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-white">Page Manager</h1>
          <p className="text-gray-400 mt-2">
            Manage the content of your legal pages (Privacy Policy, Terms of Service, Data Deletion Instructions)
          </p>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <div className="flex space-x-8">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.name}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Editor */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Page Content (Markdown/HTML supported)
              </label>
              <textarea
                value={currentContent}
                onChange={(e) => setCurrentContent(e.target.value)}
                className="w-full h-96 px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary-500 font-mono text-sm"
                placeholder="Enter page content here..."
              />
              <p className="mt-2 text-sm text-gray-400">
                You can use Markdown or HTML formatting. This content will be displayed on the {tabs.find(t => t.id === activeTab)?.name} page.
              </p>
            </div>

            {/* Preview */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Preview
              </label>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-6 max-h-96 overflow-y-auto">
                <div
                  className="prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{ __html: currentContent || '<p class="text-gray-500">No content yet...</p>' }}
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-gray-700">
              <button
                onClick={resetToDefault}
                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
              >
                Reset to Default
              </button>
              <div className="flex space-x-4">
                <a
                  href={`/${activeTab === 'dataDeletion' ? 'data-deletion' : activeTab}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  View Live Page
                </a>
                <button
                  onClick={saveContent}
                  disabled={saving}
                  className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Default content templates
function getDefaultPrivacyPolicy(): string {
  return `<h1>Privacy Policy</h1>
<p>Last Updated: December 2024</p>

<h2>1. Introduction</h2>
<p>Welcome to Streamlick. We are committed to protecting your privacy and ensuring the security of your personal information.</p>

<h2>2. Information We Collect</h2>
<ul>
<li>Account information (name, email, password)</li>
<li>Broadcast data and recordings</li>
<li>Usage analytics</li>
<li>Payment information (processed securely by Stripe)</li>
</ul>

<h2>3. How We Use Your Information</h2>
<p>We use your information to provide and improve our services, process payments, and communicate with you about your account.</p>

<h2>4. Data Sharing</h2>
<p>We do not sell your personal data. We only share data with third-party services necessary to operate our platform (payment processors, cloud storage, etc.).</p>

<h2>5. Your Rights</h2>
<p>You have the right to access, correct, or delete your personal data. See our Data Deletion Instructions for more information.</p>

<h2>6. Contact Us</h2>
<p>For privacy concerns, contact us at privacy@streamlick.com</p>`;
}

function getDefaultTerms(): string {
  return `<h1>Terms of Service</h1>
<p>Last Updated: December 2024</p>

<h2>1. Acceptance of Terms</h2>
<p>By accessing and using Streamlick, you accept and agree to be bound by these Terms of Service.</p>

<h2>2. Use of Service</h2>
<ul>
<li>You must be at least 18 years old to use this service</li>
<li>You are responsible for all content you broadcast</li>
<li>You must comply with all applicable laws and third-party platform policies</li>
</ul>

<h2>3. User Content</h2>
<p>You retain all rights to content you create. By using our service, you grant us permission to store and transmit your content as necessary to provide the service.</p>

<h2>4. Prohibited Conduct</h2>
<ul>
<li>Broadcasting illegal content</li>
<li>Violating intellectual property rights</li>
<li>Harassing or threatening others</li>
<li>Attempting to hack or disrupt the service</li>
</ul>

<h2>5. Termination</h2>
<p>We reserve the right to suspend or terminate accounts that violate these terms.</p>

<h2>6. Limitation of Liability</h2>
<p>Streamlick is provided "as is" without warranties of any kind. We are not liable for any damages arising from your use of the service.</p>

<h2>7. Contact</h2>
<p>For questions about these terms, contact support@streamlick.com</p>`;
}

function getDefaultDataDeletion(): string {
  return `<h1>Data Deletion Instructions</h1>
<p>Last Updated: December 2024</p>

<h2>1. Your Right to Data Deletion</h2>
<p>You have the right to request deletion of your personal data at any time.</p>

<h2>2. How to Delete Your Data</h2>
<h3>Option 1: Delete Your Account</h3>
<ol>
<li>Log in to your account</li>
<li>Go to Settings → Account</li>
<li>Click "Delete Account"</li>
<li>Confirm the deletion</li>
</ol>

<h3>Option 2: Email Request</h3>
<p>Email privacy@streamlick.com with subject "Data Deletion Request" and include your account email.</p>

<h2>3. What Gets Deleted</h2>
<ul>
<li>Account information</li>
<li>Broadcast recordings</li>
<li>Streaming destinations and tokens</li>
<li>Custom branding assets</li>
<li>Analytics data</li>
</ul>

<h2>4. Data Retention</h2>
<p>Some data may be retained for legal reasons (transaction records for 7 years, security logs, etc.)</p>

<h2>5. Timeline</h2>
<ul>
<li>Immediate: Account deactivated</li>
<li>Within 7 days: Identity verification and confirmation</li>
<li>Within 30 days: Data permanently deleted from active systems</li>
<li>Within 90 days: Removed from backups</li>
</ul>

<h2>6. Contact</h2>
<p>Questions? Email privacy@streamlick.com</p>`;
}
