import { useState } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';

interface Comment {
  id: string;
  platform: 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble';
  authorName: string;
  authorAvatar?: string;
  message: string;
  timestamp: Date;
  isFeatured: boolean;
  isModerated: boolean;
}

interface CommentsPanelProps {
  broadcastId?: string;
  onCommentClick?: (comment: Comment) => void;
}

export function CommentsPanel({ broadcastId, onCommentClick }: CommentsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble'>('all');
  const [inputMessage, setInputMessage] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['youtube', 'facebook', 'twitch', 'linkedin', 'rumble']);
  const [comments, setComments] = useState<Comment[]>([
    {
      id: '1',
      platform: 'youtube',
      authorName: 'TechFan99',
      message: 'Great stream! Love the content 🔥',
      timestamp: new Date(Date.now() - 120000),
      isFeatured: false,
      isModerated: false,
    },
    {
      id: '2',
      platform: 'twitch',
      authorName: 'StreamerPro',
      message: 'Can you show the demo again?',
      timestamp: new Date(Date.now() - 60000),
      isFeatured: true,
      isModerated: false,
    },
    {
      id: '3',
      platform: 'facebook',
      authorName: 'Sarah Johnson',
      message: 'This is exactly what I needed to learn!',
      timestamp: new Date(Date.now() - 30000),
      isFeatured: false,
      isModerated: false,
    },
  ]);

  const platformIcons: Record<string, string> = {
    youtube: '📺',
    facebook: '👥',
    twitch: '🎮',
    linkedin: '💼',
    x: '𝕏',
    rumble: '🎬',
  };

  const platformColors: Record<string, string> = {
    youtube: 'bg-red-100 text-red-700',
    facebook: 'bg-blue-100 text-blue-700',
    twitch: 'bg-purple-100 text-purple-700',
    linkedin: 'bg-blue-100 text-blue-800',
    x: 'bg-gray-100 text-gray-700',
    rumble: 'bg-green-100 text-green-700',
  };

  const filteredComments = filter === 'all'
    ? comments
    : comments.filter((c) => c.platform === filter);

  const toggleFeature = (commentId: string) => {
    setComments(
      comments.map((c) =>
        c.id === commentId ? { ...c, isFeatured: !c.isFeatured } : c
      )
    );
  };

  const moderateComment = (commentId: string) => {
    setComments(
      comments.map((c) =>
        c.id === commentId ? { ...c, isModerated: true } : c
      )
    );
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);

    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ago`;
  };

  const handlePostComment = async () => {
    if (!inputMessage.trim()) {
      toast.error('Please enter a message');
      return;
    }

    if (selectedPlatforms.length === 0) {
      toast.error('Please select at least one platform');
      return;
    }

    setIsPosting(true);

    try {
      const response = await api.post('/comments/post', {
        message: inputMessage.trim(),
        platforms: selectedPlatforms,
      });

      // Show results
      const results = response.data.results;
      const successPlatforms = results.filter((r: any) => r.success).map((r: any) => r.platform);
      const failedPlatforms = results.filter((r: any) => !r.success);

      if (successPlatforms.length > 0) {
        toast.success(`Posted to: ${successPlatforms.join(', ')}`);
        setInputMessage('');
      }

      if (failedPlatforms.length > 0) {
        failedPlatforms.forEach((r: any) => {
          toast.error(`${r.platform}: ${r.error}`);
        });
      }
    } catch (error: any) {
      console.error('Post comment error:', error);
      toast.error(error.response?.data?.error || 'Failed to post comment');
    } finally {
      setIsPosting(false);
    }
  };

  const togglePlatform = (platform: string) => {
    // Don't allow toggling X as it's not supported for posting
    if (platform === 'x') return;

    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter(p => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200">
        <h3 className="text-sm font-semibold text-gray-900 mb-2">Live Comments</h3>
        <div className="flex gap-1 overflow-x-auto pb-2">
          <button
            onClick={() => setFilter('all')}
            className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            All
          </button>
          {(['youtube', 'facebook', 'twitch', 'linkedin', 'x', 'rumble'] as const).map(
            (platform) => (
              <button
                key={platform}
                onClick={() => setFilter(platform)}
                className={`px-2 py-1 text-xs rounded transition-colors whitespace-nowrap ${
                  filter === platform
                    ? platformColors[platform]
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {platformIcons[platform]} {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </button>
            )
          )}
        </div>
      </div>

      {/* Comments List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {filteredComments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">💬</div>
            <p className="text-sm text-gray-600">No comments yet</p>
            <p className="text-xs text-gray-500 mt-1">
              Comments will appear here as viewers interact with your stream
            </p>
          </div>
        ) : (
          filteredComments.map((comment) => (
            <div
              key={comment.id}
              onClick={() => onCommentClick?.(comment)}
              className={`p-3 rounded-lg border ${
                comment.isFeatured
                  ? 'border-yellow-400 bg-yellow-50'
                  : comment.isModerated
                  ? 'border-red-300 bg-red-50 opacity-50'
                  : 'border-gray-200 bg-white hover:shadow-md'
              } transition-all ${onCommentClick ? 'cursor-pointer hover:border-blue-400' : ''}`}
              title={onCommentClick ? 'Click to display on stream' : ''}
            >
              <div className="flex items-start gap-3">
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center flex-shrink-0">
                  <span className="text-xs font-semibold text-gray-600">
                    {comment.authorName.charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {comment.authorName}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${
                        platformColors[comment.platform]
                      }`}
                    >
                      {platformIcons[comment.platform]}
                    </span>
                    {comment.isFeatured && (
                      <span className="text-xs bg-yellow-200 text-yellow-800 px-1.5 py-0.5 rounded">
                        ⭐ Featured
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-700">{comment.message}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-500">
                      {formatTime(comment.timestamp)}
                    </span>
                    {!comment.isModerated && (
                      <>
                        <button
                          onClick={() => toggleFeature(comment.id)}
                          className="text-xs text-blue-600 hover:text-blue-700"
                        >
                          {comment.isFeatured ? '🌟 Unfeature' : '⭐ Feature'}
                        </button>
                        <button className="text-xs text-green-600 hover:text-green-700">
                          💬 Reply
                        </button>
                        <button
                          onClick={() => moderateComment(comment.id)}
                          className="text-xs text-red-600 hover:text-red-700"
                        >
                          🚫 Hide
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Stats Footer */}
      <div className="border-t border-gray-200 px-4 py-2 bg-gray-50">
        <div className="flex items-center justify-between text-xs text-gray-600">
          <span>
            {comments.length} comment{comments.length !== 1 ? 's' : ''}
          </span>
          <span>
            {comments.filter((c) => c.isFeatured).length} featured
          </span>
          <span>
            {comments.filter((c) => c.isModerated).length} moderated
          </span>
        </div>
      </div>

      {/* Post Comment Input */}
      <div className="border-t border-gray-200 p-3 bg-gray-50">
        <div className="mb-2">
          <label className="block text-xs font-medium text-gray-700 mb-2">Post to platforms:</label>
          <div className="flex flex-wrap gap-1">
            {(['youtube', 'facebook', 'twitch', 'linkedin', 'rumble'] as const).map((platform) => (
              <button
                key={platform}
                onClick={() => togglePlatform(platform)}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  selectedPlatforms.includes(platform)
                    ? platformColors[platform]
                    : 'bg-gray-200 text-gray-500'
                }`}
                disabled={isPosting}
              >
                {platformIcons[platform]} {platform.charAt(0).toUpperCase() + platform.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <input
            id="comments-message"
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' && !isPosting) {
                handlePostComment();
              }
            }}
            placeholder="Type your message..."
            className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={isPosting}
            aria-label="Comment message"
          />
          <button
            onClick={handlePostComment}
            disabled={isPosting || !inputMessage.trim()}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
          >
            {isPosting ? '...' : 'Post'}
          </button>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      <div className="border-t border-gray-200 px-4 py-2 bg-white">
        <div className="flex items-center justify-between text-xs">
          <span className="text-gray-600 flex items-center gap-1">
            <span className="inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live updates enabled
          </span>
          <button className="text-blue-600 hover:text-blue-700">⚙️ Settings</button>
        </div>
      </div>
    </div>
  );
}
