import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { broadcastService } from '../services/broadcast.service';
import { useAuthStore } from '../store/authStore';
import { useBranding } from '../context/BrandingContext';
import { Broadcast } from '../types';
import { Button } from '../components/Button';
import { API_URL } from '../services/api';
import toast from 'react-hot-toast';

export function Dashboard() {
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { branding } = useBranding();

  useEffect(() => {
    loadBroadcasts();
  }, []);

  const loadBroadcasts = async () => {
    try {
      const data = await broadcastService.getAll();
      // Ensure data is always an array
      setBroadcasts(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error('Failed to load broadcasts');
      setBroadcasts([]); // Set empty array on error
    } finally {
      setIsLoading(false);
    }
  };

  const createBroadcast = async () => {
    try {
      // Prompt user for broadcast title
      const title = window.prompt('Enter a title for your broadcast:', `Live Stream - ${new Date().toLocaleDateString()}`);

      // User cancelled
      if (title === null) {
        return;
      }

      // Use provided title or default if empty
      const finalTitle = title.trim() || `Live Stream - ${new Date().toLocaleDateString()}`;

      const broadcast = await broadcastService.create({
        title: finalTitle,
        description: '',
      });
      navigate(`/studio/${broadcast.id}`);
    } catch (error) {
      toast.error('Failed to create broadcast');
    }
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl.startsWith('http') ? branding.logoUrl : `${API_URL}${branding.logoUrl}`}
                alt={branding.config?.platformName || 'Logo'}
                className="w-[300px] h-[134px] object-contain cursor-pointer"
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
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user?.email}</span>
              <Button variant="ghost" size="sm" onClick={() => logout()}>
                Logout
              </Button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="mt-4 flex gap-6 border-t border-gray-200 pt-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-sm font-medium text-primary-600 border-b-2 border-primary-600 pb-1"
            >
              Broadcasts
            </button>
            <button
              onClick={() => navigate('/recordings')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-1"
            >
              Recordings
            </button>
            <button
              onClick={() => navigate('/analytics')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-1"
            >
              Analytics
            </button>
            <button
              onClick={() => navigate('/settings')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-1"
            >
              Settings
            </button>
            <button
              onClick={() => navigate('/billing')}
              className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-1"
            >
              Billing
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-3xl font-bold text-white">Your Broadcasts</h2>
            <p className="text-white mt-1">Create and manage your live streams</p>
          </div>
          <Button onClick={createBroadcast} size="lg">
            + Create Broadcast
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : broadcasts.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-lg shadow">
            <svg
              className="mx-auto h-12 w-12 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">No broadcasts</h3>
            <p className="mt-1 text-sm text-gray-500">
              Get started by creating a new broadcast.
            </p>
            <div className="mt-6">
              <Button onClick={createBroadcast}>+ Create Broadcast</Button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {broadcasts.map((broadcast) => (
              <div
                key={broadcast.id}
                className="bg-white rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/studio/${broadcast.id}`)}
              >
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${
                        broadcast.status === 'live'
                          ? 'bg-red-100 text-red-800'
                          : broadcast.status === 'scheduled'
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {broadcast.status}
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {broadcast.title}
                  </h3>
                  {broadcast.description && (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-4">
                      {broadcast.description}
                    </p>
                  )}
                  <p className="text-xs text-gray-500">
                    Created {new Date(broadcast.createdAt).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
