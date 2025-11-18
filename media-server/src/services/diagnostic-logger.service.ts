import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import logger from '../utils/logger';

export type LogLevel = 'info' | 'warn' | 'error' | 'debug' | 'performance';
export type LogCategory = 'rtp-pipeline' | 'ffmpeg' | 'compositor' | 'network' | 'system';

export interface DiagnosticLog {
  timestamp: string;
  level: LogLevel;
  category: LogCategory;
  broadcastId?: string;
  component: string;
  message: string;
  data?: any;
  metrics?: {
    duration?: number;
    memoryUsage?: number;
    cpuUsage?: number;
    frameRate?: number;
    bitrate?: number;
    packetLoss?: number;
    rtt?: number;
  };
  error?: {
    code?: string;
    message: string;
    stack?: string;
  };
}

export interface LogFilter {
  level?: LogLevel[];
  category?: LogCategory[];
  broadcastId?: string;
  startTime?: Date;
  endTime?: Date;
  component?: string;
  limit?: number;
}

export interface LogReport {
  generatedAt: string;
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalLogs: number;
    errorCount: number;
    warningCount: number;
    performanceIssues: number;
    broadcasts: string[];
  };
  logs: DiagnosticLog[];
  statistics: {
    rtpPipeline?: {
      transportCreations: number;
      consumerCreations: number;
      averagePacketLoss: number;
      averageRtt: number;
    };
    ffmpeg?: {
      processStarts: number;
      processErrors: number;
      reconnections: number;
      averageBitrate: number;
    };
    compositor?: {
      averageFrameRate: number;
      droppedFrames: number;
      averageRenderTime: number;
      performanceWarnings: number;
    };
  };
}

/**
 * Diagnostic Logger Service
 * Captures detailed logs for debugging and optimization
 */
export class DiagnosticLoggerService extends EventEmitter {
  private logs: DiagnosticLog[] = [];
  private readonly MAX_LOGS = 50000; // Keep last 50k logs in memory
  private readonly LOG_DIR = path.join(__dirname, '../../../../logs/diagnostics');
  private currentLogFile: string | null = null;
  private logStream: fs.WriteStream | null = null;
  private currentDate: string = '';
  private rotationCheckInterval: NodeJS.Timeout | null = null;
  private readonly BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000';
  private logQueue: DiagnosticLog[] = [];
  private flushInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.ensureLogDirectory();
    this.rotateLogFile();

    // Check for date change every hour and rotate if needed
    this.rotationCheckInterval = setInterval(() => {
      this.checkAndRotateIfNeeded();
    }, 3600000); // 1 hour

    // Flush logs to backend every 2 seconds
    this.flushInterval = setInterval(() => {
      this.flushLogsToBackend();
    }, 2000);
  }

  /**
   * Ensure log directory exists
   */
  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.LOG_DIR)) {
      fs.mkdirSync(this.LOG_DIR, { recursive: true });
    }
  }

  /**
   * Check if date has changed and rotate if needed
   */
  private checkAndRotateIfNeeded(): void {
    const date = new Date().toISOString().split('T')[0];
    if (date !== this.currentDate) {
      logger.info('Date changed, rotating diagnostic log file');
      this.rotateLogFile();
    }
  }

  /**
   * Rotate log file (daily rotation)
   */
  private rotateLogFile(): void {
    if (this.logStream) {
      this.logStream.end();
    }

    const date = new Date().toISOString().split('T')[0];
    this.currentDate = date;
    this.currentLogFile = path.join(this.LOG_DIR, `diagnostic-${date}.jsonl`);
    this.logStream = fs.createWriteStream(this.currentLogFile, { flags: 'a' });

    logger.info(`Diagnostic log file rotated: ${this.currentLogFile}`);
  }

  /**
   * Flush queued logs to backend API
   */
  private async flushLogsToBackend(): Promise<void> {
    if (this.logQueue.length === 0) return;

    const logsToSend = [...this.logQueue];
    this.logQueue = [];

    try {
      // Send logs to backend in batch
      for (const log of logsToSend) {
        await axios.post(`${this.BACKEND_API_URL}/api/logs/diagnostic`, log, {
          timeout: 1000,
        }).catch(err => {
          // Silently fail - don't spam logs with backend connection errors
        });
      }
    } catch (error) {
      // Silently fail - backend may not be available
    }
  }

  /**
   * Log a diagnostic entry
   */
  log(entry: Omit<DiagnosticLog, 'timestamp'>): void {
    const log: DiagnosticLog = {
      timestamp: new Date().toISOString(),
      ...entry,
    };

    // Add to in-memory array
    this.logs.push(log);

    // Trim if exceeds max
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.shift();
    }

    // Write to file (JSONL format - one JSON per line)
    if (this.logStream) {
      this.logStream.write(JSON.stringify(log) + '\n');
    }

    // Queue for sending to backend
    this.logQueue.push(log);

    // Emit event for real-time monitoring
    this.emit('log', log);

    // Also log to main logger for critical issues
    if (entry.level === 'error') {
      logger.error(`[${entry.category}] ${entry.component}: ${entry.message}`, entry.data);
    } else if (entry.level === 'warn') {
      logger.warn(`[${entry.category}] ${entry.component}: ${entry.message}`, entry.data);
    }
  }

  /**
   * Log RTP pipeline event
   */
  logRTPPipeline(
    component: string,
    message: string,
    level: LogLevel = 'info',
    data?: any,
    broadcastId?: string
  ): void {
    this.log({
      level,
      category: 'rtp-pipeline',
      component,
      message,
      data,
      broadcastId,
    });
  }

  /**
   * Log FFmpeg event
   */
  logFFmpeg(
    component: string,
    message: string,
    level: LogLevel = 'info',
    data?: any,
    broadcastId?: string
  ): void {
    this.log({
      level,
      category: 'ffmpeg',
      component,
      message,
      data,
      broadcastId,
    });
  }

  /**
   * Log compositor event
   */
  logCompositor(
    component: string,
    message: string,
    level: LogLevel = 'info',
    data?: any,
    metrics?: DiagnosticLog['metrics'],
    broadcastId?: string
  ): void {
    this.log({
      level,
      category: 'compositor',
      component,
      message,
      data,
      metrics,
      broadcastId,
    });
  }

  /**
   * Log performance metric
   */
  logPerformance(
    category: LogCategory,
    component: string,
    message: string,
    metrics: DiagnosticLog['metrics'],
    broadcastId?: string
  ): void {
    this.log({
      level: 'performance',
      category,
      component,
      message,
      metrics,
      broadcastId,
    });
  }

  /**
   * Log error with stack trace
   */
  logError(
    category: LogCategory,
    component: string,
    message: string,
    error: Error,
    data?: any,
    broadcastId?: string
  ): void {
    this.log({
      level: 'error',
      category,
      component,
      message,
      data,
      broadcastId,
      error: {
        code: (error as any).code,
        message: error.message,
        stack: error.stack,
      },
    });
  }

  /**
   * Get logs with filters
   */
  getLogs(filter?: LogFilter): DiagnosticLog[] {
    let filtered = [...this.logs];

    if (filter) {
      if (filter.level) {
        filtered = filtered.filter((log) => filter.level!.includes(log.level));
      }

      if (filter.category) {
        filtered = filtered.filter((log) => filter.category!.includes(log.category));
      }

      if (filter.broadcastId) {
        filtered = filtered.filter((log) => log.broadcastId === filter.broadcastId);
      }

      if (filter.component) {
        filtered = filtered.filter((log) => log.component.includes(filter.component!));
      }

      if (filter.startTime) {
        filtered = filtered.filter((log) => new Date(log.timestamp) >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter((log) => new Date(log.timestamp) <= filter.endTime!);
      }

      if (filter.limit) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  /**
   * Generate comprehensive report
   */
  generateReport(filter?: LogFilter): LogReport {
    const logs = this.getLogs(filter);

    // Calculate statistics
    const broadcasts = new Set(logs.filter((l) => l.broadcastId).map((l) => l.broadcastId!));
    const errorCount = logs.filter((l) => l.level === 'error').length;
    const warningCount = logs.filter((l) => l.level === 'warn').length;
    const performanceIssues = logs.filter(
      (l) => l.level === 'performance' && l.metrics && l.metrics.duration && l.metrics.duration > 33
    ).length;

    // RTP Pipeline statistics
    const rtpLogs = logs.filter((l) => l.category === 'rtp-pipeline');
    const rtpStats = {
      transportCreations: rtpLogs.filter((l) => l.message.includes('transport created')).length,
      consumerCreations: rtpLogs.filter((l) => l.message.includes('consumer created')).length,
      averagePacketLoss: this.calculateAverage(rtpLogs, (l) => l.metrics?.packetLoss),
      averageRtt: this.calculateAverage(rtpLogs, (l) => l.metrics?.rtt),
    };

    // FFmpeg statistics
    const ffmpegLogs = logs.filter((l) => l.category === 'ffmpeg');
    const ffmpegStats = {
      processStarts: ffmpegLogs.filter((l) => l.message.includes('started')).length,
      processErrors: ffmpegLogs.filter((l) => l.level === 'error').length,
      reconnections: ffmpegLogs.filter((l) => l.message.includes('reconnect')).length,
      averageBitrate: this.calculateAverage(ffmpegLogs, (l) => l.metrics?.bitrate),
    };

    // Compositor statistics
    const compositorLogs = logs.filter((l) => l.category === 'compositor');
    const compositorStats = {
      averageFrameRate: this.calculateAverage(compositorLogs, (l) => l.metrics?.frameRate),
      droppedFrames: compositorLogs.filter((l) => l.message.includes('dropped')).length,
      averageRenderTime: this.calculateAverage(compositorLogs, (l) => l.metrics?.duration),
      performanceWarnings: compositorLogs.filter((l) => l.level === 'warn').length,
    };

    const timeRange = {
      start: logs.length > 0 ? logs[0].timestamp : new Date().toISOString(),
      end: logs.length > 0 ? logs[logs.length - 1].timestamp : new Date().toISOString(),
    };

    return {
      generatedAt: new Date().toISOString(),
      timeRange,
      summary: {
        totalLogs: logs.length,
        errorCount,
        warningCount,
        performanceIssues,
        broadcasts: Array.from(broadcasts),
      },
      logs,
      statistics: {
        rtpPipeline: rtpStats,
        ffmpeg: ffmpegStats,
        compositor: compositorStats,
      },
    };
  }

  /**
   * Calculate average of a metric
   */
  private calculateAverage(logs: DiagnosticLog[], extractor: (log: DiagnosticLog) => number | undefined): number {
    const values = logs.map(extractor).filter((v): v is number => v !== undefined);
    if (values.length === 0) return 0;
    return values.reduce((sum, v) => sum + v, 0) / values.length;
  }

  /**
   * Export report as JSON
   */
  exportReport(filter?: LogFilter): string {
    const report = this.generateReport(filter);
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as CSV
   */
  exportReportCSV(filter?: LogFilter): string {
    const logs = this.getLogs(filter);
    const headers = ['Timestamp', 'Level', 'Category', 'Component', 'Broadcast ID', 'Message', 'Data'];
    const rows = logs.map((log) => [
      log.timestamp,
      log.level,
      log.category,
      log.component,
      log.broadcastId || '',
      log.message,
      log.data ? JSON.stringify(log.data) : '',
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    return csvContent;
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    logger.info('Diagnostic logs cleared');
  }

  /**
   * Get log file path
   */
  getCurrentLogFile(): string | null {
    return this.currentLogFile;
  }

  /**
   * Clean up
   */
  destroy(): void {
    if (this.rotationCheckInterval) {
      clearInterval(this.rotationCheckInterval);
      this.rotationCheckInterval = null;
    }

    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
    }

    // Flush any remaining logs
    this.flushLogsToBackend();

    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// Export singleton instance
export const diagnosticLogger = new DiagnosticLoggerService();
