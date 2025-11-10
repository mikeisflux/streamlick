import { Link } from 'react-router-dom';

export function DataDeletion() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <Link to="/" className="text-primary-500 hover:text-primary-400 font-semibold">
            ← Back to Home
          </Link>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-12">
        <h1 className="text-4xl font-bold text-white mb-4">Data Deletion Instructions</h1>
        <p className="text-gray-400 mb-8">Last Updated: December 2024</p>

        <div className="space-y-8 text-gray-300">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">1. Your Right to Data Deletion</h2>
            <p className="mb-3">
              At Streamlick, we respect your right to control your personal data. You have the right to request the deletion of your personal information at any time. This page explains how to request data deletion and what data will be removed.
            </p>
          </section>

          {/* What Data Can Be Deleted */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">2. What Data Can Be Deleted</h2>
            <p className="mb-3">When you request data deletion, we will remove:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your account information (name, email, password)</li>
              <li>Your broadcast history and recordings</li>
              <li>Your streaming destinations and OAuth tokens</li>
              <li>Your custom branding assets (logos, overlays, banners)</li>
              <li>Your studio templates and configurations</li>
              <li>Your analytics data and metrics</li>
              <li>Your billing information and subscription history</li>
              <li>Any media clips or assets you uploaded</li>
            </ul>
          </section>

          {/* Data We Must Retain */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">3. Data We Must Retain</h2>
            <p className="mb-3">
              For legal, security, and business purposes, we may need to retain certain information even after deletion, including:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Transaction records (for tax and accounting purposes - retained for 7 years)</li>
              <li>Logs related to security incidents or violations of our Terms of Service</li>
              <li>Aggregated, anonymized analytics data that cannot identify you</li>
              <li>Information required by law to be retained</li>
            </ul>
          </section>

          {/* How to Request Data Deletion */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">4. How to Request Data Deletion</h2>

            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white mb-2">Option 1: Delete Your Account (Recommended)</h3>
              <p className="mb-2">The easiest way to delete your data is to delete your account:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Log in to your Streamlick account</li>
                <li>Go to <strong>Settings → Account</strong></li>
                <li>Scroll to the bottom and click <strong>"Delete Account"</strong></li>
                <li>Confirm the deletion by entering your password</li>
                <li>Your account and all associated data will be permanently deleted within 30 days</li>
              </ol>
            </div>

            <div className="mb-4">
              <h3 className="text-xl font-semibold text-white mb-2">Option 2: Email Request</h3>
              <p className="mb-2">If you cannot access your account, you can request deletion via email:</p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Send an email to <strong>privacy@streamlick.com</strong></li>
                <li>Use the subject line: <strong>"Data Deletion Request"</strong></li>
                <li>Include your full name and email address associated with your account</li>
                <li>Provide any additional information to help us verify your identity</li>
                <li>We will respond within 7 business days to confirm receipt</li>
                <li>Your data will be deleted within 30 days of verification</li>
              </ol>
            </div>

            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Option 3: Facebook App Data Deletion</h3>
              <p className="mb-2">
                If you connected your account through Facebook and want to delete data shared through Facebook:
              </p>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Go to your Facebook Settings → Apps and Websites</li>
                <li>Find "Streamlick" in the list</li>
                <li>Click "Remove" to revoke access</li>
                <li>Then follow Option 1 or Option 2 above to delete your Streamlick account data</li>
              </ol>
              <p className="mt-3">
                Alternatively, you can use our Facebook Data Deletion callback URL directly:
              </p>
              <code className="block bg-gray-800 p-3 rounded mt-2 text-sm">
                https://yourdomain.com/api/auth/facebook/delete
              </code>
            </div>
          </section>

          {/* Timeline */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">5. Deletion Timeline</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Immediate:</strong> Your account will be deactivated immediately upon request</li>
              <li><strong>Within 7 days:</strong> We will verify your identity and confirm the deletion request</li>
              <li><strong>Within 30 days:</strong> All of your personal data will be permanently deleted from our active systems</li>
              <li><strong>Within 90 days:</strong> Data will be removed from backup systems and archives</li>
            </ul>
          </section>

          {/* Third-Party Services */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">6. Third-Party Services</h2>
            <p className="mb-3">
              Please note that deleting your Streamlick account does not automatically delete data on third-party platforms where you streamed (Facebook, YouTube, Twitch, etc.). You must delete that content directly on those platforms:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Facebook:</strong> Go to Facebook Settings → Activity Log to delete live videos</li>
              <li><strong>YouTube:</strong> Go to YouTube Studio → Content to delete live streams</li>
              <li><strong>Twitch:</strong> Go to Twitch Creator Dashboard → Video Producer to delete VODs</li>
            </ul>
          </section>

          {/* Consequences */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">7. Consequences of Data Deletion</h2>
            <p className="mb-3">Before requesting data deletion, please understand:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your account will be permanently closed and cannot be recovered</li>
              <li>All your broadcast recordings will be permanently deleted</li>
              <li>You will lose access to any active subscriptions (no refunds for unused time)</li>
              <li>Your custom branding and studio setups will be lost</li>
              <li>Any ongoing broadcasts will be immediately ended</li>
              <li>You cannot use the same email address to create a new account for 90 days</li>
            </ul>
          </section>

          {/* Questions */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">8. Questions or Concerns</h2>
            <p className="mb-3">
              If you have any questions about data deletion or need assistance with the process, please contact us:
            </p>
            <ul className="list-none space-y-2">
              <li><strong>Email:</strong> privacy@streamlick.com</li>
              <li><strong>Support:</strong> support@streamlick.com</li>
              <li><strong>Response Time:</strong> We respond to all requests within 7 business days</li>
            </ul>
          </section>

          {/* Rights Under Law */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">9. Your Rights Under Data Protection Laws</h2>
            <p className="mb-3">
              Depending on your location, you may have additional rights under data protection laws such as GDPR (Europe), CCPA (California), or other regional privacy laws:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Right to access your personal data</li>
              <li>Right to rectify inaccurate data</li>
              <li>Right to data portability</li>
              <li>Right to restrict processing</li>
              <li>Right to object to processing</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
          </section>

          {/* Updates */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">10. Updates to This Policy</h2>
            <p>
              We may update these Data Deletion Instructions from time to time. We will notify you of any significant changes by email or through a notice on our website. Your continued use of Streamlick after changes are made constitutes acceptance of those changes.
            </p>
          </section>
        </div>

        {/* Contact Card */}
        <div className="mt-12 p-6 bg-gray-800 rounded-lg border border-gray-700">
          <h3 className="text-xl font-semibold text-white mb-3">Need Help?</h3>
          <p className="text-gray-300 mb-4">
            If you have questions about data deletion or need assistance, our privacy team is here to help.
          </p>
          <div className="space-y-2">
            <p className="text-gray-300">
              <strong className="text-white">Email:</strong> privacy@streamlick.com
            </p>
            <p className="text-gray-300">
              <strong className="text-white">Response Time:</strong> Within 7 business days
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
