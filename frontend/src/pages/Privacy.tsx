import { Link } from 'react-router-dom';

export function Privacy() {
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
        <h1 className="text-4xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-gray-400 mb-8">Last Updated: December 2024</p>

        <div className="space-y-8 text-gray-300">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">1. Introduction</h2>
            <p className="mb-3">
              Welcome to Streamlick ("we," "our," or "us"). We are committed to protecting your privacy and ensuring the security of your personal information. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our live streaming platform and services.
            </p>
            <p>
              By using Streamlick, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
            </p>
          </section>

          {/* Information We Collect */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">2. Information We Collect</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">2.1 Information You Provide</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Account Information:</strong> Email address, name, profile picture, and authentication credentials</li>
              <li><strong>Billing Information:</strong> Payment details processed securely through Stripe (we do not store credit card information)</li>
              <li><strong>Content:</strong> Videos, images, audio, logos, overlays, and other media you upload</li>
              <li><strong>Communications:</strong> Messages, feedback, and support requests you send to us</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">2.2 Automatically Collected Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Usage Data:</strong> Broadcast duration, viewer counts, stream quality metrics, and feature usage</li>
              <li><strong>Device Information:</strong> Browser type, operating system, IP address, and device identifiers</li>
              <li><strong>Cookies and Tracking:</strong> Session cookies, authentication tokens, and analytics data</li>
              <li><strong>Performance Metrics:</strong> Stream health, bitrate, dropped frames, and network quality</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">2.3 Third-Party Platform Information</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>OAuth Tokens:</strong> Access tokens for YouTube, Facebook, Twitch, X (Twitter), Rumble, and LinkedIn (encrypted and stored securely)</li>
              <li><strong>Platform Data:</strong> Chat messages, viewer counts, and engagement metrics from connected platforms</li>
              <li><strong>RTMP Credentials:</strong> Stream keys and URLs for custom streaming destinations (encrypted)</li>
            </ul>
          </section>

          {/* How We Use Your Information */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide, operate, and maintain our streaming services</li>
              <li>Process your transactions and manage subscriptions</li>
              <li>Send authentication emails and service notifications</li>
              <li>Monitor and analyze platform performance and usage</li>
              <li>Improve our services, features, and user experience</li>
              <li>Detect and prevent fraud, abuse, and security incidents</li>
              <li>Comply with legal obligations and enforce our terms</li>
              <li>Respond to support requests and customer inquiries</li>
            </ul>
          </section>

          {/* Data Storage and Security */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">4. Data Storage and Security</h2>
            <p className="mb-3">
              We implement industry-standard security measures to protect your information:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Encryption:</strong> All sensitive data (OAuth tokens, API keys, stream keys) encrypted with AES-256-GCM</li>
              <li><strong>Secure Transmission:</strong> HTTPS/TLS encryption for all data in transit</li>
              <li><strong>Access Controls:</strong> Role-based access with admin-only features protected by authentication</li>
              <li><strong>Database Security:</strong> PostgreSQL with encrypted connections and secure credentials</li>
              <li><strong>File Storage:</strong> Uploaded media stored securely with unique identifiers</li>
              <li><strong>Payment Security:</strong> PCI-compliant payment processing through Stripe</li>
            </ul>
            <p className="mt-3">
              However, no method of transmission over the internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
            </p>
          </section>

          {/* Data Sharing and Disclosure */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">5. Data Sharing and Disclosure</h2>
            <p className="mb-3">We do not sell your personal information. We may share your information in the following circumstances:</p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.1 Service Providers</h3>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Payment Processing:</strong> Stripe for billing and subscription management</li>
              <li><strong>Email Services:</strong> SendGrid for authentication and transactional emails</li>
              <li><strong>Cloud Infrastructure:</strong> Hosting and storage providers</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.2 Streaming Platforms</h3>
            <p className="ml-4">
              When you connect third-party platforms (YouTube, Facebook, Twitch, etc.), we use your OAuth tokens to stream content and retrieve chat messages on your behalf. This data is transmitted directly to your authorized destinations.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.3 Legal Requirements</h3>
            <p className="ml-4">
              We may disclose your information to comply with legal obligations, enforce our policies, respond to legal requests, or protect rights, property, and safety.
            </p>
          </section>

          {/* Your Rights and Choices */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">6. Your Rights and Choices</h2>
            <p className="mb-3">You have the following rights regarding your personal information:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
              <li><strong>Export:</strong> Download your content and broadcast data</li>
              <li><strong>Disconnect:</strong> Revoke OAuth connections to third-party platforms</li>
              <li><strong>Opt-Out:</strong> Unsubscribe from marketing communications (we don't send marketing emails currently)</li>
            </ul>
            <p className="mt-3">
              To exercise these rights, please contact us at the information provided in Section 10.
            </p>
          </section>

          {/* Data Retention */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">7. Data Retention</h2>
            <p className="mb-3">
              We retain your information for as long as necessary to provide our services and comply with legal obligations:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li><strong>Account Data:</strong> Retained while your account is active, deleted within 30 days of account deletion</li>
              <li><strong>Broadcast Recordings:</strong> Retained until you delete them or close your account</li>
              <li><strong>Logs and Metrics:</strong> Retained for 90 days for diagnostic and performance monitoring</li>
              <li><strong>Billing Records:</strong> Retained for 7 years to comply with tax and financial regulations</li>
            </ul>
          </section>

          {/* Children's Privacy */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">8. Children's Privacy</h2>
            <p>
              Streamlick is not intended for use by individuals under the age of 13. We do not knowingly collect personal information from children under 13. If we become aware that we have collected information from a child under 13, we will take steps to delete such information promptly.
            </p>
          </section>

          {/* International Data Transfers */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">9. International Data Transfers</h2>
            <p>
              Your information may be transferred to and processed in countries other than your country of residence. These countries may have different data protection laws. By using our services, you consent to the transfer of your information to our facilities and service providers globally.
            </p>
          </section>

          {/* Contact Information */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">10. Contact Us</h2>
            <p className="mb-3">
              If you have questions, concerns, or requests regarding this Privacy Policy or our data practices, please contact us:
            </p>
            <div className="ml-4 space-y-1">
              <p><strong>Email:</strong> privacy@streamlick.com</p>
              <p><strong>Support:</strong> support@streamlick.com</p>
              <p><strong>Address:</strong> [Your Company Address]</p>
            </div>
          </section>

          {/* Changes to This Policy */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">11. Changes to This Privacy Policy</h2>
            <p className="mb-3">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Posting the updated policy on our website with a new "Last Updated" date</li>
              <li>Sending an email notification to your registered email address</li>
              <li>Displaying a prominent notice in our application</li>
            </ul>
            <p className="mt-3">
              Your continued use of Streamlick after any changes indicates your acceptance of the updated Privacy Policy.
            </p>
          </section>

          {/* GDPR Compliance */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">12. GDPR Compliance (For EU Users)</h2>
            <p className="mb-3">
              If you are located in the European Economic Area (EEA), you have additional rights under the General Data Protection Regulation (GDPR):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to data portability</li>
              <li>Right to restrict processing</li>
              <li>Right to object to processing</li>
              <li>Right to withdraw consent</li>
              <li>Right to lodge a complaint with a supervisory authority</li>
            </ul>
            <p className="mt-3">
              Our legal basis for processing your personal data includes: performance of a contract, legitimate interests, and your consent.
            </p>
          </section>

          {/* California Privacy Rights */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">13. California Privacy Rights (CCPA)</h2>
            <p className="mb-3">
              If you are a California resident, you have specific rights under the California Consumer Privacy Act (CCPA):
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Right to know what personal information is collected</li>
              <li>Right to know if personal information is sold or disclosed</li>
              <li>Right to opt-out of the sale of personal information (we do not sell your information)</li>
              <li>Right to deletion of personal information</li>
              <li>Right to non-discrimination for exercising your rights</li>
            </ul>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 pt-8 border-t border-gray-700">
          <p className="text-sm text-gray-500 text-center">
            © 2024 Streamlick. All rights reserved. | <Link to="/terms" className="text-primary-500 hover:text-primary-400">Terms of Service</Link> | <Link to="/privacy" className="text-primary-500 hover:text-primary-400">Privacy Policy</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
