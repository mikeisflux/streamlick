import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { DashboardLayout } from '../components/layout/DashboardLayout';
import toast from 'react-hot-toast';
import {
  localRecordingsService,
  LocalRecording,
} from '../services/local-recordings.service';

export function Recordings() {
  const [recordings, setRecordings] = useState<LocalRecording[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [menuOpen, setMenuOpen] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const data = await localRecordingsService.getAllRecordings();
      setRecordings(data);
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
      setMenuOpen(null);
      loadRecordings();
    } catch (error) {
      console.error('Failed to delete recording:', error);
      toast.error('Failed to remove recording');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.size === 0) return;

    if (
      !confirm(
        `Delete ${selectedIds.size} recording(s)?\n\nNote: This will only remove them from the list. The files will still exist in your Downloads folder.`
      )
    ) {
      return;
    }

    try {
      for (const id of selectedIds) {
        await localRecordingsService.deleteRecording(id);
      }
      toast.success(`${selectedIds.size} recording(s) removed`);
      setSelectedIds(new Set());
      loadRecordings();
    } catch (error) {
      console.error('Failed to delete recordings:', error);
      toast.error('Failed to remove recordings');
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === recordings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(recordings.map(r => r.id)));
    }
  };

  const handleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl">
        {/* Header */}
        <h1 className="text-2xl font-semibold text-gray-900 mb-6">Library</h1>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600"></div>
          </div>
        ) : recordings.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-gray-400"
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
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No recordings yet</h3>
            <p className="text-gray-500 mb-6">
              Start recording a broadcast to see it here.
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-medium"
            >
              Go to Broadcasts
            </button>
          </div>
        ) : (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedIds.size === recordings.length && recordings.length > 0}
                  onChange={handleSelectAll}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Select all</span>
              </label>

              <button
                onClick={handleDeleteSelected}
                disabled={selectedIds.size === 0}
                className={`flex items-center gap-2 text-sm ${
                  selectedIds.size > 0
                    ? 'text-red-600 hover:text-red-700 cursor-pointer'
                    : 'text-gray-400 cursor-not-allowed'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Delete
              </button>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {recordings.map((recording) => (
                <div key={recording.id} className="group relative">
                  {/* Checkbox overlay */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(recording.id)}
                      onChange={() => handleSelectOne(recording.id)}
                      className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500 bg-white/80"
                    />
                  </div>

                  {/* Thumbnail */}
                  <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden mb-2">
                    {recording.thumbnail ? (
                      <img
                        src={recording.thumbnail}
                        alt={recording.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-800 to-gray-900">
                        <svg className="w-12 h-12 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}

                    {/* Duration badge */}
                    <div className="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/80 text-white text-xs rounded font-medium">
                      {formatDuration(recording.duration)}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                      <h3 className="font-medium text-gray-900 text-sm truncate" title={recording.title}>
                        {recording.title}
                      </h3>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatDate(recording.createdAt)}
                      </p>
                    </div>

                    {/* Menu button */}
                    <div className="relative">
                      <button
                        onClick={() => setMenuOpen(menuOpen === recording.id ? null : recording.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
                      >
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <circle cx="12" cy="6" r="2" />
                          <circle cx="12" cy="12" r="2" />
                          <circle cx="12" cy="18" r="2" />
                        </svg>
                      </button>

                      {/* Dropdown menu */}
                      {menuOpen === recording.id && (
                        <>
                          <div
                            className="fixed inset-0 z-10"
                            onClick={() => setMenuOpen(null)}
                          />
                          <div className="absolute right-0 top-full mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20">
                            <button
                              onClick={() => {
                                // Download functionality would go here
                                toast.success('Recording is in your Downloads folder');
                                setMenuOpen(null);
                              }}
                              className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                              </svg>
                              Download
                            </button>
                            <button
                              onClick={() => handleDelete(recording.id, recording.filename)}
                              className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Info Box */}
            <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="h-5 w-5 text-blue-500"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-medium text-blue-800">
                    About Local Recordings
                  </h3>
                  <ul className="mt-2 text-sm text-blue-700 list-disc pl-5 space-y-1">
                    <li>Recordings are saved directly to your computer's Downloads folder</li>
                    <li>This list helps you track what you've recorded and when</li>
                    <li>Removing a recording from this list doesn't delete the file from your computer</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
