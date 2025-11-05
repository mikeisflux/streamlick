import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../services/auth.service';
import { Button } from '../components/Button';
import toast from 'react-hot-toast';

export function Login() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await authService.sendMagicLink(email);
      setEmailSent(true);
      toast.success('Check your email for the magic link!');
    } catch (error) {
      toast.error('Failed to send magic link. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">🎥 Streamlick</h1>
          <p className="text-gray-600">Browser-based Live Streaming Studio</p>
        </div>

        {!emailSent ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="you@example.com"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full"
              size="lg"
            >
              {isLoading ? 'Sending...' : 'Send Magic Link'}
            </Button>
          </form>
        ) : (
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">Check your email!</h2>
            <p className="text-gray-600">
              We sent a magic link to <span className="font-semibold">{email}</span>
            </p>
            <p className="text-sm text-gray-500">Click the link in the email to sign in.</p>
            <Button
              variant="ghost"
              onClick={() => setEmailSent(false)}
              className="mt-4"
            >
              Use a different email
            </Button>
          </div>
        )}

        <p className="mt-8 text-center text-sm text-gray-600">
          No account needed. We'll create one for you automatically.
        </p>
      </div>
    </div>
  );
}
