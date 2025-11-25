import { useState, useEffect } from 'react';
import {
  VideoCameraIcon as VideoCameraSolidIcon,
  StopCircleIcon,
  PauseCircleIcon,
  PlayCircleIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/solid';
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { recordingService } from '../services/recording.service';
import { compositorService } from '../services/compositor.service';

interface RecordingControlsProps {
  broadcastId?: string;
  localStream?: MediaStream | null;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}

interface SavedRecording {
  id: string;
  name: string;
  duration: string;
  size: string;
  date: string;
  blob: Blob;
}

export function RecordingControls({ broadcastId, localStream, audioEnabled = true, videoEnabled = true }: RecordingControlsProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);

  // Load recordings from localStorage
  const [recordings, setRecordings] = useState<SavedRecording[]>(() => {
    const saved = localStorage.getItem('saved_recordings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Note: Blob data is not preserved in localStorage, only metadata
        return parsed.map((r: any) => ({ ...r, blob: null }));
      } catch (e) {
        console.error('Failed to load recordings:', e);
      }
    }
    return [];
  });

  // Persist recording metadata to localStorage (without blobs)
  useEffect(() => {
    const toSave = recordings.map(({ id, name, duration, size, date }) => ({
      id,
      name,
      duration,
      size,
      date,
    }));
    localStorage.setItem('saved_recordings', JSON.stringify(toSave));
  }, [recordings]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isRecording && !isPaused) {
      interval = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecording, isPaused]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes
        .toString()
        .padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs
      .toString()
      .padStart(2, '0')}`;
  };

  const startRecording = async () => {
    try {
      // Get the composite output stream
      let stream = compositorService.getOutputStream();

      // If compositor isn't running but we have a local stream, initialize it
      if (!stream && localStream) {
        console.log('[RecordingControls] Compositor not running, initializing for local recording...');

        // Initialize compositor with just the local participant
        await compositorService.initialize([
          {
            id: 'local',
            name: 'You',
            stream: localStream,
            isLocal: true,
            audioEnabled,
            videoEnabled,
          },
        ]);

        // Now get the output stream
        stream = compositorService.getOutputStream();
      }

      if (!stream) {
        toast.error('No camera/mic available - please allow access first');
        return;
      }

      // Start recording with the composite stream
      await recordingService.startRecording(stream);
      setIsRecording(true);
      setRecordingTime(0);
      toast.success('Recording started');
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
    }
  };

  const stopRecording = async () => {
    try {
      // Stop recording and get the blob
      const blob = await recordingService.stopRecording();

      // Calculate size in MB
      const sizeMB = (blob.size / (1024 * 1024)).toFixed(2);

      // Create recording entry
      const newRecording: SavedRecording = {
        id: `rec-${Date.now()}`,
        name: `Recording ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`,
        duration: formatTime(recordingTime),
        size: `${sizeMB} MB`,
        date: new Date().toLocaleString(),
        blob: blob,
      };

      // Add to recordings list
      setRecordings((prev) => [newRecording, ...prev]);

      setIsRecording(false);
      setIsPaused(false);
      setRecordingTime(0);
      toast.success('Recording saved successfully');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  const pauseRecording = () => {
    try {
      recordingService.pauseRecording();
      setIsPaused(true);
      toast('Recording paused');
    } catch (error) {
      console.error('Failed to pause recording:', error);
      toast.error('Failed to pause recording');
    }
  };

  const resumeRecording = () => {
    try {
      recordingService.resumeRecording();
      setIsPaused(false);
      toast.success('Recording resumed');
    } catch (error) {
      console.error('Failed to resume recording:', error);
      toast.error('Failed to resume recording');
    }
  };

  const downloadRecording = (recordingId: string) => {
    const recording = recordings.find((r) => r.id === recordingId);
    if (!recording) {
      toast.error('Recording not found');
      return;
    }

    if (!recording.blob) {
      toast.error('Recording data not available - please record a new session');
      return;
    }

    // Download the actual video file
    const filename = `${recording.name.replace(/\s+/g, '_').replace(/:/g, '-')}.webm`;
    recordingService.downloadRecording(recording.blob, filename);
    toast.success('Download started - check your downloads folder');
  };

  const deleteRecording = (recordingId: string) => {
    if (confirm('Are you sure you want to delete this recording?')) {
      setRecordings((prev) => prev.filter((r) => r.id !== recordingId));
      toast.success('Recording deleted');
    }
  };

  return (
    <div className="p-4 space-y-4">
      {/* Recording Status */}
      {isRecording && (
        <div
          className={`p-4 rounded-lg border-2 ${
            isPaused
              ? 'border-yellow-500 bg-yellow-50'
              : 'border-red-500 bg-red-50'
          }`}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {!isPaused && (
                <span className="flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-3 w-3 rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                </span>
              )}
              <span className="font-semibold text-gray-900">
                {isPaused ? 'Recording Paused' : 'Recording in Progress'}
              </span>
            </div>
            <div className="flex items-center gap-1 text-gray-900 font-mono text-lg font-bold">
              <ClockIcon className="w-5 h-5" />
              {formatTime(recordingTime)}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isPaused ? (
              <button
                onClick={resumeRecording}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <PlayCircleIcon className="w-5 h-5" />
                Resume
              </button>
            ) : (
              <button
                onClick={pauseRecording}
                className="flex-1 px-4 py-2 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
              >
                <PauseCircleIcon className="w-5 h-5" />
                Pause
              </button>
            )}
            <button
              onClick={stopRecording}
              className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
            >
              <StopCircleIcon className="w-5 h-5" />
              Stop & Save
            </button>
          </div>
        </div>
      )}

      {/* Start Recording Button */}
      {!isRecording && (
        <button
          onClick={startRecording}
          className="w-full px-6 py-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors flex items-center justify-center gap-3 font-semibold text-lg"
        >
          <VideoCameraSolidIcon className="w-6 h-6" />
          Start Recording
        </button>
      )}

      {/* Recording Info */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
          <CheckCircleIcon className="w-5 h-5" />
          Recording Information
        </h4>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Recordings are saved in 1080p quality</li>
          <li>• You can download recordings after the broadcast</li>
          <li>• Recordings are stored for 30 days</li>
        </ul>
      </div>

      {/* Divider */}
      {recordings.length > 0 && (
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-2 bg-white text-gray-500">
              Previous Recordings
            </span>
          </div>
        </div>
      )}

      {/* Recordings List */}
      {recordings.length > 0 ? (
        <div className="space-y-2">
          {recordings.map((recording) => (
            <div
              key={recording.id}
              className="p-3 border-2 border-gray-200 rounded-lg bg-white hover:border-blue-500 transition-colors"
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-gray-900">
                    {recording.name}
                  </h4>
                  <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                    <ClockIcon className="w-3 h-3" />
                    <span>{recording.duration}</span>
                    <span className="text-gray-300">•</span>
                    <span>{recording.size}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{recording.date}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => downloadRecording(recording.id)}
                  className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <ArrowDownTrayIcon className="w-4 h-4" />
                  Download
                </button>
                <button
                  onClick={() => deleteRecording(recording.id)}
                  className="px-3 py-2 bg-red-100 hover:bg-red-200 text-red-600 rounded text-sm transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        !isRecording && (
          <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
            <VideoCameraSolidIcon className="w-8 h-8 mx-auto mb-2 text-gray-300" />
            <p>No recordings yet</p>
            <p className="text-xs mt-1">Start recording to save your broadcast</p>
          </div>
        )
      )}
    </div>
  );
}
