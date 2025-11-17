import { useState, useEffect, useRef } from 'react';

interface Clip {
  id: string;
  name: string;
  duration: number;
  createdAt: Date;
  thumbnailUrl?: string;
  status: 'processing' | 'ready' | 'failed';
  fileSize: number;
  resolution: string;
}

interface ClipManagerProps {
  broadcastId?: string;
  onClose?: () => void;
}

export function ClipManager({ broadcastId, onClose }: ClipManagerProps) {
  const [clips, setClips] = useState<Clip[]>([
    {
      id: '1',
      name: 'Demo Segment - Product Launch',
      duration: 45,
      createdAt: new Date(Date.now() - 3600000),
      status: 'ready',
      fileSize: 15728640, // 15 MB
      resolution: '1080p',
    },
    {
      id: '2',
      name: 'Q&A Session',
      duration: 120,
      createdAt: new Date(Date.now() - 7200000),
      status: 'ready',
      fileSize: 42467328, // 40.5 MB
      resolution: '1080p',
    },
    {
      id: '3',
      name: 'Opening Remarks',
      duration: 30,
      createdAt: new Date(Date.now() - 600000),
      status: 'processing',
      fileSize: 0,
      resolution: '1080p',
    },
  ]);

  const [selectedClip, setSelectedClip] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Use ref to store recording interval ID
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Cleanup interval and reset state on unmount
  useEffect(() => {
    return () => {
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      // Reset recording state to prevent stale state on remount
      setIsRecording(false);
      setRecordingDuration(0);
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / 3600000);

    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    return date.toLocaleDateString();
  };

  const handleStartRecording = () => {
    setIsRecording(true);

    // Clear any existing interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
    }

    // Simulate recording
    const interval = setInterval(() => {
      setRecordingDuration((prev) => prev + 1);
    }, 1000);

    // Store interval ID in ref for cleanup
    recordingIntervalRef.current = interval;
  };

  const handleStopRecording = () => {
    setIsRecording(false);

    // Clear interval
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }

    // Create new clip
    const newClip: Clip = {
      id: Date.now().toString(),
      name: `Clip ${clips.length + 1}`,
      duration: recordingDuration,
      createdAt: new Date(),
      status: 'processing',
      fileSize: 0,
      resolution: '1080p',
    };

    setClips([newClip, ...clips]);
    setRecordingDuration(0);
  };

  const handleDownload = (clipId: string) => {
    const clip = clips.find((c) => c.id === clipId);
    if (clip) {
      alert(`Downloading: ${clip.name}`);
      // Implement actual download logic
    }
  };

  const handleDelete = (clipId: string) => {
    if (confirm('Are you sure you want to delete this clip?')) {
      setClips(clips.filter((c) => c.id !== clipId));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between bg-gray-50 flex-shrink-0">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Clip Manager</h2>
            <p className="text-sm text-gray-600 mt-1">
              Record, manage, and download clips from your stream
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Recording Controls */}
        <div className="px-6 py-4 bg-gray-900 text-white flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold mb-1">Quick Clip Recording</h3>
              <p className="text-xs text-gray-400">
                Capture the current moment with one click
              </p>
            </div>
            {!isRecording ? (
              <button
                onClick={handleStartRecording}
                className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center gap-2"
              >
                <span className="w-3 h-3 bg-white rounded-full"></span>
                Start Recording
              </button>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></span>
                  <span className="text-white font-mono text-lg">
                    {formatDuration(recordingDuration)}
                  </span>
                </div>
                <button
                  onClick={handleStopRecording}
                  className="px-6 py-3 bg-white text-gray-900 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
                >
                  ⏹ Stop
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Clips List - Scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">
              Your Clips ({clips.length})
            </h3>
            <div className="flex gap-2">
              <select className="px-3 py-1 border border-gray-300 rounded text-sm">
                <option>All Clips</option>
                <option>Ready</option>
                <option>Processing</option>
              </select>
              <button className="px-3 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors">
                🔍 Search
              </button>
            </div>
          </div>

          {clips.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">🎬</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No clips yet</h3>
              <p className="text-sm text-gray-600">
                Start recording clips during your stream to save memorable moments
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clips.map((clip) => (
                <div
                  key={clip.id}
                  className={`border rounded-lg overflow-hidden hover:shadow-lg transition-shadow ${
                    selectedClip === clip.id ? 'ring-2 ring-blue-500' : 'border-gray-200'
                  }`}
                  onClick={() => setSelectedClip(clip.id)}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-gray-900 relative">
                    {clip.status === 'processing' ? (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="text-center">
                          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                          <p className="text-white text-sm">Processing...</p>
                        </div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-white text-4xl">
                        ▶️
                      </div>
                    )}
                    <div className="absolute bottom-2 right-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                      {formatDuration(clip.duration)}
                    </div>
                    <div className="absolute top-2 left-2 px-2 py-1 bg-black/80 text-white text-xs rounded">
                      {clip.resolution}
                    </div>
                  </div>

                  {/* Details */}
                  <div className="p-4">
                    <h4 className="font-semibold text-gray-900 mb-1 truncate">
                      {clip.name}
                    </h4>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mb-3">
                      <span>{formatDate(clip.createdAt)}</span>
                      <span>•</span>
                      <span>{formatFileSize(clip.fileSize)}</span>
                      {clip.status === 'ready' && (
                        <>
                          <span>•</span>
                          <span className="text-green-600">✓ Ready</span>
                        </>
                      )}
                    </div>

                    {clip.status === 'ready' && (
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDownload(clip.id);
                          }}
                          className="flex-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          ⬇ Download
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            alert('Share functionality coming soon!');
                          }}
                          className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded transition-colors"
                        >
                          📤
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(clip.id);
                          }}
                          className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded transition-colors"
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between flex-shrink-0">
          <div className="text-sm text-gray-600">
            Storage: {formatFileSize(clips.reduce((sum, c) => sum + c.fileSize, 0))} / 5 GB
          </div>
          <button
            onClick={() => {
              // Clean up intervals and reset state before closing
              if (recordingIntervalRef.current) {
                clearInterval(recordingIntervalRef.current);
                recordingIntervalRef.current = null;
              }
              setIsRecording(false);
              setRecordingDuration(0);
              onClose?.();
            }}
            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
