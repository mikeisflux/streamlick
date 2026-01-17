import { useState, useEffect } from 'react';
import { Button } from '../Button';
import { useAuthStore } from '../../store/authStore';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Subscription {
  id: string;
  planType: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  stripeSubscriptionId?: string;
}

export function BillingSettings() {
  const { user } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCancelling, setIsCancelling] = useState(false);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    try {
      const response = await api.get('/billing/subscription');
      setSubscription(response.data);
    } catch (error) {
      // No active subscription
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      const response = await api.post('/billing/create-checkout-session');
      // Redirect to Stripe Checkout
      window.location.href = response.data.url;
    } catch (error) {
      toast.error('Failed to create checkout session');
    }
  };

  const handleManage = async () => {
    try {
      const response = await api.post('/billing/create-portal-session');
      // Redirect to Stripe Customer Portal
      window.location.href = response.data.url;
    } catch (error) {
      toast.error('Failed to open billing portal');
    }
  };

  const handleCancel = async () => {
    if (
      !confirm(
        'Are you sure you want to cancel your subscription? You will lose access to all premium features at the end of your billing period.'
      )
    )
      return;

    setIsCancelling(true);
    try {
      await api.post('/billing/cancel-subscription');
      toast.success('Subscription cancelled. Access continues until end of period.');
      loadSubscription();
    } catch (error) {
      toast.error('Failed to cancel subscription');
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Billing & Subscription</h2>
        <p className="text-gray-600">Manage your subscription and payment methods</p>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Current Plan */}
          <div className="border border-gray-200 rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 capitalize">
                  {user?.planType} Plan
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  $20/month - All features included
                </p>
              </div>
              <span
                className={`px-4 py-2 rounded-full text-sm font-medium ${
                  subscription?.status === 'active'
                    ? 'bg-green-100 text-green-800'
                    : subscription?.status === 'cancelled'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-gray-100 text-gray-800'
                }`}
              >
                {subscription?.status || 'Inactive'}
              </span>
            </div>

            {subscription && subscription.status === 'active' && (
              <div className="border-t pt-4 mt-4">
                <dl className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-gray-500">Billing Period</dt>
                    <dd className="text-gray-900 font-medium mt-1">
                      {new Date(subscription.currentPeriodStart).toLocaleDateString()} -{' '}
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-gray-500">Next Billing Date</dt>
                    <dd className="text-gray-900 font-medium mt-1">
                      {new Date(subscription.currentPeriodEnd).toLocaleDateString()}
                    </dd>
                  </div>
                </dl>
              </div>
            )}
          </div>

          {/* Plan Features */}
          <div className="bg-gray-50 rounded-lg p-6">
            <h3 className="font-semibold text-gray-900 mb-4">
              Your Pro Features
            </h3>
            <ul className="space-y-3">
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  Up to 10 participants on screen
                </span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  Unlimited streaming destinations
                </span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  1080p Full HD streaming
                </span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  Local recording (unlimited storage)
                </span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  Custom branding & overlays
                </span>
              </li>
              <li className="flex items-start">
                <svg
                  className="w-6 h-6 text-green-500 mr-3 flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="text-gray-900">
                  Priority support
                </span>
              </li>
            </ul>
          </div>

          {/* Actions */}
          <div className="flex gap-4">
            {subscription?.status === 'active' ? (
              <Button onClick={handleSubscribe} size="lg" className="flex-1">
                Upgrade to Pro - $20/month
              </Button>
            ) : (
              <>
                <Button onClick={handleManage} variant="ghost" className="flex-1">
                  Manage Billing
                </Button>
                {subscription?.status === 'active' && (
                  <Button
                    onClick={handleCancel}
                    variant="danger"
                    disabled={isCancelling}
                    className="flex-1"
                  >
                    {isCancelling ? 'Cancelling...' : 'Cancel Subscription'}
                  </Button>
                )}
              </>
            )}
          </div>

          {subscription?.status === 'cancelled' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-sm text-yellow-800">
                Your subscription has been cancelled. You will have access to premium features until{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString()}.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
