import { EngagementMetrics, StreamInsight } from '../../../services/analytics.service';
import { analyticsService } from '../../../services/analytics.service';

interface AnalyticsDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  metrics: EngagementMetrics | null;
  insights: StreamInsight[];
  position: { x: number; y: number };
  size: { width: number; height: number };
  onDragStart: (e: React.MouseEvent) => void;
  onResizeStart: (e: React.MouseEvent) => void;
}

export function AnalyticsDashboard({
  isOpen,
  onClose,
  metrics,
  insights,
  position,
  size,
  onDragStart,
  onResizeStart,
}: AnalyticsDashboardProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 pointer-events-none">
      <div
        className="bg-gray-900 rounded-lg shadow-2xl overflow-hidden flex flex-col pointer-events-auto"
        style={{
          position: 'absolute',
          left: `${position.x}px`,
          top: `${position.y}px`,
          width: `${size.width}px`,
          height: `${size.height}px`,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b border-gray-700 flex items-center justify-between bg-gray-800 cursor-move"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-600 rounded-lg flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Analytics Dashboard</h2>
              <p className="text-sm text-gray-400">Real-time stream insights & AI recommendations</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metrics Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Total Viewers</div>
              <div className="text-3xl font-bold text-white">{metrics?.totalViewers || 0}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Current Viewers</div>
              <div className="text-3xl font-bold text-green-400">{metrics?.currentViewers || 0}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Peak Viewers</div>
              <div className="text-3xl font-bold text-blue-400">{metrics?.peakViewers || 0}</div>
            </div>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <div className="text-sm text-gray-400 mb-1">Avg Watch Time</div>
              <div className="text-3xl font-bold text-purple-400">
                {Math.round((metrics?.averageWatchTime || 0) / 60)}m
              </div>
            </div>
          </div>

          {/* AI Insights */}
          {insights && insights.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Insights & Recommendations
              </h3>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${
                      insight.type === 'warning'
                        ? 'bg-red-900/20 border-red-500'
                        : insight.type === 'success'
                        ? 'bg-green-900/20 border-green-500'
                        : 'bg-blue-900/20 border-blue-500'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        {insight.type === 'warning' && (
                          <svg className="w-5 h-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                          </svg>
                        )}
                        {insight.type === 'success' && (
                          <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                        {insight.type === 'info' && (
                          <svg className="w-5 h-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h4 className="font-semibold text-white mb-1">{insight.message}</h4>
                        <p className="text-sm text-gray-300">{insight.suggestion}</p>
                        <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                          <span className="px-2 py-1 bg-gray-700 rounded">{insight.category}</span>
                          <span>Severity: {insight.severity}/10</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Engagement Details */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Engagement Rate</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-green-500 to-blue-500"
                      style={{ width: `${Math.min(((metrics?.engagementRate || 0) / 3) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {((metrics?.engagementRate || 0) * 100).toFixed(0)}%
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Interactions per viewer
              </p>
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">Drop-off Rate</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-500 to-red-500"
                      style={{ width: `${(metrics?.dropOffRate || 0) * 100}%` }}
                    />
                  </div>
                </div>
                <div className="text-2xl font-bold text-white">
                  {((metrics?.dropOffRate || 0) * 100).toFixed(0)}%
                </div>
              </div>
              <p className="text-sm text-gray-400 mt-2">
                Viewers who left
              </p>
            </div>
          </div>

          {/* Heatmap Placeholder */}
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <h3 className="text-lg font-semibold text-white mb-4">Viewer Activity Heatmap</h3>
            <div className="h-32 bg-gray-700 rounded-lg flex items-center justify-center">
              <div className="text-gray-400 text-sm">Heatmap visualization (requires charting library)</div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              Shows when viewers joined/left during the stream
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-700 bg-gray-800 flex items-center justify-between relative">
          <div className="text-sm text-gray-400">
            Tracking duration: {Math.round(analyticsService.getStreamDuration() / 60)} minutes
          </div>
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
          >
            Close
          </button>
          {/* Resize Handle */}
          <button
            onMouseDown={onResizeStart}
            className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize text-gray-500 hover:text-gray-300 flex items-center justify-center"
            title="Resize"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16">
              <path d="M16 16V10h-2v4h-4v2h6zM0 0v6h2V2h4V0H0z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
