import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
// CRITICAL FIX: Use centralized requireAdmin middleware instead of duplicate
import { authenticate, AuthRequest, requireAdmin } from '../auth/middleware';
import logger from '../utils/logger';

const execAsync = promisify(exec);
const router = Router();

// CRITICAL FIX: Removed duplicate requireAdmin - use centralized version
router.use(authenticate, requireAdmin);

// Test suite definitions
const TEST_SUITES = {
  unit: {
    name: 'Unit Tests',
    description: 'Run all unit tests (auth, broadcasts, destinations)',
    command: 'npm run test:unit',
  },
  integration: {
    name: 'Integration Tests',
    description: 'Run integration tests (WebRTC, participants, RTMP)',
    command: 'npm run test:integration',
  },
  e2e: {
    name: 'End-to-End Tests',
    description: 'Run full end-to-end test suite',
    command: 'npm run test:e2e',
  },
  all: {
    name: 'All Tests',
    description: 'Run complete test suite with coverage',
    command: 'npm run test:coverage',
  },
  auth: {
    name: 'Authentication Tests',
    description: 'Test authentication and authorization',
    command: 'npm test -- auth.test',
  },
  broadcasts: {
    name: 'Broadcast Tests',
    description: 'Test broadcast management',
    command: 'npm test -- broadcasts.test',
  },
  destinations: {
    name: 'Destination Tests',
    description: 'Test streaming destinations',
    command: 'npm test -- destinations.test',
  },
  webrtc: {
    name: 'WebRTC Tests',
    description: 'Test WebRTC and MediaSoup functionality',
    command: 'npm test -- webrtc.test',
  },
  participants: {
    name: 'Participant Tests',
    description: 'Test participant management',
    command: 'npm test -- participants.test',
  },
};

// Get list of available test suites
router.get('/suites', (req, res) => {
  const suites = Object.entries(TEST_SUITES).map(([key, value]) => ({
    key,
    ...value,
  }));
  res.json(suites);
});

// Run specific test suite
router.post('/run/:suite', async (req, res) => {
  try {
    const { suite } = req.params;

    if (!TEST_SUITES[suite as keyof typeof TEST_SUITES]) {
      return res.status(400).json({ error: 'Invalid test suite' });
    }

    const testConfig = TEST_SUITES[suite as keyof typeof TEST_SUITES];

    logger.info(`Running test suite: ${suite}`);

    // Run tests with timeout
    const { stdout, stderr } = await execAsync(testConfig.command, {
      cwd: path.join(__dirname, '../../'),
      timeout: 300000, // 5 minutes
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const output = stdout + stderr;

    // Parse test results
    const results = parseJestOutput(output);

    logger.info(`Test suite ${suite} completed: ${results.passed} passed, ${results.failed} failed`);

    res.json({
      suite,
      success: results.failed === 0,
      ...results,
      output,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Test execution error:', error);

    // Parse output even on failure
    const output = error.stdout + error.stderr;
    const results = parseJestOutput(output);

    res.status(200).json({
      suite: req.params.suite,
      success: false,
      ...results,
      output,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Run all tests
router.post('/run-all', async (req, res) => {
  try {
    logger.info('Running complete test suite');

    const { stdout, stderr } = await execAsync('npm run test:coverage', {
      cwd: path.join(__dirname, '../../'),
      timeout: 600000, // 10 minutes for full suite
      env: {
        ...process.env,
        NODE_ENV: 'test',
      },
    });

    const output = stdout + stderr;
    const results = parseJestOutput(output);

    // Try to read coverage report
    let coverage = null;
    try {
      const coveragePath = path.join(__dirname, '../../coverage/coverage-summary.json');
      const coverageData = await fs.readFile(coveragePath, 'utf-8');
      coverage = JSON.parse(coverageData);
    } catch (err) {
      logger.warn('Could not read coverage report:', err);
    }

    res.json({
      suite: 'all',
      success: results.failed === 0,
      ...results,
      coverage,
      output,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Full test suite error:', error);

    const output = error.stdout + error.stderr;
    const results = parseJestOutput(output);

    res.status(200).json({
      suite: 'all',
      success: false,
      ...results,
      output,
      error: error.message,
      timestamp: new Date().toISOString(),
    });
  }
});

// Get test coverage report
router.get('/coverage', async (req, res) => {
  try {
    const coveragePath = path.join(__dirname, '../../coverage/coverage-summary.json');
    const coverageData = await fs.readFile(coveragePath, 'utf-8');
    const coverage = JSON.parse(coverageData);

    res.json({
      total: coverage.total,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Error reading coverage:', error);
    res.status(404).json({ error: 'Coverage report not found. Run tests with coverage first.' });
  }
});

// Get test history (last 10 runs)
router.get('/history', async (req, res) => {
  try {
    const historyPath = path.join(__dirname, '../../test-history.json');

    try {
      const historyData = await fs.readFile(historyPath, 'utf-8');
      const history = JSON.parse(historyData);
      res.json(history.slice(-10)); // Last 10 runs
    } catch (err) {
      // No history yet
      res.json([]);
    }
  } catch (error: any) {
    logger.error('Error reading test history:', error);
    res.status(500).json({ error: 'Failed to read test history' });
  }
});

// Save test result to history
router.post('/history', async (req, res) => {
  try {
    const { suite, success, passed, failed, total, duration } = req.body;

    const historyPath = path.join(__dirname, '../../test-history.json');

    let history: any[] = [];
    try {
      const historyData = await fs.readFile(historyPath, 'utf-8');
      history = JSON.parse(historyData);
    } catch (err) {
      // No history yet
    }

    history.push({
      suite,
      success,
      passed,
      failed,
      total,
      duration,
      timestamp: new Date().toISOString(),
    });

    // Keep only last 100 runs
    if (history.length > 100) {
      history = history.slice(-100);
    }

    await fs.writeFile(historyPath, JSON.stringify(history, null, 2));

    res.json({ message: 'Test result saved to history' });
  } catch (error: any) {
    logger.error('Error saving test history:', error);
    res.status(500).json({ error: 'Failed to save test history' });
  }
});

// System health check (quick tests)
router.get('/health-check', async (req, res) => {
  try {
    const prisma = require('../database/prisma').default;

    const checks = {
      database: false,
      redis: false,
      mediaServer: false,
      timestamp: new Date().toISOString(),
    };

    // Database check
    try {
      await prisma.$queryRaw`SELECT 1`;
      checks.database = true;
    } catch (err) {
      logger.error('Database health check failed:', err);
    }

    // Redis check
    try {
      const redis = require('../database/redis').default;
      await redis.ping();
      checks.redis = true;
    } catch (err) {
      logger.error('Redis health check failed:', err);
    }

    // Media server check (if configured)
    try {
      const response = await fetch(`${process.env.MEDIA_SERVER_URL || 'http://localhost:3001'}/health`);
      checks.mediaServer = response.ok;
    } catch (err) {
      logger.warn('Media server health check failed:', err);
    }

    const allHealthy = checks.database && checks.redis;

    res.json({
      status: allHealthy ? 'healthy' : 'degraded',
      checks,
    });
  } catch (error: any) {
    logger.error('Health check error:', error);
    res.status(500).json({ error: 'Health check failed' });
  }
});

// Helper function to parse Jest output
function parseJestOutput(output: string): {
  passed: number;
  failed: number;
  total: number;
  duration: number;
  suites: number;
} {
  const results = {
    passed: 0,
    failed: 0,
    total: 0,
    duration: 0,
    suites: 0,
  };

  try {
    // Parse test results from Jest output
    const testMatch = output.match(/Tests:\s+(\d+)\s+failed,\s+(\d+)\s+passed,\s+(\d+)\s+total/);
    if (testMatch) {
      results.failed = parseInt(testMatch[1]);
      results.passed = parseInt(testMatch[2]);
      results.total = parseInt(testMatch[3]);
    } else {
      const passMatch = output.match(/Tests:\s+(\d+)\s+passed,\s+(\d+)\s+total/);
      if (passMatch) {
        results.passed = parseInt(passMatch[1]);
        results.total = parseInt(passMatch[2]);
      }
    }

    // Parse test suites
    const suitesMatch = output.match(/Test Suites:\s+.*?(\d+)\s+total/);
    if (suitesMatch) {
      results.suites = parseInt(suitesMatch[1]);
    }

    // Parse duration
    const durationMatch = output.match(/Time:\s+([\d.]+)\s*s/);
    if (durationMatch) {
      results.duration = parseFloat(durationMatch[1]);
    }
  } catch (err) {
    logger.warn('Error parsing test output:', err);
  }

  return results;
}

export default router;
