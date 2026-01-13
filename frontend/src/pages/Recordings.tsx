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
  const [totalSize, setTotalSize] = useState(0);
  const navigate = useNavigate();

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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <DashboardLayout
      title="Your Recordings"
      subtitle={`Manage your locally saved recordings • ${localRecordingsService.formatSize(totalSize)} total`}
      actions={
        recordings.length > 0 ? (
          <button
            onClick={handleClearAll}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Clear All
          </button>
        ) : undefined
      }
    >
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
            Start recording a broadcast to save it locally.
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
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider">
              <div className="col-span-4">Title</div>
              <div className="col-span-2">Duration</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-3">Date</div>
              <div className="col-span-1"></div>
            </div>

            {/* Table Rows */}
            {recordings.map((recording) => (
              <div
                key={recording.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-gray-100 hover:bg-gray-50 items-center"
              >
                <div className="col-span-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 24 24">
                        <circle cx="12" cy="12" r="8" />
                      </svg>
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-gray-900 truncate">{recording.title}</div>
                      <div className="text-sm text-gray-500 truncate">{recording.filename}</div>
                    </div>
                  </div>
                </div>
                <div className="col-span-2 text-sm text-gray-700">
                  {localRecordingsService.formatDuration(recording.duration)}
                </div>
                <div className="col-span-2 text-sm text-gray-700">
                  {localRecordingsService.formatSize(recording.size)}
                </div>
                <div className="col-span-3 text-sm text-gray-500">
                  {formatDate(recording.createdAt)}
                </div>
                <div className="col-span-1 text-right">
                  <button
                    onClick={() => handleDelete(recording.id, recording.filename)}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Info Box */}
          <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
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
                  <li>To free up space, manually delete video files from your Downloads folder</li>
                </ul>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
