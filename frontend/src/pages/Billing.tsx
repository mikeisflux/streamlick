import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';

export function Billing() {
  const [isLoading, setIsLoading] = useState(false);
  const user = useAuthStore((state) => state.user);
  const { branding } = useBranding();
  const navigate = useNavigate();

  const handleSubscribe = async () => {
    setIsLoading(true);
    try {
      // In production, this would create a Stripe checkout session
      toast.success('Redirecting to checkout...');

      // Simulate Stripe checkout
      setTimeout(() => {
        toast.success('Subscription activated!');
        navigate('/dashboard');
      }, 2000);
    } catch (error) {
      toast.error('Failed to process subscription');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8 flex justify-between items-center">
          {branding?.logoUrl ? (
            <img
              src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:3000'}${branding.logoUrl}`}
              alt={branding.config?.platformName || 'Logo'}
              className="h-10 object-contain cursor-pointer"
              onClick={() => navigate('/dashboard')}
            />
          ) : (
            <h1
              className="text-2xl font-bold text-gray-900 cursor-pointer"
              onClick={() => navigate('/dashboard')}
            >
              {branding?.config?.platformName || 'Streamlick'}
            </h1>
          )}
          <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Plan</h2>
          <p className="text-xl text-gray-600">
            Unlock unlimited streaming with our Pro plan
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-primary-500 to-purple-600 p-8 text-white text-center">
            <h3 className="text-3xl font-bold mb-2">Pro Plan</h3>
            <div className="text-5xl font-bold mb-4">
              $20<span className="text-2xl">/month</span>
            </div>
            <p className="text-white/90">Everything you need to create professional streams</p>
          </div>

          <div className="p-8">
            <h4 className="text-xl font-bold text-gray-900 mb-6">What's Included:</h4>

            <div className="grid md:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Up to 10 Participants</p>
                  <p className="text-sm text-gray-600">Host interviews, panels, and webinars</p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Unlimited Destinations</p>
                  <p className="text-sm text-gray-600">Stream to all platforms at once</p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">1080p HD Streaming</p>
                  <p className="text-sm text-gray-600">Crystal clear video quality</p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Unlimited Storage</p>
                  <p className="text-sm text-gray-600">Never worry about recording limits</p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Custom Branding</p>
                  <p className="text-sm text-gray-600">Logos, overlays, and backgrounds</p>
                </div>
              </div>

              <div className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <div>
                  <p className="font-semibold text-gray-900">Priority Support</p>
                  <p className="text-sm text-gray-600">Get help when you need it</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-8">
              <Button
                onClick={handleSubscribe}
                disabled={isLoading}
                size="lg"
                className="w-full"
              >
                {isLoading ? 'Processing...' : 'Subscribe Now - $20/month'}
              </Button>
              <p className="text-center text-sm text-gray-600 mt-4">
                Cancel anytime. No questions asked.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-gray-600">
            Questions? Email us at{' '}
            <a href="mailto:support@streamlick.com" className="text-primary-600 hover:underline">
              support@streamlick.com
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
