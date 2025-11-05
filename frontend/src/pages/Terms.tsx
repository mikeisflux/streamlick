import { Link } from 'react-router-dom';

export function Terms() {
  return (
    <div className="min-h-screen bg-gray-900">
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
        <h1 className="text-4xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-gray-400 mb-8">Last Updated: December 2024</p>

        <div className="space-y-8 text-gray-300">
          {/* Introduction */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">1. Agreement to Terms</h2>
            <p className="mb-3">
              Welcome to Streamlick. These Terms of Service ("Terms") govern your access to and use of Streamlick's live streaming platform, services, and website (collectively, the "Services"). By accessing or using our Services, you agree to be bound by these Terms.
            </p>
            <p className="mb-3">
              If you do not agree to these Terms, you must not access or use our Services. We reserve the right to modify these Terms at any time. Your continued use of the Services after changes are posted constitutes your acceptance of the revised Terms.
            </p>
          </section>

          {/* Eligibility */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">2. Eligibility</h2>
            <p className="mb-3">
              You must be at least 13 years old to use Streamlick. If you are under 18, you must have parental or guardian consent. By using our Services, you represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You meet the age requirements stated above</li>
              <li>You have the legal capacity to enter into these Terms</li>
              <li>You will comply with all applicable laws and regulations</li>
              <li>All information you provide is accurate and current</li>
            </ul>
          </section>

          {/* Account Registration */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">3. Account Registration and Security</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">3.1 Account Creation</h3>
            <p className="mb-3">
              To use certain features, you must create an account using a valid email address. You agree to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Provide accurate, complete, and current information</li>
              <li>Maintain and update your information to keep it accurate</li>
              <li>Maintain the security and confidentiality of your account credentials</li>
              <li>Notify us immediately of any unauthorized access or security breach</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">3.2 Account Responsibility</h3>
            <p>
              You are responsible for all activities that occur under your account. You agree not to share your account credentials or allow others to access your account. Streamlick is not liable for any loss or damage arising from unauthorized use of your account.
            </p>
          </section>

          {/* Services and Features */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">4. Services and Features</h2>
            <p className="mb-3">
              Streamlick provides a live streaming platform that enables you to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Broadcast live video to multiple platforms (YouTube, Facebook, Twitch, X, Rumble, LinkedIn, and custom RTMP)</li>
              <li>Manage multi-participant broadcasts with guests</li>
              <li>Record and store broadcast content</li>
              <li>Apply video effects (backgrounds, overlays, lower thirds)</li>
              <li>Aggregate and display chat from multiple platforms</li>
              <li>Upload and manage media assets</li>
              <li>Monitor stream health and performance metrics</li>
            </ul>
            <p className="mt-3">
              We reserve the right to modify, suspend, or discontinue any features or Services at any time without notice.
            </p>
          </section>

          {/* Subscription and Billing */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">5. Subscription and Billing</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.1 Paid Plans</h3>
            <p className="mb-3">
              Streamlick offers various subscription plans with different features and limits. By subscribing to a paid plan:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You authorize us to charge your payment method on a recurring basis</li>
              <li>Subscriptions automatically renew unless canceled</li>
              <li>Prices are subject to change with 30 days' notice</li>
              <li>All fees are non-refundable except as required by law</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.2 Payment Processing</h3>
            <p>
              All payments are processed securely through Stripe. We do not store your credit card information. By providing payment information, you authorize Stripe to process your payments in accordance with their terms.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.3 Cancellation</h3>
            <p>
              You may cancel your subscription at any time through your account settings or the Stripe customer portal. Cancellation takes effect at the end of your current billing period. You will retain access to paid features until the end of the billing period.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">5.4 Failed Payments</h3>
            <p>
              If a payment fails, we may suspend your access to paid features. We will attempt to contact you and retry the payment. Continued failure may result in account downgrade or termination.
            </p>
          </section>

          {/* Content and Conduct */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">6. User Content and Conduct</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">6.1 Your Content</h3>
            <p className="mb-3">
              You retain all rights to content you upload or stream through Streamlick ("Your Content"). By using our Services, you grant us a limited, non-exclusive, royalty-free license to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Store, process, and transmit Your Content to provide the Services</li>
              <li>Display Your Content as necessary for the Services to function</li>
              <li>Create backups and recordings as requested by you</li>
            </ul>
            <p className="mt-3">
              You represent and warrant that:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You own or have necessary rights to Your Content</li>
              <li>Your Content does not violate any laws or third-party rights</li>
              <li>Your Content does not infringe intellectual property rights</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">6.2 Prohibited Content and Conduct</h3>
            <p className="mb-3">You agree NOT to use our Services to:</p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Upload or stream illegal, harmful, or offensive content</li>
              <li>Violate intellectual property rights or privacy rights</li>
              <li>Harass, threaten, or abuse others</li>
              <li>Distribute malware, viruses, or harmful code</li>
              <li>Engage in spam, phishing, or fraudulent activities</li>
              <li>Attempt to gain unauthorized access to our systems</li>
              <li>Interfere with or disrupt the Services</li>
              <li>Use automated systems (bots) without permission</li>
              <li>Resell or redistribute our Services without authorization</li>
              <li>Violate third-party platform terms (YouTube, Facebook, etc.)</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">6.3 Content Moderation</h3>
            <p>
              We reserve the right (but have no obligation) to monitor, review, and remove content that violates these Terms or is otherwise objectionable. We may take action including content removal, account suspension, or termination without notice.
            </p>
          </section>

          {/* Third-Party Platforms */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">7. Third-Party Platforms and Services</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">7.1 Platform Integration</h3>
            <p className="mb-3">
              Streamlick integrates with third-party platforms (YouTube, Facebook, Twitch, X, Rumble, LinkedIn). By connecting these platforms:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>You authorize us to stream content and access data on your behalf</li>
              <li>You must comply with each platform's terms of service and policies</li>
              <li>You are responsible for maintaining valid credentials and permissions</li>
              <li>We are not responsible for changes to platform APIs or policies</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">7.2 Third-Party Liability</h3>
            <p>
              We are not responsible for the availability, content, or policies of third-party platforms. Any disputes with third-party platforms are solely between you and that platform.
            </p>
          </section>

          {/* Intellectual Property */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">8. Intellectual Property Rights</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">8.1 Streamlick Property</h3>
            <p>
              Streamlick and its original content, features, and functionality are owned by Streamlick and are protected by copyright, trademark, and other intellectual property laws. You may not copy, modify, distribute, or create derivative works without our written permission.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">8.2 DMCA Compliance</h3>
            <p className="mb-3">
              We respect intellectual property rights and comply with the Digital Millennium Copyright Act (DMCA). If you believe your work has been infringed, contact us with:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Identification of the copyrighted work</li>
              <li>Location of the infringing material</li>
              <li>Your contact information</li>
              <li>A statement of good faith belief</li>
              <li>Your electronic or physical signature</li>
            </ul>
            <p className="mt-3">
              DMCA notices should be sent to: dmca@streamlick.com
            </p>
          </section>

          {/* Disclaimers */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">9. Disclaimers and Warranties</h2>
            <p className="mb-3 uppercase">
              THE SERVICES ARE PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED.
            </p>
            <p className="mb-3">
              We disclaim all warranties including but not limited to:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Merchantability and fitness for a particular purpose</li>
              <li>Non-infringement of third-party rights</li>
              <li>Uninterrupted, secure, or error-free operation</li>
              <li>Accuracy, reliability, or completeness of content</li>
              <li>Defects or errors will be corrected</li>
            </ul>
            <p className="mt-3">
              You acknowledge that streaming quality depends on factors outside our control including internet connectivity, device performance, and third-party platform availability.
            </p>
          </section>

          {/* Limitation of Liability */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">10. Limitation of Liability</h2>
            <p className="mb-3 uppercase">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, STREAMLICK SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, REVENUE, DATA, OR USE.
            </p>
            <p className="mb-3">
              Our total liability for all claims arising from your use of the Services shall not exceed the amount you paid to Streamlick in the 12 months preceding the claim, or $100, whichever is greater.
            </p>
            <p>
              Some jurisdictions do not allow limitation of liability, so these limitations may not apply to you.
            </p>
          </section>

          {/* Indemnification */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">11. Indemnification</h2>
            <p>
              You agree to indemnify, defend, and hold harmless Streamlick, its officers, directors, employees, and agents from any claims, liabilities, damages, losses, costs, or expenses (including reasonable attorneys' fees) arising from:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4 mt-3">
              <li>Your use of the Services</li>
              <li>Your Content or broadcasts</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any third-party rights</li>
              <li>Your violation of applicable laws</li>
            </ul>
          </section>

          {/* Termination */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">12. Termination</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">12.1 Termination by You</h3>
            <p>
              You may terminate your account at any time by contacting support or using the account deletion feature in your settings.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">12.2 Termination by Us</h3>
            <p className="mb-3">
              We may suspend or terminate your account at any time, with or without notice, for:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Violation of these Terms</li>
              <li>Fraudulent, abusive, or illegal activity</li>
              <li>Extended period of inactivity</li>
              <li>Non-payment of fees</li>
              <li>Any reason at our sole discretion</li>
            </ul>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">12.3 Effect of Termination</h3>
            <p>
              Upon termination, your right to use the Services ceases immediately. We may delete Your Content and data. Provisions that should survive termination (including indemnification, disclaimers, and limitations of liability) will continue to apply.
            </p>
          </section>

          {/* Dispute Resolution */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">13. Dispute Resolution and Governing Law</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">13.1 Governing Law</h3>
            <p>
              These Terms are governed by the laws of [Your Jurisdiction], without regard to conflict of law principles.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">13.2 Informal Resolution</h3>
            <p>
              Before filing a claim, you agree to contact us at legal@streamlick.com to attempt to resolve the dispute informally.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">13.3 Arbitration Agreement</h3>
            <p className="mb-3">
              Any dispute arising from these Terms or the Services shall be resolved through binding arbitration, except:
            </p>
            <ul className="list-disc list-inside space-y-2 ml-4">
              <li>Disputes that can be brought in small claims court</li>
              <li>Claims for injunctive or equitable relief</li>
            </ul>
            <p className="mt-3">
              You waive the right to participate in class actions or class-wide arbitration.
            </p>
          </section>

          {/* General Provisions */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">14. General Provisions</h2>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">14.1 Entire Agreement</h3>
            <p>
              These Terms constitute the entire agreement between you and Streamlick regarding the Services.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">14.2 Severability</h3>
            <p>
              If any provision is found unenforceable, the remaining provisions will remain in full effect.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">14.3 No Waiver</h3>
            <p>
              Our failure to enforce any right or provision does not constitute a waiver of that right or provision.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">14.4 Assignment</h3>
            <p>
              You may not assign or transfer these Terms without our consent. We may assign our rights and obligations without restriction.
            </p>

            <h3 className="text-xl font-semibold text-white mb-2 mt-4">14.5 Force Majeure</h3>
            <p>
              We are not liable for delays or failures due to circumstances beyond our reasonable control (natural disasters, acts of government, internet outages, etc.).
            </p>
          </section>

          {/* Contact */}
          <section>
            <h2 className="text-2xl font-semibold text-white mb-3">15. Contact Information</h2>
            <p className="mb-3">
              For questions about these Terms, please contact us:
            </p>
            <div className="ml-4 space-y-1">
              <p><strong>Email:</strong> legal@streamlick.com</p>
              <p><strong>Support:</strong> support@streamlick.com</p>
              <p><strong>Address:</strong> [Your Company Address]</p>
            </div>
          </section>

          {/* Acknowledgment */}
          <section className="bg-gray-800 border border-gray-700 rounded-lg p-6">
            <h2 className="text-xl font-semibold text-white mb-3">Acknowledgment</h2>
            <p>
              BY USING STREAMLICK, YOU ACKNOWLEDGE THAT YOU HAVE READ, UNDERSTOOD, AND AGREE TO BE BOUND BY THESE TERMS OF SERVICE.
            </p>
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
