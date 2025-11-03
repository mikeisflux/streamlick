import { useState, useEffect, useRef } from 'react';
import { Button } from './Button';
import api from '../services/api';
import toast from 'react-hot-toast';
import { clipPlayerService, MediaClip } from '../services/clip-player.service';

interface MediaLibraryProps {
  onTriggerClip?: (clip: MediaClip) => void;
}

export function MediaLibrary({ onTriggerClip }: MediaLibraryProps) {
  const [clips, setClips] = useState<MediaClip[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<'all' | 'video' | 'audio' | 'image'>('all');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchClips();
  }, []);

  const fetchClips = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/media-clips');
      setClips(response.data.clips || []);
    } catch (error) {
      toast.error('Failed to load media clips');
      console.error('Fetch clips error:', error);
    } finally {
      setIsLoading(false);
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{getTypeIcon(clip.type)}</span>
                <div>
                  <div className="text-white font-medium truncate">{clip.name}</div>
                  {clip.duration && (
                    <div className="text-xs text-gray-400">
                      {(clip.duration / 1000).toFixed(1)}s
                    </div>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleDeleteClip(clip.id)}
                className="text-red-400 hover:text-red-300 text-sm"
                title="Delete"
              >
                🗑️
              </button>
            </div>

            {/* Thumbnail/Preview */}
            {clip.type === 'image' && (
              <img
                src={clip.url}
                alt={clip.name}
                className="w-full h-32 object-cover rounded mb-3"
              />
            )}
            {clip.type === 'video' && (
              <video
                src={clip.url}
                className="w-full h-32 object-cover rounded mb-3"
                muted
              />
            )}
            {clip.type === 'audio' && (
              <div className="w-full h-32 bg-gray-600 rounded mb-3 flex items-center justify-center">
                <span className="text-4xl">🎵</span>
              </div>
            )}

            {/* Controls */}
            <div className="flex gap-2">
              <Button
                onClick={() => handleTriggerClip(clip)}
                variant="primary"
                size="sm"
                className="flex-1"
              >
                ▶️ Play
              </Button>
              {clip.hotkey && (
                <div className="px-3 py-2 bg-gray-600 rounded text-xs font-mono text-white">
                  {clip.hotkey}
                </div>
              )}
            </div>

            {/* Volume Control for Audio/Video */}
            {(clip.type === 'audio' || clip.type === 'video') && (
              <div className="mt-3">
                <label className="text-xs text-gray-400 block mb-1">Volume: {clip.volume}%</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={clip.volume}
                  onChange={(e) => {
                    const newVolume = parseInt(e.target.value);
                    setClips(clips.map((c) =>
                      c.id === clip.id ? { ...c, volume: newVolume } : c
                    ));
                  }}
                  className="w-full"
                />
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
              Max size: 100MB
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
