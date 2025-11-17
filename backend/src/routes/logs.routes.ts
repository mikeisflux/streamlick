import { Router, Request, Response } from 'express';
import { authenticate as authMiddleware } from '../auth/middleware';
import logger from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const router = Router();

// In-memory diagnostic logs storage (will be populated from media server)
// In production, this would integrate with diagnosticLogger from media-server
let diagnosticLogs: any[] = [];
let compositorMetrics: any[] = [];

/**
 * GET /api/logs/diagnostic
 * Get diagnostic logs with optional filtering
 */
router.get('/diagnostic', authMiddleware, async (req: Request, res: Response) => {
  try {
    const {
      level,
      category,
      broadcastId,
      startTime,
      endTime,
      component,
      limit = 1000,
    } = req.query;

    let filtered = [...diagnosticLogs];

    // Apply filters
    if (level) {
      const levels = Array.isArray(level) ? level : [level];
      filtered = filtered.filter((log) => levels.includes(log.level));
    }

    if (category) {
      const categories = Array.isArray(category) ? category : [category];
      filtered = filtered.filter((log) => categories.includes(log.category));
    }

    if (broadcastId) {
      filtered = filtered.filter((log) => log.broadcastId === broadcastId);
    }

    if (component) {
      filtered = filtered.filter((log) => log.component.includes(component as string));
    }

    if (startTime) {
      filtered = filtered.filter((log) => new Date(log.timestamp) >= new Date(startTime as string));
    }

    if (endTime) {
      filtered = filtered.filter((log) => new Date(log.timestamp) <= new Date(endTime as string));
    }

    // Apply limit
    const limitNum = parseInt(limit as string, 10);
    filtered = filtered.slice(-limitNum);

    res.json({
      total: filtered.length,
      logs: filtered,
    });
  } catch (error: any) {
    logger.error('Get diagnostic logs error:', error);
    res.status(500).json({ error: 'Failed to retrieve logs' });
  }
});

/**
 * GET /api/logs/compositor
 * Get compositor performance metrics
 */
router.get('/compositor', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId, limit = 100 } = req.query;

    let filtered = [...compositorMetrics];

    if (broadcastId) {
      filtered = filtered.filter((m) => m.broadcastId === broadcastId);
    }

    const limitNum = parseInt(limit as string, 10);
    filtered = filtered.slice(-limitNum);

    res.json({
      total: filtered.length,
      metrics: filtered,
    });
  } catch (error: any) {
    logger.error('Get compositor metrics error:', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * POST /api/logs/compositor
 * Report compositor performance metrics (from frontend)
 */
router.post('/compositor', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId, metrics } = req.body;

    const entry = {
      broadcastId,
      timestamp: new Date().toISOString(),
      ...metrics,
    };

    compositorMetrics.push(entry);

    // Keep only last 10000 entries
    if (compositorMetrics.length > 10000) {
      compositorMetrics = compositorMetrics.slice(-10000);
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Report compositor metrics error:', error);
    res.status(500).json({ error: 'Failed to report metrics' });
  }
});

/**
 * GET /api/logs/report
 * Generate comprehensive diagnostic report
 */
router.get('/report', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { broadcastId, startTime, endTime, format = 'json' } = req.query;

    // Filter logs
    let filteredLogs = [...diagnosticLogs];
    if (broadcastId) {
      filteredLogs = filteredLogs.filter((l) => l.broadcastId === broadcastId);
    }
    if (startTime) {
      filteredLogs = filteredLogs.filter((l) => new Date(l.timestamp) >= new Date(startTime as string));
    }
    if (endTime) {
      filteredLogs = filteredLogs.filter((l) => new Date(l.timestamp) <= new Date(endTime as string));
    }

    // Generate statistics
    const broadcasts = new Set(filteredLogs.filter((l) => l.broadcastId).map((l) => l.broadcastId));
    const errorCount = filteredLogs.filter((l) => l.level === 'error').length;
    const warningCount = filteredLogs.filter((l) => l.level === 'warn').length;

    // Category statistics
    const rtpLogs = filteredLogs.filter((l) => l.category === 'rtp-pipeline');
    const ffmpegLogs = filteredLogs.filter((l) => l.category === 'ffmpeg');
    const compositorLogs = filteredLogs.filter((l) => l.category === 'compositor');

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange: {
        start: filteredLogs.length > 0 ? filteredLogs[0].timestamp : new Date().toISOString(),
        end: filteredLogs.length > 0 ? filteredLogs[filteredLogs.length - 1].timestamp : new Date().toISOString(),
      },
      summary: {
        totalLogs: filteredLogs.length,
        errorCount,
        warningCount,
        broadcasts: Array.from(broadcasts),
      },
      statistics: {
        rtpPipeline: {
          totalLogs: rtpLogs.length,
          errors: rtpLogs.filter((l) => l.level === 'error').length,
        },
        ffmpeg: {
          totalLogs: ffmpegLogs.length,
          processStarts: ffmpegLogs.filter((l) => l.message.includes('started')).length,
          processErrors: ffmpegLogs.filter((l) => l.level === 'error').length,
          reconnections: ffmpegLogs.filter((l) => l.message.includes('reconnect')).length,
        },
        compositor: {
          totalLogs: compositorLogs.length,
          performanceWarnings: compositorLogs.filter((l) => l.level === 'warn').length,
        },
      },
      logs: filteredLogs,
      compositorMetrics: compositorMetrics.filter((m) => {
        if (!broadcastId) return true;
        return m.broadcastId === broadcastId;
      }),
    };

    if (format === 'csv') {
      // Generate CSV
      const headers = ['Timestamp', 'Level', 'Category', 'Component', 'Broadcast ID', 'Message', 'Data'];
      const rows = filteredLogs.map((log) => [
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

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-${Date.now()}.csv"`);
      res.send(csvContent);
    } else {
      // Return JSON
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="diagnostic-report-${Date.now()}.json"`);
      res.json(report);
    }
  } catch (error: any) {
    logger.error('Generate report error:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * POST /api/logs/diagnostic
 * Add diagnostic log entry (from media server)
 */
router.post('/diagnostic', async (req: Request, res: Response) => {
  try {
    const log = req.body;
    diagnosticLogs.push(log);

    // Keep only last 50000 logs
    if (diagnosticLogs.length > 50000) {
      diagnosticLogs = diagnosticLogs.slice(-50000);
    }

    res.json({ success: true });
  } catch (error: any) {
    logger.error('Add diagnostic log error:', error);
    res.status(500).json({ error: 'Failed to add log' });
  }
});

/**
 * DELETE /api/logs/diagnostic
 * Clear all diagnostic logs
 */
router.delete('/diagnostic', authMiddleware, async (req: Request, res: Response) => {
  try {
    diagnosticLogs = [];
    compositorMetrics = [];
    logger.info('Diagnostic logs cleared');
    res.json({ success: true, message: 'Logs cleared successfully' });
  } catch (error: any) {
    logger.error('Clear logs error:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

/**
 * GET /api/logs/application
 * Get application logs from Winston log files
 */
router.get('/application', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = 500, level, search } = req.query;

    // Read Winston log files
    const logsDir = path.join(process.cwd(), 'logs');
    let logLines: any[] = [];

    try {
      const combinedLogPath = path.join(logsDir, 'combined.log');
      const fileExists = await fs.access(combinedLogPath).then(() => true).catch(() => false);

      if (fileExists) {
        const combinedLog = await fs.readFile(combinedLogPath, 'utf-8');
        const lines = combinedLog.split('\n').filter(line => line.trim());

        logLines = lines
          .slice(-Number(limit))
          .map((line: string) => {
            try {
              return JSON.parse(line);
            } catch {
              return {
                timestamp: new Date().toISOString(),
                level: 'info',
                message: line,
              };
            }
          })
          .filter((log: any) => {
            // Filter by level
            if (level && log.level !== level) return false;

            // Filter by search
            if (search && !JSON.stringify(log).toLowerCase().includes(String(search).toLowerCase())) {
              return false;
            }

            return true;
          });
      }
    } catch (error) {
      logger.error('Error reading application log files:', error);
    }

    res.json({
      logs: logLines.reverse(), // Most recent first
      total: logLines.length,
    });
  } catch (error: any) {
    logger.error('Get application logs error:', error);
    res.status(500).json({ error: 'Failed to fetch application logs' });
  }
});

/**
 * GET /api/logs/oauth
 * Get OAuth-specific logs
 */
router.get('/oauth', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = 100, platform } = req.query;

    const logsDir = path.join(process.cwd(), 'logs');
    const combinedLogPath = path.join(logsDir, 'combined.log');

    try {
      const logExists = await fs.access(combinedLogPath).then(() => true).catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(combinedLogPath, 'utf-8');
        const lines = logContent.split('\n').filter(line => line.trim());

        const oauthLogs = lines
          .slice(-Number(limit) * 5) // Read more to ensure we get enough OAuth logs
          .map(line => {
            try {
              return JSON.parse(line);
            } catch {
              return null;
            }
          })
          .filter(log => {
            if (!log) return false;

            // Filter for OAuth-related logs
            const message = JSON.stringify(log).toLowerCase();
            const isOAuth = message.includes('oauth') || message.includes('[oauth]');

            if (!isOAuth) return false;

            // Filter by platform if specified
            if (platform && !message.includes(String(platform).toLowerCase())) {
              return false;
            }

            return true;
          })
          .slice(-Number(limit)); // Take only the requested limit

        res.json({
          logs: oauthLogs.reverse(),
          total: oauthLogs.length,
        });
      } else {
        res.json({ logs: [], total: 0 });
      }
    } catch (error) {
      logger.error('Error reading OAuth logs:', error);
      res.json({ logs: [], total: 0 });
    }
  } catch (error: any) {
    logger.error('Get OAuth logs error:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth logs' });
  }
});

export default router;
