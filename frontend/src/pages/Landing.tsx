import { useNavigate } from 'react-router-dom';
import { Button } from '../components/Button';

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          <div className="text-white text-2xl font-bold">🎥 Streamlick</div>
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6">
            Professional Live Streaming
            <br />
            <span className="text-yellow-300">Right from Your Browser</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto">
            Create professional live streams with guests, custom branding, and multistreaming to
            YouTube, Facebook, X (Twitter), Twitch, Rumble, LinkedIn, and more. No downloads required.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8 py-4">
              Get Started Free
            </Button>
            <Button
              size="lg"
              variant="secondary"
              onClick={() => navigate('/login')}
              className="text-lg px-8 py-4"
            >
              Try Demo
            </Button>
          </div>
          <p className="text-white/80 mt-4">$20/month - Unlimited everything. Cancel anytime.</p>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold mb-2">Multi-Participant Streaming</h3>
              <p className="text-white/80">
                Invite up to 10 guests to join your broadcast. Perfect for interviews, panels,
                and webinars.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📡</div>
              <h3 className="text-2xl font-bold mb-2">Multistreaming</h3>
              <p className="text-white/80">
                Stream to YouTube, Facebook, LinkedIn, Twitch, X, Rumble, and any custom RTMP service
                (Restream, Castr, Wowza, or your own server) simultaneously.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold mb-2">Custom Branding</h3>
              <p className="text-white/80">
                Add logos, overlays, banners, and custom backgrounds to make your streams look
                professional.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-2xl font-bold mb-2">Aggregate Chat</h3>
              <p className="text-white/80">
                See and display comments from all platforms in one place. Feature messages on
                screen.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🖥️</div>
              <h3 className="text-2xl font-bold mb-2">Screen Sharing</h3>
              <p className="text-white/80">
                Share your screen for presentations, demos, and tutorials with just one click.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📹</div>
              <h3 className="text-2xl font-bold mb-2">Recording & Storage</h3>
              <p className="text-white/80">
                Record your streams in HD and access them anytime with unlimited cloud storage.
              </p>
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
            Simple, Transparent Pricing
          </h2>
          <p className="text-xl text-white/90 mb-12">One plan. Unlimited everything.</p>

          <div className="max-w-md mx-auto bg-white rounded-2xl p-8 shadow-2xl">
            <h3 className="text-3xl font-bold text-gray-900 mb-2">Pro Plan</h3>
            <div className="text-5xl font-bold text-primary-600 mb-6">
              $20<span className="text-2xl text-gray-600">/month</span>
            </div>
            <ul className="text-left space-y-3 mb-8">
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">Up to 10 participants on screen</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">Unlimited streaming destinations</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">1080p Full HD streaming</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">Unlimited cloud recording storage</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">Custom branding & overlays</span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-2 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-700">Priority support</span>
              </li>
            </ul>
            <Button size="lg" className="w-full" onClick={() => navigate('/login')}>
              Start Free Trial
            </Button>
            <p className="text-sm text-gray-600 mt-4">No credit card required to start</p>
          </div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4 py-20 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Go Live?
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Join thousands of creators streaming with Streamlick
          </p>
          <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8 py-4">
            Get Started Now
          </Button>
        </section>
      </main>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-8 text-center text-white/80">
        <p>&copy; 2024 Streamlick. All rights reserved.</p>
      </footer>
    </div>
  );
}
