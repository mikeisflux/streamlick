import { useState, useEffect } from 'react';
import { PlatformLogo } from './PlatformLogos';

interface PlatformViewers {
  platform: string;
  count: number;
  trend?: 'up' | 'down' | 'stable';
  peakCount?: number;
}

interface ViewerCountProps {
  broadcastId: string;
  platforms: PlatformViewers[];
  onRefresh?: () => void;
  showTrends?: boolean;
  showPeaks?: boolean;
  compact?: boolean;
}

export const ViewerCount: React.FC<ViewerCountProps> = ({
  broadcastId,
  platforms,
  onRefresh,
  showTrends = true,
  showPeaks = true,
  compact = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(!compact);
  const [history, setHistory] = useState<Record<string, number[]>>({});

  const totalViewers = platforms.reduce((sum, p) => sum + p.count, 0);
  const totalPeak = platforms.reduce((max, p) => Math.max(max, p.peakCount || 0), 0);

  // Update history for trend tracking
  useEffect(() => {
    const interval = setInterval(() => {
      setHistory(prev => {
        const updated = { ...prev };
        platforms.forEach(p => {
          if (!updated[p.platform]) updated[p.platform] = [];
          updated[p.platform].push(p.count);
          // Keep last 20 data points
          if (updated[p.platform].length > 20) {
            updated[p.platform].shift();
          }
        });
        return updated;
      });
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [platforms]);

  const getTrendIcon = (trend?: 'up' | 'down' | 'stable') => {
    switch (trend) {
      case 'up':
        return '📈';
      case 'down':
        return '📉';
      case 'stable':
        return '➡️';
      default:
        return '';
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  if (compact && !isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="bg-gray-800 rounded-lg px-4 py-2 border border-gray-700 hover:border-gray-600 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-xl">👥</span>
          </div>
          <div>
            <div className="text-sm text-gray-400">Total Viewers</div>
            <div className="text-2xl font-bold text-white">{formatNumber(totalViewers)}</div>
          </div>
          {showPeaks && totalPeak > 0 && (
            <div className="text-xs text-gray-500">
              Peak: {formatNumber(totalPeak)}
            </div>
          )}
        </div>
      </button>
    );
  }

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <span>👥</span>
          Live Viewers
        </h3>
        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              className="p-1 text-gray-400 hover:text-white transition-colors"
              title="Refresh"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          )}
          {compact && (
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-white"
            >
              ▼
            </button>
          )}
        </div>
      </div>

      {/* Total count */}
      <div className="bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-lg p-4 mb-4 border border-blue-500/30">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-gray-300 mb-1">Total Across All Platforms</div>
            <div className="text-4xl font-bold text-white">{totalViewers.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-gray-400">Live</div>
            <div className="flex items-center gap-1 mt-1">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm text-green-400 font-semibold">STREAMING</span>
            </div>
            {showPeaks && totalPeak > 0 && (
              <div className="text-xs text-gray-400 mt-2">
                Peak: {totalPeak.toLocaleString()}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Per-platform breakdown */}
      <div className="space-y-2">
        <div className="text-sm font-medium text-gray-400 mb-2">By Platform</div>
        {platforms.map((platform) => (
          <div
            key={platform.platform}
            className="bg-gray-900 rounded-lg p-3 border border-gray-700 hover:border-gray-600 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <PlatformLogo platform={platform.platform} size="md" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-white font-medium capitalize">
                      {platform.platform}
                    </span>
                    {showTrends && platform.trend && (
                      <span className="text-sm">
                        {getTrendIcon(platform.trend)}
                      </span>
                    )}
                  </div>
                  {showPeaks && platform.peakCount && platform.peakCount > 0 && (
                    <div className="text-xs text-gray-500">
                      Peak: {platform.peakCount.toLocaleString()}
                    </div>
                  )}
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-bold text-white">
                  {platform.count.toLocaleString()}
                </div>
                <div className="text-xs text-gray-400">
                  {totalViewers > 0 ? `${((platform.count / totalViewers) * 100).toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>

            {/* Mini sparkline chart */}
            {history[platform.platform] && history[platform.platform].length > 1 && (
              <div className="mt-3 h-8 flex items-end gap-1">
                {history[platform.platform].slice(-10).map((count, idx) => {
                  const max = Math.max(...history[platform.platform]);
                  const height = max > 0 ? (count / max) * 100 : 0;
                  return (
                    <div
                      key={idx}
                      className="flex-1 bg-blue-500/30 rounded-t"
                      style={{ height: `${height}%`, minHeight: '2px' }}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ))}

        {platforms.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📊</div>
            <div className="text-sm">No platform data available</div>
            <div className="text-xs mt-1">Start streaming to see viewer counts</div>
          </div>
        )}
      </div>

      {/* Quick stats */}
      <div className="mt-4 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-xs text-gray-400">Platforms</div>
            <div className="text-lg font-semibold text-white">{platforms.length}</div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Avg/Platform</div>
            <div className="text-lg font-semibold text-white">
              {platforms.length > 0 ? Math.round(totalViewers / platforms.length) : 0}
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400">Peak Total</div>
            <div className="text-lg font-semibold text-white">{totalPeak}</div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact floating viewer count badge
export const ViewerCountBadge: React.FC<{
  count: number;
  trend?: 'up' | 'down' | 'stable';
  onClick?: () => void;
}> = ({ count, trend, onClick }) => {
  const getTrendColor = () => {
    switch (trend) {
      case 'up':
        return 'text-green-400';
      case 'down':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getTrendIcon = () => {
    switch (trend) {
      case 'up':
        return '↗';
      case 'down':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <button
      onClick={onClick}
      className="bg-gray-900/90 backdrop-blur-sm rounded-full px-4 py-2 border border-gray-700 hover:border-gray-600 transition-all shadow-lg"
    >
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-white font-semibold text-lg">{count.toLocaleString()}</span>
        {trend && (
          <span className={`text-sm ${getTrendColor()}`}>
            {getTrendIcon()}
          </span>
        )}
      </div>
    </button>
  );
};
