import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

export function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const platform = success || error;
  const [countdown, setCountdown] = useState(3);
  const [canClose, setCanClose] = useState(true);

  useEffect(() => {
    // Countdown timer
    const countdownInterval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownInterval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Try to notify parent window if opened as popup
    if (success && window.opener) {
      window.opener.postMessage(
        {
          type: 'oauth-success',
          platform: success,
        },
        window.location.origin
      );
    }

    // Auto-close after 3 seconds
    const closeTimer = setTimeout(() => {
      try {
        window.close();
        // If window.close() didn't work (not a popup), redirect to dashboard
        setTimeout(() => {
          // If we're still here after trying to close, redirect instead
          setCanClose(false);
          window.location.href = '/dashboard';
        }, 500);
      } catch (e) {
        // Can't close, redirect instead
        window.location.href = '/dashboard';
      }
    }, 3000);

    return () => {
      clearInterval(countdownInterval);
      clearTimeout(closeTimer);
    };
  }, [success, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8 text-center">
        {success ? (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
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
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connected Successfully!
            </h2>
            <p className="text-gray-600 mb-4">
              {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'The platform'} has been connected to your account.
            </p>
            <p className="text-sm text-gray-500">
              {canClose
                ? `This window will close in ${countdown} seconds...`
                : 'Redirecting to dashboard...'}
            </p>
          </>
        ) : error ? (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Connection Failed
            </h2>
            <p className="text-gray-600 mb-4">
              Failed to connect {platform ? platform.charAt(0).toUpperCase() + platform.slice(1) : 'the platform'}.
            </p>
            <p className="text-sm text-gray-500">
              {canClose
                ? `This window will close in ${countdown} seconds...`
                : 'Redirecting to dashboard...'}
            </p>
          </>
        ) : (
          <p className="text-gray-600">Processing...</p>
        )}
      </div>
    </div>
  );
}
