import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useBranding } from '../context/BrandingContext';
import { Button } from '../components/Button';
import { API_URL } from '../services/api';
import toast from 'react-hot-toast';
import {
  localRecordingsService,
  LocalRecording,
} from '../services/local-recordings.service';

export function Recordings() {
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSize, setTotalSize] = useState(0);
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { branding } = useBranding();

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await localRecordingsService.getAllRecordings();
      setRecordings(data);

      const size = await localRecordingsService.getTotalSize();
      setTotalSize(size);
    } catch (error) {
      console.error('Failed to load recordings:', error);
      toast.error('Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string, filename: string) => {
    if (
      !confirm(
        `Delete recording "${filename}"?\n\nNote: This will only remove it from the list. The file will still exist in your Downloads folder.`
      )
    ) {
      return;
    }

    try {
      await localRecordingsService.deleteRecording(id);
      toast.success('Recording removed from list');
      loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast.error('Failed to remove recording');
    }
  };

  const handleClearAll = async () => {
    if (
      !confirm(
        `Clear all ${recordings.length} recordings from the list?\n\nNote: This will only remove them from the list. The files will still exist in your Downloads folder.`
      )
    ) {
      return;
    }

    try {
      for (const recording of recordings) {
        await localRecordingsService.deleteRecording(recording.id);
      }
      toast.success('All recordings cleared from list');
      loadRecordings();
    } catch (error) {
      console.error('Failed to clear recordings:', error);
      toast.error('Failed to clear recordings');
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
                src={
                  branding.logoUrl.startsWith('http')
                    ? branding.logoUrl
                    : `${API_URL}${branding.logoUrl}`
                }
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
              className="text-sm font-medium text-gray-600 hover:text-gray-900 pb-1"
            >
              Broadcasts
            </button>
            <button
              onClick={() => navigate('/recordings')}
              className="text-sm font-medium text-primary-600 border-b-2 border-primary-600 pb-1"
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
            <h2 className="text-3xl font-bold text-white">Your Recordings</h2>
            <p className="text-white mt-1">
              Manage your locally saved recordings •{' '}
              {localRecordingsService.formatSize(totalSize)} total
            </p>
          </div>
          {recordings.length > 0 && (
            <Button onClick={handleClearAll} variant="ghost" size="sm">
              Clear All
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          </div>
        ) : recordings.length === 0 ? (
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
                d="M7 4v16M17 4v16M3 8h18M3 12h18M3 16h18"
              />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              No recordings yet
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              Start recording a broadcast to save it locally.
            </p>
            <div className="mt-6">
              <Button onClick={() => navigate('/dashboard')}>
                Go to Broadcasts
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Title
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Duration
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Size
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    Date
                  </th>
                  <th scope="col" className="relative px-6 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {recordings.map((recording) => (
                  <tr key={recording.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">
                        {recording.title}
                      </div>
                      <div className="text-sm text-gray-500">
                        {recording.filename}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {localRecordingsService.formatDuration(
                          recording.duration
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {localRecordingsService.formatSize(recording.size)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(recording.createdAt).toLocaleString()}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() =>
                          handleDelete(recording.id, recording.filename)
                        }
                        className="text-red-600 hover:text-red-900"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-blue-400"
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                About Local Recordings
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc pl-5 space-y-1">
                  <li>
                    Recordings are saved directly to your computer's Downloads
                    folder
                  </li>
                  <li>
                    This list helps you track what you've recorded and when
                  </li>
                  <li>
                    Removing a recording from this list doesn't delete the file
                    from your computer
                  </li>
                  <li>
                    To free up space, manually delete video files from your
                    Downloads folder
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
