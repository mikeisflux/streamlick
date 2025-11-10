import { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import api from '../services/api';

interface TestSuite {
  key: string;
  name: string;
  description: string;
  command: string;
}

interface TestResult {
  suite: string;
  success: boolean;
  passed: number;
  failed: number;
  total: number;
  duration: number;
  suites: number;
  output: string;
  timestamp: string;
  error?: string;
}

interface HealthCheck {
  status: string;
  checks: {
    database: boolean;
    redis: boolean;
    mediaServer: boolean;
  };
  timestamp: string;
}

export default function AdminTesting() {
  const [suites, setSuites] = useState<TestSuite[]>([]);
  const [running, setRunning] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, TestResult>>({});
  const [history, setHistory] = useState<TestResult[]>([]);
  const [health, setHealth] = useState<HealthCheck | null>(null);
  const [selectedSuite, setSelectedSuite] = useState<string | null>(null);
  const [expandedOutput, setExpandedOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTestSuites();
    loadTestHistory();
    checkSystemHealth();
  }, []);

  const loadTestSuites = async () => {
    try {
      const response = await api.get('/admin/testing/suites');
      setSuites(response.data);
      setLoading(false);
    } catch (error: any) {
      console.error('Failed to load test suites:', error);
      if (error.response?.status === 403) {
        toast.error('Admin access required');
      } else {
        toast.error('Failed to load test suites');
      }
      setLoading(false);
    }
  };

  const loadTestHistory = async () => {
    try {
      const response = await api.get('/admin/testing/history');
      setHistory(response.data);
    } catch (error) {
      console.error('Failed to load test history:', error);
    }
  };

  const checkSystemHealth = async () => {
    try {
      const response = await api.get('/admin/testing/health-check');
      setHealth(response.data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  };

  const runTest = async (suiteKey: string) => {
    setRunning(suiteKey);
    setSelectedSuite(suiteKey);
    toast.loading(`Running ${suiteKey} tests...`, { id: `test-${suiteKey}` });

    try {
      const response = await api.post(`/admin/testing/run/${suiteKey}`);
      const result = response.data;

      setResults(prev => ({
        ...prev,
        [suiteKey]: result,
      }));

      // Save to history
      await api.post('/admin/testing/history', {
        suite: suiteKey,
        success: result.success,
        passed: result.passed,
        failed: result.failed,
        total: result.total,
        duration: result.duration,
      });

      if (result.success) {
        toast.success(`✅ ${result.passed}/${result.total} tests passed!`, { id: `test-${suiteKey}` });
      } else {
        toast.error(`❌ ${result.failed}/${result.total} tests failed`, { id: `test-${suiteKey}` });
      }

      loadTestHistory();
    } catch (error: any) {
      console.error('Test execution failed:', error);
      toast.error('Test execution failed', { id: `test-${suiteKey}` });
    } finally {
      setRunning(null);
    }
  };

  const runAllTests = async () => {
    setRunning('all');
    setSelectedSuite('all');
    toast.loading('Running complete test suite...', { id: 'test-all' });

    try {
      const response = await api.post('/admin/testing/run-all');
      const result = response.data;

      setResults(prev => ({
        ...prev,
        all: result,
      }));

      await api.post('/admin/testing/history', {
        suite: 'all',
        success: result.success,
        passed: result.passed,
        failed: result.failed,
        total: result.total,
        duration: result.duration,
      });

      if (result.success) {
        toast.success(`✅ All tests passed! (${result.passed}/${result.total})`, { id: 'test-all' });
      } else {
        toast.error(`❌ Some tests failed (${result.failed}/${result.total})`, { id: 'test-all' });
      }

      loadTestHistory();
    } catch (error: any) {
      console.error('Test execution failed:', error);
      toast.error('Test execution failed', { id: 'test-all' });
    } finally {
      setRunning(null);
    }
  };

  const renderHealthStatus = () => {
    if (!health) return null;

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">System Health</h3>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-300">Overall Status</span>
            <span className={`px-3 py-1 rounded text-sm font-semibold ${
              health.status === 'healthy' ? 'bg-green-600 text-white' : 'bg-yellow-600 text-white'
            }`}>
              {health.status.toUpperCase()}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Database</span>
            <span className={`text-2xl ${health.checks.database ? 'text-green-500' : 'text-red-500'}`}>
              {health.checks.database ? '✅' : '❌'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Redis</span>
            <span className={`text-2xl ${health.checks.redis ? 'text-green-500' : 'text-red-500'}`}>
              {health.checks.redis ? '✅' : '❌'}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-gray-300">Media Server</span>
            <span className={`text-2xl ${health.checks.mediaServer ? 'text-green-500' : 'text-yellow-500'}`}>
              {health.checks.mediaServer ? '✅' : '⚠️'}
            </span>
          </div>

          <button
            onClick={checkSystemHealth}
            className="w-full mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Refresh Health Check
          </button>
        </div>
      </div>
    );
  };

  const renderTestSuite = (suite: TestSuite) => {
    const result = results[suite.key];
    const isRunning = running === suite.key;

    return (
      <div key={suite.key} className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-white">{suite.name}</h3>
            <p className="text-sm text-gray-400 mt-1">{suite.description}</p>
          </div>

          <button
            onClick={() => runTest(suite.key)}
            disabled={running !== null}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {isRunning ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Running...</span>
              </>
            ) : (
              <>
                <span>▶️</span>
                <span>Run Test</span>
              </>
            )}
          </button>
        </div>

        {result && (
          <div className="mt-4 pt-4 border-t border-gray-700">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400">Status</div>
                <div className={`text-lg font-semibold ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                  {result.success ? '✅ PASSED' : '❌ FAILED'}
                </div>
              </div>

              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400">Passed</div>
                <div className="text-lg font-semibold text-green-500">{result.passed}</div>
              </div>

              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400">Failed</div>
                <div className="text-lg font-semibold text-red-500">{result.failed}</div>
              </div>

              <div className="bg-gray-900 rounded p-3">
                <div className="text-xs text-gray-400">Duration</div>
                <div className="text-lg font-semibold text-white">{result.duration.toFixed(2)}s</div>
              </div>
            </div>

            <button
              onClick={() => setExpandedOutput(expandedOutput === suite.key ? null : suite.key)}
              className="text-sm text-blue-400 hover:text-blue-300"
            >
              {expandedOutput === suite.key ? '▼ Hide Output' : '▶ Show Output'}
            </button>

            {expandedOutput === suite.key && (
              <pre className="mt-3 bg-black rounded p-4 text-xs text-green-400 overflow-x-auto max-h-96 overflow-y-auto">
                {result.output}
              </pre>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderTestHistory = () => {
    if (history.length === 0) return null;

    return (
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <h3 className="text-xl font-semibold text-white mb-4">Recent Test Runs</h3>

        <div className="space-y-2">
          {history.slice(-10).reverse().map((run, idx) => (
            <div key={idx} className="bg-gray-900 rounded p-3 flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className={`text-2xl ${run.success ? 'text-green-500' : 'text-red-500'}`}>
                  {run.success ? '✅' : '❌'}
                </span>
                <div>
                  <div className="text-white font-medium">{run.suite}</div>
                  <div className="text-xs text-gray-400">
                    {new Date(run.timestamp).toLocaleString()}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-4 text-sm">
                <span className="text-green-400">{run.passed} passed</span>
                <span className="text-red-400">{run.failed} failed</span>
                <span className="text-gray-400">{run.duration.toFixed(2)}s</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen p-8 flex items-center justify-center">
        <div className="text-white text-xl">Loading test suites...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">🧪 Production Testing Dashboard</h1>
          <p className="text-gray-400">
            Run automated tests and monitor system health from the admin interface
          </p>
        </div>

        {/* System Health */}
        <div className="mb-8">
          {renderHealthStatus()}
        </div>

        {/* Run All Tests Button */}
        <div className="mb-8">
          <button
            onClick={runAllTests}
            disabled={running !== null}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg flex items-center justify-center space-x-3"
          >
            {running === 'all' ? (
              <>
                <span className="animate-spin">⏳</span>
                <span>Running Complete Test Suite...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Run All Tests with Coverage</span>
              </>
            )}
          </button>
        </div>

        {/* Individual Test Suites */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {suites.map(suite => renderTestSuite(suite))}
        </div>

        {/* Test History */}
        {renderTestHistory()}
      </div>
    </div>
  );
}
