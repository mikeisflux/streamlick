import { useState, useEffect } from 'react';
import { Button } from '../Button';
import api from '../../services/api';
import toast from 'react-hot-toast';

interface Recording {
  id: string;
  broadcast: {
    id: string;
    title: string;
    createdAt: string;
  };
  filePath: string;
  fileSizeBytes: number;
  durationSeconds: number;
  quality: string;
  format: string;
  storageType: string;
  isAvailable: boolean;
  createdAt: string;
}

export function RecordingsSettings() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRecordings();
  }, []);

  const loadRecordings = async () => {
    try {
      const response = await api.get('/recordings');
      setRecordings(response.data);
    } catch (error) {
      toast.error('Failed to load recordings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this recording? This cannot be undone.')) return;

    try {
      await api.delete(`/recordings/${id}`);
      toast.success('Recording deleted');
      loadRecordings();
    } catch (error) {
      toast.error('Failed to delete recording');
    }
  };

  const handleDownload = async (id: string, title: string) => {
    try {
      const response = await api.get(`/recordings/${id}/download`, {
        responseType: 'blob',
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${title}.mp4`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Download started');
    } catch (error) {
      toast.error('Failed to download recording');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const totalSize = recordings.reduce((sum, r) => sum + r.fileSizeBytes, 0);
  const totalDuration = recordings.reduce((sum, r) => sum + r.durationSeconds, 0);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Recordings</h2>
        <p className="text-gray-600">Manage your recorded broadcasts</p>
      </div>

      {/* Storage Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-primary-50 rounded-lg p-4">
          <p className="text-sm text-primary-600 font-medium">Total Recordings</p>
          <p className="text-3xl font-bold text-primary-900 mt-1">{recordings.length}</p>
        </div>
        <div className="bg-blue-50 rounded-lg p-4">
          <p className="text-sm text-blue-600 font-medium">Total Duration</p>
          <p className="text-3xl font-bold text-blue-900 mt-1">{formatDuration(totalDuration)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600 font-medium">Storage Used</p>
          <p className="text-3xl font-bold text-green-900 mt-1">{formatFileSize(totalSize)}</p>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
        </div>
      ) : recordings.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
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
          <h3 className="mt-2 text-sm font-medium text-gray-900">No recordings</h3>
          <p className="mt-1 text-sm text-gray-500">
            Your recorded broadcasts will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-primary-300 transition-colors"
            >
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center text-3xl">
                  🎥
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{recording.broadcast.title}</h3>
                  <div className="flex items-center gap-3 text-sm text-gray-600 mt-1">
                    <span>{formatDuration(recording.durationSeconds)}</span>
                    <span>•</span>
                    <span>{formatFileSize(recording.fileSizeBytes)}</span>
                    <span>•</span>
                    <span className="uppercase">{recording.quality}</span>
                    <span>•</span>
                    <span>{new Date(recording.createdAt).toLocaleDateString()}</span>
                  </div>
                  {!recording.isAvailable && (
                    <p className="text-sm text-red-600 mt-1">⚠️ File not available</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDownload(recording.id, recording.broadcast.title)}
                  disabled={!recording.isAvailable}
                >
                  Download
                </Button>
                <Button variant="danger" size="sm" onClick={() => handleDelete(recording.id)}>
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
