import { useState } from 'react';

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
}

export function CommentsPanel({ broadcastId }: CommentsPanelProps) {
  const [filter, setFilter] = useState<'all' | 'youtube' | 'facebook' | 'twitch' | 'linkedin' | 'x' | 'rumble'>('all');
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
              className={`p-3 rounded-lg border ${
                comment.isFeatured
                  ? 'border-yellow-400 bg-yellow-50'
                  : comment.isModerated
                  ? 'border-red-300 bg-red-50 opacity-50'
                  : 'border-gray-200 bg-white hover:shadow-md'
              } transition-all`}
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
