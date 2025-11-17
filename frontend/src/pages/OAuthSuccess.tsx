import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export function OAuthSuccess() {
  const [searchParams] = useSearchParams();
  const success = searchParams.get('success');
  const error = searchParams.get('error');
  const platform = success || error;

  useEffect(() => {
    if (success && window.opener) {
      // Send message to parent window
      window.opener.postMessage(
        {
          type: 'oauth-success',
          platform: success,
        },
        window.location.origin
      );

      // Close popup after short delay
      setTimeout(() => {
        window.close();
      }, 500);
    } else if (error) {
      // On error, just show message and let user close manually
      setTimeout(() => {
        if (window.opener) {
          window.close();
        }
      }, 3000);
    }
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
              This window will close automatically...
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
              This window will close in 3 seconds...
            </p>
          </>
        ) : (
          <p className="text-gray-600">Processing...</p>
        )}
      </div>
    </div>
  );
}
