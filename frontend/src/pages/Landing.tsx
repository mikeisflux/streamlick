import { useNavigate } from 'react-router-dom';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/Button';
import { API_URL } from '../services/api';

export function Landing() {
  const navigate = useNavigate();
  const { branding } = useBranding();

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex items-center justify-between">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${API_URL}${branding.logoUrl}`}
              alt={branding.config?.platformName || 'Logo'}
              className="w-[300px] h-[134px] object-contain cursor-pointer"
              onClick={() => navigate('/')}
            />
          ) : (
            <div className="text-white text-2xl font-bold cursor-pointer" onClick={() => navigate('/')}>
              {branding?.config?.platformName || 'Streamlick'}
            </div>
          )}
          <Button variant="secondary" onClick={() => navigate('/login')}>
            Sign In
          </Button>
        </nav>
      </header>

      <main>
        {/* Hero */}
        <section
          className="container mx-auto px-4 py-20 text-center relative rounded-2xl overflow-hidden"
          style={{
            backgroundImage: branding?.heroUrl
              ? `linear-gradient(rgba(0, 0, 0, 0.4), rgba(0, 0, 0, 0.4)), url(${branding.heroUrl.startsWith('http') ? branding.heroUrl : `${API_URL}${branding.heroUrl}`})`
              : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            minHeight: '500px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}
        >
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 drop-shadow-lg">
            Professional Live Streaming
            <br />
            <span className="text-yellow-300">Right from Your Browser</span>
          </h1>
          <p className="text-xl md:text-2xl text-white/90 mb-8 max-w-3xl mx-auto drop-shadow-lg">
            Create professional live streams with guests, custom branding, and multistreaming to
            YouTube, Facebook, X (Twitter), Twitch, Rumble, LinkedIn, and more. No downloads required.
          </p>
          <div className="flex gap-4 justify-center">
            <Button size="lg" onClick={() => navigate('/login')} className="text-lg px-8 py-4">
              Start Streaming
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
          <p className="text-white/80 mt-4 drop-shadow-lg">$20/month - All features included. Cancel anytime.</p>
        </section>

        {/* Features */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid md:grid-cols-3 gap-8">
            {/* AI Live Captions */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white border-2 border-yellow-300">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="text-2xl font-bold mb-2">AI Live Captions</h3>
              <p className="text-white/80">
                Real-time speech-to-text powered by AI. Automatically add professional captions to your stream with 95%+ accuracy in multiple languages.
              </p>
            </div>

            {/* Instant Scene Clips */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white border-2 border-yellow-300">
              <div className="text-4xl mb-4">✂️</div>
              <h3 className="text-2xl font-bold mb-2">Instant Scene Clips</h3>
              <p className="text-white/80">
                Create viral clips during your live stream with one click. Instantly save and download the last 30 seconds in HD - perfect for social media highlights.
              </p>
            </div>

            {/* Producer Mode */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white border-2 border-yellow-300">
              <div className="text-4xl mb-4">🎛️</div>
              <h3 className="text-2xl font-bold mb-2">Producer Mode</h3>
              <p className="text-white/80">
                Professional broadcast control room with pre-show lobby, countdown timers, and instant scene switching. Control everything like a TV studio.
              </p>
            </div>

            {/* Advanced Scene Manager */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎬</div>
              <h3 className="text-2xl font-bold mb-2">Advanced Scene Manager</h3>
              <p className="text-white/80">
                Create unlimited scenes with professional transitions, templates, and hotkeys. Switch between layouts instantly during live streams like a pro.
              </p>
            </div>

            {/* AI Background Effects */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎭</div>
              <h3 className="text-2xl font-bold mb-2">AI Background Removal</h3>
              <p className="text-white/80">
                Remove, blur, or replace backgrounds in real-time using AI. Add virtual backgrounds, custom images, or green screen effects without special equipment.
              </p>
            </div>

            {/* Multi-Participant Streaming */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-2xl font-bold mb-2">Multi-Participant Streaming</h3>
              <p className="text-white/80">
                Invite up to 10 guests to join your broadcast. Perfect for interviews, panels, podcasts, and webinars with professional video quality.
              </p>
            </div>

            {/* Multistreaming */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📡</div>
              <h3 className="text-2xl font-bold mb-2">Multistreaming to 6+ Platforms</h3>
              <p className="text-white/80">
                Stream to YouTube, Facebook, LinkedIn, Twitch, X, Rumble, and any custom RTMP service (Restream, Castr, Wowza) simultaneously with zero delay.
              </p>
            </div>

            {/* Aggregate Chat */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-2xl font-bold mb-2">Unified Chat & Moderation</h3>
              <p className="text-white/80">
                See comments from ALL platforms in one place. Feature messages on screen, filter profanity, ban users, and moderate across all platforms instantly.
              </p>
            </div>

            {/* Custom Branding */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎨</div>
              <h3 className="text-2xl font-bold mb-2">Custom Branding & Overlays</h3>
              <p className="text-white/80">
                Upload your logo, add custom overlays, banners, lower thirds, and backgrounds. Make your streams look professional and on-brand.
              </p>
            </div>

            {/* Screen Sharing */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🖥️</div>
              <h3 className="text-2xl font-bold mb-2">Screen Sharing & Presentations</h3>
              <p className="text-white/80">
                Share your screen for presentations, demos, and tutorials with one click. Switch between webcam and screen seamlessly.
              </p>
            </div>

            {/* Recording & Storage */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📹</div>
              <h3 className="text-2xl font-bold mb-2">Cloud Recording & Storage</h3>
              <p className="text-white/80">
                Record your streams in 1080p HD and access them anytime with unlimited cloud storage. Download or share recordings instantly.
              </p>
            </div>

            {/* Real-Time Viewer Count */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-2">Real-Time Analytics</h3>
              <p className="text-white/80">
                Track viewers across all platforms in real-time. See detailed analytics, platform breakdown, engagement metrics, and viewer history.
              </p>
            </div>

            {/* Lower Thirds */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📝</div>
              <h3 className="text-2xl font-bold mb-2">Animated Lower Thirds</h3>
              <p className="text-white/80">
                Add professional name and title overlays for guests with customizable styles, colors, and smooth animations.
              </p>
            </div>

            {/* Chat Layout Customizer */}
            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-2xl font-bold mb-2">Chat Layout Customizer</h3>
              <p className="text-white/80">
                Position and style your chat overlay with 5 layouts, 8 positions, and 4 professional presets. Full control over appearance.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">🎵</div>
              <h3 className="text-2xl font-bold mb-2">Media Library</h3>
              <p className="text-white/80">
                Upload and trigger video clips, images, and sound effects during your stream.
              </p>
            </div>

            <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 text-white">
              <div className="text-4xl mb-4">📊</div>
              <h3 className="text-2xl font-bold mb-2">Analytics Dashboard</h3>
              <p className="text-white/80">
                Track performance with detailed analytics, viewer history, and engagement metrics across all platforms.
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
              Get Started
            </Button>
            <p className="text-sm text-gray-600 mt-4">Cancel anytime. Full access immediately.</p>
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
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-4">
          <a
            href="/privacy"
            className="hover:text-white transition-colors underline"
            onClick={(e) => {
              e.preventDefault();
              navigate('/privacy');
            }}
          >
            Privacy Policy
          </a>
          <a
            href="/terms"
            className="hover:text-white transition-colors underline"
            onClick={(e) => {
              e.preventDefault();
              navigate('/terms');
            }}
          >
            Terms of Service
          </a>
          <a
            href="/data-deletion"
            className="hover:text-white transition-colors underline"
            onClick={(e) => {
              e.preventDefault();
              navigate('/data-deletion');
            }}
          >
            Data Deletion Instructions
          </a>
        </div>
        <p>&copy; 2024 Streamlick. All rights reserved.</p>
      </footer>
    </div>
  );
}
