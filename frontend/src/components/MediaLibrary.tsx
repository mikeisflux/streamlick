import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import api from '../services/api';
import toast from 'react-hot-toast';
import { clipPlayerService, MediaClip } from '../services/clip-player.service';
import { SafeMediaPreview } from './SafeMediaPreview';
import { audioMixerService } from '../services/audio-mixer.service';

interface MediaLibraryProps {
  onTriggerClip?: (clip: MediaClip) => void;
}

export function MediaLibrary({ onTriggerClip }: MediaLibraryProps) {
  console.warn('🚨 MediaLibrary component mounted/rendered! New code loaded!');

  const [clips, setClips] = useState<MediaClip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [failedMedia, setFailedMedia] = useState<Set<string>>(new Set());
  const [playingClips, setPlayingClips] = useState<Set<string>>(new Set());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  useEffect(() => {
    fetchClips();
  }, []);

  // CRITICAL FIX: Auto-refresh clips every 30 seconds to handle server reloads
  useEffect(() => {
    const intervalId = setInterval(() => {
      // Silently refresh clips in background
      fetchClips();
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(intervalId);
  }, []);

  const fetchClips = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/media-clips');
      const newClips = response.data.clips || [];
      setClips(newClips);
      // Clear failed media state on successful refresh
      setFailedMedia(new Set());
    } catch (error) {
      toast.error('Failed to load media clips');
      console.error('Fetch clips error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle media load errors
  const handleMediaError = (clipId: string, error: any) => {
    console.error(`Media load error for clip ${clipId}:`, error);
    setFailedMedia(prev => new Set(prev).add(clipId));
  };

  // Retry loading a specific clip
  const handleRetryMedia = async (clipId: string) => {
    try {
      const response = await api.get(`/media-clips/${clipId}`);
      if (response.data.clip) {
        // Update the specific clip in state
        setClips(clips.map(c => c.id === clipId ? response.data.clip : c));
        // Remove from failed set
        setFailedMedia(prev => {
          const newSet = new Set(prev);
          newSet.delete(clipId);
          return newSet;
        });
        toast.success('Media reloaded');
      }
    } catch (error) {
      toast.error('Failed to reload media');
      console.error('Retry media error:', error);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name);

    try {
      toast.loading('Uploading...', { id: 'upload' });
      const response = await api.post('/media-clips/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setClips([...clips, response.data.clip]);
      toast.success('Clip uploaded successfully', { id: 'upload' });
      setShowUploadModal(false);
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Upload failed', { id: 'upload' });
      console.error('Upload error:', error);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleLinkMedia = async (url: string, name: string, type: 'video' | 'audio' | 'image') => {
    try {
      const response = await api.post('/media-clips/link', { url, name, type });
      setClips([...clips, response.data.clip]);
      toast.success('Media linked successfully');
      setShowLinkModal(false);
    } catch (error) {
      toast.error('Failed to link media');
      console.error('Link error:', error);
    }
  };

  const handleDeleteClip = async (clipId: string) => {
    if (!confirm('Are you sure you want to delete this clip?')) return;

    try {
      await api.delete(`/media-clips/${clipId}`);
      setClips(clips.filter((c) => c.id !== clipId));
      toast.success('Clip deleted');
    } catch (error) {
      toast.error('Failed to delete clip');
      console.error('Delete error:', error);
    }
  };

  const handleTriggerClip = (clip: MediaClip) => {
    if (onTriggerClip) {
      onTriggerClip(clip);
    }
  };

  const handlePreviewClick = async (clipId: string) => {
    console.warn('🚨🚨🚨 VIDEO CLICKED!!! 🚨🚨🚨', clipId);

    const videoElement = videoRefs.current.get(clipId);
    if (!videoElement) {
      console.error('❌ NO VIDEO ELEMENT FOUND');
      return;
    }

    if (playingClips.has(clipId)) {
      console.warn('⏹️ STOPPING VIDEO', clipId);
      videoElement.pause();
      videoElement.currentTime = 0;
      setPlayingClips(prev => {
        const newSet = new Set(prev);
        newSet.delete(clipId);
        return newSet;
      });
    } else {
      console.warn('========================================');
      console.warn('▶️ STARTING VIDEO PLAYBACK:', clipId);
      console.warn('========================================');

      // DIAGNOSTIC: Check video element state
      console.warn('📊 Initial video state:', {
        paused: videoElement.paused,
        muted: videoElement.muted,
        volume: videoElement.volume,
        readyState: videoElement.readyState,
        networkState: videoElement.networkState,
        src: videoElement.src?.substring(0, 50) + '...',
      });

      try {
        // STEP 1: Set video properties
        console.warn('🔊 Step 1: Setting volume=1.0, muted=false');
        videoElement.volume = 1.0;
        videoElement.muted = false;

        // STEP 2: Initialize AudioContext and verify it's running
        console.warn('🎵 Step 2: Initializing Audio Mixer');
        audioMixerService.initialize();

        // Get audioContext to check state
        const audioContext = (audioMixerService as any).audioContext;
        console.warn('📡 AudioContext state BEFORE resume:', audioContext?.state);

        // STEP 3: Resume AudioContext and WAIT for it
        if (audioContext && audioContext.state === 'suspended') {
          console.warn('⏳ Step 3: Resuming AudioContext...');
          await audioContext.resume();
          console.warn('✅ AudioContext resumed! New state:', audioContext.state);
        } else {
          console.warn('ℹ️ AudioContext already running:', audioContext?.state);
        }

        // STEP 4: Create MediaElementSource
        console.warn('🔌 Step 4: Creating MediaElementSource');
        audioMixerService.addMediaElement(clipId, videoElement);
        console.warn('✅ MediaElementSource created and connected');

        // STEP 5: Verify video state again before playing
        console.warn('📊 Video state before play():', {
          muted: videoElement.muted,
          volume: videoElement.volume,
          paused: videoElement.paused,
        });

        // STEP 6: Play the video
        console.warn('▶️ Step 6: Calling play()...');
        await videoElement.play();

        console.warn('✅✅✅ SUCCESS: Video playing!');
        console.warn('📊 Final video state:', {
          paused: videoElement.paused,
          muted: videoElement.muted,
          volume: videoElement.volume,
          currentTime: videoElement.currentTime,
        });

        setPlayingClips(prev => new Set(prev).add(clipId));
        toast.success('Video playing with audio!');

      } catch (error: any) {
        console.error('❌❌❌ PLAYBACK FAILED');
        console.error('Error details:', error);
        console.error('Error name:', error?.name);
        console.error('Error message:', error?.message);
        toast.error('Failed to play video: ' + error?.message);
      }
    }
  };

  const filteredClips = selectedType === 'all'
    ? clips
    : clips.filter((c) => c.type === selectedType);

  const getTypeIcon = (type: string): string => {
    switch (type) {
      case 'video': return '🎬';
      case 'audio': return '🔊';
      case 'image': return '🖼️';
      default: return '📁';
    }
  };

  return (
    <div className="bg-gray-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-bold text-white">Media Clips</h2>
        <div className="flex gap-2">
          <Button
            onClick={() => fetchClips()}
            variant="secondary"
            size="sm"
            disabled={isLoading}
            title="Reload all media clips"
          >
            {isLoading ? '⏳' : '🔄'} Refresh
          </Button>
          <Button
            onClick={() => setShowUploadModal(true)}
            variant="primary"
            size="sm"
          >
            📤 Upload
          </Button>
          <Button
            onClick={() => setShowLinkModal(true)}
            variant="secondary"
            size="sm"
          >
            🔗 Link URL
          </Button>
        </div>
      </div>

      {/* Type Filter */}
      <div className="flex gap-2 mb-4">
        {(['all', 'video', 'audio', 'image'] as const).map((type) => (
          <button
            key={type}
            onClick={() => setSelectedType(type)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              selectedType === type
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
            }`}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Clips Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClips.map((clip) => (
          <div key={clip.id} className="bg-gray-700 rounded-lg p-4">
            {/* Header with clip name */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-2xl">{getTypeIcon(clip.type)}</span>
              <div className="flex-1">
                <div className="text-white font-medium truncate">{clip.name}</div>
                {clip.duration && (
                  <div className="text-xs text-gray-400">
                    {(clip.duration / 1000).toFixed(1)}s
                  </div>
                )}
              </div>
            </div>

            {/* Image Preview */}
            {clip.type === 'image' && (
              <div className="relative group">
                <SafeMediaPreview
                  src={clip.url}
                  alt={clip.name}
                  type="image"
                  className="w-full h-32 object-cover rounded cursor-pointer"
                  fallbackClassName="w-full h-32 rounded"
                  onError={(e) => handleMediaError(clip.id, e)}
                  onRetry={() => handleRetryMedia(clip.id)}
                />
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClip(clip.id);
                  }}
                  className="absolute top-1 right-1 z-10 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            )}

            {/* Video Preview - Click to play/stop */}
            {clip.type === 'video' && (
              <div className="relative group">
                <div
                  onClick={(e) => {
                    console.warn('🚨🚨🚨 DIV CLICKED!!!', clip.id, e);
                    handlePreviewClick(clip.id);
                  }}
                  className="cursor-pointer"
                  style={{ border: '2px solid red' }}
                >
                  <video
                    ref={(el) => {
                      if (el) {
                        videoRefs.current.set(clip.id, el);
                        el.volume = 1.0; // CRITICAL: Set volume to 100% for audio playback
                      }
                    }}
                    src={clip.url}
                    className="w-full h-48 object-cover rounded"
                    muted={false}
                    preload="metadata"
                    onEnded={() => {
                      // CRITICAL: Remove video from audio mixer when it ends
                      try {
                        audioMixerService.removeMediaElement(clip.id);
                        console.log('[MediaLibrary] Video ended, removed from audio mixer');
                      } catch (error) {
                        console.error('[MediaLibrary] Failed to remove video from audio mixer:', error);
                      }

                      setPlayingClips(prev => {
                        const newSet = new Set(prev);
                        newSet.delete(clip.id);
                        return newSet;
                      });
                    }}
                    data-exclude-global-mute="true"
                  />
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClip(clip.id);
                  }}
                  className="absolute top-1 right-1 z-10 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            )}

            {/* Audio Preview */}
            {clip.type === 'audio' && (
              <div className="relative group">
                <div className="w-full h-32 bg-gray-600 rounded flex items-center justify-center">
                  <span className="text-4xl">🎵</span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteClip(clip.id);
                  }}
                  className="absolute top-1 right-1 z-10 bg-red-600 text-white w-5 h-5 flex items-center justify-center rounded text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700"
                  title="Delete"
                >
                  ×
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {filteredClips.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg mb-2">No media clips yet</p>
          <p className="text-sm">Upload or link media files to use during your streams</p>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Upload Media Clip</h3>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,audio/*,image/*"
              onChange={handleFileUpload}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 mb-4"
            />
            <div className="text-sm text-gray-400 mb-4">
              Supported: Video (MP4, WebM), Audio (MP3, WAV), Images (JPG, PNG, GIF)
              <br />
              Max size: Videos 2GB, Audio 50MB, Images 10MB
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setShowUploadModal(false)} variant="secondary" className="flex-1">
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Link Modal */}
      {showLinkModal && (
        <LinkMediaModal
          onClose={() => setShowLinkModal(false)}
          onSubmit={handleLinkMedia}
        />
      )}
    </div>
  );
}

function LinkMediaModal({
  onClose,
  onSubmit,
}: {
  onClose: () => void;
  onSubmit: (url: string, name: string, type: 'video' | 'audio' | 'image') => void;
}) {
  const [url, setUrl] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState<'video' | 'audio' | 'image'>('video');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url || !name) {
      toast.error('Please fill in all fields');
      return;
    }
    onSubmit(url, name, type);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full">
        <h3 className="text-xl font-bold text-white mb-4">Link External Media</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Media URL</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/video.mp4"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="My Video Clip"
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Type</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as any)}
              className="w-full bg-gray-700 text-white rounded-lg px-4 py-2 border border-gray-600 focus:border-primary-500 focus:outline-none"
            >
              <option value="video">Video</option>
              <option value="audio">Audio</option>
              <option value="image">Image</option>
            </select>
          </div>
          <div className="flex gap-2">
            <Button type="button" onClick={onClose} variant="secondary" className="flex-1">
              Cancel
            </Button>
            <Button type="submit" variant="primary" className="flex-1">
              Link Media
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
