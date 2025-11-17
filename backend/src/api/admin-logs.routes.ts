import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs/promises';
import * as path from 'path';
import { authenticate, requireAdmin } from '../auth/middleware';
import prisma from '../database/prisma';

const router = Router();
const execAsync = promisify(exec);

// Require authentication and admin privileges for all log routes
router.use(authenticate);
router.use(requireAdmin);

/**
 * Get application logs (from winston or PM2)
 */
router.get('/application', async (req: Request, res: Response) => {
  try {
    const { limit = 500, level, search, startDate, endDate } = req.query;

    // Try to read Winston log files
    const logsDir = path.join(process.cwd(), 'logs');
    let logLines: any[] = [];

    try {
      // Read error log
      const errorLogPath = path.join(logsDir, 'error.log');
      const combinedLogPath = path.join(logsDir, 'combined.log');

      const [errorLogExists, combinedLogExists] = await Promise.all([
        fs.access(errorLogPath).then(() => true).catch(() => false),
        fs.access(combinedLogPath).then(() => true).catch(() => false),
      ]);

      if (combinedLogExists) {
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

            // Filter by date range
            if (startDate && new Date(log.timestamp) < new Date(String(startDate))) return false;
            if (endDate && new Date(log.timestamp) > new Date(String(endDate))) return false;

            return true;
          });
      }

      // If no Winston logs, try PM2 logs
      if (logLines.length === 0) {
        try {
          const { stdout } = await execAsync(`pm2 logs --lines ${limit} --nostream --raw`);
          logLines = stdout.split('\n')
            .filter(line => line.trim())
            .map(line => ({
              timestamp: new Date().toISOString(),
              level: line.includes('error') || line.includes('ERROR') ? 'error' : 'info',
              message: line,
            }));
        } catch (pm2Error) {
          logger.warn('Could not read PM2 logs:', pm2Error);
        }
      }
    } catch (error) {
      logger.error('Error reading log files:', error);
    }

    res.json({
      logs: logLines.reverse(), // Most recent first
      total: logLines.length,
    });
  } catch (error) {
    logger.error('Get application logs error:', error);
    res.status(500).json({ error: 'Failed to fetch application logs' });
  }
});

/**
 * Get OAuth-specific logs (filtered view)
 */
router.get('/oauth', async (req: Request, res: Response) => {
  try {
    const { limit = 100, platform } = req.query;

    // Read recent log files and filter for OAuth entries
    const logsDir = path.join(process.cwd(), 'logs');
    const combinedLogPath = path.join(logsDir, 'combined.log');

    try {
      const logExists = await fs.access(combinedLogPath).then(() => true).catch(() => false);

      if (logExists) {
        const logContent = await fs.readFile(combinedLogPath, 'utf-8');
        const lines = logContent.split('\n').filter(line => line.trim());

        const oauthLogs = lines
          .slice(-Number(limit) * 2) // Read more to ensure we get enough OAuth logs
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
  } catch (error) {
    logger.error('Get OAuth logs error:', error);
    res.status(500).json({ error: 'Failed to fetch OAuth logs' });
  }
});

/**
 * Get system info and stats
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    const os = require('os');

    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      cpus: os.cpus().length,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      uptime: os.uptime(),
      nodeVersion: process.version,
      processUptime: process.uptime(),
      memoryUsage: process.memoryUsage(),
    };

    res.json(systemInfo);
  } catch (error) {
    logger.error('Get system info error:', error);
    res.status(500).json({ error: 'Failed to fetch system info' });
  }
});

/**
 * Clear logs (danger zone)
 */
router.delete('/application', async (req: Request, res: Response) => {
  try {
    const logsDir = path.join(process.cwd(), 'logs');

    // Clear Winston log files
    const files = ['error.log', 'combined.log'];

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      try {
        await fs.writeFile(filePath, '');
        logger.info(`Cleared log file: ${file}`);
      } catch (error) {
        logger.warn(`Could not clear log file ${file}:`, error);
      }
    }

    res.json({ message: 'Logs cleared successfully' });
  } catch (error) {
    logger.error('Clear logs error:', error);
    res.status(500).json({ error: 'Failed to clear logs' });
  }
});

/**
 * Download logs as a file
 */
router.get('/download', async (req: Request, res: Response) => {
  try {
    const { type = 'combined' } = req.query;
    const logsDir = path.join(process.cwd(), 'logs');
    const fileName = type === 'error' ? 'error.log' : 'combined.log';
    const filePath = path.join(logsDir, fileName);

    const fileExists = await fs.access(filePath).then(() => true).catch(() => false);

    if (fileExists) {
      res.download(filePath, `streamlick-${fileName}-${Date.now()}.log`);
    } else {
      res.status(404).json({ error: 'Log file not found' });
    }
  } catch (error) {
    logger.error('Download logs error:', error);
    res.status(500).json({ error: 'Failed to download logs' });
  }
});

export default router;
