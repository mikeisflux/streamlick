import { useEffect, useState } from 'react';
import { socketService } from '../services/socket.service';

export interface StreamHealthMetrics {
  broadcastId: string;
  status: 'idle' | 'starting' | 'live' | 'ending' | 'error';
  uptime: number;
  bitrate: number;
  framerate: number;
  droppedFrames: number;
  totalFrames: number;
  networkQuality: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  destinations: DestinationHealth[];
  timestamp: Date;
}

export interface DestinationHealth {
  id: string;
  platform: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  bitrate: number;
  rtt: number;
  packetLoss: number;
  errorCount: number;
  lastError?: string;
}

interface StreamHealthMonitorProps {
  broadcastId: string;
  isLive: boolean;
}

export function StreamHealthMonitor({ broadcastId, isLive }: StreamHealthMonitorProps) {
  const [metrics, setMetrics] = useState<StreamHealthMetrics | null>(null);

  useEffect(() => {
    if (!isLive) {
      setMetrics(null);
      return;
    }

    // Start health monitoring
    socketService.emit('start-health-monitoring', { broadcastId });

    // Listen for health updates
    const handleHealthMetrics = (data: StreamHealthMetrics) => {
      setMetrics(data);
    };

    socketService.on('health-metrics', handleHealthMetrics);

    return () => {
      socketService.off('health-metrics', handleHealthMetrics);
      socketService.emit('stop-health-monitoring', { broadcastId });
    };
  }, [broadcastId, isLive]);

  if (!metrics || !isLive) {
    return null;
  }

  const formatUptime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getQualityColor = (quality: StreamHealthMetrics['networkQuality']): string => {
    switch (quality) {
      case 'excellent':
        return 'text-green-400';
      case 'good':
        return 'text-green-300';
      case 'fair':
        return 'text-yellow-400';
      case 'poor':
        return 'text-orange-400';
      case 'critical':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  const getQualityIcon = (quality: StreamHealthMetrics['networkQuality']): string => {
    switch (quality) {
      case 'excellent':
      case 'good':
        return '●';
      case 'fair':
        return '◐';
      case 'poor':
      case 'critical':
        return '○';
      default:
        return '○';
    }
  };

  const getStatusColor = (status: DestinationHealth['status']): string => {
    switch (status) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500';
      case 'disconnected':
        return 'bg-gray-500';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const dropRate = metrics.totalFrames > 0 ? (metrics.droppedFrames / metrics.totalFrames) * 100 : 0;

  return (
    <div className="bg-gray-800 rounded-lg p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
          <span className={`text-lg ${getQualityColor(metrics.networkQuality)}`}>
            {getQualityIcon(metrics.networkQuality)}
          </span>
          Stream Health
        </h3>
        <span className="text-xs text-gray-400">{formatUptime(metrics.uptime)}</span>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-700 rounded p-2">
          <div className="text-xs text-gray-400">Bitrate</div>
          <div className="text-sm font-semibold text-white">{Math.round(metrics.bitrate)} kbps</div>
        </div>
        <div className="bg-gray-700 rounded p-2">
          <div className="text-xs text-gray-400">FPS</div>
          <div className="text-sm font-semibold text-white">{Math.round(metrics.framerate)}</div>
        </div>
        <div className="bg-gray-700 rounded p-2">
          <div className="text-xs text-gray-400">Drop Rate</div>
          <div className={`text-sm font-semibold ${dropRate > 5 ? 'text-red-400' : 'text-white'}`}>
            {dropRate.toFixed(2)}%
          </div>
        </div>
      </div>

      {/* Network Quality */}
      <div className="bg-gray-700 rounded p-2">
        <div className="text-xs text-gray-400 mb-1">Network Quality</div>
        <div className={`text-sm font-semibold capitalize ${getQualityColor(metrics.networkQuality)}`}>
          {metrics.networkQuality}
        </div>
      </div>

      {/* Destinations */}
      {metrics.destinations.length > 0 && (
        <div>
          <div className="text-xs text-gray-400 mb-2">Destinations</div>
          <div className="space-y-1">
            {metrics.destinations.map((dest) => (
              <div key={dest.id} className="flex items-center justify-between text-xs bg-gray-700 rounded p-2">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${getStatusColor(dest.status)}`}></span>
                  <span className="text-gray-300 capitalize">{dest.platform}</span>
                </div>
                <div className="flex items-center gap-3 text-gray-400">
                  {dest.status === 'connected' && (
                    <>
                      <span>{Math.round(dest.bitrate)} kbps</span>
                      <span>{dest.rtt}ms</span>
                      {dest.packetLoss > 0 && (
                        <span className="text-orange-400">{dest.packetLoss.toFixed(1)}% loss</span>
                      )}
                    </>
                  )}
                  {dest.status === 'error' && (
                    <span className="text-red-400">Error ({dest.errorCount})</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Warning */}
      {metrics.networkQuality === 'critical' && (
        <div className="bg-red-900/30 border border-red-500/50 rounded p-2 text-xs text-red-300">
          ⚠️ Critical network issues detected. Stream quality may be affected.
        </div>
      )}
    </div>
  );
}
